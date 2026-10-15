import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBatch, canRelease, scholarshipJournal, refundDue, type PaymentGate, type SchoolPayee, type TermAward } from '@/domain';
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
  const { data: payees } = await sb.from('school_payees').select('school_id, verified_at, changed_at, callback_confirmed_at').eq('active', true);
  const payeeMap: Record<string, SchoolPayee> = {};
  for (const p of payees ?? []) payeeMap[p.school_id] = { schoolId: p.school_id, verified: !!p.verified_at, changedAt: p.changed_at?.slice(0, 10), callbackConfirmed: !!p.callback_confirmed_at };
  const { data: cash } = await sb.from('ledger_postings').select('amount_cents').eq('fund', '25F-TN').eq('account', 'cash');
  const segCash = (cash ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);

  const batch = buildBatch(name, term, awards, gates, payeeMap, asOf, segCash);
  const { data: row, error } = await sb.from('disbursement_batches').upsert({ name, term, state: 'DRAFT', prepared_by: PREPARER, ready_total_cents: batch.readyTotal }, { onConflict: 'name' }).select('id, state').single();
  if (error || !row) throw new Error(error?.message);
  if (row.state !== 'DRAFT' && row.state !== 'PREPARED') throw new Error(`batch ${name} is ${row.state}; cannot rebuild`);
  await sb.from('disbursement_lines').delete().eq('batch_id', row.id);
  if (batch.lines.length) await sb.from('disbursement_lines').insert(batch.lines.map((l) => ({ batch_id: row.id, award_id: l.awardId, school_id: l.schoolId, term, amount_cents: l.amount, status: l.status, blockers: l.blockers })));
  if (row.state === 'DRAFT') await sb.rpc('svc_transition_batch', { p_batch: row.id, p_to: 'PREPARED', p_actor_id: PREPARER });
  return { ...batch, batchId: row.id, batchName: batch.batchId };
}

/** Sends a batch after two approvals (enforced again by the DB trigger). Posts scholarship journals. */
export async function sendBatch(sb: SupabaseClient, batchId: string) {
  const { data: b } = await sb.from('disbursement_batches').select('id, name, state, term').eq('id', batchId).single();
  if (!b || b.state !== 'APPROVED_2') throw new Error('batch is not fully approved');
  const { data: approvals } = await sb.from('batch_approvals').select('user_id, approved_at').eq('batch_id', batchId);
  const ok = canRelease((approvals ?? []).map((a) => ({ userId: a.user_id, at: a.approved_at })), PREPARER);
  if (!ok.ok) throw new Error(ok.reason);
  const { data: lines } = await sb.from('disbursement_lines').select('award_id, school_id, amount_cents').eq('batch_id', batchId).eq('status', 'READY');
  const bySchool = new Map<string, number>();
  for (const l of lines ?? []) bySchool.set(l.school_id, (bySchool.get(l.school_id) ?? 0) + l.amount_cents);
  const { data: payees } = await sb.from('school_payees').select('school_id, processor_account_ref').eq('active', true);
  const res = await payoutProvider().send(b.name, [...bySchool.entries()].map(([schoolId, amountCents]) => ({
    schoolId, amountCents, payeeRef: payees?.find((p) => p.school_id === schoolId)?.processor_account_ref ?? '', memo: `Lionheart ${b.name}`, idempotencyKey: `${b.name}:${schoolId}`,
  })));
  const today = new Date().toISOString().slice(0, 10);
  for (const l of lines ?? []) {
    const j = scholarshipJournal('', today, `${b.name}:${l.award_id}`, l.amount_cents);
    await sb.rpc('svc_post_journal', { p_date: today, p_kind: 'scholarship_payment', p_ref: j.ref, p_postings: j.postings, p_actor: 'job:disbursement' });
  }
  await sb.from('disbursement_lines').update({ status: 'SENT' }).eq('batch_id', batchId).eq('status', 'READY');
  await sb.from('disbursement_batches').update({ provider_ref: res.providerRef }).eq('id', batchId);
  await sb.rpc('svc_transition_batch', { p_batch: batchId, p_to: 'SENT', p_actor_id: 'job:disbursement' });
  for (const l of lines ?? []) {
    const { data: aw } = await sb.from('awards').select('application_id, applications(state)').eq('id', l.award_id).single();
    const st = (aw as unknown as { applications: { state: string } } | null)?.applications.state;
    if (aw && st === 'SCHOOL_CONFIRMED') await sb.rpc('svc_transition_application', { p_app: aw.application_id, p_to: 'ACTIVE', p_actor_kind: 'job', p_actor_id: 'job:disbursement' });
  }
  return { providerRef: res.providerRef, file: res.file, total: [...bySchool.values()].reduce((a, c) => a + c, 0) };
}

/** School reports a withdrawal; refund owed is prorated by days enrolled out of the term. */
export async function reportWithdrawal(sb: SupabaseClient, p: { awardId: string; term: string; daysEnrolled: number; termDays?: number; reportedBy: string }) {
  const termDays = p.termDays ?? 90;
  const { data: paid } = await sb.from('disbursement_lines').select('amount_cents').eq('award_id', p.awardId).eq('term', p.term).eq('status', 'SENT').maybeSingle();
  const amount = paid ? refundDue(paid.amount_cents, p.daysEnrolled, termDays) : 0;
  await sb.from('refunds').insert({ award_id: p.awardId, term: p.term, days_enrolled: p.daysEnrolled, term_days: termDays, amount_cents: amount, reported_by: p.reportedBy });
  const { data: aw } = await sb.from('awards').select('application_id').eq('id', p.awardId).single();
  if (aw) await sb.rpc('svc_transition_application', { p_app: aw.application_id, p_to: 'WITHDRAWN', p_actor_kind: 'person', p_actor_id: p.reportedBy });
  await audit(sb, { actorKind: 'person', actorId: p.reportedBy, action: 'withdrawal_reported', entityType: 'award', entityId: p.awardId, after: { amount } });
  return { refundDue: amount };
}
