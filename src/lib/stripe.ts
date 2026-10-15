import Stripe from 'stripe';
import { envPick } from './env';

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(envPick('STRIPE_SECRET_KEY').STRIPE_SECRET_KEY, { appInfo: { name: 'Lionheart SGO' } });
  return client;
}

/** Exact text the donor accepts. Its SHA-256 is stored with every consent so we can prove what was shown. */
export const DESIGNATION_TEXT_VERSION = 'designation-2027-v1';
export const designationText = (amountDollars: string) =>
  `I irrevocably designate ${amountDollars} of this gift as a qualified contribution under Section 25F of the Internal Revenue Code, ` +
  `to fund scholarships for eligible Tennessee students. I am giving my own funds as an individual, not through a business or donor-advised fund. ` +
  `I understand I cannot direct this gift to a particular student, and I receive no goods or services in return.`;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
