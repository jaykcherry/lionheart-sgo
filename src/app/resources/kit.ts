// @ts-nocheck — ported verbatim from prototype/site.html (Resources kit); DOM-string rendering shared with the prototype.
import qrcode from 'qrcode-generator';
import { SCHOOLS, esc, usd, schoolLabel, bySlug } from '@/web/heritage';

const SITE = (typeof window !== 'undefined' ? window.location.origin : 'https://lionheartscholars.org') + '/';
const link = (route, sid, src) => SITE + route + (sid || src ? '?' + [sid ? 'school=' + sid : '', src ? 'src=' + src : ''].filter(Boolean).join('&') : '');
const $ = (s, r) => (r || document).querySelector(s);
export const S = { res: { school: '' } };
let LIM4 = 0;
export function setLimit4(v) { LIM4 = v; }
function schoolDatalist(id) { return `<datalist id="${id}">${SCHOOLS.map(s => `<option value="${esc(schoolLabel(s))}"></option>`).join('')}</datalist>`; }
const schoolById = id => bySlug(id);
function qrSvg(text, px, fg) {
  try {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2, size = n + m * 2; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="${fg || '#111a30'}"/></svg>`;
  } catch (e) { return ''; }
}
function qrMatrix(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
const resSchool = () => schoolById(S.res.school);
function resCtx() {
  const s = resSchool();
  return { s, name: s ? s.name : '', who: s ? s.name : 'your school', apply: link('family/apply', s && s.id, 'flyer'), give: link('donor/give', s && s.id, 'flyer'), applyShort: 'lionheartscholars.org', lim4: usd(LIM4) };
}
const MAT = {
  family: { label: 'Family flyer', size: 'Letter, 8.5 × 11 in', w: 8.5, h: 11 },
  donor: { label: 'Donor flyer', size: 'Letter, 8.5 × 11 in', w: 8.5, h: 11 },
  insert: { label: 'Bulletin insert', size: 'Half sheet, 5.5 × 8.5 in (prints 2 per page)', w: 5.5, h: 8.5 },
  poster: { label: 'Poster', size: 'Tabloid, 11 × 17 in', w: 11, h: 17 }
};
function matHead(c) { return `<div class="m-head"><div class="m-wave"></div><p class="m-brand">LIONHEART</p><p class="m-tag">Scholarships for Tennessee private schools</p></div>`; }
function matFoot(c, extra) { return `<p class="m-fine">${extra ? extra + ' ' : ''}Lionheart is a Tennessee scholarship granting organization under the federal scholarship tax credit (26 U.S.C. § 25F). ${c.s ? 'Shared by ' + esc(c.s.name) + '. ' : ''}lionheartscholars.org</p>`; }
function matHTML(kind, c) {
  if (kind === 'family') return `<div class="mat mat-letter">${matHead(c)}
    <p class="m-eyebrow">${c.s ? esc(c.s.name) + ' families' : 'Tennessee families'}</p>
    <h2 class="m-h">Help with private school tuition.</h2>
    <p class="m-lead">Lionheart scholarships help Tennessee families pay tuition at the private school they choose${c.s ? ', including ' + esc(c.s.name) : ''}. Most families qualify.</p>
    <ul class="m-checks"><li>Your child lives in Tennessee</li><li>Kindergarten through 12th grade in 2027–28</li><li>Household income up to three times your area’s median, about ${c.lim4} for a family of four</li></ul>
    <div class="m-cta"><div class="m-qr">${qrSvg(c.apply, 150)}<span>Scan to apply</span></div><div><p class="m-big">Apply in about ten minutes.</p><p class="m-small">You’ll need last year’s tax return and a proof of address. Apply at <b>lionheartscholars.org</b>.</p></div></div>
    <div class="m-steps"><div><b>1</b><p>Check</p><span>Four quick questions tell you if you’re likely to qualify.</span></div><div><b>2</b><p>Apply</p><span>Tell us about your household and upload last year’s tax forms.</span></div><div><b>3</b><p>Hear back</p><span>Awards are paid straight to your school each term.</span></div></div>
    ${matFoot(c, 'Scholarships depend on available funds and are awarded by need under a published formula.')}</div>`;
  if (kind === 'donor') return `<div class="mat mat-letter m-donor">${matHead(c)}
    <p class="m-eyebrow">${c.s ? 'Support ' + esc(c.s.name) + ' families' : 'For Tennessee taxpayers'}</p>
    <h2 class="m-h">Give $3,400.<br>Get $3,400 back at tax time.</h2>
    <p class="m-lead">A new federal tax credit lets each taxpayer send up to $1,700 of their federal taxes to scholarships instead of the Treasury. Married couples can send $3,400.${c.s ? ' Name ' + esc(c.s.name) + ' as your preferred school.' : ''}</p>
    <div class="m-cert"><div><span>A couple gives</span><b>$3,400</b></div><div><span>Federal tax credit</span><b>−$3,400</b></div><div class="net"><span>Net cost</span><b>$0</b></div></div>
    <div class="m-cta"><div class="m-qr">${qrSvg(c.give, 150)}<span>Scan to give</span></div><div><p class="m-big">Gifts count from January 1, 2027.</p><p class="m-small">Card, Apple Pay or PayPal, about five minutes. Schedule it now and we charge it on January 1. Give at <b>lionheartscholars.org</b>.</p></div></div>
    <div class="m-steps"><div><b>1</b><p>Give</p><span>$1,700 each in your own names, designated for the credit.</span></div><div><b>2</b><p>By Jan 31</p><span>Your IRS acknowledgment arrives with your donor number.</span></div><div><b>3</b><p>Tax time</p><span>Claim it on Form 8525. The credit lowers your tax.</span></div></div>
    ${matFoot(c, 'The credit can’t exceed the federal tax you owe; unused credit carries forward five years. No gift can be directed to a particular student. Not tax advice.')}</div>`;
  if (kind === 'insert') return `<div class="mat mat-half">${matHead(c)}
    <h2 class="m-h" style="font-size:30px">Your taxes can pay for a child’s tuition.</h2>
    <p class="m-lead" style="font-size:13.5px">Give up to $1,700 each ($3,400 as a couple) and get it all back as a federal tax credit. Families can apply for help with tuition${c.s ? ' at ' + esc(c.s.name) : ''}.</p>
    <div class="m-pair"><div class="m-qr">${qrSvg(c.give, 120)}<span>Give</span></div><div class="m-qr">${qrSvg(c.apply, 120)}<span>Apply</span></div></div>
    <p class="m-small" style="text-align:center">Scan with your phone’s camera, or visit <b>lionheartscholars.org</b>.</p>
    ${matFoot(c)}</div>`;
  if (kind === 'poster') return `<div class="mat mat-poster">${matHead(c)}
    <p class="m-eyebrow">${c.s ? esc(c.s.name) : 'Tennessee private schools'}</p>
    <h2 class="m-h" style="font-size:76px">Your tax bill can send a child to private school.</h2>
    <p class="m-lead" style="font-size:22px">Give up to $1,700 each, $3,400 as a couple, and get every dollar back as a federal tax credit. It becomes a scholarship for a Tennessee family.</p>
    <div class="m-pair big"><div class="m-qr">${qrSvg(c.give, 300)}<span>Scan to give</span><small>Give $1,700 each, get it all back</small></div><div class="m-qr">${qrSvg(c.apply, 300)}<span>Scan to apply</span><small>Tuition help for Tennessee families</small></div></div>
    <p class="m-big" style="text-align:center;font-size:30px">Gifts count from January 1, 2027. Most Tennessee families qualify.</p>
    <div class="m-steps"><div><b>I</b><p>You give</p><span>Up to $1,700 each by card, Apple Pay or PayPal. We cover the card fees.</span></div><div><b>II</b><p>You claim the credit</p><span>Your IRS letter arrives by January 31. The gift comes off your tax.</span></div><div><b>III</b><p>A child is enrolled</p><span>We award by need and pay tuition straight to the school.</span></div></div>
    ${matFoot(c)}</div>`;
  return '';
}
export function copyKit(c) {
  const sch = c.s ? c.s.name : '[School name]';
  return [
    ['Email to school families', `Subject: Tuition help for ${sch} families\n\nDear families,\n\nLionheart, a new Tennessee scholarship organization, is offering scholarships for the 2027–28 school year to help families pay tuition at private schools like ${sch}. Most Tennessee families qualify: the income limit is three times your area’s median income, about ${c.lim4} for a family of four.\n\nThe application takes about ten minutes. You’ll need last year’s tax return and a proof of address.\n\nApply here: ${c.apply}\n\nScholarships are awarded by need under Lionheart’s published formula and are paid directly to the school.`],
    ['Email to donors and grandparents', `Subject: Give $3,400, get $3,400 back, and help ${sch} families\n\nA new federal tax credit lets every taxpayer send up to $1,700 of their federal taxes to a scholarship organization instead of the Treasury. Married couples can send $3,400. The full amount comes back as a credit on your federal return.\n\nLionheart turns those gifts into tuition scholarships for Tennessee families. When you give, you can name ${sch} as your preferred school.\n\nGifts count from January 1, 2027. You can schedule yours today:\n${c.give}\n\nThe credit can’t exceed the federal tax you owe, and unused credit carries forward five years. Talk with your tax preparer about your situation.`],
    ['Social post for donors', `Your federal taxes can pay a child’s private school tuition. Give $1,700 each ($3,400 as a couple) through Lionheart and get it all back as a federal tax credit.${c.s ? ' Name ' + sch + ' as your school.' : ''} Gifts count from Jan 1, 2027. ${c.give}`],
    ['Social post for families', `Looking for help with private school tuition? Lionheart scholarships are open to Tennessee families${c.s ? ' at ' + sch + ' and' : ''} at schools across the state. Most families qualify. Apply in about 10 minutes: ${c.apply}`],
    ['Newsletter blurb', `TAX CREDIT SCHOLARSHIPS: Starting January 1, 2027, you can give up to $1,700 ($3,400 for married couples) to Lionheart and receive the full amount back as a federal tax credit. Gifts become scholarships for Tennessee children at private schools. Families can apply for tuition help too. Learn more at lionheartscholars.org.`],
    ['Text message', `New federal tax credit: give $1,700 each ($3,400 as a couple) to private school scholarships and get it all back at tax time. ${c.give}`]
  ];
}
const KEY_DATES = [['Now', 'Families can apply for 2027–28. Donors can schedule gifts.'], ['January 1, 2027', 'Gifts begin to count for the federal credit. Scheduled gifts are charged.'], ['January 31', 'Donors receive IRS acknowledgments with their donor numbers.'], ['Spring', 'First award round. Renewing students and siblings are funded first.'], ['Summer', 'Second award round.'], ['August 20 and January 20', 'Tuition is paid to schools, once enrollment is confirmed.']];
const TALKING = ['Lionheart is a nonprofit scholarship granting organization for Tennessee, operating under the federal scholarship tax credit that begins January 1, 2027.', 'Donors give up to $1,700 each ($3,400 for a married couple filing jointly) and receive the same amount back as a federal tax credit, up to the tax they owe.', 'Donors may name a preferred school. Gifts are never directed to a particular student, and awards follow a published, need-based formula.', 'Families qualify with household income up to 300% of their area’s median income; most Tennessee families do.', 'Scholarships are paid directly to the school by ACH. Partnering is free and non-exclusive.', 'Questions: hello@lionheartscholars.org [placeholder].'];

export function resourcesHTML() {
  const c = resCtx();
  return `
  <div class="band band-field">
    <section class="wrap split" style="padding-block:84px 72px;align-items:center">
      <div>
        <span class="kicker">Resources</span>
        <h1 class="display-sm" style="margin-top:18px">Spread the word.</h1>
        <p class="lead" style="margin-top:24px">Ready-to-print flyers, social graphics, QR codes and words to use, free for schools, community groups and supporters. Choose a school and every piece carries its name, with QR codes that go straight to giving or applying.</p>
      </div>
      <div class="panel">
        <span class="card-kicker">Making materials for</span>
        <div class="field" style="margin-top:14px"><label for="res-q">Find a school</label><input class="input" id="res-q" list="dl-res" placeholder="Start typing a school or city" value="${c.s ? esc(schoolLabel(c.s)) : ''}" data-action-input="res-school" autocomplete="off">${schoolDatalist('dl-res')}</div>
        <div class="res-chosen" id="res-chosen">${c.s ? `<span class="pill pill-gilt">${esc(c.s.name)}, ${esc(c.s.city)}</span><button type="button" class="btn btn-ghost btn-sm" data-action="res-clear">Use general materials</button>` : `<span class="pill pill-neutral">General materials (no school named)</span>`}</div>
        <p class="hint" style="margin-top:12px">Anyone can make these. Naming a school adds it to the text and to the giving link, so donors who scan see it as their preferred school.</p>
      </div>
    </section>
  </div>

  <div class="band"><section class="wrap sec">
    <div class="calc-head"><div><span class="kicker" data-rv>Print</span><h2 class="h2" data-rv style="margin-top:16px">Flyers, inserts and posters</h2></div><p class="lead" data-rv>Print at home or at any print shop. To save a PDF, choose “Save as PDF” in the print window.</p></div>
    <div class="mats">${Object.keys(MAT).map((k, i) => `<figure class="mat-card" data-rv style="--d:${(i * 0.08).toFixed(2)}s"><div class="mat-frame" data-w="${MAT[k].w}" data-h="${MAT[k].h}"><div class="mat-scale">${matHTML(k, c)}</div></div><figcaption><div><p class="h4">${MAT[k].label}</p><p class="small muted">${MAT[k].size}</p></div><button type="button" class="btn btn-primary btn-sm" data-action="res-print" data-kind="${k}">Print</button></figcaption></figure>`).join('')}</div>
  </section></div>

  <div class="band band-surface" style="border-top:1px solid var(--line)"><section class="wrap sec">
    <div class="calc-head"><div><span class="kicker" data-rv>Share online</span><h2 class="h2" data-rv style="margin-top:16px">Social graphics</h2></div><p class="lead" data-rv>Sized for Instagram, Facebook and stories. Download and post, with a caption from the kit below.</p></div>
    <div class="socials">${[['sq-donor', 'Donor post', '1080 × 1080'], ['sq-family', 'Family post', '1080 × 1080'], ['story', 'Story', '1080 × 1920']].map(([k, l, d], i) => `<figure class="social-card" data-rv style="--d:${(i * 0.08).toFixed(2)}s"><canvas class="social-canvas ${k === 'story' ? 'tall' : ''}" data-social="${k}" width="${1080}" height="${k === 'story' ? 1920 : 1080}" aria-label="${l} preview"></canvas><figcaption><div><p class="h4">${l}</p><p class="small muted">${d} PNG</p></div><button type="button" class="btn btn-primary btn-sm" data-action="res-png" data-kind="${k}">Download</button></figcaption></figure>`).join('')}</div>
  </section></div>

  <div class="band"><section class="wrap sec split" style="align-items:center">
    <div><span class="kicker" data-rv>QR codes</span><h2 class="h2" data-rv style="margin-top:16px">Two codes, two jobs</h2><p class="lead" data-rv style="margin-top:20px">Put them on newsletters, slides, signs and report cards. ${c.s ? 'Both carry ' + esc(c.s.name) + '.' : 'Choose a school above to tag them.'}</p></div>
    <div class="qr-pair">${[['give', 'Give', c.give], ['apply', 'Apply', c.apply]].map(([k, l, u]) => `<div class="qr-card" data-rv="scale"><div class="qr-box">${qrSvg(u, 190)}</div><p class="h4">${l}</p><p class="small muted qr-url">${esc(u.replace('https://', ''))}</p><div class="btn-row" style="justify-content:center;gap:8px"><button type="button" class="btn btn-secondary btn-sm" data-action="res-qr" data-kind="${k}" data-fmt="png">PNG</button><button type="button" class="btn btn-secondary btn-sm" data-action="res-qr" data-kind="${k}" data-fmt="svg">SVG</button><button type="button" class="btn btn-ghost btn-sm" data-action="copy" data-text="${esc(u)}">Copy link</button></div></div>`).join('')}</div>
  </section></div>

  <div class="band band-surface" style="border-top:1px solid var(--line)"><section class="wrap sec">
    <div class="calc-head"><div><span class="kicker" data-rv>Words to use</span><h2 class="h2" data-rv style="margin-top:16px">Copy kit</h2></div><p class="lead" data-rv>Plain, accurate language you can paste into an email, a post or a bulletin. Edit freely, but please keep the tax facts as written.</p></div>
    <div class="copy-kit">${copyKit(c).map(([t, body], i) => `<div class="copy-card" data-rv style="--d:${(i * 0.05).toFixed(2)}s"><div class="copy-head"><p class="h4">${t}</p><button type="button" class="btn btn-secondary btn-sm" data-action="copy-block" data-i="${i}">Copy</button></div><pre class="copy-text" id="copy-${i}">${esc(body)}</pre></div>`).join('')}</div>
  </section></div>

  <div class="band"><section class="wrap sec split">
    <div><span class="kicker" data-rv>For your front office</span><h2 class="h2" data-rv style="margin-top:16px">Talking points</h2>
      <ul class="talk">${TALKING.map(t => `<li data-rv>${esc(t)}</li>`).join('')}</ul></div>
    <div><h3 class="h3" data-rv>Key dates</h3><ol class="timeline" style="margin-top:14px">${KEY_DATES.map(([w, b]) => `<li data-rv><span class="when">${w}</span><p class="body">${b}</p></li>`).join('')}</ol>
      <div class="note" style="margin-top:24px" data-rv>Not on our list yet? <a href="/schools">Claim your school</a> so we can pay tuition for your students by ACH.</div></div>
  </section></div>
`;
}

/* social graphics drawn on canvas */
function drawSocial(cv) {
  const k = cv.dataset.social, c = resCtx(), x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const navy = '#18243f', gold = '#b9975b', ivory = '#fbf8f1', goldHi = '#d8bf8a';
  const g = x.createRadialGradient(W * 0.8, H * 0.35, 50, W * 0.6, H * 0.5, W * 1.1); g.addColorStop(0, '#22325a'); g.addColorStop(1, '#111a30');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // guilloche
  x.save(); x.globalAlpha = 0.28; x.strokeStyle = gold; x.lineWidth = 1.2; const cx = W * 0.92, cy = k === 'story' ? H * 0.2 : H * 0.18, R = W * 0.5;
  for (let cpy = 0; cpy < 14; cpy++) { x.beginPath(); for (let t = 0; t <= 360; t++) { const a = t / 360 * Math.PI * 2, rr = R + 26 * Math.sin(16 * (a + cpy / 14 * Math.PI / 8)); const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a); t ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  x.restore();
  // border
  x.strokeStyle = gold; x.lineWidth = 2; x.strokeRect(40, 40, W - 80, H - 80); x.lineWidth = 1; x.strokeRect(52, 52, W - 104, H - 104);
  const serif = '"Libre Caslon Display", Georgia, serif', text = '"Libre Caslon Text", Georgia, serif', sans = '"Libre Franklin", Arial, sans-serif';
  x.fillStyle = goldHi; x.font = `400 30px ${text}`; x.letterSpacing = '8px'; x.fillText('LIONHEART', 110, 150); x.letterSpacing = '0px';
  function wrap(str, font, size, maxW, y0, lh, color) { x.font = `400 ${size}px ${font}`; x.fillStyle = color; const words = str.split(' '); let line = '', y = y0; words.forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { x.fillText(line, 110, y); line = w; y += lh; } else line = t; }); if (line) x.fillText(line, 110, y); return y; }
  let y;
  if (k === 'sq-family') {
    x.font = `italic 34px ${text}`; x.fillStyle = goldHi; x.fillText(c.s ? c.s.name + ' families' : 'Tennessee families', 110, 250);
    y = wrap('Help with private school tuition.', serif, 104, W - 220, 380, 112, ivory);
    y = wrap('Most Tennessee families qualify. Apply in about ten minutes.', text, 38, 560, y + 90, 52, '#cfd3de');
  } else {
    x.font = `italic 34px ${text}`; x.fillStyle = goldHi; x.fillText(c.s ? 'Support ' + c.s.name : 'For Tennessee taxpayers', 110, 250);
    y = wrap('Give $3,400. Get $3,400 back at tax time.', serif, k === 'story' ? 118 : 104, W - 220, k === 'story' ? 420 : 380, k === 'story' ? 128 : 112, ivory);
    y = wrap('A federal tax credit turns your gift into a private school scholarship. Gifts count from January 1, 2027.', text, k === 'story' ? 40 : 36, k === 'story' ? W - 220 : 560, y + 90, k === 'story' ? 56 : 50, '#cfd3de');
  }
  // QR
  const url = k === 'sq-family' ? c.apply : c.give; const q = qrMatrix(url), n = q.getModuleCount();
  const qs = k === 'story' ? 380 : 240, qx = k === 'story' ? (W - qs) / 2 : W - qs - 110, qy = k === 'story' ? H - qs - 330 : H - qs - 170, cell = qs / (n + 4);
  x.fillStyle = '#fff'; x.fillRect(qx, qy, qs, qs); x.fillStyle = '#111a30';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect(qx + (col + 2) * cell, qy + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
  x.font = `600 30px ${sans}`; x.fillStyle = goldHi; x.textAlign = 'center';
  x.fillText(k === 'sq-family' ? 'Scan to apply' : 'Scan to give', qx + qs / 2, qy + qs + (k === 'story' ? 70 : 48));
  x.textAlign = k === 'story' ? 'center' : 'left'; x.font = `400 30px ${sans}`; x.fillStyle = '#cfd3de'; x.fillText('lionheartscholars.org', k === 'story' ? W / 2 : 110, k === 'story' ? qy + qs + 120 : qy + qs + 48); x.textAlign = 'left';
  x.fillStyle = gold; x.fillRect(110, k === 'story' ? 200 : 180, 120, 2);
}
export function drawAllSocial() { const run = () => document.querySelectorAll('canvas[data-social]').forEach(drawSocial); (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run); }
export function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export const fileSlug = () => { const s = resSchool(); return s ? s.id : 'lionheart'; };
export function printMat(kind) {
  let root = document.getElementById('print-sheet'); if (!root) { root = document.createElement('div'); root.id = 'print-sheet'; document.body.appendChild(root); }
  const m = MAT[kind], c = resCtx(), html = matHTML(kind, c);
  root.innerHTML = kind === 'insert' ? `<div class="print-two">${html}${html}</div>` : html;
  let st = document.getElementById('print-page'); if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
  st.textContent = kind === 'insert' ? '@page { size: 11in 8.5in; margin: 0; }' : `@page { size: ${m.w}in ${m.h}in; margin: 0; }`;
  document.body.classList.add('printing');
  const token = (printMat.n = (printMat.n || 0) + 1);
  const done = () => { if (token !== printMat.n) return; document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) {} setTimeout(done, 1500); }, 120);
}
export function fitMats() { document.querySelectorAll('.mat-frame').forEach(f => { const w = +f.dataset.w * 96, h = +f.dataset.h * 96, s = f.clientWidth / w; const inner = f.firstElementChild; inner.style.width = w + 'px'; inner.style.height = h + 'px'; inner.style.transform = `scale(${s})`; f.style.height = (h * s) + 'px'; }); }

export { resCtx, qrMatrix, qrSvg };
