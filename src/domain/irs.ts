import type { Cents } from './money';
import { sum } from './money';
import type { IncomeItem } from './eligibility';

/**
 * IRS income verification through the Income Verification Express Service (IVES).
 *
 * The family e-signs Form 4506-C for each tax return filed for the measurement year (one per joint return,
 * one per separate filer). An IVES participant (our transcript vendor) sends it to the IRS and returns the
 * tax return transcript, usually within a few business days. Social Security numbers go straight to the
 * vendor at signing and are never stored by Lionheart (we keep the last four digits only).
 *
 * The transcript replaces the family's typed figures and uploaded W-2/1040s for the people it covers.
 * Untaxed cash income that never appears on a return (child support, the untaxed part of Social Security)
 * still comes from the family's own statement.
 */

/** Normalized fields from an IRS tax return transcript (Form 1040 series). Dollars in cents. */
export interface TranscriptFields {
  filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss';
  wages: Cents;
  taxableInterest: Cents;
  ordinaryDividends: Cents;
  businessIncome: Cents;        // Schedule C net (may be negative)
  farmIncome?: Cents;           // Schedule F net (may be negative)
  rentalRoyalty: Cents;         // Schedule E (may be negative)
  unemployment: Cents;
  socialSecurityGross: Cents;   // line 6a
  pensionsTaxable: Cents;       // IRAs + pensions, taxable amounts (excludes rollovers)
  otherIncome: Cents;
  agi: Cents;
}

export type TranscriptOutcome =
  | { kind: 'return'; taxYear: number; fields: TranscriptFields; coversMemberIds: string[] }
  | { kind: 'no_record'; taxYear: number; coversMemberIds: string[] }      // IRS has no return on file (yet)
  | { kind: 'rejected'; reason: string; coversMemberIds: string[] };      // identity mismatch, bad signature, etc.

/** Section 8 annual income counts gross cash income; negative business/rental results count as zero. */
export function transcriptToIncomeItems(o: Extract<TranscriptOutcome, { kind: 'return' }>): IncomeItem[] {
  const who = o.coversMemberIds[0]!;   // joint returns: attribute to the primary filer; household total is what matters
  const f = o.fields;
  const items: [IncomeItem['type'], Cents][] = [
    ['wages', f.wages],
    ['interest_dividends', f.taxableInterest + f.ordinaryDividends],
    ['self_employment', Math.max(0, f.businessIncome) + Math.max(0, f.farmIncome ?? 0)],
    ['rental', Math.max(0, f.rentalRoyalty)],
    ['unemployment', f.unemployment],
    ['social_security', f.socialSecurityGross],
    ['pension', f.pensionsTaxable],
    ['other_cash', Math.max(0, f.otherIncome)],
  ];
  const out: IncomeItem[] = items.filter(([, a]) => a > 0).map(([type, amount]) => ({ personId: who, type, amount, year: o.taxYear, cash: true, source: 'transcript' as const }));
  // The spouse on a joint return is accounted for by the same transcript: a $0 marker keeps the
  // "every adult accounted for" check satisfied without double counting.
  for (const m of o.coversMemberIds.slice(1)) out.push({ personId: m, type: 'other_cash', amount: 0, year: o.taxYear, cash: true, source: 'transcript' });
  if (!out.some((i) => i.personId === who)) out.push({ personId: who, type: 'other_cash', amount: 0, year: o.taxYear, cash: true, source: 'transcript' });
  return out;
}

const TAXABLE_TYPES = new Set<IncomeItem['type']>(['wages', 'self_employment', 'unemployment', 'interest_dividends', 'rental', 'pension', 'social_security', 'other_cash']);

export interface TranscriptMerge {
  items: IncomeItem[];
  /** people whose income is now IRS-verified */
  verifiedMemberIds: string[];
  notes: string[];
  /** true when a person a transcript covers had attested zero income but the IRS shows income */
  contradictsZeroIncome: boolean;
}

/**
 * Replaces the family's taxable income items for the people a transcript covers with the IRS figures.
 * Child support and alimony received (never on a return) stay as the family stated them.
 */
export function mergeTranscripts(stated: IncomeItem[], outcomes: TranscriptOutcome[], zeroIncomeAttested: string[]): TranscriptMerge {
  const returns = outcomes.filter((o): o is Extract<TranscriptOutcome, { kind: 'return' }> => o.kind === 'return');
  const covered = new Set(returns.flatMap((o) => o.coversMemberIds));
  const kept = stated.filter((i) => !(covered.has(i.personId) && TAXABLE_TYPES.has(i.type)));
  const fromIrs = returns.flatMap(transcriptToIncomeItems);
  const notes: string[] = [];
  for (const o of returns) {
    const before = sum(stated.filter((i) => o.coversMemberIds.includes(i.personId) && TAXABLE_TYPES.has(i.type)).map((i) => i.amount));
    const after = sum(transcriptToIncomeItems(o).map((i) => i.amount));
    const fmt = (c: Cents) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    notes.push(Math.abs(after - before) <= Math.max(100_000, before * 0.05)
      ? `IRS transcript for ${o.taxYear} confirms stated income (${fmt(after)}).`
      : `IRS transcript for ${o.taxYear} shows ${fmt(after)}; the family stated ${fmt(before)}. The IRS figure is used.`);
  }
  for (const o of outcomes) if (o.kind === 'no_record') notes.push(`IRS has no ${o.taxYear} return on file for ${o.coversMemberIds.length} person(s).`);
  const contradictsZeroIncome = returns.some((o) => o.coversMemberIds.some((m) => zeroIncomeAttested.includes(m)) && sum(transcriptToIncomeItems(o).map((i) => i.amount)) > 0);
  if (contradictsZeroIncome) notes.push('A person who reported no income has income on an IRS transcript. The IRS figure is used.');
  return { items: [...kept, ...fromIrs], verifiedMemberIds: [...covered], notes, contradictsZeroIncome };
}

/**
 * When the IRS has no return on file, the family may simply not have filed yet. Retry every 14 days through
 * the extended filing deadline (Oct 15 of the year after the tax year); after that, hand it to a reviewer.
 */
export function nextTranscriptRetry(taxYear: number, today: string): string | null {
  const last = `${taxYear + 1}-10-15`;
  const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 14);
  const next = d.toISOString().slice(0, 10);
  return next <= last ? next : null;
}

/** A signed 4506-C authorizes one request within 120 days of the signature date. */
export const FORM_4506C_VALID_DAYS = 120;
export const consentValid = (signedAt: string, today: string) =>
  (new Date(today + 'T00:00:00Z').getTime() - new Date(signedAt.slice(0, 10) + 'T00:00:00Z').getTime()) / 86_400_000 <= FORM_4506C_VALID_DAYS;
