import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/supabase';
import { startFamily, linkDonor } from './actions';

export const dynamic = 'force-dynamic';

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (!s) redirect('/signin?next=' + encodeURIComponent('/onboarding' + (sp.school ? `?school=${sp.school}` : '')));
  const go = [
    hasRole(s, 'family') && ['/family', 'Family portal'],
    hasRole(s, 'school_admin') && ['/school', 'School portal'],
    hasRole(s, 'donor') && ['/donor', 'Donor portal'],
    hasRole(s, 'staff', 'board') && ['/board', 'Operations console'],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="band"><section className="wrap" style={{ paddingBlock: '64px 84px' }}>
      
      <h1 className="h2" style={{ margin: '14px 0 8px' }}>What brings you to Lionheart?</h1>
      <p className="body">Signed in as {s.email}. You can add more than one role to the same account.</p>
      {go.length > 0 && <div className="btn-row" style={{ marginTop: 20 }}>{go.map(([h, l]) => <Link key={h} className="btn btn-primary" href={h}>{l}</Link>)}</div>}
      <div className="cols-3" style={{ marginTop: 40 }}>
        <form action={startFamily} className="card"><input type="hidden" name="school" value={sp.school ?? ''} /><span className="card-kicker">Family</span><h2 className="h3">Apply for a scholarship</h2>
          <p className="body" style={{ flex: 1 }}>Set up your household, add your children, and upload last year’s tax documents.</p><div><button className="btn btn-solid">Start as a family</button></div></form>
        <div className="card"><span className="card-kicker">School</span><h2 className="h3">Claim your school</h2>
          <p className="body" style={{ flex: 1 }}>Find your school on our list and verify with your school email.</p><div><Link className="btn btn-solid" href="/schools">Find my school</Link></div></div>
        <form action={linkDonor} className="card"><span className="card-kicker">Donor</span><h2 className="h3">See my gifts</h2>
          <p className="body" style={{ flex: 1 }}>Track your credit, scheduled gifts, and year-end acknowledgments.</p><div><button className="btn btn-solid">Open donor portal</button></div></form>
      </div>
      <p className="hint" style={{ marginTop: 28 }}>Staff and board access is granted by the board chair from the operations console.</p>
    </section></div>
  );
}
