import type { Cents } from './money';

/**
 * 90% test (§25F(d)(1)(B); prop. Treas. Reg. §1.25F-3(c)(4) under the 85% safe harbor):
 * "income" = qualified contributions + earnings on the segregated account (+ refunds from schools,
 * counted as income in the year returned). Cash basis, first-in-first-out. Each year's income must
 * be ≥90% spent on scholarships by the end of the FOLLOWING taxable year.
 */

export interface YearIncome { year: number; contributions: Cents; earnings: Cents; refunds: Cents }
export interface ScholarshipPayment { date: string; amount: Cents }   // actual or scheduled

export interface YearStatus {
  year: number;
  income: Cents;
  required: Cents;          // 90% of income
  spent: Cents;             // FIFO-attributed scholarship payments made by the deadline
  deadline: string;         // Dec 31 of year + 1
  pct: number;              // spent / income
  status: 'met' | 'on_track' | 'at_risk' | 'failed' | 'open';
  shortfall: Cents;         // required − spent (≥ 0)
}

export function ninetyPercentTest(incomes: YearIncome[], payments: ScholarshipPayment[], asOf: string, scheduled: ScholarshipPayment[] = []): YearStatus[] {
  const years = [...incomes].sort((a, b) => a.year - b.year);
  // FIFO buckets of remaining unspent income per year
  const buckets = years.map((y) => ({ year: y.year, income: y.contributions + y.earnings + y.refunds, remaining: y.contributions + y.earnings + y.refunds, spentByDeadline: 0 }));
  const all = [
    ...payments.map((p) => ({ ...p, scheduled: false })),
    ...scheduled.map((p) => ({ ...p, scheduled: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  for (const p of all) {
    let left = p.amount;
    for (const b of buckets) {
      if (left <= 0) break;
      if (b.remaining <= 0) continue;
      const take = Math.min(b.remaining, left);
      b.remaining -= take; left -= take;
      if (p.date <= `${b.year + 1}-12-31`) b.spentByDeadline += take;
    }
  }

  return buckets.map((b) => {
    const required = Math.ceil(b.income * 0.9);
    const deadline = `${b.year + 1}-12-31`;
    const pct = b.income ? b.spentByDeadline / b.income : 1;
    let status: YearStatus['status'];
    if (b.spentByDeadline >= required) status = asOf > deadline || b.income === 0 ? 'met' : 'on_track';
    else if (asOf > deadline) status = 'failed';
    else if (asOf < `${b.year}-12-31`) status = 'open';
    else status = 'at_risk';
    return { year: b.year, income: b.income, required, spent: b.spentByDeadline, deadline, pct, status, shortfall: Math.max(0, required - b.spentByDeadline) };
  });
}
