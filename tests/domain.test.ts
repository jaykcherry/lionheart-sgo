import { describe, it, expect } from 'vitest';
import {
  sizeMultiplier, resolveLimit, TN_LIMITS_SEED, determineEligibility, type EligibilityInput,
  unmetNeed, awardAmount, allocateRound, splitTerms, rankCandidates, type Candidate,
  routeGift, splitCouple, creditForYear, substantialContributors, screen,
  ninetyPercentTest, buildBatch, canRelease, refundDue, giftJournal, assertBalanced, reconcile,
  buildYearEnd, tieOut, applicationMachine, batchMachine, evaluate, blocked, dollars,
} from '../src/domain';

const table = { ...TN_LIMITS_SEED, areas: { ...TN_LIMITS_SEED.areas, TEST: { code: 'TEST', name: 'Test', medianIncome: dollars(100_000), fiscalYear: 2026, source: 'test' } }, countyToArea: { ...TN_LIMITS_SEED.countyToArea, testco: 'TEST' } };

describe('income limits', () => {
  it("matches Treasury's example: AMGI $100,000, household of 3 → $270,000", () => {
    expect(resolveLimit(table, 'Testco County', 3).limit).toBe(dollars(270_000));
  });
  it('Nashville FY2026, household of 4 → $348,300', () => {
    expect(resolveLimit(TN_LIMITS_SEED, 'Davidson', 4).limit).toBe(dollars(348_300));
  });
  it('extends the HUD multiplier by 8% per person over 8', () => {
    expect(sizeMultiplier(10)).toBeCloseTo(1.48);
  });
});

const baseApp = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  applicationDate: '2027-02-20', county: 'Davidson', state: 'TN', residencyProof: 'utility',
  household: [{ personId: 'p1', relationship: 'self', age: 40 }, { personId: 'p2', relationship: 'spouse', age: 39 }, { personId: 's1', relationship: 'child', age: 9 }, { personId: 's2', relationship: 'child', age: 6 }],
  incomeItems: [{ personId: 'p1', type: 'wages', amount: dollars(90_000), year: 2026, cash: true, source: 'w2' }, { personId: 'p2', type: 'wages', amount: dollars(30_000), year: 2026, cash: true, source: 'w2' }],
  zeroIncomeAttested: [], student: { grade: '3', age: 9 }, ...over,
});

describe('eligibility', () => {
  it('direct income: $120k for 4 in Davidson is ~103% AMGI → tier B, eligible', () => {
    const d = determineEligibility(baseApp(), TN_LIMITS_SEED);
    expect(d.result).toBe('ELIGIBLE');
    expect(d.tier).toBe('B');
    expect(d.pctAmgi).toBeCloseTo(120_000 / 116_100, 3);
  });
  it('categorical SNAP letter within 12 months → tier A without income math', () => {
    const d = determineEligibility(baseApp({ incomeItems: [], categorical: { program: 'SNAP', letterDate: '2026-09-01', nameMatchesHousehold: true } }), TN_LIMITS_SEED);
    expect(d.method).toBe('categorical'); expect(d.tier).toBe('A'); expect(d.result).toBe('ELIGIBLE');
  });
  it('Medicaid is not categorical: falls back to income', () => {
    const d = determineEligibility(baseApp({ categorical: { program: 'MEDICAID', letterDate: '2026-09-01', nameMatchesHousehold: true } }), TN_LIMITS_SEED);
    expect(d.method).toBe('direct_income');
  });
  it('an adult with no income evidence forces human review', () => {
    const d = determineEligibility(baseApp({ household: [...baseApp().household, { personId: 'gma', relationship: 'parent', age: 70 }] }), TN_LIMITS_SEED);
    expect(d.result).toBe('NEEDS_REVIEW');
  });
  it('over the limit is only a *proposed* denial', () => {
    const d = determineEligibility(baseApp({ incomeItems: [{ personId: 'p1', type: 'wages', amount: dollars(400_000), year: 2026, cash: true, source: 'w2' }], zeroIncomeAttested: ['p2'] }), TN_LIMITS_SEED);
    expect(d.result).toBe('INELIGIBLE_PROPOSED');
  });
  it('unknown county never denies; it goes to review', () => {
    const d = determineEligibility(baseApp({ county: 'Shelby', incomeItems: [{ personId: 'p1', type: 'wages', amount: dollars(300_000), year: 2026, cash: true, source: 'w2' }], zeroIncomeAttested: ['p2'] }), TN_LIMITS_SEED);
    expect(d.result).toBe('NEEDS_REVIEW');
  });
  it('non-TN residence is a proposed denial', () => {
    expect(determineEligibility(baseApp({ state: 'KY' }), TN_LIMITS_SEED).result).toBe('INELIGIBLE_PROPOSED');
  });
});

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  applicationId: id, studentId: 's-' + id, householdId: 'h-' + id, schoolId: 'cpa', tier: 'B', priority: 3,
  tuition: dollars(16_000), requiredFees: dollars(500), aid: { efs: dollars(7_530), schoolAid: 0, otherSgo: 0, other: 0 }, ...over,
});

