import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { routeGift, splitCouple, fmtUSD, giftJournal, type PaymentMethod } from '@/domain';
import { stripe, designationText, DESIGNATION_TEXT_VERSION, sha256 } from '@/lib/stripe';
import { env } from '@/lib/env';
import { audit, openTicket } from '@/lib/audit';

export interface GiveRequest {
  givers: { legalName: string; email: string }[];   // 1 or 2 (spouses each give in their own name)
  totalCents: number;
  street: string; city: string; state: string; zip: string;
  designate: boolean;
  preferredSchoolId?: string | null;
  eDeliveryConsent: boolean;
  ip?: string; userAgent?: string; userId?: string | null;
}

/**
 * Creates donor rows, designation consents, and pledged gifts, then a Stripe Checkout session.
 * Before credit-eligible giving opens (or before Lionheart is on the IRS SGO list) the card is saved
 * (setup mode) and charged later by the chargePledges job, which reconfirms the designation.
 */
export async function startGift(sb: SupabaseClient, r: GiveRequest) {
  const e = env();
  if (r.givers.length < 1 || r.givers.length > 2) throw new Error('one or two givers');
  if (!Number.isInteger(r.totalCents) || r.totalCents < 1000) throw new Error('minimum gift is $10');
  const today = new Date().toISOString().slice(0, 10);
  // Charge on the later of today and Jan 1, 2027; hold every charge until Lionheart is on the IRS SGO list.
  const chargeOn = e.CREDIT_ELIGIBLE_FROM > today ? e.CREDIT_ELIGIBLE_FROM : today;
  const deferred = chargeOn > today || e.SGO_LISTED !== 'true';
  const amounts = r.givers.length === 2 ? splitCouple(r.totalCents) : [r.totalCents];
  const householdKey = crypto.randomUUID();

  const giftIds: string[] = [];
  for (let i = 0; i < r.givers.length; i++) {
    const g = r.givers[i]!; const amount = amounts[i]!;
    const { data: donor, error } = await sb.from('donors').insert({ user_id: r.userId ?? null, legal_name: g.legalName, email: g.email, street: r.street, city: r.city, state: r.state, zip: r.zip,
      household_key: householdKey, e_delivery_consent: r.eDeliveryConsent }).select('id').single();
    if (error || !donor) throw new Error(error?.message);
    const routing = routeGift({ donorType: 'individual', method: 'card', amount, chargeDate: chargeOn, designate: r.designate, priorDesignatedThisYear: 0, excessTo: 'general' });
    let consentId: string | null = null;
    if (routing.qualified) {
      const text = designationText(fmtUSD(routing.creditEligible));
      const { data: c, error: ce } = await sb.from('designation_consents').insert({ donor_id: donor.id, text_version: DESIGNATION_TEXT_VERSION, text_sha256: await sha256(text),
        amount_cents: routing.creditEligible, ip: r.ip ?? null, user_agent: r.userAgent ?? null, context: 'checkout' }).select('id').single();
      if (ce || !c) throw new Error(ce?.message);
      consentId = c.id;
    }
    for (const line of routing.lines) {
      const { data: gift, error: ge } = await sb.from('gifts').insert({ donor_id: donor.id, amount_cents: line.amount, method: 'card', fund: line.fund, designated: line.designated,
        designation_consent_id: line.designated ? consentId : null, state: 'PLEDGED', charge_on: chargeOn, processor: 'stripe',
        preferred_school_id: line.fund === '25F-TN' ? r.preferredSchoolId ?? null : null }).select('id').single();
      if (ge || !gift) throw new Error(ge?.message);
      giftIds.push(gift.id);
    }
  }

  const s = stripe();
  const success = `${e.NEXT_PUBLIC_SITE_URL}/donor?gift=thanks`;
  const cancel = `${e.NEXT_PUBLIC_SITE_URL}/donor/give?cancelled=1`;
  const session = deferred
    ? await s.checkout.sessions.create({ mode: 'setup', currency: 'usd', customer_creation: 'always', customer_email: r.givers[0]!.email,
        payment_method_types: ['card'], success_url: success, cancel_url: cancel, metadata: { gift_ids: giftIds.join(','), deferred: 'true' } })
    : await s.checkout.sessions.create({ mode: 'payment', customer_email: r.givers[0]!.email, success_url: success, cancel_url: cancel,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: r.totalCents, product_data: { name: 'Gift to Lionheart scholarships' } } }],
        payment_intent_data: { metadata: { gift_ids: giftIds.join(',') }, setup_future_usage: undefined },
        metadata: { gift_ids: giftIds.join(',') } });
  await audit(sb, { actorKind: 'person', actorId: r.userId ?? r.givers[0]!.email, action: deferred ? 'pledge_created' : 'checkout_started', entityType: 'gift', after: { giftIds, chargeOn } });
  return { url: session.url, deferred, chargeOn };
}

