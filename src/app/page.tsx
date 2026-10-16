import Link from 'next/link';
import { Redirect } from './components/Redirect';

const PATH = [
  ['From Jan 1, 2027', 'You give', 'Each spouse gives $1,700 by card, Apple Pay or PayPal. We cover the card fees.'],
  ['By Jan 31', 'You get your tax letter', 'It carries your IRS donor number for Form 8525. The credit comes off your tax bill.'],
  ['April and July', 'Families are awarded', 'By need, with renewals and siblings first. No donor picks a student.'],
  ['Aug 20 and Jan 20', 'Schools are paid', 'Tuition goes straight to the school once it confirms the student is enrolled.'],
];
const DOORS = [
  ['/donors', 'Donors', 'Give, and owe that much less', ['$0 net cost', ' for a married couple with at least $3,400 of federal tax. About five minutes.']],
  ['/families', 'Families', 'Apply for a scholarship', ['Most Tennessee families qualify.', ' The limit is three times your area’s median income. Apply in about ten minutes.']],
  ['/schools', 'School leaders', 'Your school is already listed', ['No cost, non-exclusive.', ' Verify with your school email in two minutes; we pay tuition by ACH.']],
] as const;
const PROOF = [
  ['90%', 'At least 90% to scholarships', 'Federal law requires it. We track it every day and publish it every year.'],
  ['0', 'Students chosen by donors', 'Awards follow a published formula. Ties go to a lottery whose seed is read into the board minutes.'],
  ['2', 'Approvals on every payment', 'One from staff and one from a board officer before money reaches a school.'],
  ['Jan 31', 'Your tax letter, every year', 'With your IRS donor number, by email or mail. Couples get one each.'],
];

export default function Home() {
  return (
    <>
      <div className="band band-field">
        <section className="wrap hero">
          <div>
            <h1 className="display">Your tax bill can pay a child’s tuition.</h1>
            <p className="lead" style={{ marginTop: 28 }}>Give up to $1,700 each, or $3,400 as a married couple. The new federal scholarship tax credit takes every dollar off your tax bill, and the money becomes a scholarship at a Tennessee Christian school.</p>
            <div className="hero-cta"><Link className="btn btn-gold" href="/donor/give">Give $3,400</Link><Link className="btn btn-secondary" href="/families">Apply for a scholarship</Link></div>
          </div>
          <Redirect />
        </section>
      </div>

      <div className="band"><section className="wrap sec">
        <h2 className="h2" style={{ maxWidth: '20ch' }}>How a gift becomes a scholarship</h2>
        <ol className="path" style={{ listStyle: 'none', padding: 0 }}>
          {PATH.map(([d, t, b]) => <li key={t} className="path-step"><p className="path-date">{d}</p><span className="path-dot" aria-hidden /><h3 className="path-title">{t}</h3><p className="body">{b}</p></li>)}
        </ol>
      </section></div>

      <div className="band band-surface" style={{ borderTop: '1px solid var(--line)' }}><section className="wrap sec">
        <h2 className="h2" style={{ marginBottom: 28 }}>Start where you are</h2>
        <div className="doors">
          {DOORS.map(([h, who, t, [b, rest]]) => (
            <Link key={h} className="door" href={h}>
              <div><p className="door-who">{who}</p><p className="door-title">{t}</p></div>
              <p className="door-fact"><b>{b}</b>{rest}</p>
              <span className="door-go" aria-hidden><svg width="18" height="18" viewBox="0 0 18 18"><path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="#17221d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            </Link>))}
        </div>
      </section></div>

      <div className="band"><section className="wrap sec">
        <h2 className="h2" style={{ marginBottom: 32, maxWidth: '22ch' }}>What we promise every donor</h2>
        <div className="proof">{PROOF.map(([n, t, b]) => <div key={t}><p className="proof-n">{n}</p><h3 className="proof-t">{t}</h3><p className="body" style={{ fontSize: 15.5 }}>{b}</p></div>)}</div>
      </section></div>

      <div className="band band-ink"><section className="wrap sec split" style={{ alignItems: 'end' }}>
        <div><p className="verse">The righteous are bold as a lion.</p><p className="verse-ref">Proverbs 28:1</p></div>
        <p className="lead" style={{ color: '#c9d6cd' }}>Lionheart exists so more Tennessee families can choose a Christian education. We take our name from Proverbs: courage in what we fund, and care in how we fund it.</p>
      </section></div>
    </>
  );
}
