import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBatch, canRelease, scholarshipJournal, refundJournal, refundDue, batchSafety, netRefunds, fmtUSD, type PaymentGate, type SchoolPayee, type TermAward } from '@/domain';
import { sendEmail } from '@/lib/email';
import { openTicket } from '@/lib/audit';
import { opsAlertEmails } from './mail';
import { payoutProvider } from './payouts';
import { audit } from '@/lib/audit';

const PREPARER = 'job:disbursement-preparer';

/** Builds (or rebuilds) the term batch from current gates. Run by the scheduled job ~5 days before pay date. */
export async function prepareBatch(sb: SupabaseClient, term: string, name: string, asOf = new Date().toISOString().slice(0, 10)) {
  const { data: terms } = await sb.from('award_terms').select('award_id, term, amount_cents, awards!inner(application_id, applications!inner(id, school_id, household_id, state, hold_reason))').eq('term', term);
  const { data: sentLines } = await sb.from('disbursement_lines').select('award_id').eq('term', term).eq('status', 'SENT');
  const sent = new Set((sentLines ?? []).map((l) => l.award_id));
  const awards: TermAward[] = []; const gates: Record<string, PaymentGate> = {};
  const { data: confirms } = await sb.from('enrollment_confirmations').select('award_id, enrolled').eq('term', term);
  const { data: resid } = await sb.from('residency_attestations').select('household_id').eq('term', term);
  const residSet = new Set((resid ?? []).map((r) => r.household_id));
  for (const raw of terms ?? []) {
    const t = raw as unknown as { award_id: string; amount_cents: number; awards: { applications: { id: string; school_id: string; household_id: string; state: string; hold_reason: string | null } } };
    if (sent.has(t.award_id)) continue;
    const app = t.awards.applications;
    awards.push({ awardId: t.award_id, studentId: app.id, schoolId: app.school_id, term, amount: t.amount_cents });
    gates[t.award_id] = {
      enrollmentConfirmed: !!confirms?.find((c) => c.award_id === t.award_id && c.enrolled),
      residencyReattested: residSet.has(app.household_id),
      hold: app.state === 'HELD' ? app.hold_reason ?? 'Held' : ['WITHDRAWN', 'DECLINED', 'CLOSED'].includes(app.state) ? app.state.toLowerCase() : app.state === 'AWARDED' ? 'Family has not accepted' : undefined,
    };
  }
  const { data: payees } = await sb.from('school_payees').select('school_id, verified_at, changed_at, email_confirmed_at, payable_after, replaces_payee_id').eq('active', true);
  const payeeMap: Record<string, SchoolPayee> = {};
  for (const p of payees ?? []) payeeMap[p.school_id] = { schoolId: p.school_id, verified: !!p.verified_at, changedAt: p.changed_at?.slice(0, 10), emailConfirmed: !!p.email_confirmed_at, payableAfter: p.payable_after ?? undefined };
  const { data: cash } = await sb.from('ledger_postings').select('amount_cents').eq('fund', '25F-TN').eq('account', 'cash');
  const segCash = (cash ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);

  const batch = buildBatch(name, term, awards, gates, payeeMap, asOf, segCash);
  const payOn = term === 'spring' ? `${Number(asOf.slice(0, 4)) + (asOf.slice(5, 7) >= '07' ? 1 : 0)}-01-20` : `${asOf.slice(0, 4)}-08-20`;
  const { data: row, error } = await sb.from('disbursement_batches').upsert({ name, term, state: 'DRAFT', prepared_by: PREPARER, ready_total_cents: batch.readyTotal, pay_on: payOn < asOf ? asOf : payOn }, { onConflict: 'name' }).select('id, state').single();
  if (error || !row) throw new Error(error?.message);
  if (row.state !== 'DRAFT' && row.state !== 'PREPARED') throw new Error(`batch ${name} is ${row.state}; cannot rebuild`);
  await sb.from('disbursement_lines').delete().eq('batch_id', row.id);
  if (batch.lines.length) await sb.from('disbursement_lines').insert(batch.lines.map((l) => ({ batch_id: row.id, award_id: l.awardId, school_id: l.schoolId, term, amount_cents: l.amount, status: l.status, blockers: l.blockers })));
  if (row.state === 'DRAFT') await sb.rpc('svc_transition_batch', { p_batch: row.id, p_to: 'PREPARED', p_actor_id: PREPARER });
  return { ...batch, batchId: row.id, batchName: batch.batchId };
}

