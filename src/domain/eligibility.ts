import type { Cents } from './money';
import { sum } from './money';
import type { LimitsTable, ResolvedLimit } from './limits';
import { resolveLimit } from './limits';

/**
 * Student eligibility under §25F(c)(2) and prop. Treas. Reg. §1.25F-3(c)(6)–(7).
 * Deterministic: the same input and limits table always give the same answer.
 * This module never *denies* on its own when data is incomplete; it returns NEEDS_REVIEW.
 */

export const CATEGORICAL_PROGRAMS = ['SNAP', 'TANF', 'WIC', 'SECTION8', 'SSI'] as const;
export type CategoricalProgram = (typeof CATEGORICAL_PROGRAMS)[number];

export type IncomeType =
  | 'wages' | 'self_employment' | 'unemployment' | 'social_security' | 'pension'
  | 'child_support' | 'alimony' | 'interest_dividends' | 'rental' | 'other_cash';

export interface IncomeItem {
  personId: string;
  type: IncomeType;
  amount: Cents;
  year: number;
  /** Section 8 annual income counts cash items only (24 CFR 5.609). Non-cash items are excluded. */
  cash: boolean;
  source: 'w2' | '1040' | 'paystub' | 'transcript' | 'attestation' | 'payroll_data' | 'other_document';
}

export interface HouseholdMember {
  personId: string;
  relationship: 'self' | 'spouse' | 'partner' | 'child' | 'parent' | 'other_relative' | 'other';
  age: number;
}

export interface EligibilityInput {
  applicationDate: string;              // ISO date
  county: string;
  state: string;                         // residence state of the student
  residencyException?: 'military_dependent' | 'indian_lands';
  residencyProof?: 'lease' | 'mortgage' | 'utility' | 'drivers_license' | 'other';
  household: HouseholdMember[];
  incomeItems: IncomeItem[];
  /** every adult (18+) must be accounted for: either has income items or attests to zero income */
  zeroIncomeAttested: string[];
  categorical?: { program: CategoricalProgram | string; letterDate: string; nameMatchesHousehold: boolean };
  fosterPlacement?: { letterDate: string };
  student: { grade: string; age: number };
}

export type EligibilityMethod = 'categorical' | 'foster' | 'direct_income';
export type EligibilityResult = 'ELIGIBLE' | 'INELIGIBLE_PROPOSED' | 'NEEDS_REVIEW';
export type NeedTier = 'A' | 'B' | 'C';

export interface Determination {
  result: EligibilityResult;
  method: EligibilityMethod | null;
  householdSize: number;
  incomeTotal: Cents | null;
  limit: ResolvedLimit;
  /** income ÷ (AMGI × size multiplier), e.g. 1.42 = 142% of AMGI */
  pctAmgi: number | null;
  tier: NeedTier | null;
  reasons: string[];       // why the result is what it is (plain language, shown to reviewers)
  reviewFlags: string[];   // what a human must look at
  limitsVersion: string;
}

