import type { Cents } from './money';
import { sum } from './money';

/**
 * Year-end donor documents (Temp. Treas. Reg. §1.25F-4T(c)).
 * Acknowledgment by Jan 31: SGO EIN, total designated qualified contributions for the year,
 * unique donor number, goods/services statement. IRS report by Feb 28: per donor number,
 * name, address, aggregate qualified contributions. No donor SSN is collected.
 */

/** The IRS publishes the donor-number format through the SGO portal. Keep it pluggable. */
export type DonorNumberFormatter = (args: { sgoEin: string; year: number; sequence: number; donorId: string }) => string;
export const provisionalDonorNumber: DonorNumberFormatter = ({ year, sequence }) => `LH${year}-${String(sequence).padStart(6, '0')}`;

export interface DesignatedGift { giftId: string; donorId: string; date: string; amount: Cents; refunded?: boolean }
export interface Donor { donorId: string; legalName: string; address: string; email: string; eDeliveryConsent: boolean }

export interface Acknowledgment {
  donorId: string; year: number; donorNumber: string; sgoEin: string; legalName: string; address: string;
  totalQualified: Cents; giftCount: number; goodsOrServices: 'none'; delivery: 'email' | 'mail'; dueBy: string;
}
export interface IrsReportRow { donorNumber: string; name: string; address: string; aggregateQualified: Cents }

export function buildYearEnd(year: number, sgoEin: string, donors: Donor[], gifts: DesignatedGift[],
  existingNumbers: Record<string, string> = {}, fmt: DonorNumberFormatter = provisionalDonorNumber) {
  const inYear = gifts.filter((g) => g.date.startsWith(String(year)) && !g.refunded);
  const byDonor = new Map<string, DesignatedGift[]>();
  for (const g of inYear) byDonor.set(g.donorId, [...(byDonor.get(g.donorId) ?? []), g]);
  let seq = Object.keys(existingNumbers).length;
  const acks: Acknowledgment[] = [];
  const rows: IrsReportRow[] = [];
  const donorsById = new Map(donors.map((d) => [d.donorId, d]));
  for (const [donorId, gs] of [...byDonor.entries()].sort()) {
    const d = donorsById.get(donorId);
    if (!d) throw new Error(`gift references unknown donor ${donorId}`);
    const donorNumber = existingNumbers[donorId] ?? fmt({ sgoEin, year, sequence: ++seq, donorId });
    const total = sum(gs.map((g) => g.amount));
    acks.push({ donorId, year, donorNumber, sgoEin, legalName: d.legalName, address: d.address, totalQualified: total, giftCount: gs.length,
      goodsOrServices: 'none', delivery: d.eDeliveryConsent ? 'email' : 'mail', dueBy: `${year + 1}-01-31` });
    rows.push({ donorNumber, name: d.legalName, address: d.address, aggregateQualified: total });
  }
  return { acks, rows };
}

/** Release gate: acknowledgments, IRS report and segregated designated deposits must tie to the cent. */
export function tieOut(acks: Acknowledgment[], rows: IrsReportRow[], segregatedDesignatedDeposits: Cents) {
  const a = sum(acks.map((x) => x.totalQualified));
  const r = sum(rows.map((x) => x.aggregateQualified));
  const dupNumbers = rows.length - new Set(rows.map((x) => x.donorNumber)).size;
  const problems: string[] = [];
  if (a !== r) problems.push(`Acknowledgments total ${a} ≠ IRS report total ${r}`);
  if (a !== segregatedDesignatedDeposits) problems.push(`Acknowledgments total ${a} ≠ designated deposits in §25F account ${segregatedDesignatedDeposits}`);
  if (dupNumbers) problems.push(`${dupNumbers} duplicate donor number(s)`);
  return { ok: problems.length === 0, problems, total: a };
}