interface BatchPlan { b: { id: string; name: string; state: string; term: string }; lines: { award_id: string; school_id: string; amount_cents: number }[];
  bySchool: Record<string, number>; pay: Record<string, number>; netted: { refundId: string; schoolId: string; amount: number; reportedAt: string }[]; problems: string[] }

/** What a batch would pay right now, after refund netting, plus every automated safety problem. */
export async function planBatch(sb: SupabaseClient, batchId: string): Promise<BatchPlan> {
  const { data: b } = await sb.from('disbursement_batches').select('id, name, state, term').eq('id', batchId).single();
  if (!b) throw new Error('batch not found');
  const { data: lines } = await sb.from('disbursement_lines').select('award_id, school_id, amount_cents').eq('batch_id', batchId).eq('status', 'READY');
  const bySchool: Record<string, number> = {};
  for (const l of lines ?? []) bySchool[l.school_id] = (bySchool[l.school_id] ?? 0) + l.amount_cents;
  const schools = Object.keys(bySchool).length ? Object.keys(bySchool) : ['00000000-0000-0000-0000-000000000000'];
  const { data: owed } = await sb.from('refunds').select('id, school_id, amount_cents, reported_at').is('received_at', null).is('netted_batch_id', null).gt('amount_cents', 0).in('school_id', schools);
  const { pay, applied } = netRefunds(bySchool, (owed ?? []).map((r) => ({ refundId: r.id, schoolId: r.school_id!, amount: r.amount_cents, reportedAt: r.reported_at })));
  const { data: terms } = await sb.from('award_terms').select('amount_cents, awards!inner(applications!inner(school_id))').eq('term', b.term);
  const awarded: Record<string, number> = {};
  for (const t of (terms ?? []) as unknown as { amount_cents: number; awards: { applications: { school_id: string } } }[]) awarded[t.awards.applications.school_id] = (awarded[t.awards.applications.school_id] ?? 0) + t.amount_cents;
  const { data: sentRows } = await sb.from('disbursement_lines').select('school_id, amount_cents').eq('term', b.term).eq('status', 'SENT');
  const sent: Record<string, number> = {};
  for (const r of sentRows ?? []) sent[r.school_id] = (sent[r.school_id] ?? 0) + r.amount_cents;
  const { data: cash } = await sb.from('ledger_postings').select('amount_cents').eq('fund', '25F-TN').eq('account', 'cash');
  const segCash = (cash ?? []).reduce((x, r) => x + Number(r.amount_cents), 0);
  const { data: appr } = await sb.from('batch_approvals').select('approved_at').eq('batch_id', batchId).order('approved_at').limit(1);
  const firstApproval = appr?.[0]?.approved_at as string | undefined;
  const { data: payees } = await sb.from('school_payees').select('school_id, changed_at, email_confirmed_at').eq('active', true).in('school_id', schools);
  const changed = firstApproval ? (payees ?? []).filter((p) => (p.changed_at && p.changed_at > firstApproval) || (p.email_confirmed_at && p.email_confirmed_at > firstApproval)).map((p) => p.school_id) : [];
  const problems = batchSafety({ bySchool, awardedForTermBySchool: awarded, alreadySentForTermBySchool: sent, segregatedCash: segCash, payeeChangedSince: changed });
  return { b, lines: lines ?? [], bySchool, pay, netted: applied, problems };
}

/**
 * Sends a batch after two approvals (enforced again by the DB trigger), through the bank's API, netting refunds
 * schools owe. Runs from the pay-date job once both approvals are in. Safety checks run again first.
 */
