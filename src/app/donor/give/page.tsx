import { give } from '../actions';
import { SCHOOLS, bySlug, byLabel, schoolLabel, DESIG_RULES } from '@/web/heritage';

export const dynamic = 'force-dynamic';

export default async function Give({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string; school?: string; schoolq?: string }> }) {
  const sp = await searchParams;
  const pref = bySlug(sp.school) ?? byLabel(sp.schoolq);
  const before2027 = new Date() < new Date('2027-01-01T00:00:00');
  return (
    <div className="band"><section className="wrap" style={{ paddingBlock: '48px 84px' }}>
      <div className="flow">
        <form action={give} className="flow-body">
          <h1 className="h2">Make a gift</h1>
          {sp.error && <p className="errbox">{sp.error}</p>}
          {sp.cancelled && <p className="note">Checkout was cancelled. Nothing was charged.</p>}
          <div className="field"><span className="label">How do you file?</span>
            <div className="seg"><label><input type="radio" name="filing" value="joint" defaultChecked />Married filing jointly, both giving</label><label><input type="radio" name="filing" value="single" />Just me</label></div>
            <span className="hint">Spouses are counted separately. For $3,400 we record two $1,700 gifts, one in each name, so each of you gets your own donor number.</span></div>
          <div className="field" style={{ maxWidth: 260 }}><label htmlFor="amount">Total amount (USD)</label><input className="input" id="amount" name="amount" inputMode="decimal" defaultValue="3400" required /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="name1">Your legal name, as on your tax return</label><input className="input" id="name1" name="name1" required autoComplete="name" /></div>
            <div className="field"><label htmlFor="name2">Spouse’s legal name (if both giving)</label><input className="input" id="name2" name="name2" /></div>
            <div className="field span-all"><label htmlFor="email">Email for receipts</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="field span-all"><label htmlFor="street">Mailing address</label><input className="input" id="street" name="street" required autoComplete="street-address" /></div>
            <div className="field"><label htmlFor="city">City</label><input className="input" id="city" name="city" required /></div>
            <div className="field"><label htmlFor="state">State</label><input className="input" id="state" name="state" required defaultValue="TN" /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input className="input" id="zip" name="zip" required inputMode="numeric" /></div>
          </div>
          <div className="pref-box">
            <div className="field"><label htmlFor="pref">Name a preferred school <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
              <input className="input" id="pref" name="preferred_school_label" list="dl-pref" defaultValue={pref ? schoolLabel(pref) : ''} placeholder={`Search ${SCHOOLS.length} Tennessee private schools`} autoComplete="off" />
              <datalist id="dl-pref">{SCHOOLS.map((x) => <option key={x.id} value={schoolLabel(x)} />)}</datalist>
              <span className="hint">Your gift joins that school’s designated pool, which funds eligible students at the school by need, never a particular student, and only when the school has at least 10 eligible applicants. Parents and grandparents may name their own child’s school.</span></div>
            <label className="tick"><input type="checkbox" name="pref_ack" /><span>If I name a school, I understand my gift isn’t tied to a scholarship for any particular student, including my own child or grandchild, and doesn’t change anyone’s chances.</span></label>
            <div dangerouslySetInnerHTML={{ __html: DESIG_RULES }} />
          </div>
          <p className="note note-warn">Gifts over $5,000 in a year (spouses combined) can make you a “substantial contributor” under federal rules, and then your children and grandchildren can’t receive a Lionheart scholarship that year or the next. If someone in your family may apply, keep your total at $5,000 or less.</p>
          <div className="paper" style={{ padding: '16px 18px' }}>
            <label className="tick"><input type="checkbox" name="designate" defaultChecked /><span>I irrevocably designate up to $1,700 per giver as a qualified contribution under Section 25F, to fund scholarships for eligible Tennessee students. I’m giving my own funds as an individual, not through a business or donor-advised fund, and receive nothing in return.</span></label>
          </div>
          <label className="tick"><input type="checkbox" name="edelivery" defaultChecked /><span>Email my year-end acknowledgment instead of mailing it.</span></label>
          {before2027 && <p className="note">Gifts count for the credit only from January 1, 2027. We’ll save your card now and charge it once Lionheart is on the IRS list of approved SGOs (January 1, 2027 at the earliest). You can cancel any time before then.</p>}
          <div className="form-actions"><span className="small muted">Card, Apple Pay and Google Pay on the next page. We cover card fees.</span><button className="btn btn-solid">{before2027 ? 'Save card and schedule' : 'Continue to payment'}</button></div>
        </form>
        <aside className="flow-aside"><div className="panel stack-s"><span className="card-kicker">Prefer PayPal or a DAF?</span>
          <p className="small">PayPal: choose it on the next page where available, or email gifts@lionheartscholars.org.</p>
          <p className="small">Donor-advised fund grants are welcome for giving beyond your credit, but they don’t earn the federal credit.</p></div></aside>
      </div>
    </section></div>
  );
}
