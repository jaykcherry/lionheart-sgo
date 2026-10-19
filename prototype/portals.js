/* Lionheart prototype portals: sign-in, Family, School, Donor portals and the Board console.
   Runs the real domain engine (window.LionheartEngine, bundled from src/domain). Sample data only. */
window.LH_PORTALS = function (LH) {
  'use strict';
  const E = window.LionheartEngine;
  const { S, esc, toast, rerender, SCHOOLS, schoolById } = LH;
  const $d = (n) => Math.round(n * 100);           // dollars → cents
  const money = (c) => E.fmtUSD(c);
  const DEMO_DATE = '2027-08-12';
  const H = E.hash32;
  const pick = (arr, key) => arr[H(key) % arr.length];

  /* ───────────── Sample data (fictional people; illustrative tuition) ───────────── */
  const TUITION = { cpa: [21500, 650], da: [14900, 500], dca: [14200, 450], ehcs: [12800, 400], gcs: [15600, 500], la: [19800, 600], ncs: [13900, 400], fcs: [11900, 350], ba: [27500, 800], mtcs: [11400, 350], bcs: [15200, 500], ecs: [16800, 550] };
  const SCHOOL_STATE = { cpa: 'ACTIVE', ncs: 'ACTIVE', dca: 'ACTIVE', ehcs: 'ACTIVE', la: 'ACTIVE', mtcs: 'AGREEMENT_SIGNED' };
  SCHOOLS.forEach((s) => { s.state = SCHOOL_STATE[s.id] || 'UNCLAIMED'; }); // demo portal state only; public pages never show a real school as a partner it hasn't become
  const ACTIVE_SCHOOLS = ['cpa', 'ncs', 'dca', 'ehcs', 'la', 'mtcs'];

  const FIRST = ['Avery', 'Micah', 'Lucy', 'Eli', 'Grace', 'Noah', 'Hannah', 'Isaac', 'Ruth', 'Caleb', 'Lydia', 'Silas', 'Naomi', 'Jonah', 'Abigail', 'Levi', 'Esther', 'Asher', 'Clara', 'Owen', 'Mabel', 'Jude', 'Phoebe', 'Ezra', 'Iris', 'Gideon', 'June', 'Amos'];
  const LAST = ['Carter', 'Nguyen', 'Brooks', 'Okafor', 'Delgado', 'Murphy', 'Patel', 'Hughes', 'Ramirez', 'Bennett', 'Coleman', 'Foster', 'Greene', 'Jenkins', 'Kim', 'Long', 'Mason', 'Ortiz', 'Price', 'Reed', 'Shaw', 'Torres', 'Vaughn', 'Wade', 'Young', 'Ellison', 'Hart', 'Stone'];
  const COUNTIES = ['Davidson', 'Davidson', 'Williamson', 'Rutherford', 'Sumner', 'Wilson'];
  const GR = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  function makeApp(i, over) {
    const id = 'A-' + (1001 + i);
    const school = over.school || ACTIVE_SCHOOLS[H(id + 's') % ACTIVE_SCHOOLS.length];
    const size = over.size || 3 + (H(id + 'z') % 4);
    const county = over.county || pick(COUNTIES, id + 'c');
    const band = H(id + 'i') % 10; // income band
    const income = over.income != null ? over.income : [38, 52, 64, 79, 96, 118, 141, 168, 205, 262][band] * 1000;
    const adults = [{ personId: id + '-p1', relationship: 'self', age: 41 }, { personId: id + '-p2', relationship: 'spouse', age: 39 }];
    const kids = Array.from({ length: size - 2 }, (_, k) => ({ personId: id + '-k' + k, relationship: 'child', age: 6 + k * 3 }));
    const household = over.household || [...adults, ...kids];
    const grade = over.grade || pick(GR, id + 'g');
    const input = {
      applicationDate: '2027-02-20', county, state: over.state || 'TN', residencyProof: 'utility', household,
      incomeItems: over.categorical ? [] : [{ personId: id + '-p1', type: 'wages', amount: $d(Math.round(income * 0.7)), year: 2026, cash: true, source: 'w2' }, { personId: id + '-p2', type: 'wages', amount: $d(income - Math.round(income * 0.7)), year: 2026, cash: true, source: 'w2' }],
      zeroIncomeAttested: [], categorical: over.categorical, student: { grade, age: grade === 'K' ? 5 : 5 + Number(grade) },
    };
    const det = E.determineEligibility(input, E.TN_LIMITS_SEED);
    const [tu, fe] = TUITION[school];
    const efs = over.efs != null ? over.efs : (det.tier === 'A' || (det.tier === 'B' && H(id + 'e') % 2)) ? 7530 : 0;
    return {
      id, family: over.family || LAST[i % LAST.length], parent: over.parent || FIRST[(i + 7) % FIRST.length] + ' ' + (over.family || LAST[i % LAST.length]),
      child: over.child || FIRST[i % FIRST.length], grade, school, county, size: household.length, income: over.categorical ? null : $d(income),
      det, tuition: $d(tu), fees: $d(fe), aid: { efs: $d(efs), schoolAid: $d(over.schoolAid != null ? over.schoolAid : (H(id + 'a') % 3 === 0 ? 1500 : 0)), otherSgo: 0, other: 0 },
      priority: over.priority || 3, hold: over.hold || '', householdId: over.householdId || id, address: over.address || `${100 + i} ${pick(['Elm', 'Oak', 'Cedar', 'Maple', 'Hickory'], id)} St`,
      state: det.result === 'ELIGIBLE' ? 'QUEUED' : det.result, round: over.round || 1, input,
      residencyReattested: over.reattested != null ? over.reattested : true,
    };
  }

  const special = {
    2: { family: 'Roe', parent: 'Dana Roe', child: 'Sam', school: 'ncs', grade: '3', county: 'Davidson', income: 104000, size: 4, householdId: 'H-ROE', efs: 0, schoolAid: 0, reattested: false },
    6: { categorical: { program: 'SNAP', letterDate: '2026-11-03', nameMatchesHousehold: true } },
    9: { household: [{ personId: 'A-1010-p1', relationship: 'self', age: 44 }, { personId: 'A-1010-p2', relationship: 'spouse', age: 43 }, { personId: 'A-1010-k0', relationship: 'child', age: 10 }, { personId: 'A-1010-gma', relationship: 'parent', age: 71 }] },
    11: { state: 'KY', county: 'Simpson' },
    14: { categorical: { program: 'WIC', letterDate: '2026-12-15', nameMatchesHousehold: true }, school: 'la' },
    18: { address: '12 Oak Street', family: 'Brooks', parent: 'Kate Brooks', child: 'Ava' },
  };
  const APPS = Array.from({ length: 28 }, (_, i) => makeApp(i, special[i] || {}));
  // Roe's second child (same household) is a Round-2 sibling applicant
  APPS.push(makeApp(28, { family: 'Roe', parent: 'Dana Roe', child: 'Lily', school: 'ncs', grade: 'K', county: 'Davidson', income: 104000, size: 4, householdId: 'H-ROE', efs: 0, schoolAid: 0, round: 2, reattested: false }));
  APPS.push(makeApp(29, { round: 2 }), makeApp(30, { round: 2, school: 'cpa' }), makeApp(31, { round: 2, categorical: { program: 'SSI', letterDate: '2027-03-01', nameMatchesHousehold: true } }));

  // Board / committee registry for disqualified-person screening
  const DQ_REGISTRY = [
    { personId: 'b1', fullName: 'Tom Brooks', address: '12 Oak St.', role: 'director', year: 2027 },
    { personId: 'b2', fullName: 'Ruth Alvarez', address: '88 Granny White Pike', role: 'officer', year: 2027 },
    { personId: 'b3', fullName: 'Paul Whitaker', address: '9 Hillsboro Ct', role: 'selection_participant', year: 2027 },
  ];
  const DQ_RELATIVES = [{ ofPersonId: 'b1', fullName: 'Kate Brooks', relation: 'child', address: '12 Oak Street' }];
  const screenees = APPS.map((a) => ({ personId: a.id, fullName: a.parent, address: a.address }));
  const DQ_MATCHES = E.screen(screenees, DQ_REGISTRY, DQ_RELATIVES, 2027);
  DQ_MATCHES.forEach((m) => { const a = APPS.find((x) => x.id === m.screeneeId); if (a && m.strength !== 'possible') { a.hold = `Possible disqualified person: ${m.against}`; } });

  // Donors and gifts
  const DONOR_FIRST = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Susan', 'Richard', 'Karen', 'Joseph', 'Sarah', 'Thomas', 'Lisa', 'Charles', 'Nancy'];
  const DONOR_LAST = ['Whitfield', 'Harmon', 'Caldwell', 'Pruitt', 'Langston', 'McCord', 'Sutton', 'Averitt', 'Beasley', 'Draper', 'Fentress', 'Gaines', 'Holloway', 'Ingram', 'Jarrell', 'Kinney', 'Lowery', 'Maddox', 'Norwood', 'Overton'];
  const DONORS = []; const GIFTS = [];
  const months = ['01-01', '01-01', '01-01', '01-14', '02-03', '02-20', '03-11', '04-02', '05-09', '06-18', '07-07', '07-29'];
  for (let i = 0; i < 64; i++) {
    const last = DONOR_LAST[i % 20]; const first = DONOR_FIRST[(i * 7) % 20];
    const couple = H('c' + i) % 3 !== 0;
    const date = '2027-' + months[H('d' + i) % months.length];
    const pref = H('p' + i) % 6 === 0 ? 'cpa' : H('p' + i) % 9 === 0 ? 'la' : '';
    const amt = [1700, 1700, 1700, 1000, 500, 1700][H('a' + i) % 6];
    const ids = couple ? [`D${i}a`, `D${i}b`] : [`D${i}a`];
    ids.forEach((did, k) => {
      DONORS.push({ donorId: did, legalName: k ? `${DONOR_FIRST[(i * 7 + 3) % 20]} ${last}` : `${first} ${last}`, address: `${200 + i} ${pick(['Belle Meade', 'Franklin', 'Granny White', 'Hillsboro'], did)} Rd, Nashville TN`, email: `${did}@example.org`, eDeliveryConsent: H(did) % 7 !== 0 });
      GIFTS.push({ giftId: 'G' + did, donorId: did, date, amount: $d(amt), method: pick(['card', 'card', 'apple_pay', 'paypal', 'ach'], did), pref, state: 'RECONCILED' });
    });
  }
  // Persona donors: Margaret & Tom Ellis
  DONORS.push({ donorId: 'ELLIS-M', legalName: 'Margaret A. Ellis', address: '41 Tyne Blvd, Nashville TN 37215', email: 'margaret@example.org', eDeliveryConsent: true },
    { donorId: 'ELLIS-T', legalName: 'Thomas R. Ellis', address: '41 Tyne Blvd, Nashville TN 37215', email: 'tom@example.org', eDeliveryConsent: true });
  GIFTS.push({ giftId: 'G-EM1', donorId: 'ELLIS-M', date: '2027-01-01', amount: $d(1700), method: 'card', pref: '', state: 'RECONCILED' },
    { giftId: 'G-ET1', donorId: 'ELLIS-T', date: '2027-01-01', amount: $d(1200), method: 'card', pref: '', state: 'RECONCILED' },
    { giftId: 'G-ET2', donorId: 'ELLIS-T', date: '2027-12-01', amount: $d(500), method: 'card', pref: '', state: 'PLEDGED', scheduled: true });

  /* ───────────── Prototype state ───────────── */
  const P = S.p = {
    role: null, tab: {},
    round1: null, round2: null, round2Seed: 'LH-2027-R2-0812', round2Approved: false,
    confirmations: {},  // awardId → { enrolled: bool, at }
    payees: {}, batch: null, approvals: [], batchState: 'DRAFT', sent: [], withdrawals: [], prefSchool: '', eDelivery: true,
    reviews: {}, seenOnboarding: {}, wd: { award: '', days: '30' }, newBank: '',
  };
  ACTIVE_SCHOOLS.forEach((id) => { P.payees[id] = { schoolId: id, verified: id !== 'mtcs', emailConfirmed: true, last4: String(1000 + (H(id) % 9000)) }; });

  const giftsBefore = (date) => GIFTS.filter((g) => !g.scheduled && g.date <= date);
  const designatedTotal = (date) => giftsBefore(date).reduce((a, g) => a + g.amount, 0);
  const prefPools = (date) => {
    const m = {}; giftsBefore(date).filter((g) => g.pref).forEach((g) => { m[g.pref] = (m[g.pref] || 0) + g.amount; });
    return Object.entries(m).map(([schoolId, amount]) => ({ schoolId, amount }));
  };
  const toCand = (a) => ({ applicationId: a.id, studentId: 'st-' + a.id, householdId: a.householdId, schoolId: a.school, needIndex: E.needIndexOf(a.det), priority: a.priority, tuition: a.tuition, requiredFees: a.fees, aid: a.aid, hold: a.hold || undefined });

  // Round 1 (April 15, 2027): run once at load and treat as board-approved
  const R1_DATE = '2027-04-15';
  P.round1 = E.allocateRound({ roundId: '2027-R1', seed: 'LH-2027-R1-0415', cashAvailable: designatedTotal(R1_DATE), preferencePools: prefPools(R1_DATE),
    candidates: APPS.filter((a) => a.round === 1 && a.det.result === 'ELIGIBLE').map(toCand) });
  const AWARD = {}; // applicationId → { amount, terms, round }
  function applyRound(res, roundNo) {
    res.lines.forEach((l) => {
      const a = APPS.find((x) => x.id === l.applicationId);
      if (l.outcome === 'AWARDED') { AWARD[a.id] = { amount: l.amount, terms: l.terms, round: roundNo, fundedFrom: l.fundedFrom, unmet: l.unmet, needIndex: l.needIndex, fullAmount: l.fullAmount, partial: l.partial, shortfall: l.shortfall }; a.state = 'AWARDED'; }
      else if (l.outcome === 'WAITLISTED') a.state = 'WAITLISTED';
      else if (l.outcome === 'HELD') a.state = 'HELD';
      else if (l.outcome === 'NO_AWARD') a.state = 'CLOSED';
    });
  }
  applyRound(P.round1, 1);
  // Most round-1 families have accepted; most schools have confirmed fall enrollment
  APPS.filter((a) => a.state === 'AWARDED').forEach((a) => {
    if (a.family !== 'Roe' || a.child === 'Sam') a.state = 'ACCEPTED';
    if (a.state === 'ACCEPTED' && a.school !== 'ncs') { P.confirmations[a.id] = { enrolled: true, at: '2027-08-10' }; a.state = 'SCHOOL_CONFIRMED'; }
  });
  // Siblings of round-1 recipients get priority 2 in round 2 (§25F(d)(1)(D))
  const recipientHouseholds = new Set(Object.keys(AWARD).map((id) => APPS.find((a) => a.id === id).householdId));
  APPS.filter((a) => a.round === 2 && recipientHouseholds.has(a.householdId)).forEach((a) => { a.priority = 2; });
  APPS.filter((a) => a.round === 2 && a.det.result === 'ELIGIBLE').forEach((a) => { a.state = 'QUEUED'; });

  const committed = () => Object.values(AWARD).reduce((s, w) => s + w.amount, 0);
  const paidTotal = () => P.sent.reduce((s, b) => s + b.total, 0);
  const segBalance = () => designatedTotal(DEMO_DATE) - paidTotal() + P.withdrawals.filter((w) => w.received).reduce((s, w) => s + w.refund, 0);
  const uncommitted = () => designatedTotal(DEMO_DATE) - committed();

  function termAwards(term) {
    return Object.entries(AWARD).map(([id, w]) => { const a = APPS.find((x) => x.id === id); const t = w.terms.find((x) => x.term === term); return t && { awardId: id, studentId: 'st-' + id, schoolId: a.school, term, amount: t.amount }; }).filter(Boolean);
  }
  function gatesFor() {
    const g = {};
    Object.keys(AWARD).forEach((id) => {
      const a = APPS.find((x) => x.id === id);
      g[id] = { enrollmentConfirmed: !!(P.confirmations[id] && P.confirmations[id].enrolled), residencyReattested: !!a.residencyReattested, hold: a.state === 'WITHDRAWN' ? 'Withdrawn' : a.state === 'HELD' ? a.hold : (a.state === 'AWARDED' ? 'Family has not accepted the award' : '') };
    });
    return g;
  }
  function currentBatch() {
    const alreadySent = new Set(P.sent.flatMap((b) => b.awardIds));
    return E.buildBatch('2027-FALL-1', 'fall', termAwards('fall').filter((t) => !alreadySent.has(t.awardId)), gatesFor(), P.payees, DEMO_DATE, segBalance());
  }

  function snapshot() {
    const designated = designatedTotal(DEMO_DATE);
    const scheduled = Object.values(AWARD).flatMap((w) => w.terms.map((t) => ({ date: t.term === 'fall' ? '2027-08-20' : '2028-01-20', amount: t.amount })))
      .filter((p, i) => !(p.date === '2027-08-20' && P.sent.length)); // crude: once fall sent, it moves to actual payments
    const ninety = E.ninetyPercentTest([{ year: 2027, contributions: designated, earnings: $d(412), refunds: 0 }],
      P.sent.map((b) => ({ date: b.date, amount: b.total })), DEMO_DATE, scheduled);
    const recon = [{ severity: 'warn', code: 'NOT_DEPOSITED', message: 'Stripe payout po_1Q8x (3 gifts, $4,100 net) in transit; expected Aug 13.', ref: 'po_1Q8x' }];
    if (Object.values(P.payees).some((p) => p.changedAt && (!p.emailConfirmed || (p.payableAfter && DEMO_DATE < p.payableAfter)))) recon.push({ severity: 'warn', code: 'PAYEE_CHANGE', message: 'A school changed its bank account. Payments to that school wait until the school confirms from its email on file with the state and the 3-day cancel window ends. No action needed.', ref: 'payee' });
    const awardedStudents = Object.keys(AWARD).map((id) => ({ studentId: id, schoolId: APPS.find((a) => a.id === id).school, year: 2027 }));
    const deadlines = E.deadlinesFor(2027).map((d) => ({ ...d, done: ['irs-portal-2027', 'tn-list-2027'].includes(d.id) }));
    const segLedger = segBalance();
    const findings = E.evaluate({ asOf: DEMO_DATE, ninety, recon, awardedStudents, segregatedBankBalance: segLedger, segregatedLedgerBalance: segLedger,
      acknowledgmentsQueued: { year: 2027, donorsWithGifts: 0, queued: 0 }, deadlines, openHolds: APPS.filter((a) => a.state === 'HELD').length,
      dqMatchesUnreviewed: APPS.filter((a) => a.state === 'HELD' && !P.reviews[a.id]).length, exceptionTicketsOverSla: 0 });
    return { findings, ninety, deadlines };
  }

  /* ───────────── UI helpers ───────────── */
  const pill = (txt, cls) => `<span class="pill ${cls}">${esc(txt)}</span>`;
  const STATE_PILL = { QUEUED: 'pill-neutral', WAITLISTED: 'pill-warn', AWARDED: 'pill-gilt', ACCEPTED: 'pill-gilt', SCHOOL_CONFIRMED: 'pill-ok', ACTIVE: 'pill-ok', HELD: 'pill-bad', NEEDS_REVIEW: 'pill-warn', INELIGIBLE_PROPOSED: 'pill-bad', DENIED: 'pill-bad', ELIGIBLE: 'pill-ok', WITHDRAWN: 'pill-neutral', CLOSED: 'pill-neutral', PAID: 'pill-ok' };
  const stateLabel = (s) => ({ QUEUED: 'Eligible · in queue', SCHOOL_CONFIRMED: 'School confirmed', NEEDS_REVIEW: 'Needs review', INELIGIBLE_PROPOSED: 'Ineligible (proposed)' }[s] || s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '));
  const statePill = (s) => pill(stateLabel(s), STATE_PILL[s] || 'pill-neutral');
  const schoolName = (id) => (schoolById(id) || { name: id }).name;
  const tierPill = (t) => t ? pill('Tier ' + t, t === 'A' ? 'pill-ok' : t === 'B' ? 'pill-gilt' : 'pill-neutral') : '';
  const kpi = (label, value, sub) => `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value tnum">${value}</p>${sub ? `<p class="kpi-sub">${sub}</p>` : ''}</div>`;
  const sev = { critical: 'pill-bad', warn: 'pill-warn', info: 'pill-ok' };

  function shell(role, persona, tabs, body) {
    const cur = P.tab[role] || tabs[0][0];
    return `
    <div class="band band-surface">
      <div class="wrap portal-head">
        <div><span class="eyebrow">${esc(role)}</span><h1 class="h2" style="margin-top:6px">${esc(persona.title)}</h1><p class="small muted" style="margin-top:4px">${persona.sub}</p></div>
        <div class="btn-row"><span class="pill pill-neutral">Demo date ${esc(new Date(DEMO_DATE + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</span><a class="btn btn-secondary btn-sm" href="#signin">Switch account</a></div>
      </div>
      <div class="wrap"><nav class="tabs" role="tablist" aria-label="${esc(role)} sections">${tabs.map(([id, label, badge]) => `<button type="button" role="tab" class="tab" aria-selected="${id === cur}" data-action="ptab" data-role="${esc(role)}" data-tab="${id}">${esc(label)}${badge ? `<span class="tab-badge tnum">${badge}</span>` : ''}</button>`).join('')}</nav></div>
    </div>
    <div class="band"><section class="wrap" style="padding-block:40px 84px">${body(cur)}</section></div>`;
  }
  const checklist = (items) => `<ol class="checklist">${items.map(([done, label, sub]) => `<li data-done="${done}"><span class="ck" aria-hidden="true">${done ? '✓' : ''}</span><div><p>${label}</p>${sub ? `<p class="small muted">${sub}</p>` : ''}</div></li>`).join('')}</ol>`;
  const track = (steps, at) => `<ol class="track">${steps.map((s, i) => `<li data-state="${i < at ? 'done' : i === at ? 'current' : 'todo'}"><span></span>${esc(s)}</li>`).join('')}</ol>`;
  const bar = (val, max) => `<div class="bar" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${val}"><span style="width:${Math.min(100, (val / max) * 100).toFixed(1)}%"></span></div>`;

  /* ───────────── Sign in ───────────── */
  function signin() {
    const demo = [
      ['family', 'Family', 'Dana Roe', 'Sam has an award at Nashville Christian School; his sister Lily is queued for Round 2. A residency check is due.'],
      ['school', 'School', 'Karen Hale, Business manager', 'Nashville Christian School. Fall enrollment confirmation window is open.'],
      ['donor', 'Donor', 'Margaret & Tom Ellis', 'Married, filing jointly. Tom has $500 left of his credit, scheduled for December.'],
      ['board', 'Board & operations', 'Ruth Alvarez, Treasurer', 'Compliance, award rounds, payment approvals, reviews.'],
    ];
    return `<div class="band band-gilt"><section class="wrap split" style="padding-block:72px 84px">
      <div class="stack-m">
        <span class="eyebrow">Sign in</span>
        <h1 class="display-sm">One account for families, schools and donors.</h1>
        <p class="lead">No passwords. We email you a sign-in link, or you can use a passkey. School staff and board members also confirm with a second factor.</p>
        <form class="panel stack-m" data-form="signin" style="max-width:460px">
          <div class="field"><label for="si-email">Email</label><input class="input" id="si-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
          <button class="btn btn-solid" type="submit">Email me a sign-in link</button>
          <button class="btn btn-secondary" type="button" data-action="passkey">Use a passkey</button>
          <p class="hint">Prototype: links aren’t sent. Use a demo account instead.</p>
        </form>
      </div>
      <div class="stack-m">
        <p class="label">Demo accounts (sample data)</p>
        ${demo.map(([r, label, who, sub]) => `<button type="button" class="demo-acct" data-action="as" data-role="${r}"><span class="card-kicker">${label}</span><span class="h4">${esc(who)}</span><span class="small muted">${esc(sub)}</span></button>`).join('')}
      </div>
    </section></div>`;
  }

  /* ───────────── Family portal ───────────── */
  function family() {
    const kids = APPS.filter((a) => a.householdId === 'H-ROE');
    const home = kids[0];
    const needsResidency = kids.some((k) => AWARD[k.id] && !k.residencyReattested);
    const toAccept = kids.filter((k) => k.state === 'AWARDED').length;
    return shell('Family', { title: 'Roe household', sub: `${home.size} people · ${esc(home.county)} County · 2 students at Nashville Christian School` },
      [['overview', 'Overview', toAccept + (needsResidency ? 1 : 0) || ''], ['eligibility', 'Eligibility'], ['documents', 'Documents'], ['payments', 'Payments']], (tab) => {
        if (tab === 'overview') return `
          ${(toAccept || needsResidency) ? `<div class="todo stack-s"><p class="label">To do</p>${toAccept ? `<p>Accept ${toAccept === 1 ? 'Lily’s' : 'your'} award offer by Aug 22.</p>` : ''}${needsResidency ? `<p>Confirm you still live in Tennessee before the Aug 20 payment.</p>` : ''}</div>` : ''}
          <div class="cols-2" style="margin-top:24px">${kids.map((k) => {
            const w = AWARD[k.id];
            const steps = ['Submitted', 'Verified', 'Awarded', 'Accepted', 'School confirmed', 'Paid'];
            const at = { QUEUED: 2, WAITLISTED: 2, AWARDED: 2, ACCEPTED: 4, SCHOOL_CONFIRMED: 5, ACTIVE: 6 }[k.state] ?? 1;
            const paid = P.sent.some((b) => b.awardIds.includes(k.id));
            return `<article class="card" style="gap:16px">
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><span class="card-kicker">${k.grade === 'K' ? 'Kindergarten' : 'Grade ' + k.grade} · 2027–28</span><h3 style="font-size:28px">${esc(k.child)} Roe</h3></div>${statePill(paid ? 'PAID' : k.state)}</div>
              ${track(steps, paid ? 6 : at)}
              ${w ? `<div class="paper" style="padding:16px 18px">
                <div class="sumrow" style="padding-top:0"><span>Tuition + required fees</span><span class="tnum">${money(k.tuition + k.fees)}</span></div>
                <div class="sumrow"><span>Other aid (EFS, school)</span><span class="tnum">−${money(k.aid.efs + k.aid.schoolAid)}</span></div>
                <div class="sumrow"><span>Unmet need × ${Math.round(E.coverageFor(w.needIndex) * 100)}% (income ${k.det.method === 'categorical' ? 'qualifies through benefits' : Math.round(w.needIndex * 100) + '% of area median'})</span><span class="tnum">${money(w.unmet)}</span></div>
                <div class="sumrow total" style="padding-top:12px"><span style="font-weight:600">Lionheart award</span><span class="v" style="font-size:36px">${money(w.amount)}</span></div>${w.partial ? `<p class="small">Full award ${money(w.fullAmount)}; the remaining ${money(w.shortfall)} is added in order as gifts arrive.</p>` : ''}
                <p class="small muted">${w.terms.map((t) => `${t.term === 'fall' ? 'Fall · Aug 20' : 'Spring · Jan 20'}: ${money(t.amount)}`).join(' · ')} · paid to the school</p>
              </div>` : `<p class="body">${k.state === 'QUEUED' ? 'Eligible. Lily is a sibling of a current recipient, so she’s near the front of the Round 2 queue (August).' : 'Waiting for the next award round.'}</p>`}
              ${k.state === 'AWARDED' ? `<div class="btn-row"><button class="btn btn-solid" type="button" data-action="fam-accept" data-id="${k.id}">Accept award</button><button class="btn btn-ghost" type="button" data-action="fam-decline" data-id="${k.id}">Decline</button></div>` : ''}
            </article>`; }).join('')}</div>
          ${needsResidency ? `<form class="panel stack-m" data-form="fam-residency" style="margin-top:28px;max-width:640px;box-shadow:none;border:1px solid var(--color-divider)">
            <h3 class="h4">Confirm your Tennessee address for fall</h3>
            <p class="body">Federal rules require that scholarship students live in Tennessee when each payment is made.</p>
            <label class="tick"><input type="checkbox" id="fam-res" required><span>We still live at ${esc(home.address)}, Nashville, TN.</span></label>
            <div><button class="btn btn-primary" type="submit">Confirm</button></div></form>` : ''}`;
        if (tab === 'eligibility') { const d = home.det; return `
          <div class="split"><div class="stack-m"><h2 class="h3">How we determined eligibility</h2><p class="body">Calculated automatically from your documents with the limits table <span class="tnum">${esc(d.limitsVersion)}</span>. A person reviews anything unusual before a decision.</p></div>
          <div class="paper" style="padding:20px 24px">
            <div class="sumrow" style="padding-top:0"><span>Method</span><span>${d.method === 'direct_income' ? 'Income documents' : esc(d.method)}</span></div>
            <div class="sumrow"><span>Household size</span><span class="tnum">${d.householdSize}</span></div>
            <div class="sumrow"><span>2026 household income</span><span class="tnum">${money(d.incomeTotal)}</span></div>
            <div class="sumrow"><span>Area median (${esc(d.limit.area.name.split(',')[0])}, size ${d.householdSize})</span><span class="tnum">${money(d.limit.amgiAdjusted)}</span></div>
            <div class="sumrow"><span>Your income as % of median</span><span class="tnum">${(d.pctAmgi * 100).toFixed(0)}%</span></div>
            <div class="sumrow"><span>Federal limit (300%)</span><span class="tnum">${money(d.limit.limit)}</span></div>
            <div class="sumrow" style="border-bottom:0"><span>Result</span><span>${statePill(d.result)} ${tierPill(d.tier)}</span></div>
          </div></div>`; }
        if (tab === 'documents') return `
          <div class="tablewrap"><table class="table"><thead><tr><th>Document</th><th>What we read</th><th>Status</th></tr></thead><tbody>
            <tr><td>W-2 · Dana Roe · 2026</td><td class="tnum">Wages ${money(Math.round(home.income * 0.7))} · employer EIN ••-•••4410</td><td>${pill('Confirmed by you', 'pill-ok')}</td></tr>
            <tr><td>W-2 · Chris Roe · 2026</td><td class="tnum">Wages ${money(home.income - Math.round(home.income * 0.7))}</td><td>${pill('Confirmed by you', 'pill-ok')}</td></tr>
            <tr><td>NES utility bill · Jan 2027</td><td>Address matches application</td><td>${pill('Verified', 'pill-ok')}</td></tr>
          </tbody></table></div>
          <p class="hint" style="margin-top:12px">Social Security numbers are removed automatically when a document is uploaded. Raw tax documents are deleted three years after a final decision.</p>`;
        const paid = P.sent.filter((b) => b.awardIds.some((id) => kids.some((k) => k.id === id)));
        return paid.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Student</th><th>Paid to</th><th class="num">Amount</th></tr></thead><tbody>${paid.flatMap((b) => b.lines.filter((l) => kids.some((k) => k.id === l.awardId)).map((l) => `<tr><td>${b.date}</td><td>${esc(APPS.find((a) => a.id === l.awardId).child)}</td><td>${esc(schoolName(l.schoolId))}</td><td class="num">${money(l.amount)}</td></tr>`)).join('')}</tbody></table></div>`
          : `<p class="body">No payments yet. Fall payments go to the school on August 20 once the school confirms enrollment and you confirm your address.</p>`;
      });
  }

  /* ───────────── School portal ───────────── */
  function school() {
    const sid = 'ncs';
    const mine = Object.keys(AWARD).map((id) => APPS.find((a) => a.id === id)).filter((a) => a.school === sid);
    const pending = mine.filter((a) => !P.confirmations[a.id] && a.state !== 'WITHDRAWN');
    const payee = P.payees[sid];
    return shell('School', { title: 'Nashville Christian School', sub: 'Karen Hale · Business manager · Verified partner since Nov 2026' },
      [['overview', 'Overview'], ['roster', 'Confirm enrollment', pending.length || ''], ['payments', 'Payments'], ['withdrawals', 'Withdrawals'], ['bank', 'Bank account']], (tab) => {
        if (tab === 'overview') {
          const fallExpected = mine.reduce((s, a) => s + (AWARD[a.id].terms[0].amount), 0);
          return `<div class="kpis">${kpi('Lionheart students', mine.length, '2027–28')}${kpi('Fall payment expected', money(fallExpected), 'Aug 20 by ACH')}${kpi('Awaiting your confirmation', pending.length, 'Window closes Aug 16')}</div>
          <div class="split" style="margin-top:40px"><div><h2 class="h3">Partner setup</h2><p class="body" style="margin-top:8px">Everything we need to pay you.</p></div>
          ${checklist([[true, 'Claimed your school', 'Nov 3, 2026'], [true, 'Verified your @nashvillechristian.org email'], [true, 'Signed the partnership agreement', 'Non-exclusive · $0 cost'], [payee.verified, 'Verified the school’s bank account', payee.verified ? 'Account ending ' + payee.last4 : 'Pending'], [true, 'Published 2027–28 tuition and required fees']])}</div>`;
        }
        if (tab === 'roster') return `
          <div class="note" style="max-width:70ch">Confirm each Lionheart student is enrolled for fall and that tuition and other aid are right. We pay on Aug 20 only for confirmed students.</div>
          <form data-form="sch-roster" style="margin-top:20px"><div class="tablewrap"><table class="table" style="min-width:720px"><thead><tr><th>Student</th><th>Grade</th><th class="num">Tuition + fees</th><th class="num">EFS + school aid</th><th class="num">Fall payment</th><th>Enrolled for fall?</th></tr></thead><tbody>
          ${mine.map((a) => { const c = P.confirmations[a.id]; return `<tr><td>${esc(a.child)} ${esc(a.family)}${a.state === 'AWARDED' ? `<br><span class="small muted">Family hasn’t accepted yet</span>` : ''}</td><td>${a.grade}</td><td class="num">${money(a.tuition + a.fees)}</td><td class="num">${money(a.aid.efs + a.aid.schoolAid)}</td><td class="num">${money(AWARD[a.id].terms[0].amount)}</td>
            <td>${c ? pill(c.enrolled ? 'Confirmed' : 'Not enrolled', c.enrolled ? 'pill-ok' : 'pill-bad') : `<div class="seg" role="radiogroup" aria-label="Enrolled ${esc(a.child)}"><label><input type="radio" name="en-${a.id}" value="yes">Yes</label><label><input type="radio" name="en-${a.id}" value="no">No</label></div>`}</td></tr>`; }).join('')}
          </tbody></table></div>${pending.length ? `<div class="btn-row" style="margin-top:20px"><button class="btn btn-solid" type="submit">Submit confirmations</button><span class="small muted">Tuition or aid wrong? Email schools@lionheartscholars.org before submitting.</span></div>` : `<p class="small muted" style="margin-top:16px">All students confirmed. Thank you.</p>`}</form>`;
        if (tab === 'payments') {
          const recv = P.sent.flatMap((b) => b.lines.filter((l) => l.schoolId === sid).map((l) => ({ ...l, date: b.date, batch: b.id })));
          return `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Batch</th><th>Student</th><th>Term</th><th class="num">Amount</th></tr></thead><tbody>
          ${recv.length ? recv.map((r) => `<tr><td>${r.date}</td><td class="tnum">${r.batch}</td><td>${esc(APPS.find((a) => a.id === r.awardId).child)} ${esc(APPS.find((a) => a.id === r.awardId).family)}</td><td>Fall</td><td class="num">${money(r.amount)}</td></tr>`).join('')
            : mine.map((a) => `<tr><td>Aug 20 (scheduled)</td><td>—</td><td>${esc(a.child)} ${esc(a.family)}</td><td>Fall</td><td class="num">${money(AWARD[a.id].terms[0].amount)}</td></tr>`).join('')}
          </tbody></table></div><p class="hint" style="margin-top:12px">Remittance detail is emailed with every ACH deposit.</p>`;
        }
        if (tab === 'withdrawals') {
          const opts = mine.filter((a) => a.state !== 'WITHDRAWN');
          const sel = P.wd.award || (opts[0] && opts[0].id) || '';
          const paid = sel && P.sent.some((b) => b.awardIds.includes(sel)) ? AWARD[sel].terms[0].amount : 0;
          const refund = paid ? E.refundDue(paid, Number(P.wd.days) || 0, 90) : 0;
          return `<div class="split"><div class="stack-m"><h2 class="h3">Report a withdrawal</h2><p class="body">Tell us within 30 days. If we’ve already paid for the term, the unused share comes back to Lionheart, prorated by days enrolled out of 90.</p></div>
          <form class="paper stack-m" data-form="sch-wd" style="padding:22px">
            <div class="field"><label for="wd-s">Student</label><select class="input" id="wd-s" data-bind="p.wd.award" data-rerender>${opts.map((a) => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.child)} ${esc(a.family)}</option>`).join('')}</select></div>
            <div class="field"><label for="wd-d">School days attended this term</label><input class="input" id="wd-d" inputmode="numeric" data-bind="p.wd.days" data-live="wd" value="${esc(P.wd.days)}"></div>
            <div class="sumrow" id="wd-out"><span>Refund due to Lionheart</span><span class="v">${paid ? money(refund) : '$0'}</span></div>
            <p class="hint">${paid ? 'Fall was paid ' + money(paid) + '.' : 'Fall hasn’t been paid yet, so nothing is owed; we simply won’t pay for this student.'}</p>
            <div><button class="btn btn-primary" type="submit">Report withdrawal</button></div></form></div>
            ${P.withdrawals.length ? `<h3 class="h4" style="margin-top:32px">Reported</h3><div class="tablewrap"><table class="table"><tbody>${P.withdrawals.map((w) => `<tr><td>${esc(w.name)}</td><td>${w.days} days</td><td class="num">${money(w.refund)} due</td></tr>`).join('')}</tbody></table></div>` : ''}`;
        }
        const dirMail = ((window.LH_SCHOOLS || []).find((x) => x.id === sid) || {}).vm || ['the school’s email on file'];
        const bankPending = payee.changedAt && !payee.emailConfirmed, bankHolding = payee.emailConfirmed && payee.payableAfter && DEMO_DATE < payee.payableAfter;
        return `<div class="split"><div class="stack-m"><h2 class="h3">Where we send payments</h2><p class="body">To protect you from payment fraud, a new account must be confirmed from your school’s email on file with the Tennessee Department of Education (${esc(dirMail.join(' or '))}). We then wait ${E.BANK_CHANGE_HOLD_DAYS} days before paying it, and anyone we notified can cancel from their email until then. No phone calls.</p></div>
          <div class="paper stack-m" style="padding:22px"><div class="sumrow" style="padding-top:0"><span>${bankPending ? 'Requested account' : 'Current account'}</span><span class="tnum">Checking ••••${esc(payee.last4)}</span></div>
          <div class="sumrow"><span>Status</span>${bankPending ? pill('Waiting for the school to confirm by email', 'pill-warn') : bankHolding ? pill('Confirmed · payable ' + payee.payableAfter, 'pill-gilt') : pill('Verified', 'pill-ok')}</div>
          ${bankPending || bankHolding ? `<p class="hint">Prototype: ${bankPending ? `<button type="button" class="btn btn-ghost btn-sm" data-action="sch-bank-confirm">Confirm from the school’s inbox</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-action="sch-bank-cancel">Cancel from an emailed link</button></p>` : ''}
          <form class="stack-s" data-form="sch-bank"><div class="field"><label for="nb">New routing + account number</label><input class="input" id="nb" data-bind="p.newBank" placeholder="Routing · account" autocomplete="off"></div><div><button class="btn btn-secondary" type="submit">Request account change</button></div></form></div></div>`;
      });
  }

  /* ───────────── Donor portal ───────────── */
  function donor() {
    const mine = GIFTS.filter((g) => g.donorId.startsWith('ELLIS'));
    const people = [['ELLIS-M', 'Margaret'], ['ELLIS-T', 'Tom']];
    const credit = (id) => E.creditForYear(mine.filter((g) => g.donorId === id && !g.scheduled).map((g) => g.amount));
    const sched = (id) => mine.filter((g) => g.donorId === id && g.scheduled).reduce((s, g) => s + g.amount, 0);
    const ye = E.buildYearEnd(2027, '[XX-XXXXXXX]', DONORS.filter((d) => d.donorId.startsWith('ELLIS')), mine.filter((g) => !g.scheduled));
    return shell('Donor', { title: 'Margaret & Tom Ellis', sub: 'Married filing jointly · giving since January 2027' },
      [['overview', 'Overview'], ['gifts', 'Gifts'], ['tax', 'Tax documents'], ['settings', 'Settings']], (tab) => {
        if (tab === 'overview') return `
          <div class="cols-2">${people.map(([id, n]) => { const c = credit(id); const s = sched(id); return `<div class="card"><span class="card-kicker">${n}’s 2027 credit</span>
            <p class="tnum" style="font-family:var(--font-heading);font-size:40px;line-height:1">${money(c.credit)} <span class="small muted" style="font-family:var(--font-body)">of $1,700</span></p>${bar(c.credit + s, E.CREDIT_CAP)}
            <p class="small muted">${c.credit >= E.CREDIT_CAP ? 'Full credit reached. Gifts above this are regular deductible gifts.' : s ? `${money(s)} scheduled for Dec 1 brings ${n} to ${money(Math.min(c.credit + s, E.CREDIT_CAP))}.` : `${money(E.CREDIT_CAP - c.credit)} of credit left this year.`}</p></div>`; }).join('')}</div>
          <div class="split" style="margin-top:40px"><div class="stack-m"><h2 class="h3">Your gifts at work</h2><p class="body">Lionheart has awarded ${money(committed())} to ${Object.keys(AWARD).length} students at ${new Set(Object.keys(AWARD).map((id) => APPS.find((a) => a.id === id).school)).size} schools for 2027–28. No donor chooses students; awards follow a published formula.</p><div><a class="btn btn-primary" href="#give">Give again</a></div></div>
          ${checklist([[true, 'Account created', 'Jan 1, 2027'], [true, 'Spouse linked', 'Each of you has your own credit and acknowledgment'], [P.eDelivery, 'Electronic acknowledgments', P.eDelivery ? 'On' : 'Off: we’ll mail paper'], [false, '2027 acknowledgments', 'Arrive by Jan 31, 2028']])}</div>`;
        if (tab === 'gifts') return `<div class="tablewrap"><table class="table" style="min-width:640px"><thead><tr><th>Date</th><th>From</th><th>Method</th><th class="num">Amount</th><th>Designation</th><th>Status</th></tr></thead><tbody>
          ${mine.map((g) => `<tr><td>${g.date}</td><td>${g.donorId === 'ELLIS-M' ? 'Margaret' : 'Tom'}</td><td>${esc(g.method)}</td><td class="num">${money(g.amount)}</td><td>§25F qualified</td><td>${g.scheduled ? pill('Scheduled', 'pill-gilt') + ` <button type="button" class="btn btn-ghost btn-sm" data-action="don-cancel" data-id="${g.giftId}">Cancel</button>` : pill('Received', 'pill-ok')}</td></tr>`).join('')}
          </tbody></table></div>`;
        if (tab === 'tax') return `<div class="split"><div class="stack-m"><h2 class="h3">2027 acknowledgments</h2><p class="body">Each of you gets your own acknowledgment and donor number by January 31, 2028. You’ll enter the donor number on Form 8525 with your 2027 return.</p>
          <ol class="timeline"><li><span class="when">Jan 31</span><p class="body">Acknowledgments emailed and posted here.</p></li><li><span class="when">Feb 28</span><p class="body">We report the same totals to the IRS.</p></li><li><span class="when">Tax time</span><p class="body">Form 8525: one line per spouse with your donor numbers.</p></li></ol></div>
          <div class="stack-m">${ye.acks.map((a) => `<div class="paper letter" style="padding:22px 24px"><span class="specimen">Draft</span><p class="label">Acknowledgment preview · ${esc(a.legalName)}</p><dl style="margin-top:10px"><dt>Donor number</dt><dd>${esc(a.donorNumber)} <span class="hint">(provisional format)</span></dd><dt>2027 qualified total</dt><dd>${money(a.totalQualified)}</dd><dt>Goods or services</dt><dd>None</dd><dt>Delivery</dt><dd>${a.delivery}</dd></dl></div>`).join('')}</div></div>`;
        return `<form class="split" data-form="don-settings"><div class="stack-m"><h2 class="h3">Giving preferences</h2><p class="body">You may name a school you’d like your gifts to help. It isn’t binding: we honor it only when that school has at least ${E.DEFAULT_POLICY.schoolPreference.minEligibleApplicants} eligible applicants, and students are always chosen by formula, never by donors.</p></div>
          <div class="paper stack-m" style="padding:22px">
            <div class="field"><label for="pref">Preferred school (optional, non-binding)</label><select class="input" id="pref" data-bind="p.prefSchool"><option value="">No preference: use where most needed</option>${SCHOOLS.filter((s) => s.state === 'ACTIVE').map((s) => `<option value="${s.id}"${P.prefSchool === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
            <label class="tick"><input type="checkbox" id="edel" data-bind="p.eDelivery"${P.eDelivery ? ' checked' : ''}><span>Send our acknowledgments by email</span></label>
            <div><button class="btn btn-primary" type="submit">Save</button></div></div></form>`;
      });
  }

  /* ───────────── Board console ───────────── */
  function board() {
    const snap = snapshot();
    const crit = snap.findings.filter((f) => f.severity === 'critical').length;
    const reviews = APPS.filter((a) => ['NEEDS_REVIEW', 'INELIGIBLE_PROPOSED', 'HELD'].includes(a.state) && !P.reviews[a.id]);
    const batch = currentBatch();
    return shell('Board & operations', { title: 'Lionheart operations', sub: 'Ruth Alvarez · Treasurer · Signed in with passkey + second factor' },
      [['overview', 'Compliance', crit || ''], ['awards', 'Award rounds'], ['payments', 'School payments', P.batchState !== 'SENT' && batch.readyTotal ? '1' : ''], ['reviews', 'Reviews', reviews.length || ''], ['dq', 'Disqualified persons'], ['deadlines', 'Deadlines'], ['policy', 'Policy']], (tab) => {
        if (tab === 'overview') {
          const n = snap.ninety[0];
          return `<div class="kpis">${kpi('2027 qualified gifts', money(designatedTotal(DEMO_DATE)), `${GIFTS.filter((g) => !g.scheduled).length} gifts · ${DONORS.length} donors`)}${kpi('Awarded 2027–28', money(committed()), `${Object.keys(AWARD).length} students · ${new Set(Object.keys(AWARD).map((id) => APPS.find((a) => a.id === id).school)).size} schools`)}${kpi('Paid to schools', money(paidTotal()), P.sent.length ? 'Fall batch sent' : 'Fall batch Aug 20')}${kpi('§25F account', money(segBalance()), 'Bank = ledger')}${kpi('90% test (2027)', (n.pct * 100).toFixed(0) + '%', 'incl. scheduled · due ' + n.deadline)}</div>
          <div class="split" style="margin-top:40px"><div><h2 class="h3">Findings</h2><p class="body" style="margin-top:8px">The compliance monitor runs every hour and before any money moves. Critical findings pause the flows they name.</p></div>
          <div class="findings">${snap.findings.sort((a, b) => ['critical', 'warn', 'info'].indexOf(a.severity) - ['critical', 'warn', 'info'].indexOf(b.severity)).map((f) => `<div class="finding"><span class="pill ${sev[f.severity]}">${f.severity}</span><div><p class="small" style="font-weight:600">${esc(f.area)}</p><p class="small">${esc(f.message)}</p>${f.blocks ? `<p class="hint">Pauses: ${f.blocks.join(', ')}</p>` : ''}</div></div>`).join('')}</div></div>
          <div class="split" style="margin-top:40px"><div><h2 class="h3">Automated activity</h2><p class="body" style="margin-top:8px">Every agent and job action is logged with its inputs and model version for the auditors.</p></div>
          <ol class="log">${[['06:00', 'Reconciliation job', '41 settlements matched to bank and ledger; 1 payout in transit.'], ['06:05', 'Compliance monitor', `${crit} critical, ${snap.findings.filter((f) => f.severity === 'warn').length} warnings.`], ['07:30', 'School-confirmation bot', 'Reminded Nashville Christian School: 3 students unconfirmed, window closes Aug 16.'], ['08:12', 'Document agent', 'Read W-2 for A-1024 (confidence 0.97). Parent confirmed values.'], ['09:40', 'Fraud check', 'No duplicate bank accounts or reused documents across 32 applications.'], ['10:02', 'Support agent', 'Answered 6 family questions; 1 handed to staff (custody question).']].map(([t, who, what]) => `<li><span class="tnum muted">${t}</span><span><strong style="font-weight:600">${who}</strong> · ${what}</span></li>`).join('')}</ol></div>`;
        }
        if (tab === 'awards') {
          const r1 = P.round1;
          const r2cands = APPS.filter((a) => (a.round === 2 && a.det.result === 'ELIGIBLE') || (a.round === 1 && a.state === 'WAITLISTED')).map(toCand);
          const r2 = P.round2;
          const linesTable = (res) => `<div class="tablewrap"><table class="table" style="min-width:860px"><thead><tr><th class="num">#</th><th>Applicant</th><th>School</th><th>Priority</th><th class="num">% of median</th><th class="num">Lottery</th><th class="num">Unmet need</th><th class="num">Award</th><th>Funded from</th><th>Outcome</th></tr></thead><tbody>
            ${res.lines.map((l) => { const a = APPS.find((x) => x.id === l.applicationId); return `<tr><td class="num">${l.rank}</td><td>${esc(a.child)} ${esc(a.family.charAt(0))}. <span class="small muted tnum">${l.applicationId}</span></td><td>${esc(schoolName(l.schoolId).replace(/ (Christian )?(School|Academy)$/, ''))}</td><td>${['', 'Renewal', 'Sibling', 'New'][l.priority]}</td><td class="num">${Math.round(l.needIndex * 100)}%</td><td class="num small muted">${String(l.lottery).slice(0, 6)}</td><td class="num">${money(l.unmet)}</td><td class="num">${l.amount ? money(l.amount) : '—'}${l.partial ? `<br><span class="hint">of ${money(l.fullAmount)}</span>` : ''}</td><td class="small">${l.fundedFrom.map((f) => f.pool === 'general' ? 'General' : 'Pref: ' + esc(schoolName(f.pool).split(' ')[0])).join(' + ') || '—'}</td><td>${statePill(l.outcome === 'AWARDED' ? 'AWARDED' : l.outcome)}${l.note && l.outcome !== 'AWARDED' ? `<br><span class="hint">${esc(l.note)}</span>` : ''}</td></tr>`; }).join('')}
            </tbody></table></div>`;
          const sumLine = (res) => `<div class="kpis" style="margin:16px 0 20px">${kpi('Awarded', money(res.totals.awarded), `${res.totals.students} students · ${res.totals.schools} schools`)}${kpi('Waitlisted', res.totals.waitlisted, res.totals.partial ? `${res.totals.partial} partial · ${money(res.totals.shortfall)} to fund all` : 'Offered as gifts arrive')}${kpi('Held for review', res.totals.held, 'DQ or fraud flags')}${kpi('Cash left', money(res.totals.cashRemaining), 'Rolls to next round')}</div>
            ${res.honoredPreferences.length || res.mergedPreferences.length ? `<p class="small muted">School preferences honored: ${res.honoredPreferences.map((s) => esc(schoolName(s))).join(', ') || 'none'}. Returned to general pool (fewer than ${E.DEFAULT_POLICY.schoolPreference.minEligibleApplicants} eligible applicants): ${res.mergedPreferences.map((s) => esc(schoolName(s))).join(', ') || 'none'}.</p>` : ''}`;
          return `<div class="stack-l">
            <section class="panel" style="box-shadow:none;border:1px solid var(--color-divider)">
              <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:end"><div><span class="card-kicker">Round 2 · August 2027</span><h2 class="h3" style="margin-top:6px">${r2 ? (P.round2Approved ? 'Approved' : 'Review and approve') : 'Ready to run'}</h2>
              <p class="small muted" style="margin-top:6px">${r2cands.length} candidates (waitlist + new). Uncommitted cash ${money(uncommitted())}. Policy ${E.DEFAULT_POLICY.version}.</p></div>
              ${r2 ? '' : `<form class="btn-row" data-form="run-r2"><div class="field"><label for="seed">Published lottery seed</label><input class="input" id="seed" data-bind="p.round2Seed" value="${esc(P.round2Seed)}" style="min-width:220px"></div><button class="btn btn-solid" type="submit" style="align-self:end">Run Round 2</button></form>`}</div>
              ${r2 ? sumLine(r2) + linesTable(r2) + (P.round2Approved ? '' : `<div class="btn-row" style="margin-top:20px"><button class="btn btn-solid" type="button" data-action="r2-approve">Approve Round 2 (board)</button><button class="btn btn-ghost" type="button" data-action="r2-discard">Discard and re-run</button></div>`) : ''}
            </section>
            <section><span class="card-kicker">Round 1 · April 15, 2027 · approved</span><h2 class="h3" style="margin:6px 0 4px">Seed ${esc(r1.seed)}</h2>${sumLine(r1)}${linesTable(r1)}</section></div>`;
        }
        if (tab === 'payments') {
          const sent = P.batchState === 'SENT';
          const rel = E.canRelease(P.approvals, 'job:disbursement-preparer');
          return `<div class="stack-l">
            <section>
              <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:end"><div><span class="card-kicker">Fall 2027 · ACH on Aug 20</span><h2 class="h3" style="margin-top:6px">Batch 2027-FALL-1 · ${sent ? 'sent' : esc(P.batchState.toLowerCase().replace('_', ' '))}</h2>
              <p class="small muted" style="margin-top:6px">Prepared by the disbursement job. Two different people must approve: ops lead, then a board officer.</p></div>
              ${sent ? '' : `<div class="btn-row"><button class="btn btn-secondary" type="button" data-action="appr" data-who="ann" ${P.approvals.some((a) => a.userId === 'ann') || !batch.readyTotal ? 'disabled' : ''}>Approve as Ann (ops lead)</button><button class="btn btn-secondary" type="button" data-action="appr" data-who="ruth" ${P.approvals.some((a) => a.userId === 'ruth') || !batch.readyTotal ? 'disabled' : ''}>Approve as Ruth (treasurer)</button><button class="btn btn-solid" type="button" data-action="send" ${rel.ok ? '' : 'disabled'}>Send ${money(batch.readyTotal)}</button></div>`}</div>
              ${sent ? '' : `<div class="kpis" style="margin:18px 0">${kpi('Ready', money(batch.readyTotal), `${batch.lines.filter((l) => l.status === 'READY').length} students`)}${kpi('Blocked', batch.lines.filter((l) => l.status === 'BLOCKED').length, 'Paid in a later batch once cleared')}${kpi('Approvals', `${P.approvals.length} of 2`, rel.ok ? 'Ready to send' : esc(rel.reason || ''))}</div>
              <div class="tablewrap"><table class="table" style="min-width:720px"><thead><tr><th>Student</th><th>School</th><th class="num">Amount</th><th>Status</th><th>Why blocked</th></tr></thead><tbody>
              ${batch.lines.sort((a, b) => (a.status > b.status ? -1 : 1)).map((l) => { const a = APPS.find((x) => x.id === l.awardId); return `<tr><td>${esc(a.child)} ${esc(a.family)}</td><td>${esc(schoolName(l.schoolId))}</td><td class="num">${money(l.amount)}</td><td>${pill(l.status === 'READY' ? 'Ready' : 'Blocked', l.status === 'READY' ? 'pill-ok' : 'pill-warn')}</td><td class="small">${esc(l.blockers.join('; '))}</td></tr>`; }).join('')}
              </tbody></table></div>`}
            </section>
            ${P.sent.length ? `<section><h3 class="h4">Sent</h3><div class="tablewrap"><table class="table"><thead><tr><th>Batch</th><th>Date</th><th>Schools</th><th class="num">Total</th></tr></thead><tbody>${P.sent.map((b) => `<tr><td class="tnum">${b.id}</td><td>${b.date}</td><td>${Object.keys(b.bySchool).map((s) => esc(schoolName(s))).join(', ')}</td><td class="num">${money(b.total)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
          </div>`;
        }
        if (tab === 'reviews') {
          const agentNote = (a) => a.state === 'HELD' ? 'DQ screener: address matches a director’s relative. Award held; the board chair decides.' :
            a.state === 'INELIGIBLE_PROPOSED' ? `Eligibility engine: ${a.det.reasons[0]} Recommend: deny, citing residency rule; family may appeal.` :
            `Document agent: ${a.det.reviewFlags.join(' ')} Recommend: request the grandparent’s SSA-1099 or a zero-income attestation.`;
          return reviews.length ? `<div class="stack-m">${reviews.map((a) => `<article class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><span class="card-kicker">${a.id} · ${esc(schoolName(a.school))}</span><h3 class="h4" style="margin-top:4px">${esc(a.parent)} household · ${esc(a.child)}, grade ${a.grade}</h3></div>${statePill(a.state)}</div>
            <p class="small" style="background:var(--color-accent-100);padding:10px 12px;border-radius:4px"><strong style="font-weight:600">AI recommendation.</strong> ${esc(agentNote(a))}</p>
            <div class="btn-row">${a.state === 'HELD' ? `<button class="btn btn-secondary btn-sm" data-action="rev" data-id="${a.id}" data-to="QUEUED">Clear hold (not related)</button><button class="btn btn-secondary btn-sm" data-action="rev" data-id="${a.id}" data-to="DENIED">Deny: disqualified person</button>`
              : a.state === 'INELIGIBLE_PROPOSED' ? `<button class="btn btn-secondary btn-sm" data-action="rev" data-id="${a.id}" data-to="DENIED">Confirm denial</button><button class="btn btn-ghost btn-sm" data-action="rev" data-id="${a.id}" data-to="ELIGIBLE">Override: eligible</button>`
              : `<button class="btn btn-secondary btn-sm" data-action="rev" data-id="${a.id}" data-to="DOCS_PENDING">Request documents</button><button class="btn btn-ghost btn-sm" data-action="rev" data-id="${a.id}" data-to="ELIGIBLE">Approve as eligible</button>`}</div>
            <p class="hint">Only a person can make this decision. The agent can’t deny, approve exceptions, or move money.</p></article>`).join('')}</div>`
            : `<p class="body">Nothing waiting. Every decision is logged under Policy → Audit trail.</p>`;
        }
        if (tab === 'dq') return `<div class="split"><div class="stack-m"><h2 class="h3">Disqualified-person registry</h2><p class="body">Officers, directors, anyone who helps select recipients, and substantial contributors (over $5,000 and over 2% of the year’s §25F gifts), plus their families. Every applicant is screened before each award and each payment.</p></div>
          <div class="stack-m"><div class="tablewrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Year</th></tr></thead><tbody>${DQ_REGISTRY.map((d) => `<tr><td>${esc(d.fullName)}</td><td>${esc(d.role.replace('_', ' '))}</td><td>${d.year}</td></tr>`).join('')}
            ${E.substantialContributors(Object.values(GIFTS.reduce((m, g) => { const k = g.donorId.replace(/[ab]$/, ''); m[k] = m[k] || { householdKey: k, personIds: [], amount: 0 }; m[k].amount += g.scheduled ? 0 : g.amount; return m; }, {}))).map((k) => `<tr><td>${esc(k)}</td><td>substantial contributor</td><td>2027–28</td></tr>`).join('') || `<tr><td colspan="3" class="small muted">No substantial contributors in 2027 (none over $5,000 and 2%).</td></tr>`}</tbody></table></div>
          <h3 class="h4">Screening matches</h3><div class="tablewrap"><table class="table"><tbody>${DQ_MATCHES.map((m) => `<tr><td class="tnum">${m.screeneeId}</td><td>${esc(m.against)}</td><td>${esc(m.reason)}</td><td>${pill(m.strength, m.strength === 'possible' ? 'pill-neutral' : 'pill-warn')}</td></tr>`).join('') || '<tr><td>No matches.</td></tr>'}</tbody></table></div></div></div>`;
        if (tab === 'deadlines') return `<div class="tablewrap"><table class="table"><thead><tr><th>Due</th><th>What</th><th>Owner</th><th>Status</th></tr></thead><tbody>${snap.deadlines.map((d) => `<tr><td class="tnum">${d.due}</td><td>${esc(d.label)}</td><td class="small">${esc(d.owner)}</td><td>${d.done ? pill('Done', 'pill-ok') : d.due < DEMO_DATE ? pill('Overdue', 'pill-bad') : pill('Upcoming', 'pill-neutral')}</td></tr>`).join('')}</tbody></table></div>`;
        const pol = E.DEFAULT_POLICY;
        return `<div class="split"><div class="stack-m"><h2 class="h3">Award policy ${esc(pol.version)}</h2><p class="body">Adopted by the board on March 10, 2027. The award engine can only use board-approved parameters; any change creates a new version.</p></div>
          <div class="stack-m"><div class="tablewrap"><table class="table"><thead><tr><th>Household income</th><th class="num">Share of unmet need</th><th class="num">Cap per student</th></tr></thead><tbody>
          ${pol.schedule.map((p) => `<tr><td>${p.needIndex === 0 ? 'Lowest (SNAP/TANF/WIC/Section 8/SSI, foster)' : Math.round(p.needIndex * 100) + '% of area median'}</td><td class="num">${Math.round(p.pctOfUnmet * 100)}%</td><td class="num">${money(p.cap)}</td></tr>`).join('')}</tbody></table></div>
          <p class="small">Share and cap slide smoothly between these points. Order: renewals, then siblings of recipients, then lowest income first (in bands of ${Math.round(pol.rankBandWidth * 100)}% of median), ties by published-seed lottery. ${pol.funding.mode === 'floor_then_topup' ? `Every ranked student gets up to ${money(pol.funding.floor)} before anyone is topped up; top-ups then go lowest income first.` : 'Full awards in strict rank order.'} Unmet need = tuition + required fees − EFS − school aid − other SGO awards. Awards only from cash on hand. Minimum award ${money(pol.minimumAward)}. Paid in ${pol.terms.length} terms.</p></div></div>`;
      });
  }

  /* ───────────── Events ───────────── */
  function onClick(a, b, e) {
    if (a === 'as') { P.role = b.dataset.role; location.hash = { family: 'family-portal', school: 'school-portal', donor: 'donor-portal', board: 'board' }[P.role]; return true; }
    if (a === 'passkey') { toast('Prototype: passkeys need the production app.'); return true; }
    if (a === 'ptab') { P.tab[b.dataset.role] = b.dataset.tab; rerender(); return true; }
    if (a === 'sch-bank-confirm') { const d = new Date(DEMO_DATE + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + E.BANK_CHANGE_HOLD_DAYS); Object.assign(P.payees.ncs, { emailConfirmed: true, payableAfter: d.toISOString().slice(0, 10) }); toast('Confirmed from the school’s inbox. Payable after the cancel window.'); rerender(); return true; }
    if (a === 'sch-bank-cancel') { if (P.prevPayee) P.payees.ncs = P.prevPayee; P.prevPayee = null; toast('Change cancelled. Payments stay with the previous account.'); rerender(); return true; }
    if (a === 'fam-accept' || a === 'fam-decline') {
      const app = APPS.find((x) => x.id === b.dataset.id);
      app.state = E.applicationMachine.transition(app.state, a === 'fam-accept' ? 'ACCEPTED' : 'DECLINED', { kind: 'person', id: 'dana', role: 'family' });
      if (a === 'fam-decline') delete AWARD[app.id];
      toast(a === 'fam-accept' ? 'Award accepted. Your school will confirm enrollment.' : 'Award declined.'); rerender(); return true;
    }
    if (a === 'don-cancel') { const i = GIFTS.findIndex((g) => g.giftId === b.dataset.id); if (i > -1) GIFTS.splice(i, 1); toast('Scheduled gift cancelled.'); rerender(); return true; }
    if (a === 'r2-approve') { applyRound(P.round2, 2); P.round2Approved = true; toast('Round 2 approved. Award offers emailed to families.'); rerender(); return true; }
    if (a === 'r2-discard') { P.round2 = null; rerender(); return true; }
    if (a === 'appr') {
      if (P.batchState === 'DRAFT') P.batchState = 'PREPARED';
      const who = b.dataset.who; const role = who === 'ruth' ? 'board' : 'staff';
      const to = P.approvals.length === 0 ? 'APPROVED_1' : 'APPROVED_2';
      const r = E.batchMachine.can(P.batchState, to, { kind: 'person', id: who, role });
      if (!r.ok) { toast(to === 'APPROVED_2' ? 'The second approval must come from a board officer.' : r.reason); return true; }
      P.batchState = to; P.approvals.push({ userId: who, at: DEMO_DATE }); rerender(); return true;
    }
    if (a === 'send') {
      const batch = currentBatch();
      const ready = batch.lines.filter((l) => l.status === 'READY');
      P.sent.push({ id: batch.batchId, date: '2027-08-20', total: batch.readyTotal, bySchool: batch.bySchool, awardIds: ready.map((l) => l.awardId), lines: ready });
      P.batchState = 'SENT';
      ready.forEach((l) => { const app = APPS.find((x) => x.id === l.awardId); if (app.state === 'SCHOOL_CONFIRMED') app.state = 'ACTIVE'; });
      toast(`ACH batch sent: ${money(batch.readyTotal)} to ${Object.keys(batch.bySchool).length} schools.`); rerender(); return true;
    }
    if (a === 'rev') {
      const app = APPS.find((x) => x.id === b.dataset.id);
      const to = b.dataset.to;
      try {
        const from = app.state === 'HELD' && to === 'QUEUED' ? 'HELD' : app.state;
        app.state = E.applicationMachine.transition(from, to, { kind: 'person', id: 'ruth', role: 'board' });
        if (app.state === 'ELIGIBLE') app.state = E.applicationMachine.transition('ELIGIBLE', 'QUEUED', { kind: 'job', id: 'queue' });
        if (to === 'QUEUED') app.hold = '';
        P.reviews[app.id] = to;
        toast(`${app.id}: ${stateLabel(app.state)}. Logged with your name.`);
      } catch (err) { toast(err.message); }
      rerender(); return true;
    }
    return false;
  }
  function onSubmit(f, e) {
    if (f === 'signin') { toast('Prototype: sign-in links aren’t sent. Pick a demo account.'); return true; }
    if (f === 'fam-residency') {
      if (!e.target.querySelector('#fam-res').checked) { toast('Tick the box to confirm.'); return true; }
      APPS.filter((a) => a.householdId === 'H-ROE').forEach((a) => { a.residencyReattested = true; });
      toast('Thanks. Residency confirmed for fall.'); rerender(); return true;
    }
    if (f === 'sch-roster') {
      let n = 0;
      e.target.querySelectorAll('input[type=radio]:checked').forEach((r) => {
        const id = r.name.slice(3); const app = APPS.find((x) => x.id === id);
        P.confirmations[id] = { enrolled: r.value === 'yes', at: DEMO_DATE }; n++;
        if (r.value === 'yes' && app.state === 'ACCEPTED') app.state = 'SCHOOL_CONFIRMED';
      });
      toast(n ? `${n} confirmation${n > 1 ? 's' : ''} submitted.` : 'Choose Yes or No for each student.'); rerender(); return true;
    }
    if (f === 'sch-wd') {
      const id = P.wd.award || (APPS.find((a) => AWARD[a.id] && a.school === 'ncs' && a.state !== 'WITHDRAWN') || {}).id; if (!id) return true;
      const app = APPS.find((x) => x.id === id);
      const paid = P.sent.some((b) => b.awardIds.includes(id)) ? AWARD[id].terms[0].amount : 0;
      P.withdrawals.push({ id, name: `${app.child} ${app.family}`, days: Number(P.wd.days) || 0, refund: paid ? E.refundDue(paid, Number(P.wd.days) || 0, 90) : 0 });
      app.state = 'WITHDRAWN'; P.wd.award = '';
      toast('Withdrawal reported. We’ve stopped future payments for this student.'); rerender(); return true;
    }
    if (f === 'sch-bank') {
      if (!P.newBank.trim()) { toast('Enter the new account details.'); return true; }
      P.prevPayee = Object.assign({}, P.payees.ncs);
      Object.assign(P.payees.ncs, { changedAt: DEMO_DATE, emailConfirmed: false, payableAfter: undefined, last4: P.newBank.replace(/\D/g, '').slice(-4) || '0000' }); P.newBank = '';
      toast('Change requested. We’ve emailed your school’s address on file with the state to confirm it.'); rerender(); return true;
    }
    if (f === 'don-settings') { toast('Preferences saved.'); return true; }
    if (f === 'run-r2') {
      const cands = APPS.filter((a) => (a.round === 2 && a.det.result === 'ELIGIBLE' && a.state === 'QUEUED') || (a.round === 1 && (a.state === 'WAITLISTED' || (a.state === 'QUEUED' && P.reviews[a.id])))).map(toCand);
      P.round2 = E.allocateRound({ roundId: '2027-R2', seed: P.round2Seed || 'seed', cashAvailable: uncommitted(), candidates: cands });
      rerender(); return true;
    }
    return false;
  }
  function onLive(kind) {
    if (kind !== 'wd') return;
    const out = document.getElementById('wd-out'); if (!out) return;
    const id = P.wd.award || (APPS.find((a) => AWARD[a.id] && a.school === 'ncs' && a.state !== 'WITHDRAWN') || {}).id;
    const paid = id && P.sent.some((b) => b.awardIds.includes(id)) ? AWARD[id].terms[0].amount : 0;
    out.innerHTML = `<span>Refund due to Lionheart</span><span class="v">${paid ? money(E.refundDue(paid, Number(P.wd.days) || 0, 90)) : '$0'}</span>`;
  }

  return {
    routes: { signin, 'family-portal': family, 'school-portal': school, 'donor-portal': donor, board },
    onClick, onSubmit, onLive, navFor: (name) => (['signin', 'family-portal', 'school-portal', 'donor-portal', 'board'].includes(name) ? 'signin' : null),
  };
};
