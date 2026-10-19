import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { audit } from '@/lib/audit';
import { BANK_CHANGE_HOLD_DAYS } from '@/domain';

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?|live|msn)\./i;
export const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

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

export const AGREEMENT_VERSION = 'school-partner-2027-v2';
export async function signAgreement(sb: SupabaseClient, p: { schoolId: string; userId: string; text: string; ip?: string }) {
  await sb.from('school_agreements').insert({ school_id: p.schoolId, version: AGREEMENT_VERSION, text_sha256: await sha(p.text), signed_by: p.userId, ip: p.ip ?? null });
  await sb.from('schools').update({ state: 'AGREEMENT_SIGNED' }).eq('id', p.schoolId).eq('state', 'DOMAIN_VERIFIED');
}

/**
 * Bank account changes are the classic disbursement-fraud vector. Fully automated, no phone calls:
 *  1. The account is linked through the payment provider's bank-link window (ownership verified there; we get a
 *     token and last 4 only).
 *  2. The new account starts PENDING. We email a Confirm link to the school's contact address(es) in the TDOE
 *     directory, which the requester doesn't choose and can't change. The requester and the school's other admins
 *     get a notice with a Cancel link.
 *  3. On Confirm it becomes the active account, payable only after a BANK_CHANGE_HOLD_DAYS cancel window.
 *     Anyone notified can cancel until then, which restores the previous account.
 */
const tokenPair = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return Buffer.from(b).toString('base64url'); };
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lionheartscholars.org').replace(/\/$/, '');

export async function requestPayeeChange(sb: SupabaseClient, p: { schoolId: string; legalName: string; ein: string; processorAccountRef: string; last4: string; userId: string; userEmail: string }) {
  const { data: school } = await sb.from('schools').select('id, name').eq('id', p.schoolId).single();
  if (!school) throw new Error('School not found.');
  const { data: contacts } = await sb.from('school_contacts').select('email, kind').eq('school_id', school.id).order('kind', { ascending: false });
  if (!contacts?.length) throw new Error('We don’t have your school’s email from the state directory, so we can’t confirm a bank change yet. Email schools@lionheartscholars.org.');
  const { data: current } = await sb.from('school_payees').select('id').eq('school_id', school.id).eq('active', true).maybeSingle();
  await sb.from('school_payees').update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() }).eq('school_id', school.id).eq('status', 'PENDING');
  const { data: payee, error } = await sb.from('school_payees').insert({ school_id: school.id, legal_name: p.legalName, ein: p.ein, processor_account_ref: p.processorAccountRef, last4: p.last4,
    verified_at: p.processorAccountRef.startsWith('pending') ? null : new Date().toISOString(), active: false, status: 'PENDING', requested_by: p.userId, replaces_payee_id: current?.id ?? null }).select('id').single();
  if (error || !payee) throw new Error(error?.message ?? 'Could not save the account.');

  const week = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const mk = async (kind: 'confirm' | 'cancel', to: string, expires: string) => {
    const t = tokenPair();
    await sb.from('payee_tokens').insert({ payee_id: payee.id, school_id: school.id, kind, sent_to: to, token_hash: await sha(t), expires_at: expires });
    return `${siteUrl()}/bank-change/${kind}?t=${t}`;
  };
  const what = `a new bank account ending in ${p.last4} (${p.legalName}, EIN ending ${p.ein.slice(-4)})`;
  for (const c of contacts) {
    const confirm = await mk('confirm', c.email, week); const cancel = await mk('cancel', c.email, week);
    await sendEmail({ to: c.email, subject: `Confirm ${school.name}'s new bank account with Lionheart`, text: [
      `Someone signed in as ${p.userEmail} asked Lionheart to send ${school.name}'s scholarship payments to ${what}.`,
      `We sent this to your school's email address on file with the Tennessee Department of Education so the school can confirm it.`, ``,
      `If this is right, confirm it here: ${confirm}`, `If you don't recognize it, cancel it here: ${cancel}`, ``,
      `Nothing changes until someone confirms. After that, we wait ${BANK_CHANGE_HOLD_DAYS} days before paying the new account, and the cancel link keeps working until then.`,
      ``, `Lionheart Tennessee · schools@lionheartscholars.org`].join('\n') });
  }
  const { data: admins } = await sb.from('user_roles').select('profiles(email)').eq('role', 'school_admin').eq('school_id', school.id);
  const notify = new Set<string>([p.userEmail.toLowerCase(), ...((admins ?? []) as unknown as { profiles: { email: string } | null }[]).map((a) => a.profiles?.email?.toLowerCase() ?? '').filter(Boolean)]);
  for (const to of notify) {
    const cancel = await mk('cancel', to, week);
    await sendEmail({ to, subject: `Bank account change requested for ${school.name}`, text: [
      `A request was made to send ${school.name}'s Lionheart payments to ${what}.`,
      `We've asked the school to confirm it from its email address on file with the state (${contacts.map((c) => maskEmail(c.email)).join(' or ')}).`, ``,
      `If you didn't expect this, cancel it: ${cancel}`].join('\n') });
  }
  await audit(sb, { actorKind: 'person', actorId: p.userId, action: 'payee_change_requested', entityType: 'school', entityId: school.id, after: { last4: p.last4, confirm_sent_to: contacts.map((c) => maskEmail(c.email)) } });
  return { sentTo: contacts.map((c) => maskEmail(c.email)) };
}

