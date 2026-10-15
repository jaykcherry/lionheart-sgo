import type { Cents } from './money';
import { roundDollar, sum } from './money';
import type { NeedTier } from './eligibility';

/**
 * Award engine. Selection is mechanical (formula + published-seed lottery) so that no human
 * "participates in the selection of scholarship recipients" for ordinary cases, which keeps the
 * disqualified-person group (prop. Treas. Reg. §1.25F-3(d)) small. Board approves parameters
 * and each round's summary; exceptions go to a 2–3 person committee.
 */

export interface TierRule { pctOfUnmet: number; capPerStudent: Cents }
export interface AwardPolicy {
  version: string;
  tiers: Record<NeedTier, TierRule>;
  minimumAward: Cents;               // awards below this are not issued
  terms: { id: string; share: number }[];   // e.g. fall 0.5, spring 0.5
  strictOrder: boolean;               // if true, never skip a higher-priority student to fund a lower one
  schoolPreference: { enabled: boolean; minEligibleApplicants: number };
}

export const DEFAULT_POLICY: AwardPolicy = {
  version: '2027-28-v1',
  tiers: {
    A: { pctOfUnmet: 0.9, capPerStudent: 800_000 },
    B: { pctOfUnmet: 0.6, capPerStudent: 500_000 },
    C: { pctOfUnmet: 0.3, capPerStudent: 250_000 },
  },
  minimumAward: 25_000,
  terms: [{ id: 'fall', share: 0.5 }, { id: 'spring', share: 0.5 }],
  strictOrder: true,
  schoolPreference: { enabled: true, minEligibleApplicants: 10 },
};

export interface OtherAid { efs: Cents; schoolAid: Cents; otherSgo: Cents; other: Cents }

/** Unmet need = tuition + required fees − every other source (EFS first; §25F duplicate-funding rule). */
export function unmetNeed(tuition: Cents, requiredFees: Cents, aid: OtherAid): Cents {
  return Math.max(0, tuition + requiredFees - aid.efs - aid.schoolAid - aid.otherSgo - aid.other);
}

export function awardAmount(tier: NeedTier, unmet: Cents, policy: AwardPolicy = DEFAULT_POLICY): Cents {
  const rule = policy.tiers[tier];
  const raw = Math.min(Math.round(unmet * rule.pctOfUnmet), rule.capPerStudent, unmet);
  const amt = roundDollar(raw);
  return amt < policy.minimumAward ? 0 : amt;
}

export function splitTerms(amount: Cents, policy: AwardPolicy = DEFAULT_POLICY): { term: string; amount: Cents }[] {
  const out = policy.terms.map((t) => ({ term: t.id, amount: Math.floor((amount * t.share) / 100) * 100 })); // whole dollars
  out[out.length - 1]!.amount += amount - sum(out.map((o) => o.amount)); // remainder to last term
  return out;
}

// ── Priority & lottery ──────────────────────────────────────────────────────

export type PriorityClass = 1 | 2 | 3; // 1 renewal, 2 sibling of a recipient, 3 new
export const TIER_RANK: Record<NeedTier, number> = { A: 0, B: 1, C: 2 };

/** FNV-1a 32-bit hash. Deterministic across runtimes. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Lottery number for an applicant given the round's published seed. */
export const lotteryNumber = (seed: string, applicantId: string): number => hash32(`${seed}:${applicantId}`);

export interface Candidate {
  applicationId: string;
  studentId: string;
  householdId: string;
  schoolId: string;
  tier: NeedTier;
  priority: PriorityClass;
  tuition: Cents;
  requiredFees: Cents;
  aid: OtherAid;
  hold?: string;   // non-empty → skipped and sent to review (DQ hit, fraud flag, conflict)
}

export function rankCandidates(cands: Candidate[], seed: string): Candidate[] {
  return [...cands].sort((a, b) =>
    a.priority - b.priority ||
    TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
    lotteryNumber(seed, a.applicationId) - lotteryNumber(seed, b.applicationId) ||
    a.applicationId.localeCompare(b.applicationId));
}

// ── Allocation ──────────────────────────────────────────────────────────────

export interface PreferencePool { schoolId: string; amount: Cents }

export interface AllocationInput {
  roundId: string;
  seed: string;                // published to the board before the run
  cashAvailable: Cents;         // segregated-account cash not already committed (cash-backed only)
  preferencePools?: PreferencePool[]; // non-binding donor school preferences, already netted into cashAvailable
  candidates: Candidate[];
  policy?: AwardPolicy;
}

