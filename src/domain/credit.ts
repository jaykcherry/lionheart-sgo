import type { Cents } from './money';

/**
 * Donor-side credit math (§25F(a)–(b); prop. Treas. Reg. §1.25F-2).
 * Each individual (each spouse separately) may claim up to $1,700 per year.
 * Only cash from individuals, designated at the time of the gift, counts.
 */
export const CREDIT_CAP: Cents = 170_000;
export const CREDIT_START = '2027-01-01';

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'ach' | 'paypal' | 'check' | 'daf' | 'stock' | 'crypto';
export type DonorType = 'individual' | 'business' | 'pass_through' | 'daf' | 'foundation';
export const CASH_METHODS: PaymentMethod[] = ['card', 'apple_pay', 'google_pay', 'ach', 'paypal', 'check'];

export type Fund = '25F-TN' | 'general' | 'operating';

export interface GiftIntent {
  donorType: DonorType;
  method: PaymentMethod;
  amount: Cents;
  chargeDate: string;               // ISO date the money actually moves
  designate: boolean;               // explicit §25F designation captured at checkout
  priorDesignatedThisYear: Cents;   // this individual's earlier designated gifts this calendar year
  excessTo: 'segregated' | 'general';
}

export interface GiftRouting {
  qualified: boolean;
  reasons: string[];
  lines: { fund: Fund; amount: Cents; designated: boolean }[];
  creditEligible: Cents;      // portion that can produce credit (cap-limited)
  deductibleExcess: Cents;    // portion that may be a §170 gift
}

export function routeGift(g: GiftIntent): GiftRouting {
  const reasons: string[] = [];
  if (g.donorType !== 'individual') reasons.push(`Only individuals can make qualified contributions (donor type: ${g.donorType}).`);
  if (!CASH_METHODS.includes(g.method)) reasons.push(`${g.method} is not a cash contribution from the donor.`);
  if (g.chargeDate < CREDIT_START) reasons.push(`Gifts before ${CREDIT_START} do not qualify.`);
  if (!g.designate) reasons.push('Donor did not designate the gift as a §25F qualified contribution.');

  if (reasons.length) {
    return { qualified: false, reasons, lines: [{ fund: 'general', amount: g.amount, designated: false }], creditEligible: 0, deductibleExcess: g.amount };
  }
  const roomLeft = Math.max(0, CREDIT_CAP - g.priorDesignatedThisYear);
  const creditEligible = Math.min(g.amount, roomLeft);
  const excess = g.amount - creditEligible;
  const lines: GiftRouting['lines'] = [];
  if (g.excessTo === 'segregated') lines.push({ fund: '25F-TN', amount: g.amount, designated: true });
  else {
    if (creditEligible) lines.push({ fund: '25F-TN', amount: creditEligible, designated: true });
    if (excess) lines.push({ fund: 'general', amount: excess, designated: false });
  }
  return { qualified: true, reasons: [], lines, creditEligible, deductibleExcess: excess };
}

/** Split a couple's checkout into one gift per spouse so each gets an acknowledgment and donor number. */
export function splitCouple(total: Cents): [Cents, Cents] {
  const a = Math.ceil(total / 2 / 100) * 100;
  return [a, total - a];
}

export interface CreditSummary { designated: Cents; credit: Cents; excess: Cents }
export function creditForYear(designatedGifts: Cents[]): CreditSummary {
  const designated = designatedGifts.reduce((a, b) => a + b, 0);
  const credit = Math.min(designated, CREDIT_CAP);
  return { designated, credit, excess: designated - credit };
}
