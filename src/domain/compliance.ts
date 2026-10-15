import type { Cents } from './money';
import type { YearStatus } from './spend';
import type { ReconFinding } from './ledger';

/**
 * Compliance monitor: one function that turns a snapshot of the system into findings.
 * Runs on a schedule (and before any money moves). Critical findings block the flows they name.
 */

export interface Deadline { id: string; label: string; due: string; owner: string; done: boolean }

export function deadlinesFor(year: number): Omit<Deadline, 'done'>[] {
  // `year` = tax year of gifts
  return [
    { id: `irs-portal-${year}`, label: 'Registered in IRS SGO portal', due: `${year - 1}-12-31`, owner: 'Ops lead' },
    { id: `tn-list-${year}`, label: 'Tennessee submits its SGO list to the IRS', due: year === 2027 ? '2027-02-15' : `${year - 1}-12-31`, owner: 'TDOE (we confirm listing)' },
    { id: `ack-${year}`, label: `Donor acknowledgments for ${year}`, due: `${year + 1}-01-31`, owner: 'Automated · treasurer signs off' },
    { id: `irs-report-${year}`, label: `IRS contribution report for ${year}`, due: `${year + 1}-02-28`, owner: 'Automated · treasurer submits' },
    { id: `990-${year}`, label: `Form 990 + §25F certification for ${year}`, due: `${year + 1}-05-15`, owner: 'CPA · board signs' },
    { id: `ninety-${year}`, label: `${year} receipts ≥90% spent on scholarships`, due: `${year + 1}-12-31`, owner: 'Award engine' },
    { id: `tn-charity-${year}`, label: 'TN charitable solicitation renewal', due: `${year + 1}-06-30`, owner: 'Ops lead' },
  ];
}

export interface Snapshot {
  asOf: string;
  ninety: YearStatus[];
  recon: ReconFinding[];
  awardedStudents: { studentId: string; schoolId: string; year: number }[];
  segregatedBankBalance: Cents;
  segregatedLedgerBalance: Cents;
  acknowledgmentsQueued: { year: number; donorsWithGifts: number; queued: number };
  deadlines: Deadline[];
  openHolds: number;
  dqMatchesUnreviewed: number;
  exceptionTicketsOverSla: number;
}

export interface Finding { id: string; severity: 'critical' | 'warn' | 'info'; area: string; message: string; blocks?: ('disbursement' | 'awards' | 'acknowledgments' | 'gifts')[] }

export function evaluate(s: Snapshot): Finding[] {
  const f: Finding[] = [];
  if (s.segregatedBankBalance !== s.segregatedLedgerBalance) {
    f.push({ id: 'seg-balance', severity: 'critical', area: 'Segregated account', blocks: ['disbursement', 'acknowledgments'],
      message: `Bank balance ${s.segregatedBankBalance} ≠ ledger ${s.segregatedLedgerBalance}. Money movement paused until reconciled.` });
  } else f.push({ id: 'seg-balance', severity: 'info', area: 'Segregated account', message: 'Bank and ledger agree to the cent.' });

  for (const r of s.recon) f.push({ id: `recon-${r.code}-${r.ref ?? ''}`, severity: r.severity, area: 'Reconciliation', message: r.message, blocks: r.severity === 'critical' ? ['disbursement'] : undefined });

  for (const y of s.ninety) {
    if (y.status === 'failed') f.push({ id: `ninety-${y.year}`, severity: 'critical', area: '90% test', message: `${y.year} receipts: only ${(y.pct * 100).toFixed(1)}% spent by ${y.deadline}.` });
    else if (y.status === 'at_risk') f.push({ id: `ninety-${y.year}`, severity: 'warn', area: '90% test', message: `${y.year} receipts ${(y.pct * 100).toFixed(1)}% spent; ${(y.shortfall / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} more needed by ${y.deadline}.` });
    else f.push({ id: `ninety-${y.year}`, severity: 'info', area: '90% test', message: `${y.year}: ${y.status.replace('_', ' ')} (${(y.pct * 100).toFixed(1)}% incl. scheduled).` });
  }

  const years = [...new Set(s.awardedStudents.map((a) => a.year))];
  for (const y of years) {
    const rows = s.awardedStudents.filter((a) => a.year === y);
    const students = new Set(rows.map((r) => r.studentId)).size;
    const schools = new Set(rows.map((r) => r.schoolId)).size;
    if (students < 10 || schools < 2) f.push({ id: `ten-${y}`, severity: 'warn', area: '10 students / 2 schools', message: `${y}: ${students} students at ${schools} schools. Law requires ≥10 students not all at one school.` });
    else f.push({ id: `ten-${y}`, severity: 'info', area: '10 students / 2 schools', message: `${y}: ${students} students at ${schools} schools.` });
  }

  const q = s.acknowledgmentsQueued;
  if (q.queued < q.donorsWithGifts && s.asOf >= `${q.year + 1}-01-15`) f.push({ id: `ack-${q.year}`, severity: 'critical', area: 'Acknowledgments', blocks: ['acknowledgments'], message: `${q.donorsWithGifts - q.queued} donor(s) with ${q.year} gifts have no acknowledgment queued; due Jan 31.` });

  for (const d of s.deadlines.filter((d) => !d.done)) {
    const days = Math.ceil((Date.parse(d.due) - Date.parse(s.asOf)) / 86_400_000);
    if (days < 0) f.push({ id: `dl-${d.id}`, severity: 'critical', area: 'Deadline', message: `${d.label} was due ${d.due}.` });
    else if (days <= 30) f.push({ id: `dl-${d.id}`, severity: 'warn', area: 'Deadline', message: `${d.label} due in ${days} day(s) (${d.due}).` });
  }
  if (s.dqMatchesUnreviewed) f.push({ id: 'dq', severity: 'warn', area: 'Disqualified persons', blocks: ['awards'], message: `${s.dqMatchesUnreviewed} possible disqualified-person match(es) awaiting board review.` });
  if (s.exceptionTicketsOverSla) f.push({ id: 'sla', severity: 'warn', area: 'Exception queue', message: `${s.exceptionTicketsOverSla} ticket(s) past their response time.` });
  return f;
}

export const blocked = (findings: Finding[], flow: NonNullable<Finding['blocks']>[number]) =>
  findings.some((f) => f.severity === 'critical' && f.blocks?.includes(flow));
