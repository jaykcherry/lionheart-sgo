import Link from 'next/link';

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
          ['No earmarking', 'You can’t direct a gift to a particular student. You may name a preferred school; it isn’t binding.']].map(([t, b]) => <div key={t} className="step-col"><h3 className="h4" style={{ marginBottom: 10 }}>{t}</h3><p className="body">{b}</p></div>)}
      </section></div>
    </>
  );
}