describe('awards', () => {
  it('unmet need stacks after EFS', () => {
    expect(unmetNeed(dollars(16_000), dollars(500), { efs: dollars(7_530), schoolAid: dollars(1_000), otherSgo: 0, other: 0 })).toBe(dollars(7_970));
  });
  it('tier formula with caps and whole-dollar rounding', () => {
    expect(awardAmount('A', dollars(9_000))).toBe(dollars(8_000));  // 90% = 8,100 → cap 8,000
    expect(awardAmount('B', dollars(8_970))).toBe(dollars(5_000));  // 60% = 5,382 → cap 5,000
    expect(awardAmount('C', dollars(7_000))).toBe(dollars(2_100));
    expect(awardAmount('C', dollars(500))).toBe(0);                // below $250 minimum
  });
  it('splits terms with remainder on the last term', () => {
    expect(splitTerms(dollars(5_000) + 1).map((t) => t.amount)).toEqual([250_000, 250_001]);
  });
  it('ranks renewals, then siblings, then tier, then lottery — deterministically', () => {
    const r = rankCandidates([cand('x', { tier: 'A' }), cand('y', { priority: 1, tier: 'C' }), cand('z', { priority: 2 })], 'seed-1');
    expect(r.map((c) => c.applicationId)).toEqual(['y', 'z', 'x']);
    expect(rankCandidates([cand('a'), cand('b'), cand('c')], 's').map((c) => c.applicationId))
      .toEqual(rankCandidates([cand('c'), cand('b'), cand('a')], 's').map((c) => c.applicationId));
  });
  it('allocates cash-backed only and waitlists the rest in strict order', () => {
    const res = allocateRound({ roundId: 'R1', seed: 'abc', cashAvailable: dollars(12_000), candidates: [cand('1', { priority: 1 }), cand('2'), cand('3')] });
    expect(res.totals.awarded).toBe(dollars(10_000));
    expect(res.totals.waitlisted).toBe(1);
    expect(res.totals.cashRemaining).toBe(dollars(2_000));
  });
  it('holds are never funded', () => {
    const res = allocateRound({ roundId: 'R', seed: 's', cashAvailable: dollars(50_000), candidates: [cand('1', { hold: 'DQ match' })] });
    expect(res.lines[0]!.outcome).toBe('HELD');
  });
  it('school preference pools are honored only with ≥10 eligible applicants at that school', () => {
    const many = Array.from({ length: 10 }, (_, i) => cand('m' + i, { schoolId: 'big' }));
    const res = allocateRound({ roundId: 'R', seed: 's', cashAvailable: dollars(20_000),
      preferencePools: [{ schoolId: 'big', amount: dollars(10_000) }, { schoolId: 'tiny', amount: dollars(5_000) }],
      candidates: [...many, cand('t1', { schoolId: 'tiny' })] });
    expect(res.honoredPreferences).toEqual(['big']);
    expect(res.mergedPreferences).toEqual(['tiny']);
  });
});

describe('donor credit', () => {
  it('routes a designated $1,700 card gift to the segregated fund', () => {
    const r = routeGift({ donorType: 'individual', method: 'card', amount: dollars(1_700), chargeDate: '2027-01-01', designate: true, priorDesignatedThisYear: 0, excessTo: 'general' });
    expect(r.qualified).toBe(true); expect(r.lines).toEqual([{ fund: '25F-TN', amount: dollars(1_700), designated: true }]);
  });
  it('splits the excess over the cap to the general fund when asked', () => {
    const r = routeGift({ donorType: 'individual', method: 'card', amount: dollars(2_500), chargeDate: '2027-03-01', designate: true, priorDesignatedThisYear: 0, excessTo: 'general' });
    expect(r.creditEligible).toBe(dollars(1_700)); expect(r.deductibleExcess).toBe(dollars(800));
  });
  it('DAF, business, and 2026 gifts never enter the segregated fund', () => {
    for (const g of [{ donorType: 'daf' as const, method: 'daf' as const, chargeDate: '2027-02-01' }, { donorType: 'business' as const, method: 'card' as const, chargeDate: '2027-02-01' }, { donorType: 'individual' as const, method: 'card' as const, chargeDate: '2026-12-31' }]) {
      const r = routeGift({ ...g, amount: dollars(1_000), designate: true, priorDesignatedThisYear: 0, excessTo: 'general' });
      expect(r.qualified).toBe(false); expect(r.lines[0]!.fund).toBe('general');
    }
  });
  it('splits a couple’s $3,400 into two $1,700 gifts', () => { expect(splitCouple(dollars(3_400))).toEqual([dollars(1_700), dollars(1_700)]); });
  it('caps the credit at $1,700 per person per year', () => { expect(creditForYear([dollars(1_000), dollars(1_000)]).credit).toBe(dollars(1_700)); });
});