/** Stripe webhook handler. Idempotent: ledger journals are unique on (kind, ref). */
export async function handleStripeEvent(sb: SupabaseClient, ev: Stripe.Event) {
  if (ev.type === 'checkout.session.completed') {
    const cs = ev.data.object as Stripe.Checkout.Session;
    const ids = (cs.metadata?.gift_ids ?? '').split(',').filter(Boolean);
    if (cs.mode === 'setup') {
      const si = await stripe().setupIntents.retrieve(cs.setup_intent as string);
      await sb.from('gifts').update({ processor_customer: cs.customer as string, processor_payment_method: si.payment_method as string }).in('id', ids);
      return;
    }
    await markCharged(sb, ids, cs.payment_intent as string);
  }
  if (ev.type === 'payment_intent.succeeded') {
    const pi = ev.data.object as Stripe.PaymentIntent;
    const ids = (pi.metadata?.gift_ids ?? '').split(',').filter(Boolean);
    if (ids.length) await markCharged(sb, ids, pi.id);
  }
  if (ev.type === 'payment_intent.payment_failed') {
    const pi = ev.data.object as Stripe.PaymentIntent;
    const ids = (pi.metadata?.gift_ids ?? '').split(',').filter(Boolean);
    await sb.from('gifts').update({ state: 'FAILED' }).in('id', ids);
  }
  if (ev.type === 'charge.dispute.created') {
    const d = ev.data.object as Stripe.Dispute;
    await openTicket(sb, { kind: 'chargeback', entityType: 'gift', severity: 'critical', recommendation: `Dispute ${d.id} on ${d.payment_intent}. Reverse the ledger entry and issue a corrected acknowledgment if the year is closed.` });
  }
}

async function markCharged(sb: SupabaseClient, giftIds: string[], paymentIntent: string) {
  const { data: gifts } = await sb.from('gifts').select('id, amount_cents, fund, state').in('id', giftIds);
  const pi = await stripe().paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge.balance_transaction'] });
  const bt = (pi.latest_charge as Stripe.Charge | null)?.balance_transaction as Stripe.BalanceTransaction | null;
  const fee = bt?.fee ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const g of gifts ?? []) {
    if (!['PLEDGED', 'DESIGNATION_RECONFIRMED', 'FAILED'].includes(g.state)) continue;
    await sb.from('gifts').update({ state: 'CHARGED', processor_ref: `${paymentIntent}:${g.id}`, fee_cents: Math.round(fee * (g.amount_cents / pi.amount)) }).eq('id', g.id);
    const j = giftJournal('', today, `${paymentIntent}:${g.id}`, [{ fund: g.fund, amount: g.amount_cents }]);
    await sb.rpc('svc_post_journal', { p_date: today, p_kind: 'gift', p_ref: j.ref, p_postings: j.postings, p_actor: 'webhook:stripe' });
  }
  // Card fee is absorbed by the operating fund; the reconciliation job moves the matching top-up into the §25F account.
  if (fee) await sb.rpc('svc_post_journal', { p_date: today, p_kind: 'fee_topup', p_ref: paymentIntent, p_actor: 'webhook:stripe',
    p_postings: [{ fund: 'operating', account: 'processing_fees', amount: fee }, { fund: 'operating', account: 'cash', amount: -fee }] });
}

/** Daily job: charges pledges that are due, after re-recording the designation at the moment of charge. */
export async function chargeDuePledges(sb: SupabaseClient) {
  const e = env();
  if (e.SGO_LISTED !== 'true') return { charged: 0, skipped: 'Lionheart is not yet on the IRS SGO list; pledges wait.' };
  const today = new Date().toISOString().slice(0, 10);
  const { data: due } = await sb.from('gifts').select('id, donor_id, amount_cents, fund, designated, processor_customer, processor_payment_method').eq('state', 'PLEDGED').lte('charge_on', today).not('processor_payment_method', 'is', null);
  let charged = 0;
  for (const g of due ?? []) {
    if (g.designated) {
      const text = designationText(fmtUSD(g.amount_cents));
      await sb.from('designation_consents').insert({ donor_id: g.donor_id, text_version: DESIGNATION_TEXT_VERSION, text_sha256: await sha256(text), amount_cents: g.amount_cents, context: 'pledge_charge_reconfirm' });
      await sb.from('gifts').update({ state: 'DESIGNATION_RECONFIRMED' }).eq('id', g.id);
    }
    try {
      await stripe().paymentIntents.create({ amount: g.amount_cents, currency: 'usd', customer: g.processor_customer!, payment_method: g.processor_payment_method!,
        off_session: true, confirm: true, metadata: { gift_ids: g.id } }, { idempotencyKey: `pledge-${g.id}` });
      charged++;
    } catch (err) {
      await sb.from('gifts').update({ state: 'FAILED' }).eq('id', g.id);
      await openTicket(sb, { kind: 'pledge_failed', entityType: 'gift', entityId: g.id, recommendation: `Card declined (${(err as Error).message}). Email the donor a link to update their card.` });
    }
  }
  return { charged };
}

export const METHOD_LABEL: Record<PaymentMethod, string> = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', ach: 'Bank (ACH)', paypal: 'PayPal', check: 'Check', daf: 'Donor-advised fund', stock: 'Stock', crypto: 'Crypto' };
