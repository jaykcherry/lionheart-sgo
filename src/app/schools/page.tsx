import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';
import { DESIG_RULES, REGIONS, SCHOOLS, schoolMapData, schoolMatches, schoolRank, supportBoard, supportLine, type Support } from '@/web/heritage';

export const dynamic = 'force-dynamic';

type Sp = { q?: string; region?: string; n?: string };

export default async function Schools({ searchParams }: { searchParams: Promise<Sp> }) {
  const { q = '', region = '', n = '25' } = await searchParams;
  const sb = supabaseService();
  const [{ data: rows }, { data: sup }] = await Promise.all([
    sb.from('schools').select('slug, state'),
    sb.from('school_support').select('slug, designated_cents, donor_count'),
  ]);
  const state = new Map((rows ?? []).map((r) => [r.slug as string, r.state as string]));
  const support = new Map<string, Support>((sup ?? []).map((r) => [r.slug as string, { cents: Number(r.designated_cents), donors: r.donor_count as number | null }]));
  const partners = new Set([...state].filter(([, st]) => st === 'ACTIVE').map(([slug]) => slug));
  const list = schoolRank(SCHOOLS.filter((s) => (!region || s.region === region) && schoolMatches(s, q)), q);
  const shown = Math.min(Number(n) || 25, list.length);
  const qs = (o: Partial<Sp>) => { const p = new URLSearchParams(); const m = { q, region, ...o }; if (m.q) p.set('q', m.q); if (m.region) p.set('region', m.region); if (o.n) p.set('n', o.n); const s = p.toString(); return s ? `?${s}#list` : '#list'; };
  return (
    <>
      <div className="band band-field"><section className="wrap split" style={{ paddingBlock: '84px 76px' }}>
        <div><h1 className="display-sm">Your school is already on our list.</h1>
          <p className="lead" style={{ marginTop: 28 }}>We’ve pre-loaded every private K–12 school on the Tennessee Department of Education’s approved list, Categories I through V, {SCHOOLS.length} in all.</p></div>
        <div className="rows" style={{ borderTop: '2px solid rgba(255,255,255,.5)' }}>
          {[['1', 'Find your school', 'Search the list below.'], ['2', 'Say yes', 'Review the partnership terms and confirm you can sign for the school.'], ['3', 'Verify', 'We email a six-digit code to your school address, or to the school’s email on file with the state. Enter it and you’re a partner.']].map(([num, t, b]) => (
            <div key={num}><span className="numeral" style={{ fontSize: 20 }}>{num}</span><div><p className="rows-title">{t}</p><p className="body">{b}</p></div></div>))}
        </div>
      </section></div>

      <div className="band"><section className="wrap sec" id="list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
          <div><h2 className="h2">Find your school</h2><p className="small muted" style={{ marginTop: 8 }}>{SCHOOLS.length} private schools on the state’s 2026–27 approved list{partners.size ? ` · ${partners.size} verified partner${partners.size === 1 ? '' : 's'}` : ''}</p></div>
          <form className="field" style={{ flex: '0 1 360px' }} action="/schools#list"><label htmlFor="school-q">Search by name, initials, city or county</label>
            {region && <input type="hidden" name="region" value={region} />}
            <input className="input" id="school-q" name="q" type="search" defaultValue={q} placeholder="e.g. Franklin or CPA" autoComplete="off" /></form>
        </div>
        <div className="region-chips" role="group" aria-label="Region">
          {([['', 'All of Tennessee'], ...REGIONS.map((r) => [r, `${r} Tennessee`])] as [string, string][]).map(([v, l]) => (
            <Link key={v || 'all'} className="chip" aria-pressed={region === v} href={`/schools${qs({ region: v })}`}>{l} <span className="tnum">{v ? SCHOOLS.filter((s) => s.region === v).length : SCHOOLS.length}</span></Link>))}
        </div>
        <div className="school-grid">
          <div className="schools" id="school-list">
            {!list.length && <p className="body" style={{ padding: '24px 0' }}>No school matches “{q}”{region ? ` in ${region} Tennessee` : ''}. Try a shorter name.</p>}
            {list.slice(0, shown).map((s) => {
              const st = state.get(s.id) ?? 'UNCLAIMED'; const sup = support.get(s.id);
              return (
                <div className="school" data-sid={s.id} key={s.id}>
                  <div><Link className="school-name" href={`/schools/${s.id}`}>{s.name}</Link><div className="school-meta"><span>{s.city}, {s.county} County</span><span>{s.grades}</span><span>Category {s.cat} · {s.auth}</span></div>
                    <div className={`school-support${sup?.cents ? ' has' : ''}`}>{supportLine(sup)}</div></div>
                  <div className="school-act">
                    {st === 'ACTIVE' && <span className="pill pill-ok">Verified partner</span>}
                    <Link className="btn btn-primary btn-sm" href={`/schools/${s.id}`}>View school</Link>
                    <Link className="btn btn-ghost btn-sm" href={`/donor/give?school=${s.id}`}>Support</Link>
                  </div>
                </div>);
            })}
            {shown < list.length && <div className="more-row"><Link className="btn btn-secondary" href={`/schools${qs({ n: String(shown + 25) })}`} scroll={false}>Show {Math.min(25, list.length - shown)} more <span className="muted tnum" style={{ fontWeight: 500 }}>· {list.length - shown} left</span></Link></div>}
          </div>
          <div className="map-wrap"><div className="map-card" id="school-map"><div className="map-canvas" id="school-map-canvas" />
            <script type="application/json" id="school-map-data" dangerouslySetInnerHTML={{ __html: schoolMapData(list.length === SCHOOLS.length ? null : list.map((s) => s.id), state) }} />
            <div className="map-key"><span><span className="tnum">{list.length}</span> school{list.length === 1 ? '' : 's'} shown</span><span><i className="k-listed" />On the state list</span><span><i className="k-partner" />Verified partner</span></div></div>
            <p className="hint" style={{ marginTop: 10 }}>Source: Tennessee Department of Education, Non-Public Schools Directory 2026–27, updated October 5, 2026. Pins mark each school’s street address (a few marked approximate show the ZIP code area). Click a pin or a school for details.</p></div>
        </div>
        <p className="body" style={{ marginTop: 40 }}>Not listed? Email schools@lionheartscholars.org with your school’s name, city and state approval category and we’ll add it within two business days.</p>
      </section></div>

      <div className="band band-surface" id="support" style={{ borderTop: '1px solid var(--line)' }}><section className="wrap sec">
        <div className="calc-head"><div><span className="kicker" data-rv>Donor support</span><h2 className="h2" data-rv style={{ marginTop: 16 }}>Where donors are naming schools</h2></div><p className="lead" data-rv>Donors can name a preferred school. This tracker shows the total named for each school, so families can see where support is strongest and schools can watch it grow.</p></div>
        <div style={{ marginTop: 40 }} data-rv dangerouslySetInnerHTML={{ __html: supportBoard(support) }} />
        <div style={{ marginTop: 24 }} dangerouslySetInnerHTML={{ __html: DESIG_RULES }} />
      </section></div>
    </>
  );
}
