import type { SupabaseClient } from '@supabase/supabase-js';
import { fmtUSD } from '@/domain';
import { sendEmail } from '@/lib/email';
import { openTicket } from '@/lib/audit';
import { prepareBatch, requestBatchApproval, schoolAdminEmails, sendBatch } from './disbursementService';

/**
 * Everything around school payments that used to be someone's job: enrollment and residency reminders,
 * approval requests and reminders, sending on the pay date, catch-up batches for late confirmations,
 * and refund reminders. Two people still approve every batch.
 */
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lionheartscholars.org';
export const TERMS = {
  fall: { opens: (y: number) => `${y}-08-01`, payOn: (y: number) => `${y}-08-20` },
  spring: { opens: (y: number) => `${y}-01-02`, payOn: (y: number) => `${y}-01-20` },
} as const;
const REMINDER_DAYS = [1, 5, 9, 12];

/** Logs a reminder; returns false if this exact reminder already went out (jobs are re-runnable). */
async function once(sb: SupabaseClient, kind: string, term: string, recipient: string, day: number) {
  const { error } = await sb.from('reminder_log').insert({ kind, term, recipient, day });
  return !error;
}

/** Day N of the enrollment window (1-based), or null outside it. */
export function windowDay(term: keyof typeof TERMS, today: string) {
  const y = Number(today.slice(0, 4));
  const d = Math.floor((new Date(today + 'T00:00:00Z').getTime() - new Date(TERMS[term].opens(y) + 'T00:00:00Z').getTime()) / 86_400_000) + 1;
  return d >= 1 && d <= 13 ? d : null;
}

/**
 * Days 1, 5, 9 and 12 of each window: schools with students still unconfirmed get a reminder listing how many;
 * a school with no portal user yet gets it at its TDOE directory address. Families who haven't re-attested
 * Tennessee residency get their own reminder the same days.
 */
export async function enrollmentReminders(sb: SupabaseClient, today = new Date().toISOString().slice(0, 10)) {
  const out = { schools: 0, families: 0 };
  for (const term of ['fall', 'spring'] as const) {
    const day = windowDay(term, today);
    if (!day || !REMINDER_DAYS.includes(day)) continue;
    const key = `${today.slice(0, 4)}-${term}`;
    const { data: terms } = await sb.from('award_terms').select('award_id, awards!inner(application_id, applications!inner(school_id, household_id, state))').eq('term', term);
    const { data: confirms } = await sb.from('enrollment_confirmations').select('award_id').eq('term', term);
    const { data: resid } = await sb.from('residency_attestations').select('household_id').eq('term', term);
    const confirmed = new Set((confirms ?? []).map((c) => c.award_id)), attested = new Set((resid ?? []).map((r) => r.household_id));
    const pendingBySchool = new Map<string, number>(); const families = new Set<string>();
    for (const t of (terms ?? []) as unknown as { award_id: string; awards: { applications: { school_id: string; household_id: string; state: string } } }[]) {
      const a = t.awards.applications;
      if (!['ACCEPTED', 'SCHOOL_CONFIRMED', 'ACTIVE'].includes(a.state)) continue;
      if (!confirmed.has(t.award_id)) pendingBySchool.set(a.school_id, (pendingBySchool.get(a.school_id) ?? 0) + 1);
      if (!attested.has(a.household_id)) families.add(a.household_id);
    }
    for (const [schoolId, n] of pendingBySchool) {
      let to = await schoolAdminEmails(sb, schoolId);
      if (!to.length) { const { data: c } = await sb.from('school_contacts').select('email').eq('school_id', schoolId); to = (c ?? []).map((x) => x.email); }
      for (const e of to) if (await once(sb, 'enrollment', key, e, day)) {
        await sendEmail({ to: e, subject: `${day === 12 ? 'Last day tomorrow: ' : ''}confirm ${n} Lionheart student${n === 1 ? '' : 's'} for ${term}`,
          text: [`${n} Lionheart scholarship student${n === 1 ? ' is' : 's are'} waiting for you to confirm ${term} enrollment. We pay on ${TERMS[term].payOn(Number(today.slice(0, 4)))} for confirmed students only.`,
            `Confirm in about a minute: ${site()}/school`].join('\n') }); out.schools++;
      }
    }
    for (const h of families) {
      const { data: fam } = await sb.from('user_roles').select('profiles(email)').eq('role', 'family').eq('household_id', h);
      for (const r of (fam ?? []) as unknown as { profiles: { email: string } }[]) if (await once(sb, 'residency', key, r.profiles.email, day)) {
        await sendEmail({ to: r.profiles.email, subject: `Confirm you still live in Tennessee (${term} scholarship payment)`,
          text: `Before we pay your child's school for the ${term} term, please confirm your family still lives in Tennessee. It's one click: ${site()}/family` }); out.families++;
      }
    }
  }
  return out;
}

