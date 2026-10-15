import type { SupabaseClient } from '@supabase/supabase-js';
import { buildYearEnd, tieOut, fmtUSD, type Acknowledgment } from '@/domain';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { audit, openTicket } from '@/lib/audit';

/**
 * Jan 5: generate acknowledgments for the prior year. Released only if acknowledgments, the IRS
 * report and designated deposits in the §25F account tie out to the cent. Treasurer signs off on the IRS file.
 */
export async function generateYearEnd(sb: SupabaseClient, year: number) {
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
    await openTicket(sb, { kind: 'year_end_tieout', entityType: 'year', severity: 'critical', recommendation: check.problems.join('; ') });
    return { released: false, problems: check.problems };
  }

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

export async function deliverAcknowledgments(sb: SupabaseClient, year: number) {
  const { data: acks } = await sb.from('acknowledgments').select('donor_id, donor_number, total_cents, delivery, delivered_at, donors(legal_name, email)').eq('year', year).is('delivered_at', null);
  let sent = 0;
  for (const raw of acks ?? []) {
    const a = raw as unknown as { donor_id: string; donor_number: string; total_cents: number; delivery: Acknowledgment['delivery']; donors: { legal_name: string; email: string } };
    if (a.delivery === 'email') {
      await sendEmail({ to: a.donors.email, subject: `Your ${year} Lionheart scholarship-credit acknowledgment`,
        text: ackText(year, a.donors.legal_name, a.donor_number, a.total_cents) });
    } else {
      await openTicket(sb, { kind: 'mail_acknowledgment', entityType: 'donor', entityId: a.donor_id, severity: 'info', recommendation: `Mail paper acknowledgment to ${a.donors.legal_name}.` });
    }
    await sb.from('acknowledgments').update({ delivered_at: new Date().toISOString() }).eq('donor_id', a.donor_id).eq('year', year);
    sent++;
  }
  return { sent };
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
