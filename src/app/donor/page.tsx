import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, supabaseUser } from '@/lib/supabase';
import { fmtUSD, creditForYear, CREDIT_CAP } from '@/domain';
import { cancelPledge } from './actions';

export const dynamic = 'force-dynamic';

export default async function DonorPortal({ searchParams }: { searchParams: Promise<{ gift?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (!s) redirect('/signin?next=/donor');
  const sb = await supabaseUser();
  const year = new Date().getFullYear() < 2027 ? 2027 : new Date().getFullYear();
  const [{ data: donors }, { data: gifts }, { data: acks }] = await Promise.all([
    sb.from('donors').select('id, legal_name'),
    sb.from('gifts').select('id, donor_id, amount_cents, fund, designated, state, charge_on, method').order('charge_on', { ascending: false }),
    sb.from('acknowledgments').select('donor_id, year, donor_number, total_cents, delivered_at').order('year', { ascending: false }),
  ]);
  return (
    <>
      <div className="band band-surface"><div className="wrap portal-head"><div><span className="eyebrow">Donor</span><h1 className="h2" style={{ marginTop: 6 }}>Your giving</h1></div><Link className="btn btn-primary btn-sm" href="/donor/give">Give again</Link></div></div>
      <div className="band"><section className="wrap stack-l" style={{ paddingBlock: '40px 84px' }}>
        {sp.gift && <p className="notice notice-ok">Thank you. Your receipt is on its way by email.</p>}
        {(donors ?? []).length === 0 && <p className="body">No gifts are linked to {s.email} yet. Gifts made with this email address appear here automatically after you sign in.</p>}
        <div className="cols-2">{(donors ?? []).map((d) => {
          const mine = (gifts ?? []).filter((g) => g.donor_id === d.id && g.designated && g.charge_on.startsWith(String(year)) && !['CANCELLED', 'FAILED', 'CHARGEBACK'].includes(g.state));
          const c = creditForYear(mine.map((g) => g.amount_cents));
          return <div key={d.id} className="card"><span className="card-kicker">{d.legal_name} · {year} credit</span>
            <p className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 40, lineHeight: 1 }}>{fmtUSD(c.credit)} <span className="small muted">of $1,700</span></p>
            <div className="bar"><span style={{ width: `${Math.min(100, (c.credit / CREDIT_CAP) * 100)}%` }} /></div>
            <p className="small muted">{c.credit >= CREDIT_CAP ? 'Full credit reached.' : `${fmtUSD(CREDIT_CAP - c.credit)} of credit room left (includes scheduled gifts).`}</p></div>; })}</div>
        <section><h2 className="h3">Gifts</h2><div className="tablewrap" style={{ marginTop: 12 }}><table className="table" style={{ minWidth: 640 }}><thead><tr><th>Date</th><th>Giver</th><th className="num">Amount</th><th>Fund</th><th>Status</th><th /></tr></thead><tbody>
          {(gifts ?? []).map((g) => <tr key={g.id}><td>{g.charge_on}</td><td>{donors?.find((d) => d.id === g.donor_id)?.legal_name}</td><td className="num">{fmtUSD(g.amount_cents)}</td><td>{g.fund === '25F-TN' ? '§25F scholarship' : 'General'}</td><td>{g.state === 'PLEDGED' ? 'Scheduled' : g.state.toLowerCase().replace('_', ' ')}</td>
            <td>{g.state === 'PLEDGED' && <form action={cancelPledge}><input type="hidden" name="gift_id" value={g.id} /><button className="btn btn-ghost btn-sm">Cancel</button></form>}</td></tr>)}</tbody></table></div></section>
        <section className="split"><div><h2 className="h3">Tax documents</h2><p className="body" style={{ marginTop: 6 }}>Acknowledgments with your donor number arrive by January 31. Enter the number on IRS Form 8525 with your Form 1040.</p></div>
          <div className="tablewrap"><table className="table"><thead><tr><th>Year</th><th>Giver</th><th>Donor number</th><th className="num">Qualified total</th></tr></thead><tbody>
            {(acks ?? []).length ? (acks ?? []).map((a) => <tr key={a.donor_id + a.year}><td>{a.year}</td><td>{donors?.find((d) => d.id === a.donor_id)?.legal_name}</td><td className="tnum">{a.donor_number}</td><td className="num">{fmtUSD(a.total_cents)}</td></tr>)
              : <tr><td colSpan={4} className="small muted">Your first acknowledgment arrives by January 31 after the year you give.</td></tr>}</tbody></table></div></section>
      </section></div>
    </>
  );
}
