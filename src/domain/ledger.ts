import type { Cents } from './money';
import type { Fund } from './credit';

/**
 * Event-sourced, append-only double-entry ledger. Every money event is a balanced journal.
 * The segregated §25F account must hold only qualified contributions, their earnings,
 * school refunds of scholarship money, and operating-fund top-ups that make card-fee-reduced
 * deposits whole (so the account always shows the gross gift).
 */

export type Account = 'cash' | 'contributions' | 'earnings' | 'scholarship_expense' | 'refunds_receivable'
  | 'processing_fees' | 'interfund' | 'awards_payable';

export interface Posting { fund: Fund; account: Account; amount: Cents } // debit +, credit −
export interface Journal { id: string; date: string; kind: JournalKind; ref: string; postings: Posting[] }
export type JournalKind = 'gift' | 'fee' | 'fee_topup' | 'earnings' | 'scholarship_payment' | 'school_refund' | 'chargeback' | 'adjustment';

export function assertBalanced(j: Journal): void {
  const byFund = new Map<Fund, number>();
  for (const p of j.postings) {
    if (!Number.isInteger(p.amount)) throw new Error(`journal ${j.id}: non-integer amount`);
    byFund.set(p.fund, (byFund.get(p.fund) ?? 0) + p.amount);
  }
  const total = [...byFund.values()].reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error(`journal ${j.id} is unbalanced by ${total}`);
}

export function balance(journals: Journal[], fund: Fund, account: Account): Cents {
  let b = 0;
  for (const j of journals) for (const p of j.postings) if (p.fund === fund && p.account === account) b += p.amount;
  return b;
}

// ── Journal builders ──
export const giftJournal = (id: string, date: string, ref: string, lines: { fund: Fund; amount: Cents }[]): Journal => ({
  id, date, kind: 'gift', ref,
  postings: lines.flatMap((l) => [{ fund: l.fund, account: 'cash' as const, amount: l.amount }, { fund: l.fund, account: 'contributions' as const, amount: -l.amount }]),
});
/** Processor deducted a fee from a segregated deposit; operating fund makes it whole the same day. */
export const feeAndTopupJournal = (id: string, date: string, ref: string, fee: Cents): Journal => ({
  id, date, kind: 'fee_topup', ref,
  postings: [
    { fund: 'operating', account: 'processing_fees', amount: fee },
    { fund: 'operating', account: 'cash', amount: -fee },
    // segregated cash was reduced by the processor; top-up restores it (net zero to 25F cash)
  ],
});
export const scholarshipJournal = (id: string, date: string, ref: string, amount: Cents): Journal => ({
  id, date, kind: 'scholarship_payment', ref,
  postings: [{ fund: '25F-TN', account: 'scholarship_expense', amount }, { fund: '25F-TN', account: 'cash', amount: -amount }],
});
export const refundJournal = (id: string, date: string, ref: string, amount: Cents): Journal => ({
  id, date, kind: 'school_refund', ref,
  postings: [{ fund: '25F-TN', account: 'cash', amount }, { fund: '25F-TN', account: 'contributions', amount: -amount }],
});

// ── Three-way reconciliation: processor ↔ bank ↔ ledger ──
export interface ProcessorSettlement { ref: string; date: string; gross: Cents; fee: Cents; net: Cents; fund: Fund }
export interface BankLine { id: string; date: string; account: 'segregated' | 'operating'; amount: Cents; memo: string; ref?: string }

export interface ReconFinding { severity: 'critical' | 'warn'; code: string; message: string; ref?: string }

export function reconcile(settlements: ProcessorSettlement[], bank: BankLine[], journals: Journal[]): ReconFinding[] {
  const f: ReconFinding[] = [];
  const bankByRef = new Map<string, BankLine[]>();
  for (const b of bank) if (b.ref) bankByRef.set(b.ref, [...(bankByRef.get(b.ref) ?? []), b]);
  const ledgerRefs = new Set(journals.filter((j) => j.kind === 'gift').map((j) => j.ref));

  for (const s of settlements) {
    if (s.gross - s.fee !== s.net) f.push({ severity: 'critical', code: 'PROCESSOR_MATH', message: `Settlement ${s.ref}: gross − fee ≠ net`, ref: s.ref });
    const lines = bankByRef.get(s.ref) ?? [];
    const target = s.fund === '25F-TN' ? 'segregated' : 'operating';
    const deposit = lines.find((l) => l.account === target && l.amount > 0);
    if (!deposit) f.push({ severity: 'warn', code: 'NOT_DEPOSITED', message: `Settlement ${s.ref} not yet seen in ${target} bank account`, ref: s.ref });
    else if (deposit.amount !== s.net) f.push({ severity: 'critical', code: 'DEPOSIT_MISMATCH', message: `Settlement ${s.ref}: bank ${deposit.amount} ≠ processor net ${s.net}`, ref: s.ref });
    if (s.fund === '25F-TN' && s.fee > 0) {
      const topup = lines.find((l) => l.account === 'segregated' && l.amount === s.fee && /top-?up/i.test(l.memo));
      if (!topup) f.push({ severity: 'critical', code: 'FEE_NOT_TOPPED_UP', message: `Segregated deposit ${s.ref} is short the ${s.fee}¢ card fee; operating fund top-up missing`, ref: s.ref });
    }
    if (!ledgerRefs.has(s.ref)) f.push({ severity: 'critical', code: 'NOT_IN_LEDGER', message: `Settlement ${s.ref} has no gift journal`, ref: s.ref });
  }
  // Purity: every inflow to the segregated account must be explained
  const settlementRefs = new Set(settlements.filter((s) => s.fund === '25F-TN').map((s) => s.ref));
  const okRefs = new Set(journals.filter((j) => ['earnings', 'school_refund'].includes(j.kind)).map((j) => j.ref));
  for (const b of bank.filter((x) => x.account === 'segregated' && x.amount > 0)) {
    const explained = (b.ref && (settlementRefs.has(b.ref) || okRefs.has(b.ref)));
    if (!explained) f.push({ severity: 'critical', code: 'SEGREGATED_PURITY', message: `Unexplained deposit of ${b.amount}¢ into the §25F account ("${b.memo}")`, ref: b.id });
  }
  return f;
}
