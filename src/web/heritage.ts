/**
 * Classic heritage markup shared by the public pages. These are the same templates as the prototype
 * (prototype/site.html), returned as HTML strings so the motion layer (public/motion.js) can drive them
 * by data attributes exactly as it does in the prototype. Pure functions: safe on server and client.
 */
import directory from '@/data/schools.json';

export type DirSchool = {
  id: string; name: string; city: string; county: string; zip: string; region: 'West' | 'Middle' | 'East';
  cat: string; auth: string; grades: string; k12: number; site: string; domain: string; alt: string; lat: number; lon: number; umbrella?: boolean;
};
export const SCHOOLS = (directory as DirSchool[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const REGIONS = ['West', 'Middle', 'East'] as const;
export const schoolLabel = (s: Pick<DirSchool, 'name' | 'city'>) => `${s.name} — ${s.city}`;
export const bySlug = (slug?: string | null) => (slug ? SCHOOLS.find((s) => s.id === slug) : undefined);
export const byLabel = (v?: string | null) => { const t = String(v ?? '').trim().toLowerCase(); return SCHOOLS.find((s) => schoolLabel(s).toLowerCase() === t) ?? SCHOOLS.find((s) => s.name.toLowerCase() === t); };

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const STAR = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0 7.4 4.6 12 6 7.4 7.4 6 12 4.6 7.4 0 6 4.6 4.6Z"/></svg>';
const ROMAN = ['I', 'II', 'III', 'IV'];
const SIGN = '<svg viewBox="0 0 150 40" aria-hidden="true"><path d="M4 30C12 26 16 8 22 8s-2 24 6 22 8-20 14-18-4 18 4 16 10-14 16-12-2 10 6 9 12-6 18-6 6 4 14 3 16-4 24-6 10-1 18-2"/></svg>';

function seg(name: string, opts: [string, string][], checked: string, label: string) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}"${v === checked ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div>`;
}

export function certCard(joint: boolean) {
  const amt = joint ? 3400 : 1700;
  return `<div class="cert-in"><div class="cert-core" data-rosette="cert">
    <div class="wave"></div>
    <p class="cert-title">CERTIFICATE OF GIFT</p>
    <p class="cert-head">A scholarship, at no cost to you</p>
    <div class="cert-row"><span>Gift of ${joint ? 'a married couple' : 'one taxpayer'}</span><span class="v" data-to="${amt}">${usd(amt)}</span></div>
    <div class="cert-row rule"><span>Federal tax credit</span><span class="v" data-to="${amt}" data-neg>−${usd(amt)}</span></div>
    <div class="cert-net"><span>Net cost to you</span><span class="cert-zero">$0</span></div>
    <p class="cert-note">${joint ? 'Each spouse gives $1,700. ' : ''}Gifts made on or after January 1, 2027, up to the federal tax you owe.</p>
    <div class="cert-sign"><div>${SIGN}<div class="line">For the Board of Directors</div></div><div class="mark">LIONHEART</div></div>
  </div></div>`;
}

