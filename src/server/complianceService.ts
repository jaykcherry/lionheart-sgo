import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluate, ninetyPercentTest, deadlinesFor, reconcile, type Finding, type Journal, type ProcessorSettlement, type BankLine } from '@/domain';

/** Builds a snapshot from the database, runs the domain monitor, stores the run, and opens tickets for criticals. */
export async function runCompliance(sb: SupabaseClient, asOf = new Date().toISOString().slice(0, 10)): Promise<Finding[]> {
  const year = Number(asOf.slice(0, 4));
  const years = [year - 1, year].filter((y) => y >= 2027);

  const { data: postings } = await sb.from('ledger_postings').select('fund, account, amount_cents, ledger_journals!inner(id, date, kind, ref)').eq('fund', '25F-TN');
  type P = { fund: '25F-TN'; account: string; amount_cents: number; ledger_journals: { id: string; date: string; kind: string; ref: string } };
  const rows = (postings ?? []) as unknown as P[];
  const sumWhere = (f: (p: P) => boolean) => rows.filter(f).reduce((s, p) => s + Number(p.amount_cents), 0);
  const incomes = years.map((y) => ({
    year: y,
    contributions: -sumWhere((p) => p.account === 'contributions' && p.ledger_journals.kind === 'gift' && p.ledger_journals.date.startsWith(String(y))),
    earnings: -sumWhere((p) => p.account === 'earnings' && p.ledger_journals.date.startsWith(String(y))),
    refunds: -sumWhere((p) => p.account === 'contributions' && p.ledger_journals.kind === 'school_refund' && p.ledger_journals.date.startsWith(String(y))),
  }));
  const payments = rows.filter((p) => p.account === 'scholarship_expense').map((p) => ({ date: p.ledger_journals.date, amount: Number(p.amount_cents) }));
  const { data: scheduledTerms } = await sb.from('award_terms').select('amount_cents, pay_on, award_id');
  const { data: sentLines } = await sb.from('disbursement_lines').select('award_id, term').eq('status', 'SENT');
  const sentSet = new Set((sentLines ?? []).map((l) => l.award_id + l.term));
  const scheduled = (scheduledTerms ?? []).filter((t) => !sentSet.has(t.award_id + (t.pay_on.endsWith('08-20') ? 'fall' : 'spring'))).map((t) => ({ date: t.pay_on, amount: t.amount_cents }));
  const ninety = ninetyPercentTest(incomes, payments, asOf, scheduled);

  // Reconciliation over the last 45 days
  const since = new Date(Date.parse(asOf) - 45 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: st }, { data: bank }, { data: journals }] = await Promise.all([
    sb.from('processor_settlements').select('*').gte('date', since),
    sb.from('bank_lines').select('*').gte('date', since),
    sb.from('ledger_journals').select('id, date, kind, ref').gte('date', since),
  ]);
  const recon = reconcile(
    (st ?? []).map((s) => ({ ref: s.ref, date: s.date, gross: s.gross_cents, fee: s.fee_cents, net: s.net_cents, fund: s.fund }) as ProcessorSettlement),
    (bank ?? []).map((b) => ({ id: b.id, date: b.date, account: b.account, amount: Number(b.amount_cents), memo: b.memo ?? '', ref: b.ref ?? undefined }) as BankLine),
    (journals ?? []).map((j) => ({ ...j, postings: [] }) as Journal));

  const bankSeg = (await sb.from('bank_lines').select('amount_cents').eq('account', 'segregated')).data?.reduce((s, b) => s + Number(b.amount_cents), 0) ?? 0;
  const ledgerSeg = sumWhere((p) => p.account === 'cash');
  const { data: awarded } = await sb.from('awards').select('application_id, applications!inner(school_id, cycles!inner(school_year))');
  const awardedStudents = ((awarded ?? []) as unknown as { application_id: string; applications: { school_id: string; cycles: { school_year: string } } }[])
    .map((a) => ({ studentId: a.application_id, schoolId: a.applications.school_id, year: Number(a.applications.cycles.school_year.slice(0, 4)) }));
  const { count: donorsWithGifts } = await sb.from('gifts').select('donor_id', { count: 'exact', head: true }).eq('fund', '25F-TN').gte('charge_on', `${year - 1}-01-01`).lte('charge_on', `${year - 1}-12-31`);
  const { count: queued } = await sb.from('acknowledgments').select('donor_id', { count: 'exact', head: true }).eq('year', year - 1);
  const { count: dqHeld } = await sb.from('applications').select('id', { count: 'exact', head: true }).eq('state', 'HELD');
  const { count: overSla } = await sb.from('exception_tickets').select('id', { count: 'exact', head: true }).neq('status', 'resolved').lt('sla_due', new Date().toISOString());
  const { data: doneRows } = await sb.from('audit_events').select('entity_id').eq('action', 'deadline_done');
  const done = new Set((doneRows ?? []).map((d) => d.entity_id));

  const findings = evaluate({
    asOf, ninety, recon, awardedStudents, segregatedBankBalance: bankSeg, segregatedLedgerBalance: ledgerSeg,
    acknowledgmentsQueued: { year: year - 1, donorsWithGifts: donorsWithGifts ?? 0, queued: queued ?? 0 },
    deadlines: years.flatMap((y) => deadlinesFor(y)).map((d) => ({ ...d, done: done.has(d.id) })),
    openHolds: dqHeld ?? 0, dqMatchesUnreviewed: dqHeld ?? 0, exceptionTicketsOverSla: overSla ?? 0,
  });
  const critical = findings.filter((f) => f.severity === 'critical');
  await sb.from('compliance_runs').insert({ findings, critical_count: critical.length });
  for (const f of critical) {
    const { count } = await sb.from('exception_tickets').select('id', { count: 'exact', head: true }).eq('kind', 'compliance').eq('agent_recommendation', f.message).neq('status', 'resolved');
    if (!count) await sb.from('exception_tickets').insert({ kind: 'compliance', entity_type: 'system', severity: 'critical', agent_recommendation: f.message });
  }
  return findings;
}
