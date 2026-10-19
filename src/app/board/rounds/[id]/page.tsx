import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, hasRole, supabaseUser } from '@/lib/supabase';
import { beaconUrl, fmtUSD, type AllocationResult } from '@/domain';
import { approveAwardRound } from '../../actions';

export const dynamic = 'force-dynamic';

/** Landing page for the board's approval email: the results, how they were produced, and one button. */
export default async function RoundApproval({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s || !hasRole(s, 'staff', 'board')) redirect(`/signin?next=/board/rounds/${id}`);
  const sb = await supabaseUser();
  const { data: r } = await sb.from('award_rounds').select('id, name, seed, beacon_round, input_sha256, cash_available_cents, result, run_at, approved_at, policy_version').eq('id', id).single();
  if (!r) redirect('/board');
  const res = r.result as AllocationResult;
  const t = res.totals;
  const bySchool = new Map<string, { n: number; amt: number }>();
  for (const l of res.lines.filter((x) => x.outcome === 'AWARDED')) { const v = bySchool.get(l.schoolId) ?? { n: 0, amt: 0 }; v.n++; v.amt += l.amount; bySchool.set(l.schoolId, v); }
  const { data: schools } = await sb.from('schools').select('id, name').in('id', [...bySchool.keys()].length ? [...bySchool.keys()] : ['00000000-0000-0000-0000-000000000000']);
  const isBoard = hasRole(s, 'board');
  return (
    <div className="band"><section className="wrap stack-l" style={{ paddingBlock: '40px 84px', maxWidth: 900 }}>
      <Link href="/board" className="small">← Operations</Link>
      <div><span className="eyebrow">Award round</span><h1 className="h2" style={{ marginTop: 6 }}>{r.name}</h1>
        <p className="body" style={{ marginTop: 10 }}>Run {new Date(r.run_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central under policy {r.policy_version}. Families hear nothing until a board member approves.</p></div>
      <div className="kpis">
        <div className="kpi"><span className="kpi-label">Awarded</span><span className="kpi-value tnum">{fmtUSD(t.awarded)}</span></div>
        <div className="kpi"><span className="kpi-label">Students</span><span className="kpi-value tnum">{t.students}</span></div>
        <div className="kpi"><span className="kpi-label">Schools</span><span className="kpi-value tnum">{t.schools}</span></div>
        <div className="kpi"><span className="kpi-label">Waitlisted · held</span><span className="kpi-value tnum">{t.waitlisted} · {t.held}</span></div>
        <div className="kpi"><span className="kpi-label">Cash left</span><span className="kpi-value tnum">{fmtUSD(t.cashRemaining)}</span></div>
      </div>
      <p className={t.meetsBreadthRule ? 'notice notice-ok' : 'errbox'}>{t.meetsBreadthRule ? '10-student rule met: at least 10 students, not all at one school.' : '10-student rule NOT met. Approving is still possible; the compliance monitor will flag the year.'}</p>
      <div className="tablewrap"><table className="table"><thead><tr><th>School</th><th className="num">Students</th><th className="num">Awarded</th></tr></thead><tbody>
        {[...bySchool.entries()].sort((a, b) => b[1].amt - a[1].amt).map(([sid, v]) => <tr key={sid}><td>{schools?.find((x) => x.id === sid)?.name ?? sid}</td><td className="num">{v.n}</td><td className="num">{fmtUSD(v.amt)}</td></tr>)}</tbody></table></div>
      <details className="rules"><summary>How this result was produced</summary><div>
        <p className="body">Applicants and cash were frozen before the lottery value existed (input fingerprint <code>{r.input_sha256?.slice(0, 16)}…</code>). Tie-breaks used public drand beacon round {r.beacon_round ?? '—'}{r.beacon_round ? <> (<a href={beaconUrl(r.beacon_round)} target="_blank" rel="noopener">see the value</a>)</> : null}. Anyone can re-run the published formula with the same inputs and get the same awards.</p>
      </div></details>
      {r.approved_at ? <p className="notice notice-ok">Approved {new Date(r.approved_at).toLocaleString()}.</p>
        : isBoard ? <form action={approveAwardRound}><input type="hidden" name="round_id" value={r.id} /><input type="hidden" name="return_to" value={`/board/rounds/${r.id}`} /><button className="btn btn-solid">Approve and notify families</button></form>
        : <p className="note">A board member must approve.</p>}
    </section></div>
  );
}