export async function sendBatch(sb: SupabaseClient, batchId: string) {
  const plan = await planBatch(sb, batchId);
  const { b } = plan;
  if (b.state !== 'APPROVED_2') throw new Error('batch is not fully approved');
  const { data: approvals } = await sb.from('batch_approvals').select('user_id, approved_at').eq('batch_id', batchId);
  const ok = canRelease((approvals ?? []).map((a) => ({ userId: a.user_id, at: a.approved_at })), PREPARER);
  if (!ok.ok) throw new Error(ok.reason);
  if (plan.problems.length) {
    await sb.from('disbursement_batches').update({ safety_problems: plan.problems }).eq('id', batchId);
    await openTicket(sb, { kind: 'payment_blocked', entityType: 'disbursement_batch', entityId: batchId, severity: 'critical', recommendation: plan.problems.join(' ') });
    throw new Error(`Payment blocked by safety checks: ${plan.problems.join(' ')}`);
  }
  const { data: payees } = await sb.from('school_payees').select('school_id, processor_account_ref').eq('active', true);
  const res = await payoutProvider().send(b.name, Object.entries(plan.pay).filter(([, a]) => a > 0).map(([schoolId, amountCents]) => ({
    schoolId, amountCents, payeeRef: payees?.find((p) => p.school_id === schoolId)?.processor_account_ref ?? '', memo: `Lionheart ${b.name}`, idempotencyKey: `${b.name}:${schoolId}`,
  })));
  const today = new Date().toISOString().slice(0, 10);
  for (const l of plan.lines) {
    const j = scholarshipJournal('', today, `${b.name}:${l.award_id}`, l.amount_cents);
    await sb.rpc('svc_post_journal', { p_date: today, p_kind: 'scholarship_payment', p_ref: j.ref, p_postings: j.postings, p_actor: 'job:disbursement' });
  }
  for (const r of plan.netted) {
    const j = refundJournal('', today, `refund:${r.refundId}:netted:${b.name}`, r.amount);
    await sb.rpc('svc_post_journal', { p_date: today, p_kind: 'school_refund', p_ref: j.ref, p_postings: j.postings, p_actor: 'job:disbursement' });
    await sb.from('refunds').update({ received_at: new Date().toISOString(), netted_batch_id: batchId }).eq('id', r.refundId);
  }
  await sb.from('disbursement_lines').update({ status: 'SENT' }).eq('batch_id', batchId).eq('status', 'READY');
  await sb.from('disbursement_batches').update({ provider_ref: res.providerRef, sent_at: new Date().toISOString() }).eq('id', batchId);
  await sb.rpc('svc_transition_batch', { p_batch: batchId, p_to: 'SENT', p_actor_id: 'job:disbursement' });
  for (const l of plan.lines) {
    const { data: aw } = await sb.from('awards').select('application_id, applications(state)').eq('id', l.award_id).single();
    const st = (aw as unknown as { applications: { state: string } } | null)?.applications.state;
    if (aw && st === 'SCHOOL_CONFIRMED') await sb.rpc('svc_transition_application', { p_app: aw.application_id, p_to: 'ACTIVE', p_actor_kind: 'job', p_actor_id: 'job:disbursement' });
  }
  // Remittance advice to each school: students paid, refunds netted.
  for (const [schoolId, amt] of Object.entries(plan.pay)) {
    const nettedHere = plan.netted.filter((r) => r.schoolId === schoolId);
    for (const to of await schoolAdminEmails(sb, schoolId)) await sendEmail({ to, subject: `Lionheart payment ${b.name}: ${fmtUSD(amt, { cents: true })}`,
      text: [`We sent ${fmtUSD(amt, { cents: true })} by ACH for ${plan.lines.filter((l) => l.school_id === schoolId).length} Lionheart student(s), ${b.term} term.`,
        nettedHere.length ? `This is net of ${fmtUSD(nettedHere.reduce((x, r) => x + r.amount, 0), { cents: true })} in refunds owed after withdrawals; those are now settled.` : '',
        `Student detail: ${process.env.NEXT_PUBLIC_SITE_URL}/school`].filter(Boolean).join('\n') });
  }
  return { providerRef: res.providerRef, file: res.file, total: Object.values(plan.pay).reduce((a, c) => a + c, 0), netted: plan.netted.length };
}

