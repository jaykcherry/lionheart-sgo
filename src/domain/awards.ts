import type { Cents } from './money';
import { roundDollar, sum } from './money';
import type { NeedTier } from './eligibility';

/**
 * Award engine. Selection is mechanical (formula + published-seed lottery) so that no human
 * "participates in the selection of scholarship recipients" for ordinary cases, which keeps the
 * disqualified-person group (prop. Treas. Reg. §1.25F-3(d)) small. Board approves parameters
 * and each round's summary; exceptions go to a 2–3 person committee.
 */

/**
 * Policy v2: lowest income first.
 *  - Need Index (NI) = household income ÷ size-adjusted area median (the same number the §25F
 *    300% test uses). SNAP/TANF/WIC/Section 8/SSI and foster placements get `categoricalNeedIndex`.
 *  - Ranking: statutory priority class (renewal, sibling, new) → NI band (lowest first) → lottery.
 *  - Award: a sliding share of unmet need and a sliding cap, both interpolated from `schedule`.
 *  - Funding: `floor_then_topup` gives every ranked student a floor award before anyone is
 *    topped up (breadth), still in rank order; `waterfall` funds full awards strictly in rank order.
 */
export interface SchedulePoint { needIndex: number; pctOfUnmet: number; cap: Cents }
export type FundingMode = 'waterfall' | 'floor_then_topup';
export interface AwardPolicy {
  version: string;
  schedule: SchedulePoint[];          // sorted by needIndex; linear between points, flat past the ends
  categoricalNeedIndex: number;       // NI assigned to categorical/foster eligibility (no income math)
  rankBandWidth: number;              // NI is grouped into bands this wide for ranking; lottery breaks ties inside a band
  funding: { mode: FundingMode; floor: Cents; allowPartial: boolean };
  householdCap: Cents | null;         // optional cap on total awards to one household in a round
  minimumAward: Cents;                // awards below this are not issued
  terms: { id: string; share: number }[];   // e.g. fall 0.5, spring 0.5
  strictOrder: boolean;               // never skip a higher-ranked student to fund a lower-ranked one
  schoolPreference: { enabled: boolean; minEligibleApplicants: number };
}

export const DEFAULT_POLICY: AwardPolicy = {
  version: '2027-28-v2',
  schedule: [
    { needIndex: 0, pctOfUnmet: 0.95, cap: 900_000 },
    { needIndex: 1, pctOfUnmet: 0.85, cap: 800_000 },
    { needIndex: 2, pctOfUnmet: 0.55, cap: 500_000 },
    { needIndex: 3, pctOfUnmet: 0.25, cap: 250_000 },
  ],
  categoricalNeedIndex: 0,
  rankBandWidth: 0.05,
  funding: { mode: 'floor_then_topup', floor: 100_000, allowPartial: true },
  householdCap: null,
  minimumAward: 50_000,
  terms: [{ id: 'fall', share: 0.5 }, { id: 'spring', share: 0.5 }],
  strictOrder: true,
  schoolPreference: { enabled: true, minEligibleApplicants: 10 },
};

/** Fills gaps in stored params (older rows, partial board edits) from the defaults. */
export function normalizePolicy(params: Partial<AwardPolicy> & Record<string, unknown>, version?: string): AwardPolicy {
  const p = { ...DEFAULT_POLICY, ...params, funding: { ...DEFAULT_POLICY.funding, ...(params.funding ?? {}) },
    schoolPreference: { ...DEFAULT_POLICY.schoolPreference, ...(params.schoolPreference ?? {}) } } as AwardPolicy;
  if (!Array.isArray(p.schedule) || !p.schedule.length) p.schedule = DEFAULT_POLICY.schedule;
  p.schedule = [...p.schedule].sort((a, b) => a.needIndex - b.needIndex);
  if (version) p.version = version;
  return p;
}

export interface OtherAid { efs: Cents; schoolAid: Cents; otherSgo: Cents; other: Cents }

