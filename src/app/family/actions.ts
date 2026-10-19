'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { tasks } from '@trigger.dev/sdk';
import { getSession, supabaseUser } from '@/lib/supabase';
import { dollars } from '@/domain';
import { headers } from 'next/headers';
import { supabaseService } from '@/lib/supabase';
import { submitConsent } from '@/server/irsTranscripts';
import { CONSENT_4506C_TEXT, CONSENT_4506C_VERSION } from './irsConsent';

async function household() {
  const s = await getSession();
  const h = s?.roles.find((r) => r.role === 'family' && r.household_id)?.household_id;
  if (!s || !h) redirect('/onboarding');
  return { s, householdId: h, sb: await supabaseUser() };
}
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function saveHousehold(f: FormData) {
  const { sb, householdId } = await household();
  const { error } = await sb.from('households').update({ street: str(f, 'street'), city: str(f, 'city'), zip: str(f, 'zip'), county: str(f, 'county'), state: 'TN',
    residency_exception: str(f, 'exception') || null }).eq('id', householdId);
  if (error) redirect('/family/apply?step=1&error=' + encodeURIComponent(error.message));
  redirect('/family/apply?step=2');
}

export async function addMember(f: FormData) {
  const { sb, householdId } = await household();
  const { error } = await sb.from('household_members').insert({ household_id: householdId, full_name: str(f, 'full_name'), relationship: str(f, 'relationship'),
    dob: str(f, 'dob') || null, is_student: f.get('is_student') === 'on' });
  if (error) redirect('/family/apply?step=2&error=' + encodeURIComponent(error.message));
  redirect('/family/apply?step=2');
}

export async function chooseSchools(f: FormData) {
  const { sb, householdId } = await household();
  const { data: cycle } = await sb.from('cycles').select('id').order('opens_on', { ascending: false }).limit(1).single();
  const { data: kids } = await sb.from('household_members').select('id').eq('household_id', householdId).eq('is_student', true);
  for (const k of kids ?? []) {
    const school = str(f, `school_${k.id}`), grade = str(f, `grade_${k.id}`);
    if (!school || !grade) continue;
    await sb.from('applications').upsert({ household_id: householdId, student_member_id: k.id, cycle_id: cycle!.id, school_id: school, grade }, { onConflict: 'student_member_id,cycle_id' });
    const efs = Number(str(f, `efs_${k.id}`) || 0), aid = Number(str(f, `aid_${k.id}`) || 0);
    const { data: app } = await sb.from('applications').select('id').eq('student_member_id', k.id).eq('cycle_id', cycle!.id).single();
    if (app) await sb.from('other_aid').upsert({ application_id: app.id, efs_cents: dollars(efs), school_aid_cents: dollars(aid), family_attested_at: new Date().toISOString() });
  }
  redirect('/family/apply?step=4');
}

export async function saveIncome(f: FormData) {
  const { sb, householdId } = await household();
  const { data: apps } = await sb.from('applications').select('id').eq('household_id', householdId).eq('state', 'DRAFT');
  const { data: adults } = await sb.from('household_members').select('id').eq('household_id', householdId).eq('is_student', false);
  const year = new Date().getFullYear() - 1;
  const program = str(f, 'program');
  for (const a of apps ?? []) {
    await sb.from('income_items').delete().eq('application_id', a.id);
    if (program) await sb.from('categorical_proofs').upsert({ application_id: a.id, program, letter_date: str(f, 'letter_date'), name_matches: true });
    for (const m of adults ?? []) {
      const amt = Number(str(f, `income_${m.id}`) || 0);
      if (amt > 0) await sb.from('income_items').insert({ application_id: a.id, member_id: m.id, type: 'wages', amount_cents: dollars(amt), year, cash: true, source: 'attestation' });
    }
  }
  for (const m of adults ?? []) await sb.from('household_members').update({ zero_income_attested: f.get(`zero_${m.id}`) === 'on' }).eq('id', m.id);
  redirect('/family/apply?step=5');
}