export function creditCalc(id: string) {
  return `<div class="calc" data-calc>
    <div class="calc-in">
      <div class="field"><span class="label">How you file</span>${seg(`${id}-f`, [['joint', 'Married, jointly'], ['single', 'Single']], 'joint', 'Filing status').replace(/<input /g, '<input data-c="filing" ')}</div>
      <div class="calc-slide"><div class="calc-lab"><label for="${id}-g" data-o="perlab">Gift from each of you</label><output data-o="per">$1,700</output></div><input id="${id}-g" type="range" class="range" min="100" max="5000" step="100" value="1700" data-c="per"></div>
      <div class="calc-slide"><div class="calc-lab"><label for="${id}-t">Federal income tax you’ll owe for 2027</label><output data-o="tax">$8,000</output></div><input id="${id}-t" type="range" class="range" min="0" max="20000" step="250" value="8000" data-c="tax"><span class="hint">After other credits, such as the child tax credit. Line 22 of a 2026 Form 1040 is a good guide.</span></div>
    </div>
    <div class="calc-out" aria-live="polite">
      <span class="card-kicker">Your net cost for 2027</span>
      <p class="calc-big" data-o="net">$0</p>
      <div class="calc-bar" aria-hidden="true"><span class="b-now" data-b="now"></span><span class="b-later" data-b="later"></span><span class="b-extra" data-b="extra"></span></div>
      <dl class="calc-dl">
        <div class="tot"><dt>Total gift</dt><dd data-o="total"></dd></div>
        <div><dt><i class="sw now"></i>Credit on your 2027 return</dt><dd data-o="now"></dd></div>
        <div><dt><i class="sw later"></i>Carried forward, up to 5 years</dt><dd data-o="later"></dd></div>
        <div><dt><i class="sw extra"></i>Beyond the credit</dt><dd data-o="extra"></dd></div>
      </dl>
      <p class="calc-msg" data-o="msg"></p>
    </div>
  </div>
  <p class="hint" style="margin-top:14px">An illustration, not tax advice. Assumes cash gifts from your own funds, made on or after January 1, 2027, and designated for the credit.</p>`;
}

/** Data block for the zoomable school map (public/schoolmap.js). `visible` null = all schools. */
export function schoolMapData(visible: string[] | null, status: Map<string, string>) {
  const json = JSON.stringify({
    schools: SCHOOLS.map((s) => {
      const st = status.get(s.id) ?? 'UNCLAIMED';
      return { id: s.id, n: s.name, c: s.city, co: s.county, g: s.grades, cat: s.cat, lat: s.lat, lon: s.lon, p: st === 'ACTIVE',
        claim: st === 'UNCLAIMED' || st === 'CLAIM_PENDING' ? `/school/claim/${s.id}` : null, give: `/donor/give?school=${s.id}` };
    }),
    visible,
  });
  return json.replace(/</g, '\\u003c');
}

export function journeyDocs(amt: number) {
  return `<div class="jdocs" aria-hidden="true">
    <div class="jdoc" data-doc="0"><div class="jdoc-h"><span>Gift receipt</span><span>Jan 1, 2027</span></div><p class="jdoc-t"><span data-money>${usd(amt)}</span> received</p><div class="jdoc-r"><span>Visa ···· 4242</span><span>§ 25F designated</span></div><span class="jdoc-stamp">Paid</span></div>
    <div class="jdoc" data-doc="1"><div class="jdoc-h"><span>Written acknowledgment</span><span>Tax year 2027</span></div><p class="jdoc-t">IRS donor no. ••••‑4815</p><div class="jdoc-r"><span>For Form 8525</span><span>Each spouse</span></div><span class="jdoc-stamp">Filed</span></div>
    <div class="jdoc" data-doc="2"><div class="jdoc-h"><span>Scholarship award</span><span>2027–28</span></div><p class="jdoc-t">Grade 3 · Davidson County</p><div class="jdoc-r"><span>By need, by formula</span><span>Renewable</span></div><span class="jdoc-stamp">Awarded</span></div>
    <div class="jdoc" data-doc="3"><div class="jdoc-h"><span>ACH remittance</span><span>Aug 20, 2027</span></div><p class="jdoc-t">Tuition paid to school</p><div class="jdoc-r"><span>Staff ✓ · Board officer ✓</span><span>Enrollment confirmed</span></div><span class="jdoc-stamp">Sent</span></div>
  </div>`;
}

export const DESIG_RULES = `<details class="rules"><summary>How a named school is used</summary><div>
  <p class="body">When you name a school, your gift joins that school’s designated pool. In each award round, the pool funds eligible applicants who attend that school first, ranked by need under our published formula. A donor never chooses a student, reviewers never see who gave, and a pool is used only when the school has at least 10 eligible applicants that round, so no gift can be steered to one family. Parents and grandparents may name their own child’s school, and their children may apply like anyone else. Anything a school’s pool can’t use goes to the general fund for students at every school.</p>
  <p class="body" style="margin-top:10px">Totals here are gifts with a school named, before any are awarded. They show donor interest; they aren’t a promise of an award. Donor names are never shown.</p>
</div></details>`;

