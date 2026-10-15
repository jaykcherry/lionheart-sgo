/** All money in the domain layer is integer cents. Never use floats for money. */
export type Cents = number;

export const dollars = (d: number): Cents => Math.round(d * 100);
export const toDollars = (c: Cents): number => c / 100;

export function assertCents(c: Cents, label = 'amount'): void {
  if (!Number.isInteger(c)) throw new Error(`${label} must be integer cents, got ${c}`);
}

export function fmtUSD(c: Cents, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? c % 100 !== 0;
  return (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** Round to the nearest whole dollar, in cents. */
export const roundDollar = (c: Cents): Cents => Math.round(c / 100) * 100;

export const sum = (xs: Cents[]): Cents => xs.reduce((a, b) => a + b, 0);