export async function uploadDocument(f: FormData) {
  const { sb, householdId } = await household();
  const file = f.get('file') as File | null;
  const kind = str(f, 'kind');
  if (!file || !file.size) redirect('/family/apply?step=5&error=' + encodeURIComponent('Choose a file to upload.'));
  if (file.size > 15 * 1024 * 1024) redirect('/family/apply?step=5&error=' + encodeURIComponent('Files must be under 15 MB.'));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const path = `${householdId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const up = await sb.storage.from('documents').upload(path, bytes, { contentType: file.type });
  if (up.error) redirect('/family/apply?step=5&error=' + encodeURIComponent(up.error.message));
  const deleteAfter = new Date(); deleteAfter.setFullYear(deleteAfter.getFullYear() + 3);
  const { data: doc } = await sb.from('documents').insert({ household_id: householdId, kind, storage_path: path, sha256: hash, delete_raw_after: deleteAfter.toISOString().slice(0, 10) }).select('id').single();
  if (doc) await tasks.trigger('document-uploaded', { documentId: doc.id, expectedKind: kind });
  redirect('/family/apply?step=5&uploaded=1');
}

export async function confirmExtraction(f: FormData) {
  const { sb } = await household();
  await sb.from('documents').update({ confirmed_by_parent_at: new Date().toISOString() }).eq('id', str(f, 'document_id'));
  revalidatePath('/family');
}

export async function submitApplications(f: FormData) {
  const { sb, householdId } = await household();
  if (f.get('attest_true') !== 'on' || f.get('attest_verify') !== 'on' || f.get('attest_nodirect') !== 'on') redirect('/family/apply?step=6&error=' + encodeURIComponent('Please confirm all three statements.'));
  const { data: apps } = await sb.from('applications').select('id').eq('household_id', householdId).eq('state', 'DRAFT');
  for (const a of apps ?? []) {
    const { error } = await sb.from('applications').update({ state: 'SUBMITTED', submitted_at: new Date().toISOString() }).eq('id', a.id);
    if (error) redirect('/family/apply?step=6&error=' + encodeURIComponent(error.message));
    await tasks.trigger('application-ready', { applicationId: a.id });
  }
  redirect('/family?submitted=1');
}

export async function acceptAward(f: FormData) {
  const { sb } = await household();
  await sb.rpc('accept_award', { p_application: str(f, 'application_id'), p_accept: str(f, 'accept') === 'yes' });
  revalidatePath('/family');
}

export async function attestResidency(f: FormData) {
  const { sb, householdId } = await household();
  if (f.get('confirm') !== 'on') return;
  await sb.rpc('attest_residency', { p_household: householdId, p_term: str(f, 'term') });
  revalidatePath('/family');
}

/**
 * Form 4506-C e-signature: lets the IRS send last year's tax return transcript to our IVES vendor.
 * The full SSN is passed straight to the vendor and never stored; we keep the last four digits.
 */
export async function signIrsConsent(f: FormData) {
  const { s, householdId } = await household();
  const back = (msg: string) => redirect('/family/apply?step=5&error=' + encodeURIComponent(msg));
  if (f.get('consent') !== 'on') back('Check the box to authorize the IRS request.');
  const status = str(f, 'filing_status') as 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss';
  const memberIds = [str(f, 'member_primary'), str(f, 'member_spouse')].filter(Boolean);
  if (!memberIds.length) back('Choose who filed the return.');
  if (status === 'mfj' && memberIds.length < 2) back('For a joint return, choose both spouses.');
  const typed = str(f, 'signature');
  if (typed.toLowerCase() !== str(f, 'name_on_return').toLowerCase() && typed.toLowerCase() !== str(f, 'spouse_name_on_return').toLowerCase()) back('Type your name exactly as it appears on the return to sign.');
  const h = await headers();
  try {
    await submitConsent(supabaseService(), {
      householdId, taxYear: Number(str(f, 'tax_year')), memberIds, filingStatus: status,
      nameOnReturn: str(f, 'name_on_return'), spouseNameOnReturn: str(f, 'spouse_name_on_return') || undefined,
      ssn: str(f, 'ssn'), spouseSsn: status === 'mfj' ? str(f, 'spouse_ssn') : undefined, addressOnReturn: str(f, 'address_on_return'),
      signerUserId: s.userId, signerTypedName: typed, ip: (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || undefined, userAgent: h.get('user-agent') ?? undefined,
      consentText: CONSENT_4506C_TEXT, consentVersion: CONSENT_4506C_VERSION,
    });
  } catch (e) { back((e as Error).message); }
  redirect('/family/apply?step=5&irs=1');
}