/** Unmet need = tuition + required fees − every other source (EFS first; §25F duplicate-funding rule). */
export function unmetNeed(tuition: Cents, requiredFees: Cents, aid: OtherAid): Cents {
  return Math.max(0, tuition + requiredFees - aid.efs - aid.schoolAid - aid.otherSgo - aid.other);
}

/** Need Index for a determination: categorical/foster → policy value; otherwise income ÷ adjusted AMGI. */
export function needIndexOf(det: { method: string | null; pctAmgi: number | null }, policy: AwardPolicy = DEFAULT_POLICY): number | null {
  if (det.method === 'categorical' || det.method === 'foster') return policy.categoricalNeedIndex;
  return det.pctAmgi == null ? null : Math.max(0, det.pctAmgi);
}

/** Display label only (A ≤100% of area median, B ≤200%, C ≤300%). Ranking and amounts use the continuous NI. */
export function tierLabel(needIndex: number): NeedTier { return needIndex <= 1 ? 'A' : needIndex <= 2 ? 'B' : 'C'; }

export function needBand(needIndex: number, policy: AwardPolicy = DEFAULT_POLICY): number {
  const w = policy.rankBandWidth > 0 ? policy.rankBandWidth : 1e-9;
  return Math.floor(needIndex / w + 1e-9);
}

function interp(needIndex: number, key: 'pctOfUnmet' | 'cap', policy: AwardPolicy): number {
  const pts = policy.schedule;
  if (needIndex <= pts[0]!.needIndex) return pts[0]![key];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (needIndex <= b.needIndex) {
      const t = b.needIndex === a.needIndex ? 1 : (needIndex - a.needIndex) / (b.needIndex - a.needIndex);
      return a[key] + (b[key] - a[key]) * t;
    }
  }
  return pts[pts.length - 1]![key];
}
/** Share of unmet need covered at this NI (0–1, four decimals). */
export const coverageFor = (needIndex: number, policy: AwardPolicy = DEFAULT_POLICY): number =>
  Math.round(interp(needIndex, 'pctOfUnmet', policy) * 10_000) / 10_000;
/** Per-student cap at this NI, whole dollars. */
export const capFor = (needIndex: number, policy: AwardPolicy = DEFAULT_POLICY): Cents => roundDollar(interp(needIndex, 'cap', policy));

/** Full award for one student: min(unmet × coverage, cap, unmet), whole dollars; 0 if under the minimum. */
export function awardAmount(needIndex: number, unmet: Cents, policy: AwardPolicy = DEFAULT_POLICY): Cents {
  const raw = Math.min(Math.round(unmet * coverageFor(needIndex, policy)), capFor(needIndex, policy), unmet);
  const amt = roundDollar(raw);
  return amt < policy.minimumAward ? 0 : amt;
}

/** Step-by-step explanation of one award (calculator, family letter, audit). */
export function explainAward(needIndex: number, tuition: Cents, requiredFees: Cents, aid: OtherAid, policy: AwardPolicy = DEFAULT_POLICY) {
  const unmet = unmetNeed(tuition, requiredFees, aid);
  const coverage = coverageFor(needIndex, policy);
  const cap = capFor(needIndex, policy);
  const byShare = roundDollar(Math.round(unmet * coverage));
  const amount = awardAmount(needIndex, unmet, policy);
  const limitedBy: 'share' | 'cap' | 'unmet' | 'minimum' | 'none' =
    unmet === 0 ? 'none' : amount === 0 ? 'minimum' : byShare > cap ? 'cap' : byShare >= unmet ? 'unmet' : 'share';
  return { needIndex, tier: tierLabel(needIndex), band: needBand(needIndex, policy), cost: tuition + requiredFees, unmet, coverage, cap, byShare, amount, limitedBy,
    familyShare: Math.max(0, unmet - amount), floorPart: Math.min(amount, policy.funding.floor) };
}