const GRADES = new Set(['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

function monthsBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T00:00:00Z');
  const b = new Date(bISO + 'T00:00:00Z');
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

export function tierFor(pctAmgi: number, categoricalOrFoster: boolean): NeedTier {
  if (categoricalOrFoster || pctAmgi <= 1.0) return 'A';
  if (pctAmgi <= 2.0) return 'B';
  return 'C';
}

export function determineEligibility(input: EligibilityInput, table: LimitsTable): Determination {
  const reasons: string[] = [];
  const reviewFlags: string[] = [];
  const householdSize = input.household.length;
  const limit = resolveLimit(table, input.county, Math.max(householdSize, 1));
  const base = { householdSize, limit, limitsVersion: table.version };
  const measurementYear = Number(input.applicationDate.slice(0, 4)) - 1;

  // 1. Residence (student must reside solely in Tennessee, unless a listed exception applies)
  if (input.state.toUpperCase() !== 'TN' && !input.residencyException) {
    return { ...base, result: 'INELIGIBLE_PROPOSED', method: null, incomeTotal: null, pctAmgi: null, tier: null,
      reasons: ['Student does not reside in Tennessee.'], reviewFlags: ['Human must confirm before denial.'] };
  }
  if (input.residencyException) reviewFlags.push(`Residency exception claimed: ${input.residencyException}.`);
  if (!input.residencyProof) reviewFlags.push('No proof of Tennessee address on file.');

  // 2. Eligible to enroll in a public elementary or secondary school
  if (!GRADES.has(input.student.grade)) {
    return { ...base, result: 'INELIGIBLE_PROPOSED', method: null, incomeTotal: null, pctAmgi: null, tier: null,
      reasons: [`Grade "${input.student.grade}" is outside K–12.`], reviewFlags: ['Human must confirm before denial.'] };
  }
  if (input.student.age < 4 || input.student.age > 21) reviewFlags.push(`Student age ${input.student.age} is unusual for grade ${input.student.grade}.`);

  if (householdSize < 1) reviewFlags.push('Household roster is empty.');
  if (limit.isFallback) reviewFlags.push(`County "${input.county}" not in limits table ${table.version}; used statewide reference.`);

  // 3a. Categorical eligibility: award letter dated within the last 12 months
  if (input.categorical) {
    const prog = String(input.categorical.program).toUpperCase();
    const months = monthsBetween(input.categorical.letterDate, input.applicationDate);
    if ((CATEGORICAL_PROGRAMS as readonly string[]).includes(prog) && months >= 0 && months < 12 && input.categorical.nameMatchesHousehold) {
      reasons.push(`Household receives ${prog}; letter dated ${input.categorical.letterDate} (within 12 months).`);
      return { ...base, result: reviewFlags.length ? 'NEEDS_REVIEW' : 'ELIGIBLE', method: 'categorical', incomeTotal: null, pctAmgi: null, tier: 'A', reasons, reviewFlags };
    }
    if (!(CATEGORICAL_PROGRAMS as readonly string[]).includes(prog)) reasons.push(`${prog} is not on Treasury's categorical list (SNAP, TANF, WIC, Section 8, SSI); checking income instead.`);
    else if (!(months >= 0 && months < 12)) reasons.push(`${prog} letter is older than 12 months; checking income instead.`);
    else reviewFlags.push('Benefit letter name does not match the household roster.');
  }

  // 3b. Foster placement safe harbor
  if (input.fosterPlacement) {
    reasons.push('Student is in foster care placement.');
    return { ...base, result: reviewFlags.length ? 'NEEDS_REVIEW' : 'ELIGIBLE', method: 'foster', incomeTotal: null, pctAmgi: null, tier: 'A', reasons, reviewFlags };
  }

  // 3c. Direct income verification: prior calendar year, cash items only, every adult accounted for
  const wrongYear = input.incomeItems.filter((i) => i.year !== measurementYear);
  if (wrongYear.length) reviewFlags.push(`${wrongYear.length} income item(s) are not for ${measurementYear}.`);
  const nonCash = input.incomeItems.filter((i) => !i.cash);
  if (nonCash.length) reasons.push(`${nonCash.length} non-cash item(s) excluded under Section 8 rules.`);
  const adults = input.household.filter((m) => m.age >= 18).map((m) => m.personId);
  const covered = new Set([...input.incomeItems.map((i) => i.personId), ...input.zeroIncomeAttested]);
  const missing = adults.filter((p) => !covered.has(p));
  if (missing.length) reviewFlags.push(`${missing.length} adult(s) in the household have no income documents or zero-income attestation.`);
  const attestedOnly = input.incomeItems.filter((i) => i.source === 'attestation');
  if (attestedOnly.length) reviewFlags.push(`${attestedOnly.length} income item(s) rest on attestation only.`);

  const incomeTotal = sum(input.incomeItems.filter((i) => i.cash && i.year === measurementYear).map((i) => i.amount));
  const pctAmgi = incomeTotal / limit.amgiAdjusted;
  reasons.push(`${measurementYear} household income ${(incomeTotal / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} is ${(pctAmgi * 100).toFixed(0)}% of area median for ${householdSize} (limit 300%).`);

  if (incomeTotal > limit.limit) {
    if (limit.isFallback) {
      reviewFlags.push('Over the statewide reference, but county limit unknown. Do not deny until the county figure is loaded.');
      return { ...base, result: 'NEEDS_REVIEW', method: 'direct_income', incomeTotal, pctAmgi, tier: null, reasons, reviewFlags };
    }
    return { ...base, result: 'INELIGIBLE_PROPOSED', method: 'direct_income', incomeTotal, pctAmgi, tier: null,
      reasons: [...reasons, 'Income is above 300% of area median.'], reviewFlags: [...reviewFlags, 'Human must confirm before denial.'] };
  }
  return { ...base, result: reviewFlags.length ? 'NEEDS_REVIEW' : 'ELIGIBLE', method: 'direct_income', incomeTotal, pctAmgi, tier: tierFor(pctAmgi, false), reasons, reviewFlags };
}
