import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { audit } from '@/lib/audit';

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?|live|msn)\./i;
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Step 1: school admin says "this is my school". We email a 6-digit code to an address on the school's domain. */
export async function startClaim(sb: SupabaseClient, p: { schoolId: string; userId: string; title: string; email: string }) {
  const { data: school } = await sb.from('schools').select('id, name, email_domain, state').eq('id', p.schoolId).single();
  if (!school) throw new Error('School not found.');
  if (!['UNCLAIMED', 'CLAIM_PENDING'].includes(school.state)) throw new Error('This school is already claimed. Ask your colleague to add you, or email schools@lionheartsgo.org.');
  const email = p.email.trim().toLowerCase();
  if (FREE_MAIL.test(email) || !email.endsWith('@' + school.email_domain.toLowerCase())) {
    throw new Error(`Use your @${school.email_domain} address so we can confirm you work at ${school.name}.`);
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
  await sb.from('school_claims').insert({ school_id: school.id, user_id: p.userId, title: p.title, email, code_hash: await sha(`${school.id}:${code}`), expires_at: new Date(Date.now() + 15 * 60_000).toISOString() });
  if (school.state === 'UNCLAIMED') await sb.from('schools').update({ state: 'CLAIM_PENDING' }).eq('id', school.id);
  await sendEmail({ to: email, subject: `Your Lionheart verification code: ${code}`, text: `Your code to verify ${school.name} with Lionheart is ${code}. It expires in 15 minutes. If you didn't request this, ignore this email.` });
}

/** Step 2: verify the code (5 attempts). On success the user becomes a school_admin for that school. */
export async function verifyClaim(sb: SupabaseClient, p: { schoolId: string; userId: string; code: string }) {
  const { data: claim } = await sb.from('school_claims').select('id, code_hash, expires_at, attempts, verified_at').eq('school_id', p.schoolId).eq('user_id', p.userId)
    .order('created_at', { ascending: false }).limit(1).single();
  if (!claim) throw new Error('Start again: no code was requested.');
  if (claim.attempts >= 5) throw new Error('Too many attempts. Request a new code.');
  if (new Date(claim.expires_at) < new Date()) throw new Error('That code has expired. Request a new one.');
  await sb.from('school_claims').update({ attempts: claim.attempts + 1 }).eq('id', claim.id);
  if ((await sha(`${p.schoolId}:${p.code.trim()}`)) !== claim.code_hash) throw new Error('That code doesn’t match. Check the latest email.');
  await sb.from('school_claims').update({ verified_at: new Date().toISOString() }).eq('id', claim.id);
  await sb.from('user_roles').insert({ user_id: p.userId, role: 'school_admin', school_id: p.schoolId });
  await sb.from('profiles').update({ mfa_required: true }).eq('id', p.userId);
  await sb.from('schools').update({ state: 'DOMAIN_VERIFIED' }).eq('id', p.schoolId);
  await audit(sb, { actorKind: 'person', actorId: p.userId, action: 'school_claim_verified', entityType: 'school', entityId: p.schoolId });
}

export const AGREEMENT_VERSION = 'school-partner-2027-v1';
export async function signAgreement(sb: SupabaseClient, p: { schoolId: string; userId: string; text: string; ip?: string }) {
  await sb.from('school_agreements').insert({ school_id: p.schoolId, version: AGREEMENT_VERSION, text_sha256: await sha(p.text), signed_by: p.userId, ip: p.ip ?? null });
  await sb.from('schools').update({ state: 'AGREEMENT_SIGNED' }).eq('id', p.schoolId).eq('state', 'DOMAIN_VERIFIED');
}

/**
 * Bank account changes are the classic disbursement-fraud vector. A new account is not payable until
 * staff confirm it by calling the school's main phone number on file (never a number from the request).
 */
export async function requestPayeeChange(sb: SupabaseClient, p: { schoolId: string; legalName: string; ein: string; processorAccountRef: string; last4: string; userId: string }) {
  await sb.from('school_payees').update({ active: false }).eq('school_id', p.schoolId).eq('active', true);
  await sb.from('school_payees').insert({ school_id: p.schoolId, legal_name: p.legalName, ein: p.ein, processor_account_ref: p.processorAccountRef, last4: p.last4, verified_at: null, active: true });
  await sb.from('exception_tickets').insert({ kind: 'payee_change', entity_type: 'school', entity_id: p.schoolId, severity: 'critical',
    agent_recommendation: 'Call the school’s main office number on file (not any number in the request) and confirm the account ending ' + p.last4 + ' before marking verified.' });
  await audit(sb, { actorKind: 'person', actorId: p.userId, action: 'payee_change_requested', entityType: 'school', entityId: p.schoolId, after: { last4: p.last4 } });
}