export function splitTerms(amount: Cents, policy: AwardPolicy = DEFAULT_POLICY): { term: string; amount: Cents }[] {
  const out = policy.terms.map((t) => ({ term: t.id, amount: Math.floor((amount * t.share) / 100) * 100 })); // whole dollars
  out[out.length - 1]!.amount += amount - sum(out.map((o) => o.amount)); // remainder to last term
  return out;
}

// ── Priority & lottery ──────────────────────────────────────────────────────

export type PriorityClass = 1 | 2 | 3; // 1 renewal, 2 sibling of a recipient, 3 new

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
  needIndex: number;      // income ÷ size-adjusted AMGI (categorical/foster → policy.categoricalNeedIndex)
  priority: PriorityClass;
  tuition: Cents;
  requiredFees: Cents;
  aid: OtherAid;
  hold?: string;   // non-empty → skipped and sent to review (DQ hit, fraud flag, conflict)
}

/** Statutory priority class → need band (lowest income first) → published-seed lottery. */
export function rankCandidates(cands: Candidate[], seed: string, policy: AwardPolicy = DEFAULT_POLICY): Candidate[] {
  return [...cands].sort((a, b) =>
    a.priority - b.priority ||
    needBand(a.needIndex, policy) - needBand(b.needIndex, policy) ||
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
  householdId: string;
  schoolId: string;
  needIndex: number;
  band: number;
  tier: NeedTier;              // display label
  priority: PriorityClass;
  lottery: number;
  unmet: Cents;
  fullAmount: Cents;           // what the formula calls for
  amount: Cents;               // what this round funds (≤ fullAmount)
  shortfall: Cents;            // fullAmount − amount; topped up in rank order as gifts arrive
  partial: boolean;
  terms: { term: string; amount: Cents }[];
  fundedFrom: { pool: 'general' | string; amount: Cents }[];
  outcome: Outcome;
  note?: string;
}

export interface AllocationResult {
  roundId: string;
  seed: string;
  policyVersion: string;
  mode: FundingMode;
  lines: AllocationLine[];
  totals: {
    awarded: Cents; students: number; schools: number; partial: number; waitlisted: number; held: number; noAward: number;
    cashRemaining: Cents; fullNeed: Cents; shortfall: Cents; meetsBreadthRule: boolean;
  };
  honoredPreferences: string[];   // schools whose preference pools were honored
  mergedPreferences: string[];    // schools whose pools fell back to general (too few eligible applicants)
}

export function allocateRound(input: AllocationInput): AllocationResult {
  const policy = input.policy ?? DEFAULT_POLICY;
  const ranked = rankCandidates(input.candidates, input.seed, policy);

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
      pools.set(p.schoolId, (pools.get(p.schoolId) ?? 0) + p.amount); if (!honored.includes(p.schoolId)) honored.push(p.schoolId);
    } else if (!merged.includes(p.schoolId)) merged.push(p.schoolId);
  }
  if (prefTotal > input.cashAvailable) throw new Error('preference pools exceed available cash');
  let general = input.cashAvailable - sum([...pools.values()]);

  // Full award per student (household cap applied in rank order).
  const householdUsed = new Map<string, Cents>();
  const st = ranked.map((c, i) => {
    const unmet = unmetNeed(c.tuition, c.requiredFees, c.aid);
    let full = c.hold ? 0 : awardAmount(c.needIndex, unmet, policy);
    let note: string | undefined;
    if (full && policy.householdCap != null) {
      const left = Math.max(0, policy.householdCap - (householdUsed.get(c.householdId) ?? 0));
      if (left < full) { full = left >= policy.minimumAward ? roundDollar(left) : 0; note = 'Household cap reached.'; }
      householdUsed.set(c.householdId, (householdUsed.get(c.householdId) ?? 0) + full);
    }
    return { c, rank: i + 1, unmet, full, granted: 0, from: new Map<string, Cents>(), note };
  });

  type S = typeof st[number];
  // One pass in rank order: give each student up to `want(s)` more, school pool first, then general.
  const pass = (want: (s: S) => Cents) => {
    let blocked = false;
    for (const s of st) {
      if (s.c.hold || !s.full) continue;
      const need = Math.min(want(s), s.full - s.granted);
      if (need <= 0) continue;
      const fromPool = Math.min(pools.get(s.c.schoolId) ?? 0, need);
      const rest = need - fromPool;
      let fromGen = 0;
      if (rest > 0) {
        if (!blocked && general >= rest) fromGen = rest;
        else {
          if (!policy.funding.allowPartial) { if (policy.strictOrder) blocked = true; continue; }
          if (!blocked) fromGen = general;
          if (policy.strictOrder) blocked = true;
        }
      }
      if (fromPool) { pools.set(s.c.schoolId, (pools.get(s.c.schoolId) ?? 0) - fromPool); s.from.set(s.c.schoolId, (s.from.get(s.c.schoolId) ?? 0) + fromPool); }
      if (fromGen) { general -= fromGen; s.from.set('general', (s.from.get('general') ?? 0) + fromGen); }
      s.granted += fromPool + fromGen;
    }
  };

  if (policy.funding.mode === 'floor_then_topup') pass(() => Math.max(policy.funding.floor, policy.minimumAward));
  pass((s) => s.full);
  // Preference money a school's students couldn't use goes to the general list in the same round.
  general += sum([...pools.values()]); pools.clear();
  pass((s) => s.full);
  // A boundary student left under the minimum is returned to the waitlist.
  for (const s of st) if (s.granted > 0 && s.granted < policy.minimumAward && s.granted < s.full) {
    general += s.granted; s.granted = 0; s.from.clear();
  }

  const lines: AllocationLine[] = st.map((s) => {
    const c = s.c;
    const base = { rank: s.rank, applicationId: c.applicationId, studentId: c.studentId, householdId: c.householdId, schoolId: c.schoolId,
      needIndex: c.needIndex, band: needBand(c.needIndex, policy), tier: tierLabel(c.needIndex), priority: c.priority,
      lottery: lotteryNumber(input.seed, c.applicationId), unmet: s.unmet, fullAmount: s.full, amount: s.granted,
      shortfall: s.full - s.granted, partial: s.granted > 0 && s.granted < s.full,
      terms: [] as AllocationLine['terms'], fundedFrom: [...s.from.entries()].map(([pool, amount]) => ({ pool, amount })) };
    if (c.hold) return { ...base, fullAmount: 0, amount: 0, shortfall: 0, outcome: 'HELD' as const, note: c.hold };
    if (!s.full) return { ...base, outcome: 'NO_AWARD' as const, note: s.note ?? (s.unmet === 0 ? 'No unmet need after other aid.' : 'Below minimum award.') };
    if (!s.granted) return { ...base, outcome: 'WAITLISTED' as const, note: 'Insufficient cash on hand; offered automatically, in rank order, as gifts arrive.' };
    return { ...base, terms: splitTerms(s.granted, policy), outcome: 'AWARDED' as const,
      note: base.partial ? `Partial award; ${(base.shortfall / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} more as gifts arrive.` : s.note };
  });

  const awarded = lines.filter((l) => l.outcome === 'AWARDED');
  const students = awarded.length; const schools = new Set(awarded.map((l) => l.schoolId)).size;
  return {
    roundId: input.roundId, seed: input.seed, policyVersion: policy.version, mode: policy.funding.mode, lines,
    totals: {
      awarded: sum(awarded.map((l) => l.amount)), students, schools,
      partial: awarded.filter((l) => l.partial).length,
      waitlisted: lines.filter((l) => l.outcome === 'WAITLISTED').length,
      held: lines.filter((l) => l.outcome === 'HELD').length,
      noAward: lines.filter((l) => l.outcome === 'NO_AWARD').length,
      cashRemaining: general,
      fullNeed: sum(lines.map((l) => l.fullAmount)),
      shortfall: sum(lines.map((l) => l.shortfall)),
      meetsBreadthRule: students >= 10 && schools >= 2,
    },
    honoredPreferences: honored, mergedPreferences: merged,
  };
}
