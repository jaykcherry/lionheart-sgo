import type { SupabaseClient } from '@supabase/supabase-js';
import { buildYearEnd, tieOut, fmtUSD, type Acknowledgment } from '@/domain';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { audit, openTicket } from '@/lib/audit';
import { mailProvider, opsAlertEmails } from './mail';

/**
 * From Jan 5, daily until it succeeds: generate acknowledgments for the prior year. They release automatically
 * when acknowledgments, the IRS report and designated deposits in the §25F account tie out to the cent; no
 * sign-off is needed. If they don't tie out, nothing is sent, the treasurer is emailed once with the problems,
 * and the job tries again the next day (after the bookkeeper posts the fix).
 */
export async function generateYearEnd(sb: SupabaseClient, year: number) {
  const { data: done } = await sb.from('irs_reports').select('year').eq('year', year).maybeSingle();
  if (done) return { released: true, already: true };
  const { data: gifts } = await sb.from('gifts').select('id, donor_id, amount_cents, charge_on, state').eq('fund', '25F-TN').eq('designated', true)
    .gte('charge_on', `${year}-01-01`).lte('charge_on', `${year}-12-31`).in('state', ['RECONCILED', 'ACKNOWLEDGED', 'REPORTED', 'DEPOSITED', 'SETTLED', 'CHARGED']);
  const donorIds = [...new Set((gifts ?? []).map((g) => g.donor_id))];
  const { data: donors } = await sb.from('donors').select('id, legal_name, street, city, state, zip, email, e_delivery_consent').in('id', donorIds.length ? donorIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: existing } = await sb.from('donor_numbers').select('donor_id, value').eq('year', year);

  const { acks, rows } = buildYearEnd(year, env().SGO_EIN,
    (donors ?? []).map((d) => ({ donorId: d.id, legalName: d.legal_name, address: [d.street, d.city, d.state, d.zip].filter(Boolean).join(', '), email: d.email, eDeliveryConsent: d.e_delivery_consent })),
    (gifts ?? []).map((g) => ({ giftId: g.id, donorId: g.donor_id, date: g.charge_on, amount: g.amount_cents })),
    Object.fromEntries((existing ?? []).map((e) => [e.donor_id, e.value])));

  const { data: deposits } = await sb.from('ledger_postings').select('amount_cents, ledger_journals!inner(kind, date)')
    .eq('fund', '25F-TN').eq('account', 'contributions').eq('ledger_journals.kind', 'gift').gte('ledger_journals.date', `${year}-01-01`).lte('ledger_journals.date', `${year}-12-31`);
  const designatedDeposits = -(deposits ?? []).reduce((s, d) => s + Number(d.amount_cents), 0);
  const check = tieOut(acks, rows, designatedDeposits);
  if (!check.ok) {
    const { data: open } = await sb.from('exception_tickets').select('id').eq('kind', 'year_end_tieout').eq('status', 'open').limit(1);
    if (!open?.length) {
      await openTicket(sb, { kind: 'year_end_tieout', entityType: 'year', severity: 'critical', recommendation: `${year}: ${check.problems.join('; ')}` });
      for (const to of opsAlertEmails()) await sendEmail({ to, subject: `Action needed: ${year} donor acknowledgments don't tie out`,
        text: `The ${year} acknowledgments were not sent because the totals don't match:\n\n${check.problems.map((p) => '• ' + p).join('\n')}\n\nOnce the books are corrected, nothing else is needed: the system retries every morning and sends automatically when everything matches. Acknowledgments are due January 31.` });
    }
    return { released: false, problems: check.problems };
  }
  await sb.from('exception_tickets').update({ status: 'resolved', resolution: 'Tie-out passed; released automatically.', resolved_at: new Date().toISOString() }).eq('kind', 'year_end_tieout').eq('status', 'open');

  for (const a of acks) {
    await sb.from('donor_numbers').upsert({ donor_id: a.donorId, year, value: a.donorNumber }, { onConflict: 'donor_id,year' });
    await sb.from('acknowledgments').upsert({ donor_id: a.donorId, year, donor_number: a.donorNumber, total_cents: a.totalQualified, delivery: a.delivery }, { onConflict: 'donor_id,year' });
  }
  const csv = ['donor_number,name,address,aggregate_qualified_contributions', ...rows.map((r) => [r.donorNumber, JSON.stringify(r.name), JSON.stringify(r.address), (r.aggregateQualified / 100).toFixed(2)].join(','))].join('\n');
  const path = `irs/${year}-contribution-report.csv`;
  await sb.storage.from('documents').upload(path, new Blob([csv], { type: 'text/csv' }), { upsert: true });
  await sb.from('irs_reports').upsert({ year, row_count: rows.length, total_cents: check.total, file_path: path, file_sha256: await hash(csv) });
  await audit(sb, { actorKind: 'job', actorId: 'job:year-end', action: 'year_end_generated', entityType: 'year', entityId: String(year), after: { donors: acks.length, total: check.total } });
  return { released: true, donors: acks.length, total: check.total };
}

