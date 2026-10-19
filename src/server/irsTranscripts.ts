import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeTranscripts, nextTranscriptRetry, type TranscriptOutcome, type TranscriptFields } from '@/domain/irs';
import { audit } from '@/lib/audit';

/**
 * Transcript vendors (IVES participants) differ in API shape. Each adapter normalizes to TranscriptOutcome.
 *  - 'ives_vendor': generic REST adapter (POST {IVES_API_URL}/requests, GET {IVES_API_URL}/requests/:id) for a
 *    vendor that returns normalized 1040 fields. Point it at the chosen vendor or a thin proxy that maps theirs.
 *  - 'mock': deterministic test data (transcript = stated income) for development and staging.
 *  - 'none': IRS verification is off; families upload documents.
 */
export interface TranscriptRequest {
  taxYear: number; filingStatus: TranscriptFields['filingStatus'];
  primary: { name: string; ssn: string }; spouse?: { name: string; ssn: string };
  address: string; signedAt: string; consentSha256: string; signerIp?: string;
  callbackRef: string;   // our request id
}
export interface TranscriptProvider {
  name: string;
  submit(r: TranscriptRequest): Promise<{ ref: string }>;
  fetch(ref: string): Promise<{ status: 'pending' } | { status: 'done'; outcome: Omit<TranscriptOutcome, 'coversMemberIds'>; rawSha256: string }>;
}

