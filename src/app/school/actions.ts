'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSession, supabaseService, supabaseUser } from '@/lib/supabase';
import { startClaim, verifyClaim, signAgreement, requestPayeeChange } from '@/server/schoolClaimService';
import { reportWithdrawal } from '@/server/disbursementService';
import { AGREEMENT_TEXT } from './agreement';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
async function me() { const s = await getSession(); if (!s) redirect('/signin'); return s; }
async function mySchool(slug?: string) {
  const s = await me();
  const sb = supabaseService();
  const { data: school } = slug ? await sb.from('schools').select('id, slug').eq('slug', slug).single() : { data: null };
  return { s, sb, school };
}

export async function claimStart(f: FormData) {
  const { s, sb, school } = await mySchool(str(f, 'slug'));
  const how = str(f, 'how'); // 'domain' or 'directory:<index>'
  const method = how.startsWith('directory') ? 'directory' as const : 'domain' as const;
  let sent = '';
  try {
    const r = await startClaim(sb, { schoolId: school!.id, userId: s.userId, userEmail: s.email, fullName: str(f, 'full_name'), title: str(f, 'title'), method,
      email: str(f, 'email'), contactIndex: method === 'directory' ? Number(how.split(':')[1] ?? 0) : undefined });
    sent = r.sentTo;
  } catch (e) { redirect(`/school/claim/${str(f, 'slug')}?error=${encodeURIComponent((e as Error).message)}`); }
  redirect(`/school/claim/${str(f, 'slug')}?step=code&via=${method}&to=${encodeURIComponent(sent)}`);
}

export async function claimVerify(f: FormData) {
  const { s, sb, school } = await mySchool(str(f, 'slug'));
  try { await verifyClaim(sb, { schoolId: school!.id, userId: s.userId, code: str(f, 'code') }); }
  catch (e) { redirect(`/school/claim/${str(f, 'slug')}?step=code&error=${encodeURIComponent((e as Error).message)}`); }
  redirect(`/school/claim/${str(f, 'slug')}?step=agreement`);
}

export async function claimSign(f: FormData) {
  const { s, sb, school } = await mySchool(str(f, 'slug'));
  if (!s.roles.some((r) => r.role === 'school_admin' && r.school_id === school!.id)) redirect('/schools');
  if (f.get('agree') !== 'on') redirect(`/school/claim/${str(f, 'slug')}?step=agreement&error=${encodeURIComponent('Tick the box to accept the terms.')}`);
  await signAgreement(sb, { schoolId: school!.id, userId: s.userId, text: AGREEMENT_TEXT, ip: (await headers()).get('x-forwarded-for')?.split(',')[0] });
  redirect('/school?welcome=1');
}

/**
 * Bank details are entered into the payment provider's hosted form; we receive only a token and last 4.
 * This action records the token and opens the mandatory callback ticket.
 */
export async function payeeSubmit(f: FormData) {
  const s = await me();
  const schoolId = s.roles.find((r) => r.role === 'school_admin')?.school_id;
  if (!schoolId) redirect('/schools');
  await requestPayeeChange(supabaseService(), { schoolId, userId: s.userId, legalName: str(f, 'legal_name'), ein: str(f, 'ein'), processorAccountRef: str(f, 'account_token'), last4: str(f, 'last4') });
  revalidatePath('/school');
}

export async function confirmRoster(f: FormData) {
  await me();
  const sb = await supabaseUser();
  const term = str(f, 'term');
  for (const [k, v] of f.entries()) {
    if (!k.startsWith('enrolled_')) continue;
    const awardId = k.slice('enrolled_'.length);
    const { error } = await sb.rpc('confirm_enrollment', { p_award: awardId, p_term: term, p_enrolled: v === 'yes', p_tuition_cents: null });
    if (error) redirect('/school?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/school');
}

export async function withdraw(f: FormData) {
  const s = await me();
  const awardId = str(f, 'award_id');
  const sbUser = await supabaseUser();
  const { data: visible } = await sbUser.from('school_roster').select('award_id').eq('award_id', awardId).limit(1);
  if (!visible?.length) redirect('/school?error=' + encodeURIComponent('That student isn’t on your roster.'));
  await reportWithdrawal(supabaseService(), { awardId, term: str(f, 'term'), daysEnrolled: Number(str(f, 'days')), reportedBy: s.userId });
  revalidatePath('/school');
}
