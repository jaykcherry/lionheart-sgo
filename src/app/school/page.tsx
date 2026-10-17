import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, supabaseUser } from '@/lib/supabase';
import { fmtUSD } from '@/domain';
import { confirmRoster, withdraw, payeeSubmit } from './actions';

export const dynamic = 'force-dynamic';

export default async function SchoolPortal({ searchParams }: { searchParams: Promise<{ welcome?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const schoolId = s?.roles.find((r) => r.role === 'school_admin')?.school_id;
  if (!s || !schoolId) redirect('/schools');
  const sb = await supabaseUser();
  const [{ data: school }, { data: roster }, { data: payee }, { data: lines }] = await Promise.all([
    sb.from('schools').select('name, state').eq('id', schoolId).single(),
    sb.from('school_roster').select('*').eq('school_id', schoolId).order('student_name'),
    sb.from('school_payees').select('last4, verified_at, callback_confirmed_at').eq('school_id', schoolId).eq('active', true).maybeSingle(),
    sb.from('disbursement_lines').select('term, amount_cents, status, award_id').eq('school_id', schoolId),
  ]);
  const term = new Date().getMonth() >= 6 ? 'fall' : 'spring';
  const termRows = (roster ?? []).filter((r) => r.term === term);
  const pending = termRows.filter((r) => r.enrolled == null && ['ACCEPTED', 'SCHOOL_CONFIRMED', 'ACTIVE'].includes(r.state));
  const setup: [boolean, string][] = [[true, 'Claimed and verified'], [school?.state !== 'DOMAIN_VERIFIED', 'Partnership agreement signed'], [!!payee?.verified_at, 'Bank account verified'], [school?.state === 'ACTIVE', 'Active partner']];
  return (
    <>
      <div className="band band-surface"><div className="wrap portal-head"><div><span className="eyebrow">School</span><h1 className="h2" style={{ marginTop: 6 }}>{school?.name}</h1></div></div></div>
      <div className="band"><section className="wrap stack-l" style={{ paddingBlock: '40px 84px' }}>
        {sp.welcome && <p className="notice notice-ok">Welcome. Your agreement is signed. Add your bank account below so we can pay tuition.</p>}
        {sp.error && <p className="errbox">{sp.error}</p>}
        <div className="split"><div><h2 className="h3">Setup</h2></div><ol className="checklist">{setup.map(([d, l]) => <li key={l} data-done={d}><span className="ck">{d ? '✓' : ''}</span><div><p>{l}</p></div></li>)}</ol></div>

        <section><h2 className="h3">Confirm {term} enrollment</h2><p className="body" style={{ marginTop: 6 }}>We pay only for students you confirm. {pending.length ? `${pending.length} waiting.` : 'All confirmed.'}</p>
          <form action={confirmRoster} style={{ marginTop: 16 }}><input type="hidden" name="term" value={term} />
            <div className="tablewrap"><table className="table" style={{ minWidth: 680 }}><thead><tr><th>Student</th><th>Grade</th><th className="num">EFS + school aid</th><th className="num">{term} payment</th><th>Enrolled?</th></tr></thead><tbody>
              {termRows.map((r) => <tr key={r.award_id}><td>{r.student_name}</td><td>{r.grade}</td><td className="num">{fmtUSD((r.efs_cents ?? 0) + (r.school_aid_cents ?? 0))}</td><td className="num">{fmtUSD(r.term_amount_cents)}</td>
                <td>{r.enrolled == null ? <div className="seg"><label><input type="radio" name={`enrolled_${r.award_id}`} value="yes" />Yes</label><label><input type="radio" name={`enrolled_${r.award_id}`} value="no" />No</label></div> : <span className={`pill ${r.enrolled ? 'pill-ok' : 'pill-bad'}`}>{r.enrolled ? 'Confirmed' : 'Not enrolled'}</span>}</td></tr>)}
            </tbody></table></div>
            {pending.length > 0 && <div style={{ marginTop: 16 }}><button className="btn btn-solid">Submit confirmations</button></div>}
          </form></section>

        <section className="split"><div><h2 className="h3">Payments</h2></div>
          <div className="tablewrap"><table className="table"><thead><tr><th>Term</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
            {(lines ?? []).map((l, i) => <tr key={i}><td>{l.term}</td><td>{l.status}</td><td className="num">{fmtUSD(l.amount_cents)}</td></tr>)}</tbody></table></div></section>

        <section className="split"><div><h2 className="h3">Report a withdrawal</h2><p className="body" style={{ marginTop: 6 }}>Within 30 days. Unused tuition comes back prorated by days enrolled out of 90.</p></div>
          <form action={withdraw} className="paper form-grid" style={{ padding: 20 }}><input type="hidden" name="term" value={term} />
            <div className="field"><label htmlFor="award_id">Student</label><select className="input" id="award_id" name="award_id">{termRows.filter((r) => r.state !== 'WITHDRAWN').map((r) => <option key={r.award_id} value={r.award_id}>{r.student_name}</option>)}</select></div>
            <div className="field"><label htmlFor="days">Days attended this term</label><input className="input" id="days" name="days" inputMode="numeric" required /></div>
            <div className="span-all"><button className="btn btn-secondary">Report withdrawal</button></div></form></section>

        <section className="split"><div><h2 className="h3">Bank account</h2><p className="body" style={{ marginTop: 6 }}>{payee ? `Checking ending ${payee.last4}. ${payee.callback_confirmed_at ? 'Verified.' : 'We’ll call your main office to confirm before paying it.'}` : 'Not set up yet.'}</p></div>
          <form action={payeeSubmit} className="paper form-grid" style={{ padding: 20 }}>
            <div className="field"><label htmlFor="legal_name">School legal name</label><input className="input" id="legal_name" name="legal_name" required /></div>
            <div className="field"><label htmlFor="ein">School EIN</label><input className="input" id="ein" name="ein" required placeholder="00-0000000" /></div>
            {/* In production these two fields are filled by the payment provider's hosted bank-link widget (Plaid/Stripe Financial Connections), never typed. */}
            <input type="hidden" name="account_token" value="pending-bank-link" /><input type="hidden" name="last4" value="0000" />
            <p className="hint span-all">You’ll connect the account through our bank partner’s secure window. We never see or store the full account number.</p>
            <div className="span-all"><button className="btn btn-secondary">Connect bank account</button></div></form></section>
        <p className="small muted">Questions: schools@lionheartscholars.org · <Link href="/schools">School directory</Link></p>
      </section></div>
    </>
  );
}