describe('disqualified persons', () => {
  it('substantial contributor needs > $5,000 AND > 2%', () => {
    const totals = [{ householdKey: 'big', personIds: [], amount: dollars(6_000) }, { householdKey: 'mid', personIds: [], amount: dollars(5_000) }, ...Array.from({ length: 20 }, (_, i) => ({ householdKey: 'd' + i, personIds: [], amount: dollars(3_400) }))];
    expect(substantialContributors(totals)).toEqual(['big']);
  });
  it('flags a board member’s grandchild by address', () => {
    const m = screen([{ personId: 'kid', fullName: 'Ava Brooks', address: '12 Oak Street' }], [{ personId: 'b1', fullName: 'Tom Brooks', address: '12 Oak St.', role: 'director', year: 2027 }], [], 2027);
    expect(m[0]?.strength).toBe('strong');
  });
  it('substantial-contributor status carries into the next year', () => {
    const m = screen([{ personId: 'x', fullName: 'Ann Lee', dob: '2015-01-01' }], [{ personId: 'd', fullName: 'Ann Lee', dob: '2015-01-01', role: 'substantial_contributor', year: 2027 }], [], 2028);
    expect(m).toHaveLength(1);
  });
});

describe('90% test', () => {
  it('FIFO attributes payments to the oldest year first', () => {
    const s = ninetyPercentTest([{ year: 2027, contributions: dollars(100_000), earnings: 0, refunds: 0 }, { year: 2028, contributions: dollars(100_000), earnings: 0, refunds: 0 }],
      [{ date: '2027-08-20', amount: dollars(50_000) }, { date: '2028-01-20', amount: dollars(60_000) }], '2028-06-01');
    expect(s[0]!.spent).toBe(dollars(100_000)); expect(s[0]!.status).toBe('on_track');
    expect(s[1]!.spent).toBe(dollars(10_000));
  });
  it('fails a year that misses its deadline', () => {
    const s = ninetyPercentTest([{ year: 2027, contributions: dollars(100_000), earnings: 0, refunds: 0 }], [{ date: '2028-08-20', amount: dollars(80_000) }], '2029-01-02');
    expect(s[0]!.status).toBe('failed'); expect(s[0]!.shortfall).toBe(dollars(10_000));
  });
});

describe('disbursement', () => {
  const awards = [{ awardId: 'a1', studentId: 's1', schoolId: 'cpa', term: 'fall', amount: dollars(2_500) }, { awardId: 'a2', studentId: 's2', schoolId: 'ncs', term: 'fall', amount: dollars(2_500) }];
  it('blocks lines missing enrollment confirmation or a verified payee', () => {
    const b = buildBatch('B1', 'fall', awards, { a1: { enrollmentConfirmed: true, residencyReattested: true }, a2: { enrollmentConfirmed: false, residencyReattested: true } },
      { cpa: { schoolId: 'cpa', verified: true, callbackConfirmed: true }, ncs: { schoolId: 'ncs', verified: true, callbackConfirmed: true } }, '2027-08-15', dollars(100_000));
    expect(b.readyTotal).toBe(dollars(2_500)); expect(b.lines[1]!.blockers).toContain('School has not confirmed enrollment');
  });
  it('blocks a recently changed bank account until a callback is confirmed', () => {
    const b = buildBatch('B1', 'fall', awards.slice(0, 1), { a1: { enrollmentConfirmed: true, residencyReattested: true } },
      { cpa: { schoolId: 'cpa', verified: true, changedAt: '2027-08-12', callbackConfirmed: false } }, '2027-08-15', dollars(100_000));
    expect(b.lines[0]!.status).toBe('BLOCKED');
  });
  it('needs two approvers other than the preparer', () => {
    expect(canRelease([{ userId: 'job', at: '' }, { userId: 'ann', at: '' }], 'job').ok).toBe(false);
    expect(canRelease([{ userId: 'ann', at: '' }, { userId: 'bob', at: '' }], 'job').ok).toBe(true);
  });
  it('prorates refunds by days enrolled', () => { expect(refundDue(dollars(2_500), 45, 90)).toBe(dollars(1_250)); });
});

