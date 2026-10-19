import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { audit } from '@/lib/audit';

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?|live|msn)\./i;
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** "al•••@gmail.com" — enough for the claimant to recognize the inbox, not enough to harvest it. */
export function maskEmail(e: string) {
  const [local = '', dom = ''] = e.split('@');
  return (local.length > 3 ? local.slice(0, 2) : local.slice(0, 1)) + '•••@' + dom;
}

export type VerifyOptions = { domains: string[]; contacts: { index: number; masked: string }[] };

/** The two ways to verify, both by email: an address on the school's own domain, or the school's official
 *  contact address in the Tennessee Department of Education directory (works for gmail-only schools). */
export async function verifyOptions(sb: SupabaseClient, schoolId: string): Promise<VerifyOptions> {
  const { data: school } = await sb.from('schools').select('email_domain, alt_email_domain').eq('id', schoolId).single();
  const { data: contacts } = await sb.from('school_contacts').select('email, kind').eq('school_id', schoolId).order('kind', { ascending: false });
  return {
    domains: [school?.email_domain, school?.alt_email_domain].filter(Boolean).map((d) => String(d).toLowerCase()),
    contacts: (contacts ?? []).map((c, index) => ({ index, masked: maskEmail(c.email) })),
  };
}

const DIRECTORY_SENDS_PER_DAY = 3;

/**
 * Step 1: a school administrator says "this is my school". We email a six-digit code either
 *  - method 'domain': to the claimant's own address on the school's email domain (expires in 15 minutes), or
 *  - method 'directory': to the school's contact address on file with TDOE (expires in 48 hours). That email names
 *    the claimant, so whoever reads the school's official inbox decides whether to pass the code on.
 * No phone calls in either path.
 */
export async function startClaim(sb: SupabaseClient, p: { schoolId: string; userId: string; userEmail: string; fullName: string; title: string; method: 'domain' | 'directory'; email?: string; contactIndex?: number }) {
  const { data: school } = await sb.from('schools').select('id, name, email_domain, alt_email_domain, state').eq('id', p.schoolId).single();
  if (!school) throw new Error('School not found.');
  if (!['UNCLAIMED', 'CLAIM_PENDING'].includes(school.state)) throw new Error('This school is already claimed. Ask your colleague to add you, or email schools@lionheartscholars.org.');
  if (!p.fullName.trim()) throw new Error('Add your full name.');
  const opts = await verifyOptions(sb, school.id);
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
  let sendTo: string; let minutes: number; let text: string;

  if (p.method === 'domain') {
    const email = (p.email ?? '').trim().toLowerCase();
    if (!opts.domains.length) throw new Error(`${school.name} has no school email domain on file. Choose the school’s email on file with the state instead.`);
    if (FREE_MAIL.test(email) || !opts.domains.some((d) => email.endsWith('@' + d))) throw new Error(`Use your @${opts.domains[0]} address, or send the code to the school’s email on file with the state.`);
    sendTo = email; minutes = 15;
    text = `Your code to verify ${school.name} with Lionheart is ${code}. It expires in 15 minutes. If you didn't request this, ignore this email.`;
  } else {
    const { data: contacts } = await sb.from('school_contacts').select('email, kind').eq('school_id', school.id).order('kind', { ascending: false });
    const target = (contacts ?? [])[p.contactIndex ?? 0];
    if (!target) throw new Error(`We don’t have an email for ${school.name} from the state directory. Email schools@lionheartscholars.org from your school address and we’ll help.`);
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await sb.from('school_claims').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('method', 'directory').gte('created_at', since);
    if ((count ?? 0) >= DIRECTORY_SENDS_PER_DAY) throw new Error('We’ve already sent several codes to this school’s inbox today. Ask the person who reads it to check for our email, or try again tomorrow.');
    sendTo = target.email; minutes = 48 * 60;
    const first = p.fullName.trim().split(/\s+/)[0];
    text = [`${p.fullName.trim()} (${p.title}, ${p.userEmail}) asked to set up ${school.name} as a Lionheart partner school.`,
      `We sent this to ${school.name}'s email address on file with the Tennessee Department of Education, so the school can confirm the request.`,
      ``, `If ${first} should manage scholarship enrollment and payments for your school, give them this code: ${code}`,
      `It expires in 48 hours.`, ``,
      `If you don't recognize this request, don't share the code. You can ignore this email or tell us at schools@lionheartscholars.org.`,
      ``, `Lionheart Tennessee · lionheartscholars.org`].join('\n');
  }

  await sb.from('school_claims').insert({ school_id: school.id, user_id: p.userId, title: p.title, full_name: p.fullName.trim(), email: p.userEmail.toLowerCase(), method: p.method, sent_to: sendTo,
    code_hash: await sha(`${school.id}:${code}`), expires_at: new Date(Date.now() + minutes * 60_000).toISOString() });
  if (school.state === 'UNCLAIMED') await sb.from('schools').update({ state: 'CLAIM_PENDING' }).eq('id', school.id);
  await sendEmail({ to: sendTo, subject: p.method === 'domain' ? `Your Lionheart verification code: ${code}` : `${p.fullName.trim()} asked to set up ${school.name} on Lionheart`, text });
  await audit(sb, { actorKind: 'person', actorId: p.userId, action: 'school_claim_code_sent', entityType: 'school', entityId: school.id, after: { method: p.method, sent_to: maskEmail(sendTo) } });
  return { method: p.method, sentTo: maskEmail(sendTo), minutes };
}

/** Step 2: verify the code (5 attempts). On success the user becomes a school_admin for that school. */
export async function verifyClaim(sb: SupabaseClient, p: { schoolId: string; userId: string; code: string }) {
  const { data: claim } = await sb.from('school_claims').select('id, code_hash, expires_at, attempts, verified_at, method').eq('school_id', p.schoolId).eq('user_id', p.userId)
    .order('created_at', { ascending: false }).limit(1).single();
  if (!claim) throw new Error('Start again: no code was requested.');
  if (claim.attempts >= 5) throw new Error('Too many attempts. Request a new code.');
  if (new Date(claim.expires_at) < new Date()) throw new Error('That code has expired. Request a new one.');
  if (claim.verified_at) throw new Error('This code was already used.');
  await sb.from('school_claims').update({ attempts: claim.attempts + 1 }).eq('id', claim.id);
  if ((await sha(`${p.schoolId}:${p.code.trim()}`)) !== claim.code_hash) throw new Error('That code doesn’t match. Check the latest email.');
  await sb.from('school_claims').update({ verified_at: new Date().toISOString() }).eq('id', claim.id);
  await sb.from('user_roles').insert({ user_id: p.userId, role: 'school_admin', school_id: p.schoolId });
  await sb.from('profiles').update({ mfa_required: true }).eq('id', p.userId);
  await sb.from('schools').update({ state: 'DOMAIN_VERIFIED' }).eq('id', p.schoolId);
  await audit(sb, { actorKind: 'person', actorId: p.userId, action: 'school_claim_verified', entityType: 'school', entityId: p.schoolId, after: { method: claim.method } });
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