export type Support = { cents: number; donors: number | null };
export function supportLine(sup: Support | undefined) {
  if (!sup || !sup.cents) return 'No donor designations yet';
  return `${usd(sup.cents / 100)} designated · ${sup.donors && sup.donors >= 3 ? sup.donors + ' donors' : 'fewer than 3 donors'}`;
}
export function supportBoard(support: Map<string, Support>) {
  const rows = SCHOOLS.map((s) => ({ s, d: support.get(s.id) })).filter((x): x is { s: DirSchool; d: Support } => !!x.d && x.d.cents > 0).sort((a, b) => b.d.cents - a.d.cents);
  const total = rows.reduce((t, x) => t + x.d.cents, 0) / 100;
  const max = rows.length ? rows[0]!.d.cents : 1;
  const kpis = `<div class="support-kpis">
      <div><span class="kpi-label">Designated to schools</span><span class="support-n">${usd(total)}</span></div>
      <div><span class="kpi-label">Schools with donor support</span><span class="support-n">${rows.length} <small>of ${SCHOOLS.length}</small></span></div>
      <div><span class="kpi-label">Giving opens</span><span class="support-n" style="font-size:30px">January 1, 2027</span></div>
    </div>`;
  if (!rows.length) return kpis + `<div class="support-empty"><p class="h3">No designations yet.</p><p class="body" style="margin-top:8px">Gifts made or scheduled now are charged January 1, 2027, and appear here the day they’re made. Be the first to name a school.</p><div class="btn-row" style="margin-top:18px"><a class="btn btn-gold" href="/donor/give">Give and name a school <span class="arr" aria-hidden="true">→</span></a></div></div>`;
  return kpis + `<ol class="support-board">${rows.slice(0, 12).map((x, i) => `<li data-rv style="--d:${(i * 0.05).toFixed(2)}s"><span class="sb-rank">${i + 1}</span><div class="sb-main"><p class="sb-name">${esc(x.s.name)} <small>${esc(x.s.city)}</small></p><div class="sb-bar"><span style="width:${Math.max(2, (x.d.cents / max) * 100).toFixed(1)}%"></span></div></div><div class="sb-amt"><b>${usd(x.d.cents / 100)}</b><small>${x.d.donors && x.d.donors >= 3 ? x.d.donors + ' donors' : 'fewer than 3 donors'}</small></div><a class="btn btn-ghost btn-sm" href="/donor/give?school=${x.s.id}">Support</a></li>`).join('')}</ol>`;
}