export type Outcome = 'AWARDED' | 'WAITLISTED' | 'NO_AWARD' | 'HELD';
export interface AllocationLine {
  rank: number;
  applicationId: string;
  studentId: string;
  schoolId: string;
  tier: NeedTier;
  priority: PriorityClass;
  lottery: number;
  unmet: Cents;
  amount: Cents;
  terms: { term: string; amount: Cents }[];
  fundedFrom: { pool: 'general' | string; amount: Cents }[];
  outcome: Outcome;
  note?: string;
}

export interface AllocationResult {
  roundId: string;
  seed: string;
  policyVersion: string;
  lines: AllocationLine[];
  totals: { awarded: Cents; students: number; schools: number; waitlisted: number; held: number; cashRemaining: Cents };
  honoredPreferences: string[];   // schools whose preference pools were honored
  mergedPreferences: string[];    // schools whose pools fell back to general (too few eligible applicants)
}

export function allocateRound(input: AllocationInput): AllocationResult {
  const policy = input.policy ?? DEFAULT_POLICY;
  const ranked = rankCandidates(input.candidates, input.seed);

  // Preference pools are honored only where the school has enough eligible applicants this round,
  // so a preference can never become a de-facto earmark for one child.
  const eligibleBySchool = new Map<string, number>();
  for (const c of input.candidates) if (!c.hold) eligibleBySchool.set(c.schoolId, (eligibleBySchool.get(c.schoolId) ?? 0) + 1);
  const pools = new Map<string, Cents>();
  const honored: string[] = []; const merged: string[] = [];
  let prefTotal = 0;
  for (const p of input.preferencePools ?? []) {
    prefTotal += p.amount;
    if (policy.schoolPreference.enabled && (eligibleBySchool.get(p.schoolId) ?? 0) >= policy.schoolPreference.minEligibleApplicants) {
      pools.set(p.schoolId, (pools.get(p.schoolId) ?? 0) + p.amount); honored.push(p.schoolId);
    } else merged.push(p.schoolId);
  }
  if (prefTotal > input.cashAvailable) throw new Error('preference pools exceed available cash');
  let general = input.cashAvailable - sum([...pools.values()]);

  const lines: AllocationLine[] = [];
  let blockedGeneral = false; // strict order: once general cash can't cover someone, later students can't jump ahead on general cash
  ranked.forEach((c, i) => {
    const unmet = unmetNeed(c.tuition, c.requiredFees, c.aid);
    const amount = awardAmount(c.tier, unmet, policy);
    const base = { rank: i + 1, applicationId: c.applicationId, studentId: c.studentId, schoolId: c.schoolId, tier: c.tier,
      priority: c.priority, lottery: lotteryNumber(input.seed, c.applicationId), unmet, amount, terms: [] as AllocationLine['terms'], fundedFrom: [] as AllocationLine['fundedFrom'] };
    if (c.hold) { lines.push({ ...base, amount: 0, outcome: 'HELD', note: c.hold }); return; }
    if (amount === 0) { lines.push({ ...base, outcome: 'NO_AWARD', note: unmet === 0 ? 'No unmet need after other aid.' : 'Below minimum award.' }); return; }

    const fromPool = Math.min(pools.get(c.schoolId) ?? 0, amount);
    const needGeneral = amount - fromPool;
    const generalOk = needGeneral === 0 || (!blockedGeneral && general >= needGeneral);
    if (!generalOk) {
      if (policy.strictOrder && needGeneral > 0) blockedGeneral = true;
      lines.push({ ...base, outcome: 'WAITLISTED', note: 'Insufficient cash on hand; offered automatically as gifts arrive.' });
      return;
    }
    if (fromPool) pools.set(c.schoolId, (pools.get(c.schoolId) ?? 0) - fromPool);
    general -= needGeneral;
    const fundedFrom = [
      ...(fromPool ? [{ pool: c.schoolId, amount: fromPool }] : []),
      ...(needGeneral ? [{ pool: 'general' as const, amount: needGeneral }] : []),
    ];
    lines.push({ ...base, terms: splitTerms(amount, policy), fundedFrom, outcome: 'AWARDED' });
  });

  // Unused preference money returns to the general pool for the next round.
  const awarded = lines.filter((l) => l.outcome === 'AWARDED');
  return {
    roundId: input.roundId, seed: input.seed, policyVersion: policy.version, lines,
    totals: {
      awarded: sum(awarded.map((l) => l.amount)),
      students: awarded.length,
      schools: new Set(awarded.map((l) => l.schoolId)).size,
      waitlisted: lines.filter((l) => l.outcome === 'WAITLISTED').length,
      held: lines.filter((l) => l.outcome === 'HELD').length,
      cashRemaining: general + sum([...pools.values()]),
    },
    honoredPreferences: honored, mergedPreferences: merged,
  };
}
