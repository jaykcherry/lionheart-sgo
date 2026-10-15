import Link from 'next/link';
import { incomeLimit } from './limits';

export default function Families() {
  return (
    <>
      <div className="band band-gilt"><section className="wrap split" style={{ paddingBlock: '88px 76px' }}>
        <div><span className="eyebrow">For families</span><h1 className="display-sm" style={{ marginTop: 18 }}>A scholarship for your child’s Christian education.</h1>
          <p className="lead" style={{ marginTop: 28 }}>Most Tennessee families qualify. Apply in about ten minutes with last year’s tax return and a proof of address.</p>
          <div className="btn-row" style={{ marginTop: 30 }}><Link className="btn btn-solid" href="/signin?next=/onboarding">Start your application</Link></div></div>
        <div className="rows" style={{ borderTop: '1px solid var(--color-text)' }}>
          {[['Your child lives in Tennessee', 'Residence decides, not school location.'], ['Your child could enroll in a public school', 'Kindergarten through 12th grade.'],
            ['Household income within the limit', 'Last year’s income at or below 300% of your area’s median income, adjusted for household size.'],
            ['Renewals and siblings come first', 'From 2028–29, prior recipients and their siblings are funded first.']].map(([t, b]) => (
            <div key={t}><span className="check" aria-hidden>✓</span><div><p className="rows-title">{t}</p><p className="body">{b}</p></div></div>))}
        </div></section></div>
      <div className="band"><section className="wrap sec split">
        <div><span className="eyebrow">Income limit</span><h2 className="h2" style={{ marginTop: 16 }}>Nashville area, 2026 income</h2><p className="body" style={{ marginTop: 16 }}>Davidson, Williamson, Rutherford, Sumner, Wilson and nearby counties. Other counties differ; we check yours automatically.</p></div>
        <div className="tablewrap"><table className="table"><thead><tr><th>Household size</th><th className="num">Up to</th></tr></thead><tbody>
          {[2, 3, 4, 5, 6, 7, 8].map((n) => <tr key={n}><td>{n} people</td><td className="num">${incomeLimit(n).toLocaleString('en-US')}</td></tr>)}</tbody></table></div>
      </section></div>
    </>
  );
}
