/* Lionheart school map — a zoomable map of the schools directory.
 *
 * Google Maps when a browser key is configured (window.LH_GMAPS_KEY), otherwise Leaflet with
 * OpenStreetMap/CARTO tiles. If tiles can't load (e.g. a sandboxed preview), the map still works
 * as a vector map with the state outline.
 *
 * Markup contract (shared by the static site and the Next app):
 *   <div id="school-map-canvas"></div>
 *   a JSON script tag with id "school-map-data": {"schools":[…],"visible":[ids]}
 * Each school: { id, n: name, c: city, co: county, g: grades, cat, lat, lon, p: partner,
 *                claim: href | "action" | null, give: href }
 *
 * window.LHSchoolMap = { mount(canvas), setVisible(ids), highlight(id), onSelect: fn(id) }
 */
(function () {
  'use strict';
  const TN_BOUNDS = [[34.98, -90.31], [36.68, -81.65]];
  const TN_BORDER = [[-89.53, 36.5], [-88.05, 36.5], [-87.85, 36.63], [-86.5, 36.65], [-85.0, 36.62], [-83.68, 36.6], [-81.68, 36.59], [-81.92, 36.31], [-82.03, 36.12], [-82.6, 35.97], [-83.1, 35.77], [-83.5, 35.56], [-83.88, 35.52], [-84.02, 35.3], [-84.29, 35.22], [-84.32, 34.99], [-88.2, 34.995], [-90.31, 35.0], [-90.08, 35.12], [-90.1, 35.4], [-89.95, 35.7], [-89.65, 36.0], [-89.55, 36.25]];
  const C = { navy: '#1c2a4a', crimson: '#8e2a2e', gold: '#b9975b', ivory: '#f8f5ee' };
  const GSTYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f2ede2' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#3b4560' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f5ee' }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1c2a4a' }, { weight: 1.4 }] },
    { featureType: 'administrative.county', elementType: 'geometry.stroke', stylers: [{ color: '#cfc5ad' }, { weight: 0.6 }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.school', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.school', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8dcc2' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d4c3a0' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c7d2dc' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5b6a80' }] },
  ];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) scripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
    return scripts[src];
  }

  const st = { node: null, engine: null, map: null, markers: new Map(), schools: [], byId: new Map(), visible: null, visKey: '', dataKey: '', hot: null, popup: null, ready: null, tilesOk: false };
  const api = { onSelect: null };

  // Schools share ZIP centroids; fan duplicates out in a small spiral so each pin can be clicked.
  function place(list) {
    const seen = {};
    return list.map((s) => {
      const key = s.lat + ',' + s.lon; const k = (seen[key] = (seen[key] || 0) + 1) - 1;
      if (!k) return Object.assign({}, s);
      const a = k * 2.39996, r = 0.0045 * Math.sqrt(k);
      return Object.assign({}, s, { lat: s.lat + Math.sin(a) * r, lon: s.lon + Math.cos(a) * r * 1.25 });
    });
  }

  function popupHTML(s) {
    const q = encodeURIComponent(`${s.n}, ${s.c}, TN`);
    const claim = s.p ? '<span class="pill pill-ok">Verified partner</span>'
      : s.claim === 'action' ? `<button type="button" class="btn btn-primary btn-sm" data-action="claim" data-id="${esc(s.id)}">This is my school</button>`
      : s.claim ? `<a class="btn btn-primary btn-sm" href="${esc(s.claim)}">This is my school</a>` : '';
    return `<div class="mp"><p class="mp-name">${esc(s.n)}</p><p class="mp-meta">${esc(s.c)}, ${esc(s.co)} County · ${esc(s.g)}${s.cat ? ' · Category ' + esc(s.cat) : ''}</p>
      <div class="mp-act">${claim}${s.give ? `<a class="btn btn-ghost btn-sm" href="${esc(s.give)}">Support</a>` : ''}</div>
      <p class="mp-foot"><a href="https://www.google.com/maps/search/?api=1&amp;query=${q}" target="_blank" rel="noopener">Open in Google Maps ↗</a><span>Pin marks the ZIP code area</span></p></div>`;
  }

  // ── Google ────────────────────────────────────────────────
  const baseR = () => { const z = st.map && st.map.getZoom ? st.map.getZoom() : 7; return z < 6.5 ? 4 : z < 8 ? 5.5 : 7; };
  function gIcon(s, hot) {
    return { path: google.maps.SymbolPath.CIRCLE, scale: hot ? baseR() + 4 : baseR(), fillColor: hot ? C.gold : s.p ? C.crimson : C.navy, fillOpacity: 1, strokeColor: C.ivory, strokeWeight: 2 };
  }
  function initGoogle(el) {
    return new Promise((res, rej) => {
      const cb = '__lhGmapsReady';
      window[cb] = () => res();
      window.gm_authFailure = () => { fellBack = true; rej(new Error('Google Maps key rejected')); };
      // Billing or API-activation problems don't call gm_authFailure; Google only logs them. Watch for that log
      // and switch to the OpenStreetMap map so visitors never see Google's "can't load" dialog.
      const oe = console.error;
      console.error = function (...a) {
        try { const m = a.map(String).join(' '); if (/Google Maps JavaScript API error/.test(m)) fallbackFromGoogle(m.split('\n')[0]); } catch (e) { /* ignore */ }
        return oe.apply(console, a);
      };
      loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.LH_GMAPS_KEY)}&v=weekly&loading=async&callback=${cb}`).catch(rej);
    }).then(() => {
      st.engine = 'google';
      st.map = new google.maps.Map(el, {
        center: { lat: 35.86, lng: -86.35 }, zoom: 7, minZoom: 5, maxZoom: 15, styles: GSTYLE, gestureHandling: 'cooperative',
        mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false,
        restriction: { latLngBounds: { south: 33.8, west: -92.2, north: 37.8, east: -79.6 }, strictBounds: false },
      });
      st.popup = new google.maps.InfoWindow({ maxWidth: 300 });
      st.map.addListener('zoom_changed', resize);
      st.map.fitBounds(gBounds(TN_BOUNDS), 8);
    });
  }
  const gBounds = (b) => new google.maps.LatLngBounds({ lat: b[0][0], lng: b[0][1] }, { lat: b[1][0], lng: b[1][1] });

  let fellBack = false;
  function fallbackFromGoogle(why) {
    if (fellBack || !st.node) return; fellBack = true;
    console.warn('[LHSchoolMap] Google Maps unavailable (' + why + '); using OpenStreetMap.');
    const after = () => {
      st.markers.clear(); st.popup = null; st.map = null; st.engine = null; st.hot = null;
      const fresh = document.createElement('div'); fresh.className = st.node.className;
      fresh.setAttribute('role', 'region'); fresh.setAttribute('aria-label', st.node.getAttribute('aria-label') || 'Map of schools');
      if (st.node.parentNode) st.node.parentNode.replaceChild(fresh, st.node);
      st.node = fresh;
      st.ready = initLeaflet(st.node).then(() => { buildMarkers(); applyVisible(st.visible != null); });
      st.ready.catch(() => {});
    };
    if (st.ready) st.ready.then(after, after); else after();
  }

  // ── Leaflet ───────────────────────────────────────────────
  function initLeaflet(el) {
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js').then(() => {
      st.engine = 'leaflet';
      const m = st.map = L.map(el, { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 5, maxZoom: 15, scrollWheelZoom: false, maxBounds: [[25, -104], [46, -68]], attributionControl: true });
      m.fitBounds(TN_BOUNDS, { padding: [12, 12] });
      let loads = 0, errs = 0;
      const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      }).addTo(m);
      tiles.on('tileload', () => { loads++; st.tilesOk = true; el.classList.remove('no-tiles'); });
      tiles.on('tileerror', () => { errs++; if (errs >= 3 && !loads) noTiles(el); });
      setTimeout(() => { if (!loads) noTiles(el); }, 4000);
      // Wheel zoom only after the map is clicked, so the page still scrolls past it.
      m.on('click focus', () => m.scrollWheelZoom.enable());
      m.on('mouseout blur', () => m.scrollWheelZoom.disable());
      m.on('zoomend', resize);
      st.popup = L.popup({ maxWidth: 300, closeButton: true, autoPanPadding: [24, 24] });
    });
  }
  let outline = null;
  function noTiles(el) {
    if (st.tilesOk || outline) return;
    el.classList.add('no-tiles');
    outline = L.polygon(TN_BORDER.map(([lon, lat]) => [lat, lon]), { color: C.navy, weight: 1.5, fillColor: '#efe7d6', fillOpacity: 1, interactive: false }).addTo(st.map);
    outline.bringToBack();
  }

  // ── markers ───────────────────────────────────────────────
  function buildMarkers() {
    st.markers.forEach((mk) => (st.engine === 'google' ? mk.setMap(null) : mk.remove()));
    st.markers.clear();
    for (const s of st.schools) {
      let mk;
      if (st.engine === 'google') {
        mk = new google.maps.Marker({ position: { lat: s.lat, lng: s.lon }, icon: gIcon(s, false), title: `${s.n}, ${s.c}`, optimized: true, zIndex: s.p ? 2 : 1 });
        mk.addListener('click', () => select(s.id, true));
        mk.addListener('mouseover', () => setHot(s.id, false));
      } else {
        mk = L.circleMarker([s.lat, s.lon], { radius: baseR(), color: C.ivory, weight: 2, fillColor: s.p ? C.crimson : C.navy, fillOpacity: 1 });
        mk.bindTooltip(`${esc(s.n)} · ${esc(s.c)}`, { direction: 'top', offset: [0, -6] });
        mk.on('click', () => select(s.id, true));
        mk.on('mouseover', () => setHot(s.id, false));
      }
      st.markers.set(s.id, mk);
    }
  }
  let lastR = 0;
  function resize() {
    const r = baseR(); if (r === lastR) return; lastR = r;
    st.markers.forEach((mk, id) => { if (id === st.hot) return; const s = st.byId.get(id);
      if (st.engine === 'google') mk.setIcon(gIcon(s, false)); else mk.setRadius(r); });
  }
  function applyVisible(fit) {
    const vis = st.visible;
    const pts = [];
    for (const s of st.schools) {
      const mk = st.markers.get(s.id); const on = !vis || vis.has(s.id);
      if (st.engine === 'google') { if (on !== (mk.getMap() === st.map)) mk.setMap(on ? st.map : null); }
      else { const has = st.map.hasLayer(mk); if (on && !has) mk.addTo(st.map); if (!on && has) mk.remove(); }
      if (on) pts.push([s.lat, s.lon]);
    }
    if (!fit) return;
    const all = !vis || vis.size === st.schools.length;
    let b;
    if (all || !pts.length) b = TN_BOUNDS;
    else {
      const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]);
      b = [[Math.min(...la), Math.min(...lo)], [Math.max(...la), Math.max(...lo)]];
      const pad = 0.06; b = [[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]];
    }
    if (st.engine === 'google') st.map.fitBounds(gBounds(b), 24);
    else st.map.flyToBounds(b, { padding: [20, 20], maxZoom: 12, duration: reduced() ? 0 : 0.6 });
  }
  function setHot(id, fromList) {
    if (st.hot === id) return;
    const prev = st.hot; st.hot = id;
    const style = (sid, on) => {
      const s = st.byId.get(sid); const mk = st.markers.get(sid); if (!s || !mk) return;
      if (st.engine === 'google') { mk.setIcon(gIcon(s, on)); mk.setZIndex(on ? 999 : s.p ? 2 : 1); }
      else { mk.setStyle({ radius: on ? baseR() + 4 : baseR(), fillColor: on ? C.gold : s.p ? C.crimson : C.navy }); if (on) mk.bringToFront(); }
    };
    if (prev) style(prev, false);
    if (id) style(id, true);
    if (!fromList && api.onHover) api.onHover(id);
  }
  function select(id, fromMap) {
    const s = st.byId.get(id); if (!s || !st.map) return;
    setHot(id, !fromMap);
    if (st.engine === 'google') { st.popup.setContent(popupHTML(s)); st.popup.open({ map: st.map, anchor: st.markers.get(id) }); }
    else st.popup.setLatLng([s.lat, s.lon]).setContent(popupHTML(s)).openOn(st.map);
    if (fromMap && api.onSelect) api.onSelect(id);
  }

  // ── public ────────────────────────────────────────────────
  function readData(canvas) {
    const tag = (canvas.parentNode && canvas.parentNode.querySelector('#school-map-data')) || document.getElementById('school-map-data');
    if (!tag) return null;
    try { return { raw: tag.textContent, json: JSON.parse(tag.textContent) }; } catch (e) { return null; }
  }
  function mount(canvas) {
    if (!canvas) return;
    const d = readData(canvas); if (!d) return;
    if (!st.node) {
      st.node = document.createElement('div');
      st.node.className = 'map-canvas-inner';
      st.node.setAttribute('role', 'region'); st.node.setAttribute('aria-label', 'Map of schools on our list. Use the list beside it to browse by keyboard.');
    }
    if (st.node.parentNode !== canvas) canvas.appendChild(st.node);
    const dataKey = d.json.schools.length + ':' + d.raw.length + ':' + (d.json.schools[0] && d.json.schools[0].id);
    const vis = d.json.visible ? new Set(d.json.visible) : null;
    const visKey = vis ? [...vis].sort().join(',') : '*';
    const fresh = !st.ready;
    if (!st.ready) {
      st.ready = (window.LH_GMAPS_KEY ? initGoogle(st.node).catch((e) => { console.warn('[LHSchoolMap] Google Maps unavailable, using fallback:', e.message); st.node.innerHTML = ''; return initLeaflet(st.node); }) : initLeaflet(st.node))
        .catch((e) => { console.warn('[LHSchoolMap]', e.message); canvas.classList.add('map-failed'); throw e; });
    }
    st.ready.then(() => {
      if (st.engine === 'leaflet') st.map.invalidateSize();
      if (dataKey !== st.dataKey) {
        st.dataKey = dataKey; st.schools = place(d.json.schools); st.byId = new Map(st.schools.map((s) => [s.id, s])); st.hot = null; buildMarkers();
        st.visible = vis; st.visKey = visKey; applyVisible(!fresh);
        return;
      }
      if (visKey !== st.visKey) { st.visible = vis; st.visKey = visKey; applyVisible(true); }
    }, () => {}).catch(report);
  }
  function report(e) { console.error('[LHSchoolMap]', e && e.message, e && e.stack && e.stack.split('\n')[1]); }
  api.mount = mount;
  api.setVisible = (ids) => {
    const vis = ids ? new Set(ids) : null; const key = vis ? [...vis].sort().join(',') : '*';
    if (key === st.visKey) return; st.visible = vis; st.visKey = key;
    if (st.ready) st.ready.then(() => applyVisible(true), () => {}).catch(report);
  };
  api.highlight = (id) => { if (st.ready) st.ready.then(() => setHot(id || null, true), () => {}).catch(report); };
  api.select = (id) => { if (st.ready) st.ready.then(() => select(id, false), () => {}).catch(report); };
  window.LHSchoolMap = api;
  // If the page's motion layer loaded first, wire the map up now.
  if (window.LHMotion && window.LHMotion.mapLink) window.LHMotion.mapLink();
})();
