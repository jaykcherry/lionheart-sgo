'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession, hasRole, supabaseService, supabaseUser } from '@/lib/supabase';
import { runRound, approveRound } from '@/server/awardService';
import { prepareBatch, sendBatch } from '@/server/disbursementService';
import { runCompliance } from '@/server/complianceService';
import { audit } from '@/lib/audit';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
async function ops(boardOnly = false) {
  const s = await getSession();
  if (!s || !hasRole(s, ...(boardOnly ? (['board'] as const) : (['staff', 'board'] as const)))) redirect('/signin?next=/board');
  return s;
}
const back = (msg?: string) => { revalidatePath('/board'); if (msg) redirect('/board?error=' + encodeURIComponent(msg)); };

export async function runComplianceNow() { await ops(); await runCompliance(supabaseService()); back(); }

export async function runAwardRound(f: FormData) {
  const s = await ops();
  const seed = str(f, 'seed');
  if (seed.length < 8) return back('Publish a lottery seed of at least 8 characters before running a round.');
  await runRound(supabaseService(), { cycleId: str(f, 'cycle_id'), name: str(f, 'name'), seed, runBy: s.userId });
  back();
}

export async function approveAwardRound(f: FormData) {
  const s = await ops(true);
  try { await approveRound(supabaseService(), str(f, 'round_id'), s.userId); } catch (e) { return back((e as Error).message); }
  back();
}

export async function prepare(f: FormData) {
  await ops();
  try { await prepareBatch(supabaseService(), str(f, 'term'), str(f, 'name')); } catch (e) { return back((e as Error).message); }
  back();
}

/** Approval runs as the signed-in person through the approve_batch RPC (DB enforces two approvers incl. a board member). */
export async function approve(f: FormData) {
  await ops();
  const { error } = await (await supabaseUser()).rpc('approve_batch', { p_batch: str(f, 'batch_id') });
  back(error?.message);
}

export async function send(f: FormData) {
  const s = await ops(true);
  try { await sendBatch(supabaseService(), str(f, 'batch_id')); } catch (e) { return back((e as Error).message); }
  await audit(supabaseService(), { actorKind: 'person', actorId: s.userId, action: 'batch_send_requested', entityType: 'disbursement_batch', entityId: str(f, 'batch_id') });
  back();
}

export async function decide(f: FormData) {
  await ops();
  const { error } = await (await supabaseUser()).rpc('review_application', { p_application: str(f, 'application_id'), p_to: str(f, 'to'), p_note: str(f, 'note') || 'Reviewed' });
  back(error?.message);
}

export async function resolveTicket(f: FormData) {
  const s = await ops();
  await supabaseService().from('exception_tickets').update({ status: 'resolved', resolution: str(f, 'note') || 'Resolved', resolved_by: s.userId, resolved_at: new Date().toISOString() }).eq('id', str(f, 'ticket_id'));
  back();
}

/** After a staff member phones the school's main office (number on file) and confirms the account. */
export async function confirmPayeeCallback(f: FormData) {
  const s = await ops();
  const sb = supabaseService();
  await sb.from('school_payees').update({ verified_at: new Date().toISOString(), callback_confirmed_at: new Date().toISOString(), callback_confirmed_by: s.userId }).eq('school_id', str(f, 'school_id')).eq('active', true);
  await sb.from('schools').update({ state: 'ACTIVE' }).eq('id', str(f, 'school_id')).in('state', ['AGREEMENT_SIGNED', 'PAYEE_VERIFIED', 'ACTIVE']);
  await audit(sb, { actorKind: 'person', actorId: s.userId, action: 'payee_callback_confirmed', entityType: 'school', entityId: str(f, 'school_id') });
  back();
}

export async function grantRole(f: FormData) {
  const s = await ops(true);
  const sb = supabaseService();
  const { data: p } = await sb.from('profiles').select('id').eq('email', str(f, 'email').toLowerCase()).single();
  if (!p) return back('That person must sign in once before you can grant access.');
  await sb.from('user_roles').insert({ user_id: p.id, role: str(f, 'role') });
  await sb.from('profiles').update({ mfa_required: true }).eq('id', p.id);
  if (str(f, 'role') !== 'staff') await sb.from('dq_persons').insert({ full_name: str(f, 'full_name'), role: str(f, 'role') === 'board' ? 'director' : 'selection_participant', year: new Date().getFullYear(), source: 'role_grant' });
  await audit(sb, { actorKind: 'person', actorId: s.userId, action: 'role_granted', entityType: 'profile', entityId: p.id, after: { role: str(f, 'role') } });
  back();
}
