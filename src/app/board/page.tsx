import { redirect } from 'next/navigation';
import { getSession, hasRole, supabaseUser } from '@/lib/supabase';
import { fmtUSD, type Finding, type AllocationResult } from '@/domain';
import { runComplianceNow, runAwardRound, approveAwardRound, prepare, approve, send, decide, resolveTicket, grantRole } from './actions';

export const dynamic = 'force-dynamic';
const SEV: Record<string, string> = { critical: 'pill-bad', warn: 'pill-warn', info: 'pill-ok' };

export default async function Board({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (!s || !hasRole(s, 'staff', 'board')) redirect('/signin?next=/board');
  const sb = await supabaseUser();
  const [{ data: run }, { data: tickets }, { data: rounds }, { data: batches }, { data: cycles }] = await Promise.all([
    sb.from('compliance_runs').select('run_at, findings, critical_count').order('run_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('exception_tickets').select('id, kind, entity_type, entity_id, severity, agent_recommendation, sla_due, created_at').neq('status', 'resolved').order('severity').order('created_at').limit(50),
    sb.from('award_rounds').select('id, name, seed, cash_available_cents, result, run_at, approved_at').order('run_at', { ascending: false }).limit(5),
    sb.from('disbursement_batches').select('id, name, term, state, ready_total_cents, batch_approvals(user_id, role)').order('created_at', { ascending: false }).limit(6),
    sb.from('cycles').select('id, school_year').order('opens_on', { ascending: false }),
  ]);
  const findings = ((run?.findings ?? []) as Finding[]).sort((a, b) => ['critical', 'warn', 'info'].indexOf(a.severity) - ['critical', 'warn', 'info'].indexOf(b.severity));
  const isBoard = hasRole(s, 'board');
  return (
    <>
      <div className="band band-surface"><div className="wrap portal-head"><div><span className="eyebrow">Board & operations</span><h1 className="h2" style={{ marginTop: 6 }}>Lionheart operations</h1></div>
        <form action={runComplianceNow}><button className="btn btn-secondary btn-sm">Run compliance check now</button></form></div></div>
      <div className="band"><section className="wrap stack-l" style={{ paddingBlock: '40px 84px' }}>
        {sp.error && <p className="errbox" role="alert">{sp.error}</p>}

        <section className="split"><div><h2 className="h3">Compliance</h2><p className="body" style={{ marginTop: 6 }}>{run ? `Last run ${new Date(run.run_at).toLocaleString()}. ${run.critical_count} critical.` : 'No run yet.'} Critical findings pause the flows they name.</p></div>
          <div className="findings">{findings.map((f) => <div className="finding" key={f.id}><span className={`pill ${SEV[f.severity]}`}>{f.severity}</span><div><p className="small" style={{ fontWeight: 600 }}>{f.area}</p><p className="small">{f.message}</p>{f.blocks && <p className="hint">Pauses: {f.blocks.join(', ')}</p>}</div></div>)}</div></section>

        <section><h2 className="h3">Review queue ({tickets?.length ?? 0})</h2>
          <div className="stack-m" style={{ marginTop: 14 }}>{(tickets ?? []).map((t) => (
            <article key={t.id} className="card"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><span className="card-kicker">{t.kind.replace(/_/g, ' ')} · {t.entity_type}</span><span className={`pill ${SEV[t.severity]}`}>{t.severity}</span></div>
              {t.agent_recommendation && <p className="small" style={{ background: 'var(--color-accent-100)', padding: '10px 12px', borderRadius: 4 }}><strong style={{ fontWeight: 600 }}>AI recommendation.</strong> {t.agent_recommendation}</p>}
              <div className="btn-row">
                {t.entity_type === 'application' && t.entity_id && <>
                  <form action={decide}><input type="hidden" name="application_id" value={t.entity_id} /><input type="hidden" name="to" value="ELIGIBLE" /><button className="btn btn-secondary btn-sm">Approve eligible</button></form>
                  <form action={decide}><input type="hidden" name="application_id" value={t.entity_id} /><input type="hidden" name="to" value="DOCS_PENDING" /><button className="btn btn-secondary btn-sm">Request documents</button></form>
                  <form action={decide}><input type="hidden" name="application_id" value={t.entity_id} /><input type="hidden" name="to" value="DENIED" /><button className="btn btn-ghost btn-sm">Deny</button></form></>}
                
                <form action={resolveTicket}><input type="hidden" name="ticket_id" value={t.id} /><button className="btn btn-ghost btn-sm">Mark resolved</button></form>
              </div><p className="hint">Only a person can decide. Every decision is logged with your name.</p></article>))}</div></section>

        <section><h2 className="h3">Award rounds</h2>
          <form action={runAwardRound} className="form-grid paper" style={{ padding: 20, marginTop: 14 }}>
            <div className="field"><label htmlFor="cycle_id">Cycle</label><select className="input" id="cycle_id" name="cycle_id">{(cycles ?? []).map((c) => <option key={c.id} value={c.id}>{c.school_year}</option>)}</select></div>
            <div className="field"><label htmlFor="name">Round name</label><input className="input" id="name" name="name" required placeholder="2027-R1" /></div>
            <div className="field"><label htmlFor="seed">Published lottery seed</label><input className="input" id="seed" name="seed" required placeholder="Read aloud at the board meeting" /></div>
            <div className="field" style={{ justifyContent: 'end' }}><button className="btn btn-solid">Run round</button></div>
          </form>
          {(rounds ?? []).map((r) => { const res = r.result as AllocationResult | null; return (
            <div key={r.id} className="paper" style={{ padding: 20, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><span className="card-kicker">{r.name} · seed {r.seed}</span>
                <p className="small" style={{ marginTop: 6 }}>{res ? `${fmtUSD(res.totals.awarded)} to ${res.totals.students} students at ${res.totals.schools} schools · ${res.totals.waitlisted} waitlisted · ${res.totals.held} held · ${fmtUSD(res.totals.cashRemaining)} left` : 'Not run'}</p></div>
                {r.approved_at ? <span className="pill pill-ok">Approved</span> : isBoard ? <form action={approveAwardRound}><input type="hidden" name="round_id" value={r.id} /><button className="btn btn-solid btn-sm">Approve (board)</button></form> : <span className="pill pill-warn">Awaiting board</span>}</div>
            </div>); })}</section>

        <section><h2 className="h3">School payments</h2>
          <div className="btn-row" style={{ marginTop: 12 }}>{['fall', 'spring'].map((t) => <form key={t} action={prepare}><input type="hidden" name="term" value={t} /><input type="hidden" name="name" value={`${new Date().getFullYear()}-${t.toUpperCase()}-1`} /><button className="btn btn-secondary btn-sm">Prepare {t} batch</button></form>)}</div>
          <div className="tablewrap" style={{ marginTop: 14 }}><table className="table"><thead><tr><th>Batch</th><th>State</th><th className="num">Ready</th><th>Approvals</th><th /></tr></thead><tbody>
            {(batches ?? []).map((b) => <tr key={b.id}><td className="tnum">{b.name}</td><td>{b.state}</td><td className="num">{fmtUSD(b.ready_total_cents)}</td><td>{(b.batch_approvals as { role: string }[]).map((a) => a.role).join(', ') || '—'}</td>
              <td className="btn-row">{['PREPARED', 'APPROVED_1'].includes(b.state) && <form action={approve}><input type="hidden" name="batch_id" value={b.id} /><button className="btn btn-secondary btn-sm">Approve</button></form>}
                {b.state === 'APPROVED_2' && isBoard && <form action={send}><input type="hidden" name="batch_id" value={b.id} /><button className="btn btn-solid btn-sm">Send ACH</button></form>}</td></tr>)}</tbody></table></div></section>

        {isBoard && <section className="split"><div><h2 className="h3">Grant access</h2><p className="body" style={{ marginTop: 6 }}>Board and committee members are added to the disqualified-person registry automatically.</p></div>
          <form action={grantRole} className="form-grid paper" style={{ padding: 20 }}>
            <div className="field"><label htmlFor="g-email">Email (must have signed in once)</label><input className="input" id="g-email" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="g-name">Full legal name</label><input className="input" id="g-name" name="full_name" required /></div>
            <div className="field"><label htmlFor="g-role">Role</label><select className="input" id="g-role" name="role"><option value="staff">Staff</option><option value="board">Board</option></select></div>
            <div className="field" style={{ justifyContent: 'end' }}><button className="btn btn-secondary">Grant</button></div></form></section>}
      </section></div>
    </>
  );
}
