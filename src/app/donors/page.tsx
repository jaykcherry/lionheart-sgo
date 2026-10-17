import Link from 'next/link';
import { creditCalc, DESIG_RULES, SCHOOLS, schoolLabel } from '@/web/heritage';

export default function Donors() {
  return (
    <>
      <div className="band band-field"><section className="wrap split" style={{ paddingBlock: '72px 80px', alignItems: 'center' }}>
        <div><h1 className="display-sm" style={{ marginTop: 0 }}>Give $3,400. Get $3,400 back at tax time.</h1>
          <p className="lead" style={{ marginTop: 28 }}>For a married couple filing jointly, each of you gives $1,700 and the federal scholarship credit takes it all off your tax bill. Single filers give $1,700 and get $1,700 back.</p>
          <div className="btn-row" style={{ marginTop: 30 }}><Link className="btn btn-gold" href="/donor/give">Start your gift</Link></div></div>
        <ol className="timeline" style={{ borderTop: '2px solid rgba(255,255,255,.5)' }}>
          {[['Your gift', 'Card, Apple Pay or PayPal from your own funds, designated as a scholarship-credit gift. We cover card fees.'], ['Same day', 'An emailed receipt.'],
            ['By Jan 31', 'Your IRS acknowledgment with your donor number.'], ['Tax time', 'File Form 8525 with your Form 1040.']].map(([w, b]) => <li key={w}><span className="when">{w}</span><p className="body">{b}</p></li>)}
        </ol></section></div>
      <div className="band"><section className="wrap sec cols-3">
        {[['Cash from you', 'Card, Apple Pay, PayPal or check from your own account. Stock, crypto, business and donor-advised fund gifts don’t earn the credit.'],
          ['One benefit per dollar', 'The same dollars can’t be both a credit and a deduction. Unused credit carries forward up to five years.'],
          ['No earmarking', 'You can’t direct a gift to a particular student. You may name a preferred school, including your own child’s.']].map(([t, b]) => <div key={t} className="step-col"><h3 className="h4" style={{ marginBottom: 10 }}>{t}</h3><p className="body">{b}</p></div>)}
      </section></div>
      <div className="band band-surface" style={{ borderTop: '1px solid var(--line)' }}><section className="wrap sec">
        <div className="calc-head"><div><span className="kicker">Model your gift</span><h2 className="h2" style={{ marginTop: 16 }}>See what it costs you</h2></div><p className="lead">Set how you file, what you’d give and roughly what you’ll owe. We show the credit, any carryforward, and your cost.</p></div>
        <div style={{ marginTop: 44 }} dangerouslySetInnerHTML={{ __html: creditCalc('dc') }} />
      </section></div>
      <div className="band" style={{ borderTop: '1px solid var(--line)' }}><section className="wrap sec split" style={{ alignItems: 'center' }}>
        <div className="stack-m">
          <span className="kicker">Name a school</span>
          <h2 className="h2">Support the school you love</h2>
          <p className="body" style={{ maxWidth: '52ch' }}>When you give, you can name one of Tennessee’s {SCHOOLS.length} Christian schools. Your gift joins that school’s pool and helps its families first, awarded by need. You never choose a student. Parents and grandparents can name their own child’s school, and their children can still apply; giving doesn’t change anyone’s chances.</p>
          <p className="small"><Link href="/schools#support">See donor support by school</Link></p>
        </div>
        <form className="panel" action="/donor/give" method="get">
          <div className="field"><label htmlFor="donor-pref-q">Find a school</label><input className="input" id="donor-pref-q" name="schoolq" list="dl-donor" placeholder="School name or city" autoComplete="off" required />
            <datalist id="dl-donor">{SCHOOLS.map((s) => <option key={s.id} value={schoolLabel(s)} />)}</datalist></div>
          <div className="btn-row" style={{ marginTop: 16 }}><button className="btn btn-gold">Give and name this school <span className="arr" aria-hidden="true">→</span></button></div>
          <div dangerouslySetInnerHTML={{ __html: DESIG_RULES }} />
        </form>
      </section></div>
    </>
  );
}
