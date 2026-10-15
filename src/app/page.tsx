import Link from 'next/link';

export default function Home() {
  return (
    <>
      <div className="band band-gilt">
        <section className="wrap split" style={{ alignItems: 'center', paddingBlock: '96px 84px' }}>
          <div>
            <h1 className="display"><span style={{ display: 'block' }}>Your federal taxes,</span><span style={{ display: 'block' }}>a child’s Christian education.</span></h1>
            <p className="lead" style={{ marginTop: 32 }}>Under the federal scholarship tax credit, every dollar you give to Lionheart, up to $1,700 a person, comes back off your federal tax bill. It becomes a tuition scholarship for a Tennessee family.</p>
            <div className="btn-row" style={{ marginTop: 32 }}><Link className="btn btn-primary" href="/donor/give">Make a gift</Link><Link className="btn btn-ghost" href="/families">Apply for a scholarship</Link></div>
          </div>
          <div className="panel" style={{ maxWidth: 460 }}>
            <span className="card-kicker">What a married couple’s gift costs</span>
            <div className="sumrow"><span>Your gifts to Lionheart</span><span className="v">$3,400</span></div>
            <div className="sumrow rule"><span>Federal tax credit</span><span className="v">−$3,400</span></div>
            <div className="sumrow total"><span style={{ fontWeight: 600 }}>Your net cost</span><span className="v">$0</span></div>
            <p className="small muted" style={{ marginTop: 18 }}>Each spouse gives $1,700 and claims a $1,700 credit. Gifts made on or after January 1, 2027.</p>
          </div>
        </section>
      </div>
      <div className="band">
        <section className="wrap sec">
          <span className="eyebrow">Three ways in</span>
          <h2 className="h2" style={{ margin: '16px 0 48px' }}>Where do you fit?</h2>
          <div className="cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
            {[['For donors', 'Redirect your taxes', 'Give $1,700 each and take it off your tax bill.', '/donors', 'How giving works'],
              ['For families', 'Apply for a scholarship', 'Tennessee families with children in K–12. Apply in about ten minutes.', '/families', 'Check eligibility'],
              ['For schools', 'Become a partner', 'Your school is already listed. Claim it and verify your school email.', '/schools', 'Find your school']].map(([k, t, b, h, c]) => (
              <div className="card" key={k}><span className="card-kicker">{k}</span><h3 style={{ fontSize: 30 }}>{t}</h3><p className="body" style={{ flex: 1 }}>{b}</p><div><Link className="btn btn-secondary" href={h!}>{c}</Link></div></div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
