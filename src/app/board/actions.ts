'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession, hasRole, supabaseService, supabaseUser } from '@/lib/supabase';
import { approveRound } from '@/server/awardService';
import { markIrsReportSubmitted } from '@/server/yearEndService';
import { prepareBatch } from '@/server/disbursementService';
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

export async function approveAwardRound(f: FormData) {
  const s = await ops(true);
  try { await approveRound(supabaseService(), str(f, 'round_id'), s.userId); } catch (e) { return back((e as Error).message); }
  const to = str(f, 'return_to');
  if (to.startsWith('/board/rounds/')) { revalidatePath(to); redirect(to); }
  back();
}

export async function irsReportSubmitted(f: FormData) {
  const s = await ops(true);
  const ref = str(f, 'confirmation');
  if (ref.length < 4) return back('Enter the confirmation number the IRS portal showed.');
  try { await markIrsReportSubmitted(supabaseService(), Number(str(f, 'year')), s.userId, ref); } catch (e) { return back((e as Error).message); }
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
