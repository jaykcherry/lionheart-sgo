import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function Schools({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { data: schools } = await supabaseService().from('schools').select('slug, name, city, grades, state').order('name');
  const list = (schools ?? []).filter((s) => !q || `${s.name} ${s.city}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="band band-field"><section className="wrap split" style={{ paddingBlock: '72px 80px' }}>
        <div><h1 className="display-sm" style={{ marginTop: 0 }}>Your school is already on our list.</h1>
          <p className="lead" style={{ marginTop: 24 }}>Find your school, say yes, and verify with your school email. It costs your school nothing and is non-exclusive.</p></div>
        <div className="rows" style={{ borderTop: '2px solid rgba(255,255,255,.5)' }}>
          {[['1', 'Find your school', 'Search below.'], ['2', 'Verify', 'We email a six-digit code to your school address.'], ['3', 'Sign and get paid', 'Accept the partnership terms and add your bank account. We pay tuition by ACH.']].map(([n, t, b]) => (
            <div key={n}><span className="numeral" style={{ fontSize: 20 }}>{n}</span><div><p className="rows-title">{t}</p><p className="body">{b}</p></div></div>))}
        </div>
      </section></div>
      <div className="band"><section className="wrap sec">
        <form style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}><label className="sr" htmlFor="q">Search</label><input className="input" id="q" name="q" defaultValue={q} placeholder="School name or city" style={{ maxWidth: 360 }} /><button className="btn btn-secondary">Search</button></form>
        <div className="schools">{list.map((s) => (
          <div className="school" key={s.slug}><div><div className="school-name">{s.name}</div><div className="school-meta"><span>{s.city}, TN</span><span>{s.grades}</span></div></div>
            <div className="school-act">{s.state === 'ACTIVE' ? <span className="pill pill-ok">Verified partner</span> : s.state === 'UNCLAIMED' || s.state === 'CLAIM_PENDING' ? <Link className="btn btn-primary btn-sm" href={`/school/claim/${s.slug}`}>This is my school</Link> : <span className="pill pill-gilt">Setting up</span>}</div></div>))}
        </div>
        <p className="body" style={{ marginTop: 32 }}>Not listed? Email schools@lionheartscholars.org with your school’s name, city and accreditor and we’ll add it within two business days.</p>
      </section></div>
    </>
  );
}
