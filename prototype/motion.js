/* Lionheart motion layer. Mounted after every render by site.html.
   mount(root, { animate }) — animate=false (re-render of the same page) jumps everything to its final state.
   Everything respects prefers-reduced-motion. No dependencies. */
(function () {
  'use strict';
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => RM.matches;
  const fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : false;
  const usd = n => '$' + Math.round(n).toLocaleString('en-US');
  const ease = t => 1 - Math.pow(1 - t, 3);
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ── tweening ── */
  function tween(from, to, ms, step, done) {
    if (reduced() || ms <= 0) { step(to); if (done) done(); return () => {}; }
    const t0 = performance.now(); let raf = 0;
    const tick = now => { const p = Math.min(1, (now - t0) / ms); step(from + (to - from) * ease(p)); if (p < 1) raf = requestAnimationFrame(tick); else if (done) done(); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  /* ── guilloche rosettes (engraved-banknote ornament), generated, drawn in, then slowly turning ── */
  function wavyRing(cx, R, amp, n, copies, steps) {
    let d = '';
    for (let c = 0; c < copies; c++) {
      const ph = (c / copies) * (2 * Math.PI / n);
      for (let k = 0; k <= steps; k++) {
        const t = (k / steps) * 2 * Math.PI;
        const r = R + amp * Math.sin(n * (t + ph));
        d += (k ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cx + r * Math.sin(t)).toFixed(1);
      }
      d += 'Z';
    }
    return d;
  }
  function trochoid(cx, R, r, dd, scale, steps) {
    let d = ''; const turns = r / gcd(R, r);
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * 2 * Math.PI * turns;
      const x = (R - r) * Math.cos(t) + dd * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - dd * Math.sin(((R - r) / r) * t);
      d += (k ? 'L' : 'M') + (cx + x * scale).toFixed(1) + ' ' + (cx + y * scale).toFixed(1);
    }
    return d;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  const ROSETTE_CACHE = {};
  function rosetteLayers(kind) {
    if (ROSETTE_CACHE[kind]) return ROSETTE_CACHE[kind];
    const c = 300;
    const L = kind === 'cert'
      ? [[wavyRing(c, 250, 22, 14, 10, 360), trochoid(c, 15, 7, 6, 15, 4200)], [wavyRing(c, 160, 16, 10, 8, 300)]]
      : [[wavyRing(c, 276, 18, 18, 14, 420), wavyRing(c, 200, 26, 12, 12, 360), trochoid(c, 17, 7, 5, 14, 5000)],
         [wavyRing(c, 238, 10, 24, 10, 420), wavyRing(c, 120, 18, 9, 10, 300)]];
    return (ROSETTE_CACHE[kind] = L);
  }
  function addRosette(host, kind, animate) {
    if (host.querySelector(':scope > .rosette')) return;
    const box = document.createElement('div');
    box.className = 'rosette rosette-' + kind;
    box.setAttribute('aria-hidden', 'true');
    rosetteLayers(kind).forEach((paths, li) => {
      const lyr = document.createElement('div');
      lyr.className = 'lyr ' + (li ? 'spin-r' : 'spin');
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 600 600');
      paths.forEach((d, pi) => {
        const p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('stroke-width', li ? '0.6' : '0.75');
        svg.appendChild(p);
        if (animate && !reduced()) {
          p.dataset.draw = String(li * 0.35 + pi * 0.25);
        }
      });
      lyr.appendChild(svg); box.appendChild(lyr);
    });
    host.insertBefore(box, host.firstChild);
    if (animate && !reduced()) {
      requestAnimationFrame(() => box.querySelectorAll('path[data-draw]').forEach(p => {
        const len = Math.ceil(p.getTotalLength());
        p.style.setProperty('--len', len); p.style.setProperty('--d', p.dataset.draw + 's'); p.classList.add('drawn');
      }));
    }
  }

  /* ── reveal on scroll ── */
  let io = null;
  const HOOKS = {
    cert: (el, anim) => playCert(el, anim),
    gauge: (el, anim) => playGauge(el, anim),
  };
  function reveal(el, anim) {
    if (el.classList.contains('in')) return;
    el.classList.add('in');
    const h = el.dataset.io && HOOKS[el.dataset.io];
    if (h) h(el, anim);
    el.querySelectorAll(':scope [data-count]').forEach(c => { if (!c.closest('[data-io="gauge"]')) countUp(c, anim); });
  }
  function countUp(el, anim) {
    const to = parseFloat(el.dataset.count); if (!isFinite(to)) return;
    tween(anim ? 0 : to, to, anim ? 1600 : 0, v => { el.textContent = Math.round(v).toLocaleString('en-US'); });
  }

  /* ── certificate ── */
  function playCert(cert, anim) {
    const vs = cert.querySelectorAll('.v[data-to]');
    const zero = cert.querySelector('.cert-zero');
    const sign = cert.querySelector('.cert-sign');
    if (!anim || reduced()) { if (sign) sign.classList.add('signed'); return; }
    zero.classList.remove('stamp'); zero.style.opacity = '0'; if (sign) sign.classList.remove('signed');
    vs.forEach((v, i) => {
      const to = +v.dataset.to, neg = v.hasAttribute('data-neg');
      v.textContent = neg ? '−$0' : '$0';
      setTimeout(() => tween(0, to, 1100, x => { v.textContent = (neg ? '−' : '') + usd(x); }), 250 + i * 520);
    });
    setTimeout(() => { zero.style.opacity = ''; void zero.offsetWidth; zero.classList.add('stamp'); }, 1850);
    setTimeout(() => { if (sign) sign.classList.add('signed'); }, 2250);
  }
  function tilt(stage) {
    if (!fine || reduced() || stage.dataset.tilt) return;
    stage.dataset.tilt = '1';
    stage.addEventListener('pointermove', e => {
      const c = stage.querySelector('.cert'); if (!c) return;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      c.style.setProperty('--gx', (x * 100).toFixed(0) + '%');
      c.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
    });
    stage.addEventListener('pointerleave', () => { const c = stage.querySelector('.cert'); if (c) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
  }

  /* ── 90% gauge ── */
  function playGauge(el, anim) {
    const fg = el.querySelector('.fg'); const n = el.querySelector('[data-count]');
    const C = 2 * Math.PI * 60; const pct = +(fg.dataset.pct || 90) / 100;
    fg.style.strokeDasharray = C.toFixed(1);
    if (!anim || reduced()) { fg.style.transition = 'none'; fg.style.strokeDashoffset = (C * (1 - pct)).toFixed(1); if (n) n.textContent = n.dataset.count; return; }
    fg.style.strokeDashoffset = C.toFixed(1);
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = (C * (1 - pct)).toFixed(1); }));
    if (n) tween(0, +n.dataset.count, 2000, v => { n.textContent = Math.round(v); });
  }

  /* ── countdown ── */
  let countTimer = 0;
  function countdown(root) {
    clearInterval(countTimer);
    const box = root.querySelector('[data-countdown]'); if (!box) return;
    const end = new Date(box.dataset.countdown).getTime();
    const cells = {}; box.querySelectorAll('[data-u]').forEach(c => { cells[c.dataset.u] = c; });
    const sr = box.querySelector('[data-count-sr]');
    const pad = n => String(n).padStart(2, '0');
    const upd = () => {
      let ms = end - Date.now();
      if (ms <= 0) {
        clearInterval(countTimer);
        box.querySelector('[data-count-label]').innerHTML = 'The credit is <em>open</em>. Gifts made this year count on this year’s taxes.';
        const dg = box.querySelector('.count-digits'); if (dg) dg.remove();
        return;
      }
      const s = Math.floor(ms / 1000), v = { Days: Math.floor(s / 86400), Hours: Math.floor(s / 3600) % 24, Min: Math.floor(s / 60) % 60, Sec: s % 60 };
      Object.keys(v).forEach(k => {
        const c = cells[k]; if (!c) return; const t = k === 'Days' ? String(v[k]) : pad(v[k]);
        if (c.textContent !== t) { c.textContent = t; if (!reduced()) { c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); } }
      });
      if (sr) sr.textContent = v.Days + ' days until the credit opens.';
    };
    upd(); countTimer = setInterval(upd, 1000);
  }

  /* ── journey: scroll-scrubbed path from your gift to the school ── */
  let J = null;
  function journeyInit(root) {
    const el = root.querySelector('[data-journey]');
    if (J && J.stop) J.stop();
    if (!el) { J = null; return; }
    const trail = el.querySelector('.trail'), coin = el.querySelector('.coin');
    const len = trail.getTotalLength();
    const nodes = [...el.querySelectorAll('.node')];
    const pts = nodes.map(n => { const c = n.querySelector('circle'); return { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }; });
    const at = pts.map(p => { let best = 0, bd = 1e9; for (let l = 0; l <= len; l += 2) { const q = trail.getPointAtLength(l); const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = l; } } return best; });
    at[0] = 0; at[at.length - 1] = len;
    trail.style.strokeDasharray = len.toFixed(1);
    J = { el, trail, coin, len, nodes, at, steps: [...el.querySelectorAll('.journey-step')], amtEl: el.querySelector('[data-j-amt]'), whereEl: el.querySelector('[data-j-where]'), active: -1, shown: null, stop: null };
    journeyRefresh(false);
  }
  function journeyRefresh(force) {
    if (!J) return;
    const vh = window.innerHeight, mid = vh * 0.5;
    const centers = J.steps.map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    const c0 = centers[0], cN = centers[centers.length - 1];
    let p = (mid - c0) / Math.max(1, cN - c0);
    p = Math.max(0, Math.min(1, p));
    if (reduced()) p = Math.round(p * 3) / 3;
    const seg = Math.min(J.at.length - 2, Math.floor(p * 3)), f = p * 3 - seg;
    const L = J.at[seg] + (J.at[seg + 1] - J.at[seg]) * Math.min(1, f);
    J.trail.style.strokeDashoffset = (J.len - L).toFixed(1);
    const q = J.trail.getPointAtLength(L); J.coin.setAttribute('cx', q.x.toFixed(1)); J.coin.setAttribute('cy', q.y.toFixed(1));
    let act = 0; centers.forEach((c, i) => { if (c < vh * 0.62) act = i; });
    J.nodes.forEach((n, i) => n.classList.toggle('on', i <= act));
    if (act !== J.active || force) {
      J.steps.forEach((s, i) => s.classList.toggle('on', i === act));
      J.el.querySelectorAll('.jdoc').forEach((d, i) => {
        d.classList.toggle('on', i === act); d.classList.toggle('past', i < act);
        const k = act - i;
        d.style.zIndex = i === act ? 10 : i < act ? 5 - k : 0;
        d.style.transform = i < act ? `translate(${12 * k}px, ${-11 * k}px) scale(${(1 - 0.04 * k).toFixed(2)}) rotate(${(1.6 * k).toFixed(1)}deg)` : '';
        d.style.opacity = i < act ? (0.6 / k).toFixed(2) : '';
      });
      const s = J.steps[act]; const full = +J.el.dataset.full || 3400;
      const target = s.dataset.amt === 'zero' ? 0 : full;
      J.whereEl.textContent = s.dataset.where;
      if (J.stop) J.stop();
      const from = J.shown == null ? target : J.shown;
      const jj = J; J.stop = tween(from, target, force && J.active === -1 ? 0 : 700, v => { jj.shown = v; jj.amtEl.textContent = usd(v); });
      J.active = act;
    }
  }

  /* ── family qualify slider ── */
  function qualify(root) {
    const el = root.querySelector('[data-qualify]'); if (!el) return;
    const lim = el.dataset.qualify.split(',').map(Number);
    const r = el.querySelector('[data-q-range]'), num = el.querySelector('[data-q-num]'), size = el.querySelector('[data-q-size]'), ppl = el.querySelector('[data-q-people]');
    let shown = lim[3], stop = null;
    const upd = anim => {
      const n = +r.value;
      r.style.setProperty('--fill', ((n - 1) / 7 * 100) + '%');
      size.textContent = n === 1 ? 'for a household of 1' : n === 8 ? 'for a household of 8 or more' : 'for a household of ' + n;
      if (stop) stop();
      stop = tween(shown, lim[n - 1], anim ? 500 : 0, v => { shown = v; num.textContent = usd(v); });
      const have = ppl.children.length;
      if (have < n) for (let i = have; i < n; i++) { const s = document.createElement('span'); s.style.animationDelay = anim ? ((i - have) * 0.06) + 's' : '0s'; ppl.appendChild(s); }
      else while (ppl.children.length > n) ppl.lastChild.remove();
    };
    r.addEventListener('input', () => upd(true));
    upd(false);
  }

  /* ── marquee ── */
  function marquee(root) {
    if (reduced()) return;
    root.querySelectorAll('[data-marquee] .marquee-row').forEach(row => { if (!row.dataset.dup) { row.innerHTML += row.innerHTML; row.dataset.dup = '1'; row.querySelectorAll('.marquee-item').forEach((it, i, all) => { if (i >= all.length / 2) it.setAttribute('aria-hidden', 'true'); }); } });
  }

  /* ── header ── */
  let headInit = false;
  function header() {
    if (headInit) return; headInit = true;
    const head = document.querySelector('.site-head'), meter = document.querySelector('.scroll-meter');
    let ticking = false;
    const on = () => {
      ticking = false;
      const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
      if (head) head.classList.toggle('stuck', y > 30);
      if (meter) meter.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
      if (J) journeyRefresh(false);
      parallax();
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(on); } }, { passive: true });
    window.addEventListener('resize', () => { if (J) journeyRefresh(true); });
    if (fine) window.addEventListener('pointermove', e => { px = e.clientX / window.innerWidth - 0.5; py = e.clientY / window.innerHeight - 0.5; if (!ticking) { ticking = true; requestAnimationFrame(on); } }, { passive: true });
    on();
  }
  let px = 0, py = 0;
  function parallax() {
    if (reduced()) return;
    document.querySelectorAll('.rosette-hero, .rosette-side').forEach(r => {
      const host = r.parentElement.getBoundingClientRect();
      if (host.bottom < 0 || host.top > window.innerHeight) return;
      const sy = -host.top * 0.12;
      r.style.translate = `${(px * 24).toFixed(1)}px ${(sy + py * 18).toFixed(1)}px`;
    });
  }


  /* ── credit calculator ── */
  function calc(root) {
    root.querySelectorAll('[data-calc]').forEach(box => {
      if (box.dataset.wired) return; box.dataset.wired = '1';
      const q = sel => box.querySelector(sel), o = k => q('[data-o="' + k + '"]'), b = k => q('[data-b="' + k + '"]');
      const per = q('[data-c="per"]'), tax = q('[data-c="tax"]');
      let shown = null, stop = null;
      const upd = anim => {
        const joint = (q('[data-c="filing"]:checked') || {}).value !== 'single';
        const g = joint ? 2 : 1, p = +per.value, t = +tax.value;
        const total = p * g, elig = Math.min(p, 1700) * g, now = Math.min(elig, t), later = elig - now, extra = total - elig, net = total - now;
        per.style.setProperty('--fill', ((p - 100) / 4900 * 100) + '%');
        tax.style.setProperty('--fill', (t / 20000 * 100) + '%');
        o('per').textContent = usd(p); o('tax').textContent = usd(t);
        o('perlab').textContent = joint ? 'Gift from each of you' : 'Your gift';
        o('total').textContent = usd(total); o('now').textContent = usd(now); o('later').textContent = usd(later); o('extra').textContent = usd(extra);
        [['now', now], ['later', later], ['extra', extra]].forEach(([k, v]) => { o(k).parentElement.classList.toggle('zero', !v); b(k).style.width = (total ? v / total * 100 : 0) + '%'; });
        const each = joint ? ' each' : '';
        let m;
        if (t === 0) m = 'With no federal tax owed, none of the credit applies this year. All ' + usd(elig) + ' carries forward for up to five years.';
        else if (later > 0) m = 'Your tax covers ' + usd(now) + ' of the credit. The other ' + usd(later) + ' carries forward for up to five years.';
        else if (extra > 0) m = 'The ' + usd(extra) + ' above $1,700' + each + ' is a regular charitable gift, deductible if you itemize.';
        else if (p < 1700) { const room = Math.min((1700 - p) * g, t - now); m = room > 0 ? 'You could give ' + usd(room) + ' more and still get every dollar back.' : 'Every dollar comes back as a credit on your 2027 return.'; }
        else m = 'Every dollar comes back as a credit on your 2027 return.';
        if (later > 0 && extra > 0) m += ' The ' + usd(extra) + ' above $1,700' + each + ' is a regular charitable gift.';
        o('msg').textContent = m;
        if (stop) stop();
        stop = tween(shown == null ? net : shown, net, anim ? 450 : 0, v => { shown = v; o('net').textContent = usd(v); });
      };
      box.addEventListener('input', e => { if (e.target.matches('[data-c]')) upd(true); });
      box.addEventListener('change', e => { if (e.target.matches('[data-c]')) upd(true); });
      upd(false);
    });
  }

  /* ── eligibility meter ── */
  function meter(root) {
    const m = root.querySelector('[data-meter]'); if (!m) return;
    const f = m.querySelector('.meter-fill'), l = m.querySelector('.meter-lim');
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = m.dataset.inc + '%'; l.style.left = m.dataset.lim + '%'; }));
  }

  /* ── map ↔ list ── */
  function mapLink(root) {
    const map = root.querySelector('#school-map'); if (!map) return;
    const list = root.querySelector('#school-list');
    const hot = id => {
      map.querySelectorAll('.dot.hot').forEach(d => d.classList.remove('hot'));
      list.querySelectorAll('.school.hot').forEach(d => d.classList.remove('hot'));
      if (!id) return;
      const d = map.querySelector('.dot[data-sid="' + id + '"]'); if (d) { d.classList.add('hot'); d.parentNode.appendChild(d); }
      const r = list.querySelector('.school[data-sid="' + id + '"]'); if (r) r.classList.add('hot');
    };
    list.addEventListener('mouseover', e => { const r = e.target.closest('.school[data-sid]'); hot(r && r.dataset.sid); });
    list.addEventListener('focusin', e => { const r = e.target.closest('.school[data-sid]'); hot(r && r.dataset.sid); });
    list.addEventListener('mouseleave', () => hot(null));
    map.addEventListener('mouseover', e => { const d = e.target.closest('.dot'); hot(d && d.dataset.sid); });
    map.addEventListener('click', e => { const d = e.target.closest('.dot'); if (!d) return; const r = list.querySelector('.school[data-sid="' + d.dataset.sid + '"]'); if (r) r.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); });
  }

  /* ── magnetic buttons ── */
  function magnetic(root) {
    if (!fine || reduced()) return;
    root.querySelectorAll('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1)}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ── auto-reveal for pages without hand-placed hooks ── */
  function autoReveal(root) {
    root.querySelectorAll('section').forEach(sec => {
      let i = 0;
      [...sec.children].forEach(ch => {
        if (ch.hasAttribute('data-rv') || ch.querySelector('[data-rv]')) return;
        ch.setAttribute('data-rv', ''); ch.style.setProperty('--d', Math.min(i++ * 0.09, 0.45) + 's');
      });
    });
    root.querySelectorAll('.rows > div, .timeline li, .cols-3 > *, .school').forEach((el, k, all) => {
      if (el.hasAttribute('data-rv')) return;
      const sib = [...el.parentElement.children].indexOf(el);
      el.setAttribute('data-rv', ''); el.style.setProperty('--d', Math.min(sib * 0.07, 0.5) + 's');
    });
  }

  /* ── mount ── */
  function mount(root, opts) {
    const animate = !!(opts && opts.animate) && !reduced();
    const route = opts && opts.route;
    header();
    if (animate) { root.classList.remove('page-in'); void root.offsetWidth; root.classList.add('page-in'); }
    if (animate && ['families', 'schools', 'donors'].includes(route)) autoReveal(root);
    root.querySelectorAll('.band-field, [data-rosette]').forEach(h => {
      const kind = h.dataset.rosette || 'hero';
      addRosette(h, kind, animate && kind !== 'cert');
    });
    root.querySelectorAll('.cert-stage').forEach(tilt);
    const targets = root.querySelectorAll('[data-rv], [data-io]');
    if (io) io.disconnect();
    if (!animate) {
      root.classList.add('instant');
      targets.forEach(el => reveal(el, false));
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('instant')));
    } else if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); reveal(e.target, true); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      targets.forEach(el => io.observe(el));
    } else targets.forEach(el => reveal(el, false));
    countdown(root);
    marquee(root);
    qualify(root);
    journeyInit(root);
    calc(root);
    meter(root);
    mapLink(root);
    magnetic(root);
  }

  /* re-run one element's entrance (e.g. the certificate after the filing toggle) */
  function refresh(el, anim) {
    el.querySelectorAll('[data-rosette]').forEach(h => addRosette(h, h.dataset.rosette, false));
    if (el.dataset.io && HOOKS[el.dataset.io]) HOOKS[el.dataset.io](el, anim && !reduced());
  }

  window.LHMotion = { mount, refresh, meter, journeyRefresh: f => journeyRefresh(!!f) };
})();
