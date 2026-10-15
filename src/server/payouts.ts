import { env } from '@/lib/env';

/**
 * Outbound ACH to schools from the segregated §25F account. Provider-agnostic.
 * 'manual' produces a NACHA-style CSV for the bank portal (fine at launch scale);
 * 'increase' calls Increase's ACH transfer API. Modern Treasury can be added the same way.
 */
export interface PayoutLine { schoolId: string; payeeRef: string; amountCents: number; memo: string; idempotencyKey: string }
export interface PayoutResult { providerRef: string; file?: string }

export interface PayoutProvider { send(batchName: string, lines: PayoutLine[]): Promise<PayoutResult> }

const manual: PayoutProvider = {
  async send(batchName, lines) {
    const rows = ['payee_ref,amount,memo,idempotency_key', ...lines.map((l) => [l.payeeRef, (l.amountCents / 100).toFixed(2), JSON.stringify(l.memo), l.idempotencyKey].join(','))];
    return { providerRef: `manual:${batchName}`, file: rows.join('\n') };
  },
};

const increase: PayoutProvider = {
  async send(batchName, lines) {
    const e = env();
    if (!e.INCREASE_API_KEY || !e.INCREASE_SEGREGATED_ACCOUNT_ID) throw new Error('Increase is not configured');
    const refs: string[] = [];
    for (const l of lines) {
      const res = await fetch('https://api.increase.com/ach_transfers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${e.INCREASE_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': l.idempotencyKey },
        body: JSON.stringify({ account_id: e.INCREASE_SEGREGATED_ACCOUNT_ID, external_account_id: l.payeeRef, amount: l.amountCents, statement_descriptor: l.memo.slice(0, 10), individual_name: 'Lionheart SGO' }),
      });
      if (!res.ok) throw new Error(`Increase ACH failed for ${l.schoolId}: ${res.status} ${await res.text()}`);
      refs.push(((await res.json()) as { id: string }).id);
    }
    return { providerRef: `increase:${batchName}:${refs.length}` };
  },
};

export function payoutProvider(): PayoutProvider {
  const p = env().PAYOUT_PROVIDER;
  return p === 'increase' ? increase : manual;
}