export async function schoolAdminEmails(sb: SupabaseClient, schoolId: string) {
  const { data } = await sb.from('user_roles').select('profiles(email)').eq('role', 'school_admin').eq('school_id', schoolId);
  return ((data ?? []) as unknown as { profiles: { email: string } }[]).map((r) => r.profiles.email);
}

/** Approval request to staff and board when a batch is prepared, and daily reminders from 3 days before the pay date. */
export async function requestBatchApproval(sb: SupabaseClient, batchId: string, reminder = false) {
  const plan = await planBatch(sb, batchId);
  const { data: ops } = await sb.from('user_roles').select('role, profiles(email)').in('role', ['staff', 'board']);
  const to = [...new Set([...((ops ?? []) as unknown as { profiles: { email: string } }[]).map((r) => r.profiles.email), ...opsAlertEmails()])];
  const total = Object.values(plan.pay).reduce((a, c) => a + c, 0);
  for (const e of to) await sendEmail({ to: e, subject: `${reminder ? 'Reminder: ' : ''}Approve school payments ${plan.b.name} (${fmtUSD(total)})`,
    text: [`${plan.b.name} is ready: ${fmtUSD(total)} to ${Object.keys(plan.pay).length} schools for ${plan.lines.length} students${plan.netted.length ? `, after netting ${plan.netted.length} refund(s) schools owe` : ''}.`,
      plan.problems.length ? `Safety checks found problems and the batch cannot send until they're fixed:\n${plan.problems.map((p) => '• ' + p).join('\n')}` : 'All automated safety checks passed.', '',
      `Two approvals are needed (the second from a board officer). Once both are in, it sends itself by ACH on the pay date. Review and approve: ${process.env.NEXT_PUBLIC_SITE_URL}/board#payments`].join('\n') });
}

/** School reports a withdrawal; refund owed is prorated by days enrolled out of the term. */
export async function reportWithdrawal(sb: SupabaseClient, p: { awardId: string; term: string; daysEnrolled: number; termDays?: number; reportedBy: string }) {
  const termDays = p.termDays ?? 90;
  const { data: paid } = await sb.from('disbursement_lines').select('amount_cents').eq('award_id', p.awardId).eq('term', p.term).eq('status', 'SENT').maybeSingle();
  const amount = paid ? refundDue(paid.amount_cents, p.daysEnrolled, termDays) : 0;
  const { data: aw } = await sb.from('awards').select('application_id, applications(school_id)').eq('id', p.awardId).single();
  const schoolId = (aw as unknown as { applications: { school_id: string } } | null)?.applications.school_id ?? null;
  const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await sb.from('refunds').insert({ award_id: p.awardId, school_id: schoolId, term: p.term, days_enrolled: p.daysEnrolled, term_days: termDays, amount_cents: amount, reported_by: p.reportedBy, due_on: due, invoice_sent_at: amount > 0 ? new Date().toISOString() : null });
  if (amount > 0 && schoolId) for (const to of await schoolAdminEmails(sb, schoolId)) await sendEmail({ to, subject: `Refund due to Lionheart: ${fmtUSD(amount, { cents: true })}`,
    text: [`Thanks for reporting the withdrawal. The unused share of this term's scholarship is ${fmtUSD(amount, { cents: true })} (${p.daysEnrolled} of ${termDays} days enrolled).`,
      `You can return it by ${due}, or do nothing: it will be deducted automatically from your next Lionheart payment.`].join('\n') });
  if (aw) await sb.rpc('svc_transition_application', { p_app: aw.application_id, p_to: 'WITHDRAWN', p_actor_kind: 'person', p_actor_id: p.reportedBy });
  await audit(sb, { actorKind: 'person', actorId: p.reportedBy, action: 'withdrawal_reported', entityType: 'award', entityId: p.awardId, after: { amount } });
  return { refundDue: amount };
}
