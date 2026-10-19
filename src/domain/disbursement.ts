import type { Cents } from './money';
import { sum } from './money';

/**
 * School payments. Tuition and fees are paid directly to the school (prop. Treas. Reg. §1.25F-3(c)(5)(iii)).
 * A term payment is released only when: the school confirmed enrollment in the window, the family
 * re-attested Tennessee residency, the payee account is verified (a new or changed account must be confirmed
 * from the school's email on file with the state and be past its cancel window), the
 * student is not on hold, and cash is in the segregated account. Two people approve each batch.
 */

export interface TermAward { awardId: string; studentId: string; schoolId: string; term: string; amount: Cents }
/**
 * verified: bank-link ownership check passed. emailConfirmed: someone at the school's TDOE directory inbox clicked
 * Confirm. payableAfter: end of the cancel window (BANK_CHANGE_HOLD_DAYS after the request), during which anyone
 * notified can cancel the change from a link. All automated; no phone calls.
 */
export interface SchoolPayee { schoolId: string; verified: boolean; changedAt?: string; emailConfirmed: boolean; payableAfter?: string }

export interface PaymentGate {
  enrollmentConfirmed: boolean;
  residencyReattested: boolean;
  hold?: string;
}

export interface BatchLine extends TermAward { status: 'READY' | 'BLOCKED'; blockers: string[] }
export interface Batch { batchId: string; term: string; lines: BatchLine[]; readyTotal: Cents; bySchool: Record<string, Cents> }

export const BANK_CHANGE_HOLD_DAYS = 3;

export function buildBatch(batchId: string, term: string, awards: TermAward[], gates: Record<string, PaymentGate>,
  payees: Record<string, SchoolPayee>, asOf: string, segregatedCash: Cents): Batch {
  let cashLeft = segregatedCash;
  const lines: BatchLine[] = awards.filter((a) => a.term === term).map((a) => {
    const g = gates[a.awardId]; const p = payees[a.schoolId];
    const blockers: string[] = [];
    if (!g?.enrollmentConfirmed) blockers.push('School has not confirmed enrollment');
    if (!g?.residencyReattested) blockers.push('Family has not re-attested Tennessee residency');
    if (g?.hold) blockers.push(`On hold: ${g.hold}`);
    if (!p?.verified) blockers.push('School bank account not verified');
    if (p?.changedAt && !p.emailConfirmed) blockers.push('Bank account change not yet confirmed from the school’s email on file');
    if (p?.payableAfter && asOf < p.payableAfter.slice(0, 10)) blockers.push(`Bank account change in its cancel window until ${p.payableAfter.slice(0, 10)}`);
    if (!blockers.length) {
      if (cashLeft >= a.amount) cashLeft -= a.amount; else blockers.push('Insufficient cash in segregated account');
    }
    return { ...a, status: blockers.length ? 'BLOCKED' : 'READY', blockers };
  });
  const ready = lines.filter((l) => l.status === 'READY');
  const bySchool: Record<string, Cents> = {};
  for (const l of ready) bySchool[l.schoolId] = (bySchool[l.schoolId] ?? 0) + l.amount;
  return { batchId, term, lines, readyTotal: sum(ready.map((l) => l.amount)), bySchool };
}

export interface Approval { userId: string; at: string }
/** Two different people must approve; the preparer (usually an automated job) cannot approve. */
export function canRelease(approvals: Approval[], preparedBy: string): { ok: boolean; reason?: string } {
  const distinct = new Set(approvals.map((a) => a.userId).filter((u) => u !== preparedBy));
  return distinct.size >= 2 ? { ok: true } : { ok: false, reason: `Needs 2 distinct approvers other than the preparer (has ${distinct.size}).` };
}

/** Withdrawal mid-term: school refunds the unused share, prorated by days enrolled (EFS-style). */
export function refundDue(paidForTerm: Cents, daysEnrolled: number, termDays: number): Cents {
  if (termDays <= 0) throw new Error('termDays must be positive');
  const used = Math.min(1, Math.max(0, daysEnrolled / termDays));
  return Math.round(paidForTerm * (1 - used));
}