async function useToken(sb: SupabaseClient, token: string, kind: 'confirm' | 'cancel') {
  const { data: t } = await sb.from('payee_tokens').select('id, payee_id, school_id, sent_to, expires_at, used_at').eq('token_hash', await sha(token)).eq('kind', kind).maybeSingle();
  if (!t) throw new Error('This link isn’t valid. Use the most recent email from Lionheart.');
  if (t.used_at) throw new Error('This link has already been used.');
  if (new Date(t.expires_at) < new Date()) throw new Error('This link has expired. Ask your school administrator to start the change again.');
  return t;
}

/** What a Confirm/Cancel link refers to, for the page shown before the button is pressed (links are never acted on by a GET, so mail scanners can't trigger them). */
export async function payeeTokenInfo(sb: SupabaseClient, token: string, kind: 'confirm' | 'cancel') {
  const t = await useToken(sb, token, kind);
  const { data: payee } = await sb.from('school_payees').select('legal_name, last4, status, payable_after, schools(name)').eq('id', t.payee_id).single();
  return { school: (payee as unknown as { schools: { name: string } }).schools.name, legalName: payee!.legal_name as string, last4: payee!.last4 as string, status: payee!.status as string, payableAfter: payee!.payable_after as string | null };
}

export async function confirmPayeeChange(sb: SupabaseClient, token: string) {
  const t = await useToken(sb, token, 'confirm');
  const { data: payee } = await sb.from('school_payees').select('id, school_id, status, last4').eq('id', t.payee_id).single();
  if (payee?.status !== 'PENDING') throw new Error(payee?.status === 'CANCELLED' ? 'This change was cancelled.' : 'This change was already confirmed.');
  const now = new Date(); const payableAfter = new Date(now.getTime() + BANK_CHANGE_HOLD_DAYS * 86_400_000).toISOString();
  await sb.from('payee_tokens').update({ used_at: now.toISOString() }).eq('id', t.id);
  await sb.from('school_payees').update({ active: false, status: 'REPLACED' }).eq('school_id', payee.school_id).eq('active', true);
  await sb.from('school_payees').update({ active: true, status: 'ACTIVE', email_confirmed_at: now.toISOString(), email_confirmed_to: maskEmail(t.sent_to), payable_after: payableAfter, changed_at: now.toISOString() }).eq('id', payee.id);
  await sb.from('schools').update({ state: 'ACTIVE' }).eq('id', payee.school_id).in('state', ['AGREEMENT_SIGNED', 'PAYEE_VERIFIED']);
  await audit(sb, { actorKind: 'system', actorId: 'email-link', action: 'payee_change_confirmed', entityType: 'school', entityId: payee.school_id, after: { last4: payee.last4, via: maskEmail(t.sent_to), payable_after: payableAfter } });
  return { payableAfter };
}

export async function cancelPayeeChange(sb: SupabaseClient, token: string) {
  const t = await useToken(sb, token, 'cancel');
  const { data: payee } = await sb.from('school_payees').select('id, school_id, status, payable_after, replaces_payee_id, last4').eq('id', t.payee_id).single();
  if (!payee || payee.status === 'CANCELLED') throw new Error('This change was already cancelled.');
  if (payee.status === 'ACTIVE' && payee.payable_after && new Date(payee.payable_after) < new Date()) throw new Error('The cancel window has closed. Email schools@lionheartscholars.org right away and we’ll pause payments.');
  const now = new Date().toISOString();
  await sb.from('payee_tokens').update({ used_at: now }).eq('payee_id', payee.id);   // retire every link for this change
  await sb.from('school_payees').update({ active: false, status: 'CANCELLED', cancelled_at: now }).eq('id', payee.id);
  if (payee.status === 'ACTIVE' && payee.replaces_payee_id) await sb.from('school_payees').update({ active: true, status: 'ACTIVE' }).eq('id', payee.replaces_payee_id);
  await sb.from('exception_tickets').insert({ kind: 'payee_change_cancelled', entity_type: 'school', entity_id: payee.school_id, severity: 'warn',
    agent_recommendation: `A bank change to the account ending ${payee.last4} was cancelled from an emailed link (${maskEmail(t.sent_to)}). Payments continue to the previous account; no action needed unless the school asks.` });
  await audit(sb, { actorKind: 'system', actorId: 'email-link', action: 'payee_change_cancelled', entityType: 'school', entityId: payee.school_id, after: { last4: payee.last4, via: maskEmail(t.sent_to) } });
}
