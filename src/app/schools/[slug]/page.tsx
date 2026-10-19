import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import { DESIG_RULES, SCHOOLS, TYPICAL_AWARD, bySlug, trackerChart, usd } from '@/web/heritage';

export const dynamic = 'force-dynamic';

/**
 * Every school's default page: the public donor-support tracker. Shows aggregated, donor-anonymous totals
 * (school_support / school_support_monthly). Unconfirmed schools get a "Confirm this school" button; the
 * claim flow itself lives at /school/claim/[slug] and is reached only from here.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = bySlug((await params).slug);
  return s ? { title: `${s.name} · Lionheart`, description: `Donor support for ${s.name} in ${s.city}, Tennessee, and how to give or apply.` } : {};
}

export default async function SchoolTracker({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = bySlug(slug);
  if (!s) notFound();
  const sb = supabaseService();
  const [{ data: row }, { data: all }, { data: monthly }, { data: sup }] = await Promise.all([
    sb.from('schools').select('state').eq('slug', slug).maybeSingle(),
    sb.from('school_support').select('slug, designated_cents').gt('designated_cents', 0).order('designated_cents', { ascending: false }),
    sb.from('school_support_monthly').select('month, designated_cents').eq('slug', slug),
    sb.from('school_support').select('designated_cents, donor_count').eq('slug', slug).maybeSingle(),
  ]);
  const partner = row?.state === 'ACTIVE';
  const claimable = !row || row.state === 'UNCLAIMED' || row.state === 'CLAIM_PENDING';
  const cents = Number(sup?.designated_cents ?? 0), donors = sup?.donor_count as number | null;
  const rank = (all ?? []).findIndex((r) => r.slug === slug) + 1;
  const worth = Math.floor(cents / 100 / TYPICAL_AWARD);
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lionheartscholars.org'}/schools/${slug}`;
  return (
    <>
      <div className="band band-field" data-rosette="none"><section className="wrap school-hero">
        <p><Link href="/schools" className="small school-back">← All {SCHOOLS.length} schools</Link></p>
        <p className="kicker" style={{ marginTop: 22 }}>Category {s.cat} · {s.auth}</p>
        <h1 className="display-sm" style={{ marginTop: 10 }}>{s.name}</h1>
        <p className="lead" style={{ marginTop: 14 }}>{s.street ? `${s.street}, ` : ''}{s.city} · {s.county} County · {s.grades}</p>
        <div style={{ marginTop: 18 }}>{partner ? <span className="pill pill-ok">Verified Lionheart partner</span> : claimable ? <span className="pill pill-neutral">On the state’s approved list · not yet confirmed by the school</span> : <span className="pill pill-gilt">Confirmed · setting up payments</span>}</div>
      </section></div>
      <div className="band"><section className="wrap sec">
        <div className="tracker-grid">
          <div className="tracker-main">
            <span className="kicker">Donor support tracker</span>
            <h2 className="h2" style={{ marginTop: 12 }}>Named for {s.name}</h2>
            <div className="tracker-figures">
              <div><span className="kpi-label">Designated by donors</span><span className="tracker-n tnum">{usd(cents / 100)}</span></div>
              <div><span className="kpi-label">Donors</span><span className="tracker-n tnum">{cents ? (donors && donors >= 3 ? donors : <small>fewer than 3</small>) : '0'}</span></div>
              <div><span className="kpi-label">Rank among {SCHOOLS.length} schools</span><span className="tracker-n tnum">{rank ? `#${rank}` : '—'}</span></div>
            </div>
            {cents ? <>
              <p className="body" style={{ marginTop: 18 }}>That’s about {worth ? `${worth} scholarship${worth === 1 ? '' : 's'}` : 'part of one scholarship'} at a typical award of {usd(TYPICAL_AWARD)}.</p>
              <div dangerouslySetInnerHTML={{ __html: trackerChart((monthly ?? []).map((m) => ({ month: m.month as string, cents: Number(m.designated_cents) }))) }} />
              <p className="hint">Cumulative, by month. Gifts scheduled before January 1, 2027 count on that day.</p>
            </> : <div className="tracker-empty"><p className="h3">No gifts named for this school yet.</p><p className="body" style={{ marginTop: 8 }}>Giving opens January 1, 2027. Gifts scheduled now are charged that day and show up here right away. Be the first to name {s.name}.</p></div>}
            <div style={{ marginTop: 22 }} dangerouslySetInnerHTML={{ __html: DESIG_RULES }} />
          </div>
          <aside className="tracker-side">
            <div className="paper tracker-card">
              <p className="h4">Support {s.name}</p>
              <p className="small" style={{ marginTop: 6 }}>Give up to $1,700 ($3,400 as a couple), name this school, and get it back as a federal tax credit.</p>
              <Link className="btn btn-gold" href={`/donor/give?school=${slug}`} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Give and name this school</Link>
              <Link className="btn btn-secondary" href={`/family/apply?school=${slug}`} style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Apply for a scholarship here</Link>
              <div className="btn-row" style={{ marginTop: 12, gap: 8 }}><Link className="btn btn-ghost btn-sm" href={`/resources?school=${slug}`}>Flyers and QR codes</Link><span className="small muted" style={{ wordBreak: 'break-all' }}>{url.replace('https://', '')}</span></div>
            </div>
            {partner ? <div className="paper tracker-card"><span className="pill pill-ok">Verified partner</span><p className="small" style={{ marginTop: 10 }}>This school confirmed its partnership by email. Scholarship payments go straight to the school by direct deposit.</p></div>
              : claimable ? <div className="paper tracker-card tracker-confirm"><p className="h4">Do you work at {s.name}?</p><p className="small" style={{ marginTop: 6 }}>Confirm your school with a school email in about two minutes. It’s free and non-exclusive, and it lets us pay tuition by direct deposit.</p><Link className="btn btn-primary" href={`/school/claim/${slug}`} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Confirm this school</Link></div>
              : null}
          </aside>
        </div>
      </section></div>
    </>
  );
}