/** Runs right after a successful release: email to donors who consented, a mailed letter (Lob) for the rest. */
export async function deliverAcknowledgments(sb: SupabaseClient, year: number) {
  const { data: acks } = await sb.from('acknowledgments').select('donor_id, donor_number, total_cents, delivery, delivered_at, donors(legal_name, email, street, city, state, zip)').eq('year', year).is('delivered_at', null);
  const post = mailProvider();
  let sent = 0, mailed = 0;
  for (const raw of acks ?? []) {
    const a = raw as unknown as { donor_id: string; donor_number: string; total_cents: number; delivery: Acknowledgment['delivery']; donors: { legal_name: string; email: string; street: string | null; city: string | null; state: string | null; zip: string | null } };
    const text = ackText(year, a.donors.legal_name, a.donor_number, a.total_cents);
    let ref: string | null = null;
    if (a.delivery === 'email') {
      await sendEmail({ to: a.donors.email, subject: `Your ${year} Lionheart scholarship-credit acknowledgment`, text });
    } else if (post && a.donors.street && a.donors.city && a.donors.zip) {
      ref = (await post.send({ description: `${year} acknowledgment ${a.donor_number}`, idempotencyKey: `ack:${year}:${a.donor_id}`,
        to: { name: a.donors.legal_name, street: a.donors.street, city: a.donors.city, state: a.donors.state ?? 'TN', zip: a.donors.zip },
        html: `<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.5;padding:1in 0.9in">${text.split('\n').map((l) => l ? `<p style="margin:0 0 8pt">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` : '').join('')}</body></html>` })).ref;
      mailed++;
    } else {
      await openTicket(sb, { kind: 'mail_acknowledgment', entityType: 'donor', entityId: a.donor_id, severity: 'warn', recommendation: `Mail paper acknowledgment to ${a.donors.legal_name}${post ? ' (address incomplete)' : ''}.` });
      continue;
    }
    await sb.from('acknowledgments').update({ delivered_at: new Date().toISOString(), mail_provider_ref: ref }).eq('donor_id', a.donor_id).eq('year', year);
    sent++;
  }
  return { sent, mailed };
}

/**
 * The IRS contribution report is uploaded through the IRS SGO portal by a person (the portal has no API).
 * Everything else is automatic: the file is built on release, and the treasurer gets the download link on
 * Feb 1, then reminders on Feb 15, 22 and 26 until someone records the IRS confirmation number.
 */
export async function remindIrsReport(sb: SupabaseClient, year: number, today = new Date().toISOString().slice(0, 10)) {
  const { data: r } = await sb.from('irs_reports').select('file_path, row_count, total_cents, submitted_at').eq('year', year).maybeSingle();
  if (!r || r.submitted_at) return { reminded: false };
  if (!['02-01', '02-15', '02-22', '02-26'].includes(today.slice(5))) return { reminded: false };
  const { data: link } = await sb.storage.from('documents').createSignedUrl(r.file_path, 7 * 86_400);
  for (const to of opsAlertEmails()) await sendEmail({ to, subject: `${today.slice(5) === '02-01' ? 'Ready' : 'Reminder'}: upload the ${year} §25F contribution report to the IRS (due Feb 28)`,
    text: [`The ${year} contribution report is ready: ${r.row_count} donors, ${fmtUSD(r.total_cents, { cents: true })} total. It already ties out to the acknowledgments and the bank.`, '',
      `1. Download the file (link good for 7 days): ${link?.signedUrl ?? '(sign in to /board)'}`,
      '2. Sign in to the IRS SGO portal and upload it.',
      `3. Record the IRS confirmation number at ${env().NEXT_PUBLIC_SITE_URL}/board. Reminders stop once it's recorded.`].join('\n') });
  return { reminded: true };
}

export async function markIrsReportSubmitted(sb: SupabaseClient, year: number, userId: string, confirmation: string) {
  const { error } = await sb.from('irs_reports').update({ submitted_at: new Date().toISOString(), submitted_by: userId, submission_ref: confirmation }).eq('year', year);
  if (error) throw new Error(error.message);
  await audit(sb, { actorKind: 'person', actorId: userId, action: 'irs_report_submitted', entityType: 'year', after: { year, confirmation } });
}

export const ackText = (year: number, name: string, donorNumber: string, total: number) => [
  `Dear ${name},`, '',
  `Thank you for your gifts to ${env().SGO_LEGAL_NAME} (EIN ${env().SGO_EIN}) in ${year}.`, '',
  `Total qualified contributions designated under IRC §25F: ${fmtUSD(total, { cents: true })}`,
  `Your unique donor number: ${donorNumber}`,
  'No goods or services were provided in exchange for your contributions.', '',
  `To claim the federal scholarship tax credit, enter your donor number on Form 8525 and attach it to your ${year} Form 1040.`,
  'Keep this letter with your tax records. This is not tax advice; consult your tax preparer.',
].join('\n');

async function hash(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