export function homeHTML(limits: number[], notified: boolean) {
  const joint = true, amt = 3400;
  const verse = 'The righteous are bold as a lion.'.split(' ').map((w, i) => `<span class="w" style="--d:${(0.15 + i * 0.12).toFixed(2)}s">${i === 0 ? '“' : ''}${w}${i === 6 ? '”' : ''}</span>`).join(' ');
  const big = SCHOOLS.filter((s) => s.k12 >= 300); const h = Math.ceil(big.length / 2);
  const steps: [string, string, string, string, string][] = [
    ['From January 1, 2027', 'You give', 'Up to $1,700 each, by card, Apple Pay or PayPal. We cover the card fees, and your gift goes into a scholarship fund kept apart from everything else.', 'full', 'Given to Lionheart from your own account'],
    ['By January 31', 'You claim the credit', 'Your acknowledgment carries an IRS donor number for Form 8525. The full gift comes off your federal tax, dollar for dollar.', 'zero', 'What it costs you, after the credit'],
    ['Spring and summer', 'A family is awarded', 'We award by need, with renewing students and their siblings first. No donor ever picks a student; a published formula does.', 'full', 'Awarded to a Tennessee family'],
    ['August and January', 'A school is paid', 'Once the school confirms enrollment, tuition goes straight to it by ACH, with two signatures on every payment.', 'full', 'Paid as tuition, straight to the school'],
  ];
  return `
  <div class="band band-field" data-rosette="none">
    <section class="wrap hero">
      <div>
        <p class="hero-verse" data-rv>“The righteous are bold as a lion.” Proverbs 28:1</p>
        <h1 class="display lines" data-io><span class="ln"><span>Your tax bill can</span></span><span class="ln"><span style="--d:.12s">send a child to</span></span><span class="ln"><span style="--d:.24s">Christian school.</span></span></h1>
        <div class="ornament grow" data-io>${STAR}</div>
        <p class="lead" data-rv style="--d:.55s">Give up to $1,700 to Lionheart, or $3,400 if you’re married, and you get every dollar back as a federal tax credit. We turn it into tuition for Tennessee kids at Christian schools.</p>
        <div class="hero-cta" data-rv style="--d:.7s"><a class="btn btn-gold magnetic" href="/donor/give" id="hero-give">Give $3,400 as a couple <span class="arr" aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/families">Apply for a scholarship</a></div>
      </div>
      <div class="cert-stage" data-rv="scale" data-rosette="wreath" style="--d:.25s">
        <div class="cert-filing">${seg('home-filing', [['joint', 'Married, filing jointly'], ['single', 'Single']], 'joint', 'Filing status')}</div>
        <div class="cert" id="cert" data-io="cert">${certCard(joint)}</div>
      </div>
    </section>
    <a class="scroll-cue" href="#journey"><span>Follow a gift</span><i aria-hidden="true"></i></a>
  </div>

  <div class="band count-band">
    <div class="wrap count" data-countdown="2027-01-01T00:00:00-06:00">
      <p class="count-label" data-count-label>The credit opens <em>January 1, 2027</em>.</p>
      <div class="count-digits" aria-hidden="true">${['Days', 'Hours', 'Min', 'Sec'].map((u, i) => `${i ? '<span class="count-sep">:</span>' : ''}<div class="count-unit"><span class="count-num" data-u="${u}">00</span><span class="count-cap">${u}</span></div>`).join('')}</div>
      <p class="sr" data-count-sr></p>
      <a class="btn btn-gold btn-sm" href="/donor/give">Schedule your gift <span class="arr" aria-hidden="true">→</span></a>
    </div>
  </div>

  <div class="band">
    <section class="wrap sec" id="journey">
      <div class="center"><span class="kicker" data-rv>Follow the money</span><h2 class="h2" data-rv style="margin-top:16px;--d:.08s">How a gift becomes a scholarship</h2><p class="lead" data-rv style="margin:18px auto 0;--d:.16s">One gift, followed through one school year.</p></div>
      <div class="journey" data-journey data-full="${amt}" style="margin-top:48px">
        <div class="journey-stage" data-rv="left">
          <p class="journey-amt" data-j-amt>${usd(amt)}</p>
          <p class="journey-where" data-j-where>${steps[0]![4]}</p>
          <svg class="journey-map" viewBox="0 0 520 160" aria-hidden="true">
            <path class="track" d="M40 80C100 80 130 40 190 40S290 112 340 112 430 64 480 64"/>
            <path class="trail" d="M40 80C100 80 130 40 190 40S290 112 340 112 430 64 480 64"/>
            ${([[40, 80, 'Your gift'], [190, 40, 'Lionheart'], [340, 112, 'A family'], [480, 64, 'The school']] as [number, number, string][]).map(([x, y, l], i) => `<g class="node" data-node="${i}"><circle class="o" cx="${x}" cy="${y}" r="21"/><circle class="i" cx="${x}" cy="${y}" r="16.5"/><text class="n" x="${x}" y="${y + 1}">${ROMAN[i]}</text><text x="${x}" y="${y > 70 ? y - 32 : y + 42}">${l}</text></g>`).join('')}
            <circle class="coin" r="8" cx="40" cy="80"/>
          </svg>
          ${journeyDocs(amt)}
        </div>
        <ol class="journey-steps">${steps.map(([when, t, b, a, where], i) => `<li class="journey-step" data-amt="${a}" data-where="${esc(where)}"><span class="numeral">${ROMAN[i]}</span><span class="when">${when}</span><h3>${t}</h3><p class="body">${b}</p></li>`).join('')}</ol>
      </div>
    </section>
  </div>

  <div class="band band-surface" style="border-top:1px solid var(--line)" id="model">
    <section class="wrap sec">
      <div class="calc-head"><div><span class="kicker" data-rv>Model your gift</span><h2 class="h2" data-rv style="margin-top:16px;--d:.08s">See what it costs you</h2></div><p class="lead" data-rv style="--d:.16s">Move the sliders. The credit can’t be larger than the federal tax you owe, and whatever it can’t use this year carries forward.</p></div>
      <div data-rv="scale" style="margin-top:44px;--d:.1s">${creditCalc('hc')}</div>
    </section>
  </div>

  <div class="band" style="border-top:1px solid var(--line)">
    <section class="wrap sec">
      <div class="center"><span class="kicker" data-rv>Take part</span><h2 class="h2" data-rv style="margin:16px 0 52px;--d:.08s">Three ways in</h2></div>
      <div class="ways">${([['/donors', 'For donors', '$0', 'net cost for a couple who gives $3,400', 'Redirect federal tax you already owe. About five minutes, by card, Apple Pay or PayPal.', 'How giving works'],
        ['/families', 'For families', 'K–12', 'most Tennessee families qualify', 'Household income up to three times your area’s median. Apply in about ten minutes.', 'Check eligibility'],
        ['/schools', 'For schools', '2 min.', 'to claim your school', 'You’re already on our list. Verify by email in two minutes; no cost, non-exclusive.', 'Find your school']] as string[][])
        .map(([href, who, n, t, b, go], i) => `<a class="way" href="${href}" data-rv style="--d:${(i * 0.12).toFixed(2)}s"><div class="wave"></div><div class="way-body"><span class="way-who">${who}</span><span class="way-n">${n}</span><span class="way-t">${t}</span><span class="way-b">${b}</span><span class="way-go">${go}</span></div></a>`).join('')}</div>
    </section>
  </div>

  <div class="band band-surface" style="border-top:1px solid var(--line)">
    <section class="wrap sec qual">
      <div>
        <span class="kicker" data-rv>For families</span>
        <h2 class="h2" data-rv style="margin-top:16px;--d:.08s">Most Tennessee families qualify.</h2>
        <p class="lead" data-rv style="margin-top:20px;--d:.16s">The limit is three times your area’s median income, adjusted for the size of your household. Slide to see the Nashville-area figure for yours.</p>
        <div class="btn-row" data-rv style="margin-top:30px;--d:.24s"><a class="btn btn-primary" href="/families">Check eligibility <span class="arr" aria-hidden="true">→</span></a><a class="btn btn-ghost" href="/signin?next=/onboarding">Start an application</a></div>
      </div>
      <div class="panel qual-panel" data-rv="right" data-qualify="${limits.join(',')}">
        <span class="card-kicker">Household income up to</span>
        <div class="qual-out"><span class="qual-num" data-q-num>${usd(limits[3] ?? 0)}</span></div>
        <p class="qual-size" data-q-size>for a household of 4</p>
        <input type="range" class="range" min="1" max="8" value="4" step="1" aria-label="People in your household" data-q-range>
        <div class="range-ticks" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, '8+'].map((n) => `<span>${n}</span>`).join('')}</div>
        <div class="qual-people" data-q-people aria-hidden="true"></div>
        <p class="hint" style="margin-top:16px">300% of the Nashville-area median income (HUD, FY2026), scaled by household size. We use your own county’s figure when you apply.</p>
      </div>
    </section>
  </div>

  <div class="band" style="border-top:1px solid var(--line);padding-bottom:64px">
    <section class="wrap sec split" style="align-items:end;padding-bottom:40px">
      <div><span class="kicker" data-rv>For schools</span><h2 class="h2" data-rv style="margin-top:16px;--d:.08s">Your school is already on our list.</h2></div>
      <div data-rv style="--d:.16s"><p class="lead">We’ve loaded all ${SCHOOLS.length} Christian schools on Tennessee’s approved list, from Memphis to Bristol. Donors can name yours. Confirm with your school email in two minutes.</p><div class="btn-row" style="margin-top:24px"><a class="btn btn-secondary" href="/schools">Find your school <span class="arr" aria-hidden="true">→</span></a></div></div>
    </section>
    <div class="marquee" data-marquee>
      <div class="marquee-row">${big.slice(0, h).map((s) => `<span class="marquee-item">${esc(s.name)} <small>${esc(s.city)}</small></span>`).join('')}</div>
      <div class="marquee-row rev">${big.slice(h).map((s) => `<span class="marquee-item">${esc(s.name)}</span>`).join('')}</div>
    </div>
  </div>

  <div class="band band-crimson" data-rosette="side">
    <section class="scripture" data-io>
      <p class="verse" style="max-width:none">${verse}</p>
      <p class="verse-ref" data-rv style="--d:1s">Proverbs 28:1</p>
      <p class="body" data-rv style="--d:1.15s">Lionheart was founded so more Tennessee families can choose a Christian education. We take our name from Proverbs: courage in what we fund, and care in how we fund it.</p>
    </section>
  </div>

  <div class="band">
    <section id="about" class="wrap sec charter">
      <div>
        <span class="kicker" data-rv>About Lionheart</span>
        <h2 class="h2" data-rv style="margin-top:16px;--d:.08s">Our charter with every donor</h2>
        <p class="lead dropcap" data-rv style="margin-top:26px;--d:.16s">We hold your gift as a trust. The law sets the floor; these four articles are the standard we hold ourselves to, and the board signs them every year.</p>
        <div class="gauge" data-io="gauge">
          <div class="gauge-wrap"><svg viewBox="0 0 150 150" aria-hidden="true"><circle class="ring" cx="75" cy="75" r="71"/><circle class="bg" cx="75" cy="75" r="60"/><circle class="fg" cx="75" cy="75" r="60" data-pct="90"/><circle class="ring" cx="75" cy="75" r="49"/></svg><span class="gauge-n"><span><span data-count="90">90</span><sup>%</sup></span></span></div>
          <p class="body"><b style="font-family:var(--serif);color:var(--navy)">At least 90 cents of every dollar</b> becomes tuition. Federal law requires it; we track it daily and publish it every year.</p>
        </div>
      </div>
      <div class="articles" data-rv="right">${([['Scholarships first.', 'At least 90 cents of every dollar becomes tuition.'], ['No favors.', 'Donors never choose a student. Awards follow a published formula, and ties go to a lottery recorded in the board minutes.'], ['Two signatures.', 'Every payment to a school is approved by staff and by a board officer.'], ['Open books.', 'An independent audit and a public report, every year.']] as string[][])
        .map(([t, b], i) => `<div class="article" data-rv style="--d:${(0.15 + i * 0.12).toFixed(2)}s"><span class="numeral">${ROMAN[i]}.</span><p><b>${t}</b> ${b}</p></div>`).join('')}</div>
    </section>
  </div>

  <div class="band band-gilt" id="notify">
    <section class="wrap notify">
      <div data-rv><h2>Giving opens January 1, 2027</h2><p class="body" style="margin-top:8px">Leave your email and we’ll write the day the credit opens. One short letter a month at most.</p></div>
      <form method="post" action="/api/notify" data-rv style="display:flex;gap:10px;flex-wrap:wrap;flex:0 1 520px;--d:.1s">
        <label class="sr" for="notify-email">Email address</label>
        <input class="input" id="notify-email" name="email" type="email" required placeholder="you@example.com" style="flex:1 1 240px">
        <button type="submit" class="btn btn-primary">${notified ? 'You’re on the list' : 'Notify me'}</button>
      </form>
    </section>
  </div>`;
}