/** Aug 15 / Jan 15: build the term batch and ask for approvals. Then weekly catch-up batches for late confirmations. */
export async function prepareTermBatch(sb: SupabaseClient, term: 'fall' | 'spring', today = new Date().toISOString().slice(0, 10)) {
  const y = Number(today.slice(0, 4));
  const { data: existing } = await sb.from('disbursement_batches').select('id, name, state').eq('term', term).like('name', `${y}-${term.toUpperCase()}-%`).order('name');
  if (existing?.some((b) => b.state !== 'SENT' && b.state !== 'SETTLED')) return { skipped: 'an earlier batch for this term is still open' };
  const name = `${y}-${term.toUpperCase()}-${(existing?.length ?? 0) + 1}`;
  const batch = await prepareBatch(sb, term, name, today);
  if (!batch.readyTotal) { await sb.from('disbursement_batches').delete().eq('id', batch.batchId).eq('state', 'PREPARED'); return { skipped: 'nothing ready' }; }
  await requestBatchApproval(sb, batch.batchId);
  return { name, ready: batch.readyTotal, lines: batch.lines.length };
}

/**
 * Daily: send every fully approved batch whose pay date has arrived; remind approvers daily from 3 days before
 * the pay date; nudge schools about refunds they owe (they're also netted automatically from the next payment).
 */
export async function dailyPayments(sb: SupabaseClient, today = new Date().toISOString().slice(0, 10)) {
  const out = { sent: [] as string[], reminded: 0, refundReminders: 0, errors: [] as string[] };
  const { data: batches } = await sb.from('disbursement_batches').select('id, name, state, pay_on').in('state', ['PREPARED', 'APPROVED_1', 'APPROVED_2']);
  for (const b of batches ?? []) {
    if (b.state === 'APPROVED_2' && b.pay_on && b.pay_on <= today) {
      if ((process.env.PAYOUT_PROVIDER ?? 'manual') === 'manual') {
        // Without a bank API there is nothing to send automatically; never mark a batch sent that wasn't.
        const { data: open } = await sb.from('exception_tickets').select('id').eq('kind', 'payout_provider_missing').eq('entity_id', b.id).limit(1);
        if (!open?.length) await openTicket(sb, { kind: 'payout_provider_missing', entityType: 'disbursement_batch', entityId: b.id, severity: 'critical', recommendation: `${b.name} is approved and due, but no bank API is configured (PAYOUT_PROVIDER=manual). Set up Increase so payments send automatically.` });
        out.errors.push(`${b.name}: no bank API configured`);
        continue;
      }
      try { await sendBatch(sb, b.id); out.sent.push(b.name); } catch (e) { out.errors.push(`${b.name}: ${(e as Error).message}`); }
      continue;
    }
    if (b.state !== 'APPROVED_2' && b.pay_on) {
      const daysLeft = (new Date(b.pay_on + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86_400_000;
      if (daysLeft <= 3 && (await once(sb, 'batch_approval', b.name, 'board', Math.round(daysLeft)))) { await requestBatchApproval(sb, b.id, true); out.reminded++; }
    }
  }
  const { data: owed } = await sb.from('refunds').select('id, school_id, amount_cents, invoice_sent_at, due_on, reminders_sent').is('received_at', null).is('netted_batch_id', null).gt('amount_cents', 0);
  for (const r of owed ?? []) {
    if (!r.invoice_sent_at || !r.school_id) continue;
    const age = (new Date(today + 'T00:00:00Z').getTime() - new Date(r.invoice_sent_at).getTime()) / 86_400_000;
    if ((r.reminders_sent === 0 && age >= 14) || (r.reminders_sent === 1 && age >= 28)) {
      for (const e of await schoolAdminEmails(sb, r.school_id)) await sendEmail({ to: e, subject: `Reminder: ${fmtUSD(r.amount_cents, { cents: true })} refund due to Lionheart by ${r.due_on}`,
        text: `If it isn't returned by ${r.due_on}, it will be deducted automatically from your next Lionheart payment. Nothing else is needed.` });
      await sb.from('refunds').update({ reminders_sent: r.reminders_sent + 1 }).eq('id', r.id); out.refundReminders++;
    }
    if (r.due_on && age >= 120) {
      const { data: open } = await sb.from('exception_tickets').select('id').eq('kind', 'refund_overdue').eq('entity_id', r.id).limit(1);
      if (!open?.length) await openTicket(sb, { kind: 'refund_overdue', entityType: 'refund', entityId: r.id, severity: 'warn', recommendation: 'Refund unpaid for 120 days and no later payment to net it against.' });
    }
  }
  return out;
}