describe('ledger & reconciliation', () => {
  it('rejects unbalanced journals', () => {
    expect(() => assertBalanced({ id: 'j', date: '', kind: 'gift', ref: '', postings: [{ fund: '25F-TN', account: 'cash', amount: 100 }] })).toThrow();
    expect(() => assertBalanced(giftJournal('j', '2027-01-01', 'ch_1', [{ fund: '25F-TN', amount: 170_000 }]))).not.toThrow();
  });
  it('catches a missing fee top-up and an unexplained deposit', () => {
    const f = reconcile([{ ref: 'ch_1', date: '2027-01-02', gross: 170_000, fee: 3_770, net: 166_230, fund: '25F-TN' }],
      [{ id: 'b1', date: '2027-01-03', account: 'segregated', amount: 166_230, memo: 'Stripe payout', ref: 'ch_1' }, { id: 'b2', date: '2027-01-03', account: 'segregated', amount: 50_000, memo: 'Wire from ACME LLC' }],
      [giftJournal('j1', '2027-01-01', 'ch_1', [{ fund: '25F-TN', amount: 170_000 }])]);
    expect(f.map((x) => x.code).sort()).toEqual(['FEE_NOT_TOPPED_UP', 'SEGREGATED_PURITY']);
  });
});

describe('year-end documents', () => {
  it('builds acknowledgments and an IRS report that tie out', () => {
    const { acks, rows } = buildYearEnd(2027, '00-0000000',
      [{ donorId: 'd1', legalName: 'Jane Doe', address: 'x', email: 'j@x', eDeliveryConsent: true }, { donorId: 'd2', legalName: 'John Doe', address: 'x', email: 'jd@x', eDeliveryConsent: false }],
      [{ giftId: 'g1', donorId: 'd1', date: '2027-01-01', amount: 170_000 }, { giftId: 'g2', donorId: 'd2', date: '2027-01-01', amount: 170_000 }, { giftId: 'g3', donorId: 'd2', date: '2028-01-01', amount: 1 }]);
    expect(acks).toHaveLength(2); expect(acks[1]!.delivery).toBe('mail');
    expect(tieOut(acks, rows, 340_000).ok).toBe(true);
    expect(tieOut(acks, rows, 339_999).ok).toBe(false);
  });
});

describe('state machines', () => {
  it('agents cannot deny or approve exceptions', () => {
    expect(applicationMachine.can('NEEDS_REVIEW', 'DENIED', { kind: 'agent', id: 'doc-agent' }).ok).toBe(false);
    expect(applicationMachine.can('NEEDS_REVIEW', 'DENIED', { kind: 'person', id: 'u1', role: 'staff' }).ok).toBe(true);
  });
  it('payments cannot skip school confirmation', () => {
    expect(applicationMachine.can('ACCEPTED', 'ACTIVE', { kind: 'job', id: 'x' }).ok).toBe(false);
  });
  it('batches need a board approver second', () => {
    expect(batchMachine.can('APPROVED_1', 'APPROVED_2', { kind: 'person', id: 'u', role: 'staff' }).ok).toBe(false);
  });
});

describe('compliance monitor', () => {
  it('blocks disbursement when bank ≠ ledger', () => {
    const f = evaluate({ asOf: '2027-08-01', ninety: [], recon: [], awardedStudents: [], segregatedBankBalance: 100, segregatedLedgerBalance: 101,
      acknowledgmentsQueued: { year: 2027, donorsWithGifts: 0, queued: 0 }, deadlines: [], openHolds: 0, dqMatchesUnreviewed: 0, exceptionTicketsOverSla: 0 });
    expect(blocked(f, 'disbursement')).toBe(true);
  });
});

describe('substantial contributor share test', () => {
  it('a $6,000 donor is not substantial when gifts total $351,000 (2% = $7,020)', () => {
    const totals = [{ householdKey: 'big', personIds: [], amount: dollars(6_000) }, ...Array.from({ length: 101 }, (_, i) => ({ householdKey: 'd' + i, personIds: [], amount: dollars(3_415) }))];
    expect(substantialContributors(totals)).toEqual([]);
  });
});