const sha = async (t: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');

const ivesVendor = (): TranscriptProvider => {
  const url = process.env.IVES_API_URL, key = process.env.IVES_API_KEY;
  if (!url || !key) throw new Error('IVES_API_URL and IVES_API_KEY must be set for TRANSCRIPT_PROVIDER=ives_vendor');
  const h = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return {
    name: 'ives_vendor',
    async submit(r) {
      const res = await fetch(`${url}/requests`, { method: 'POST', headers: { ...h, 'Idempotency-Key': r.callbackRef }, body: JSON.stringify({
        form: '4506-C', transcript_type: 'return', tax_years: [r.taxYear], filing_status: r.filingStatus,
        taxpayer: r.primary, spouse: r.spouse ?? null, address: r.address,
        signature: { method: 'electronic', signed_at: r.signedAt, document_sha256: r.consentSha256, ip: r.signerIp ?? null },
        client_reference: r.callbackRef,
      }) });
      if (!res.ok) throw new Error(`transcript request failed: ${res.status} ${await res.text()}`);
      return { ref: ((await res.json()) as { id: string }).id };
    },
    async fetch(ref) {
      const res = await fetch(`${url}/requests/${encodeURIComponent(ref)}`, { headers: h });
      if (!res.ok) throw new Error(`transcript fetch failed: ${res.status}`);
      const text = await res.text();
      const j = JSON.parse(text) as { status: string; tax_year: number; reason?: string; fields?: Record<string, number | string> };
      if (j.status === 'pending' || j.status === 'submitted') return { status: 'pending' };
      const rawSha256 = await sha(text);
      if (j.status === 'no_record') return { status: 'done', rawSha256, outcome: { kind: 'no_record', taxYear: j.tax_year } };
      if (j.status !== 'complete' || !j.fields) return { status: 'done', rawSha256, outcome: { kind: 'rejected', reason: j.reason ?? j.status } };
      const c = (k: string) => Math.round(Number(j.fields![k] ?? 0) * 100);
      return { status: 'done', rawSha256, outcome: { kind: 'return', taxYear: j.tax_year, fields: {
        filingStatus: String(j.fields.filing_status ?? 'single') as TranscriptFields['filingStatus'],
        wages: c('wages'), taxableInterest: c('taxable_interest'), ordinaryDividends: c('ordinary_dividends'), businessIncome: c('business_income'),
        farmIncome: c('farm_income'), rentalRoyalty: c('rental_royalty'), unemployment: c('unemployment'), socialSecurityGross: c('social_security_gross'),
        pensionsTaxable: c('pensions_taxable'), otherIncome: c('other_income'), agi: c('agi'),
      } } };
    },
  };
};

/** Mock: the IRS "confirms" whatever wages the family typed (read back from income_items by the caller). */
const mock = (stated: (ref: string) => Promise<number>): TranscriptProvider => ({
  name: 'mock',
  async submit(r) { return { ref: `mock:${r.callbackRef}` }; },
  async fetch(ref) {
    const wages = await stated(ref);
    return { status: 'done', rawSha256: await sha(ref + wages), outcome: { kind: 'return', taxYear: new Date().getFullYear() - 1, fields: {
      filingStatus: 'mfj', wages, taxableInterest: 0, ordinaryDividends: 0, businessIncome: 0, rentalRoyalty: 0, unemployment: 0, socialSecurityGross: 0, pensionsTaxable: 0, otherIncome: 0, agi: wages,
    } } };
  },
});

export function transcriptProvider(sb: SupabaseClient): TranscriptProvider | null {
  const p = process.env.TRANSCRIPT_PROVIDER ?? 'none';
  if (p === 'ives_vendor') return ivesVendor();
  if (p === 'mock') return mock(async (ref) => {
    const { data: req } = await sb.from('irs_transcript_requests').select('consent:irs_consents(member_ids)').eq('provider_ref', ref).single();
    const ids = (req as unknown as { consent: { member_ids: string[] } } | null)?.consent.member_ids ?? [];
    const { data: items } = await sb.from('income_items').select('amount_cents').in('member_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    return (items ?? []).reduce((s, i) => s + i.amount_cents, 0);
  });
  return null;
}

/**
 * Called from the family's signing action with the full SSN(s) in memory only. Stores the signature record
 * (last four digits), submits to the vendor, and records the request. The SSN is not written anywhere.
 */
export async function submitConsent(sb: SupabaseClient, c: {
  householdId: string; taxYear: number; memberIds: string[]; filingStatus: TranscriptFields['filingStatus'];
  nameOnReturn: string; spouseNameOnReturn?: string; ssn: string; spouseSsn?: string; addressOnReturn: string;
  signerUserId: string; signerTypedName: string; spouseTypedName?: string; ip?: string; userAgent?: string; consentText: string; consentVersion: string;
}) {
  const provider = transcriptProvider(sb);
  if (!provider) throw new Error('IRS verification is not turned on yet. Please upload your documents instead.');
  const digits = (s: string) => s.replace(/\D/g, '');
  const ssn = digits(c.ssn), spouseSsn = c.spouseSsn ? digits(c.spouseSsn) : undefined;
  if (ssn.length !== 9 || (c.filingStatus === 'mfj' && spouseSsn?.length !== 9)) throw new Error('Enter the full 9-digit Social Security number (or ITIN) for each person on the return.');
  const consentSha256 = await sha([c.consentVersion, c.consentText, c.taxYear, c.filingStatus, c.nameOnReturn, c.spouseNameOnReturn ?? '', ssn.slice(-4), spouseSsn?.slice(-4) ?? '', c.addressOnReturn, c.signerTypedName, c.spouseTypedName ?? ''].join('|'));
  const { data: consent, error } = await sb.from('irs_consents').insert({
    household_id: c.householdId, tax_year: c.taxYear, member_ids: c.memberIds, filing_status: c.filingStatus,
    name_on_return: c.nameOnReturn, spouse_name_on_return: c.spouseNameOnReturn ?? null, ssn_last4: ssn.slice(-4), spouse_ssn_last4: spouseSsn?.slice(-4) ?? null,
    address_on_return: c.addressOnReturn, signer_user_id: c.signerUserId, signer_typed_name: c.signerTypedName, spouse_typed_name: c.spouseTypedName ?? null,
    signer_ip: c.ip ?? null, signer_user_agent: c.userAgent ?? null, consent_text_version: c.consentVersion, consent_sha256: consentSha256,
  }).select('id, signed_at').single();
  if (error || !consent) throw new Error(error?.message ?? 'could not save signature');
  const { data: req } = await sb.from('irs_transcript_requests').insert({ consent_id: consent.id, household_id: c.householdId, provider: provider.name }).select('id').single();
  try {
    const { ref } = await provider.submit({ taxYear: c.taxYear, filingStatus: c.filingStatus, primary: { name: c.nameOnReturn, ssn },
      spouse: spouseSsn ? { name: c.spouseNameOnReturn ?? '', ssn: spouseSsn } : undefined, address: c.addressOnReturn, signedAt: consent.signed_at,
      consentSha256, signerIp: c.ip, callbackRef: req!.id });
    await sb.from('irs_transcript_requests').update({ provider_ref: ref }).eq('id', req!.id);
  } catch (e) {
    await sb.from('irs_transcript_requests').update({ state: 'ERROR', last_error: (e as Error).message, next_retry_on: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }).eq('id', req!.id);
  }
  await audit(sb, { actorKind: 'person', actorId: c.signerUserId, action: 'irs_4506c_signed', entityType: 'household', entityId: c.householdId, after: { taxYear: c.taxYear, consent: consent.id } });
  return { consentId: consent.id, requestId: req!.id };
}

/** True while any of the household's transcript requests is still out (applications wait for it). */
export async function transcriptsPending(sb: SupabaseClient, householdId: string) {
  const { data } = await sb.from('irs_transcript_requests').select('id').eq('household_id', householdId).eq('state', 'REQUESTED').limit(1);
  return !!data?.length;
}

/**
 * Hourly job: collect finished transcripts, merge them into the application's income, and re-run eligibility.
 * Requests that hit an error are resubmitted the next day. "No record" retries every 14 days (the family may not
 * have filed yet) while the application still needs verification.
 */
export async function collectTranscripts(sb: SupabaseClient, rerun: (applicationId: string) => Promise<void>) {
  const provider = transcriptProvider(sb);
  if (!provider) return { checked: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const { data: open } = await sb.from('irs_transcript_requests').select('id, household_id, provider_ref, state, attempts, next_retry_on, consent:irs_consents(member_ids, tax_year)')
    .or(`state.eq.REQUESTED,and(state.in.(NO_RECORD,ERROR),next_retry_on.lte.${today})`);
  const touched = new Set<string>();
  for (const raw of open ?? []) {
    const r = raw as unknown as { id: string; household_id: string; provider_ref: string | null; state: string; attempts: number; consent: { member_ids: string[]; tax_year: number } };
    if (!r.provider_ref) continue;
    let got;
    try { got = await provider.fetch(r.provider_ref); } catch (e) {
      await sb.from('irs_transcript_requests').update({ state: 'ERROR', last_error: (e as Error).message, attempts: r.attempts + 1, next_retry_on: nextDay(today) }).eq('id', r.id); continue;
    }
    if (got.status === 'pending') continue;
    const outcome = { ...got.outcome, coversMemberIds: r.consent.member_ids } as TranscriptOutcome;
    const state = outcome.kind === 'return' ? 'RECEIVED' : outcome.kind === 'no_record' ? 'NO_RECORD' : 'REJECTED';
    await sb.from('irs_transcript_requests').update({ state, outcome, raw_sha256: got.rawSha256, received_at: new Date().toISOString(), attempts: r.attempts + 1,
      next_retry_on: state === 'NO_RECORD' ? nextTranscriptRetry(r.consent.tax_year, today) : null }).eq('id', r.id);
    await audit(sb, { actorKind: 'job', actorId: 'job:irs-transcripts', action: `irs_transcript_${state.toLowerCase()}`, entityType: 'household', entityId: r.household_id });
    touched.add(r.household_id);
  }
  for (const householdId of touched) await applyTranscripts(sb, householdId, rerun);
  return { checked: open?.length ?? 0, households: touched.size };
}
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

/** Rewrites income items from transcripts for every application in the household still waiting on verification. */
export async function applyTranscripts(sb: SupabaseClient, householdId: string, rerun: (applicationId: string) => Promise<void>) {
  const { data: reqs } = await sb.from('irs_transcript_requests').select('outcome, state').eq('household_id', householdId).in('state', ['RECEIVED', 'NO_RECORD', 'REJECTED']);
  const outcomes = (reqs ?? []).map((r) => r.outcome as TranscriptOutcome).filter(Boolean);
  if (!outcomes.some((o) => o.kind === 'return')) {
    // Nothing usable from the IRS: let applications continue on documents.
    const { data: waiting } = await sb.from('applications').select('id').eq('household_id', householdId).eq('state', 'DOCS_PENDING');
    if (!(await transcriptsPending(sb, householdId))) for (const a of waiting ?? []) await rerun(a.id);
    return;
  }
  const { data: apps } = await sb.from('applications').select('id, state').eq('household_id', householdId).in('state', ['SUBMITTED', 'DOCS_PENDING', 'NEEDS_REVIEW']);
  const { data: members } = await sb.from('household_members').select('id, zero_income_attested').eq('household_id', householdId);
  const zero = (members ?? []).filter((m) => m.zero_income_attested).map((m) => m.id);
  for (const a of apps ?? []) {
    const { data: items } = await sb.from('income_items').select('member_id, type, amount_cents, year, cash, source').eq('application_id', a.id);
    const merged = mergeTranscripts((items ?? []).map((i) => ({ personId: i.member_id, type: i.type, amount: i.amount_cents, year: i.year, cash: i.cash, source: i.source })), outcomes, zero);
    await sb.from('income_items').delete().eq('application_id', a.id);
    if (merged.items.length) await sb.from('income_items').insert(merged.items.map((i) => ({ application_id: a.id, member_id: i.personId, type: i.type, amount_cents: i.amount, year: i.year, cash: i.cash, source: i.source })));
    // A transcript answers "no income" questions for the people it covers.
    for (const m of merged.verifiedMemberIds) await sb.from('household_members').update({ zero_income_attested: false }).eq('id', m);
    await audit(sb, { actorKind: 'job', actorId: 'job:irs-transcripts', action: 'income_verified_by_irs', entityType: 'application', entityId: a.id, after: { notes: merged.notes } });
    if (a.state === 'NEEDS_REVIEW') {
      await sb.rpc('svc_transition_application', { p_app: a.id, p_to: 'DOCS_PENDING', p_actor_kind: 'job', p_actor_id: 'job:irs-transcripts' });
      await sb.from('exception_tickets').update({ status: 'resolved', resolution: 'Superseded by IRS transcript; eligibility re-run.', resolved_at: new Date().toISOString() }).eq('entity_id', a.id).eq('kind', 'eligibility_review').eq('status', 'open');
    }
    if (a.state !== 'SUBMITTED' || !(await transcriptsPending(sb, householdId))) await rerun(a.id);
  }
}
