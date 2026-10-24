"use strict";
var LionheartEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/index.ts
  var index_exports = {};
  __export(index_exports, {
    BANK_CHANGE_HOLD_DAYS: () => BANK_CHANGE_HOLD_DAYS,
    CASH_METHODS: () => CASH_METHODS,
    CATEGORICAL_PROGRAMS: () => CATEGORICAL_PROGRAMS,
    CREDIT_CAP: () => CREDIT_CAP,
    CREDIT_START: () => CREDIT_START,
    DEFAULT_POLICY: () => DEFAULT_POLICY,
    DRAND_QUICKNET: () => DRAND_QUICKNET,
    FAMILY_RELATIONS: () => FAMILY_RELATIONS,
    FORM_4506C_VALID_DAYS: () => FORM_4506C_VALID_DAYS,
    HUD_SIZE_MULTIPLIER: () => HUD_SIZE_MULTIPLIER,
    SUBSTANTIAL_SHARE: () => SUBSTANTIAL_SHARE,
    SUBSTANTIAL_THRESHOLD: () => SUBSTANTIAL_THRESHOLD,
    TN_LIMITS_SEED: () => TN_LIMITS_SEED,
    allocateRound: () => allocateRound,
    applicationMachine: () => applicationMachine,
    assertBalanced: () => assertBalanced,
    assertCents: () => assertCents,
    awardAmount: () => awardAmount,
    balance: () => balance,
    batchMachine: () => batchMachine,
    batchSafety: () => batchSafety,
    beaconRoundAt: () => beaconRoundAt,
    beaconTimeOf: () => beaconTimeOf,
    beaconUrl: () => beaconUrl,
    blocked: () => blocked,
    buildBatch: () => buildBatch,
    buildYearEnd: () => buildYearEnd,
    canRelease: () => canRelease,
    capFor: () => capFor,
    consentValid: () => consentValid,
    coverageFor: () => coverageFor,
    creditForYear: () => creditForYear,
    deadlinesFor: () => deadlinesFor,
    determineEligibility: () => determineEligibility,
    dollars: () => dollars,
    evaluate: () => evaluate,
    explainAward: () => explainAward,
    feeAndTopupJournal: () => feeAndTopupJournal,
    fmtUSD: () => fmtUSD,
    giftJournal: () => giftJournal,
    giftMachine: () => giftMachine,
    hash32: () => hash32,
    lotteryNumber: () => lotteryNumber,
    mergeTranscripts: () => mergeTranscripts,
    needBand: () => needBand,
    needIndexOf: () => needIndexOf,
    netRefunds: () => netRefunds,
    nextTranscriptRetry: () => nextTranscriptRetry,
    ninetyPercentTest: () => ninetyPercentTest,
    normAddr: () => normAddr,
    normName: () => normName,
    normalizeCounty: () => normalizeCounty,
    normalizePolicy: () => normalizePolicy,
    provisionalDonorNumber: () => provisionalDonorNumber,
    rankCandidates: () => rankCandidates,
    reconcile: () => reconcile,
    refundDue: () => refundDue,
    refundJournal: () => refundJournal,
    resolveLimit: () => resolveLimit,
    roundDollar: () => roundDollar,
    roundPlan: () => roundPlan,
    routeGift: () => routeGift,
    scholarshipJournal: () => scholarshipJournal,
    schoolMachine: () => schoolMachine,
    screen: () => screen,
    seedFromBeacon: () => seedFromBeacon,
    sizeMultiplier: () => sizeMultiplier,
    splitCouple: () => splitCouple,
    splitTerms: () => splitTerms,
    substantialContributors: () => substantialContributors,
    sum: () => sum,
    tieOut: () => tieOut,
    tierFor: () => tierFor,
    tierLabel: () => tierLabel,
    toDollars: () => toDollars,
    transcriptToIncomeItems: () => transcriptToIncomeItems,
    unmetNeed: () => unmetNeed
  });

  // src/domain/money.ts
  var dollars = (d) => Math.round(d * 100);
  var toDollars = (c) => c / 100;
  function assertCents(c, label = "amount") {
    if (!Number.isInteger(c)) throw new Error(`${label} must be integer cents, got ${c}`);
  }
  function fmtUSD(c, opts = {}) {
    var _a;
    const showCents = (_a = opts.cents) != null ? _a : c % 100 !== 0;
    return (c < 0 ? "\u2212" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    });
  }
  var roundDollar = (c) => Math.round(c / 100) * 100;
  var sum = (xs) => xs.reduce((a, b) => a + b, 0);

  // src/domain/limits.ts
  var HUD_SIZE_MULTIPLIER = {
    1: 0.7,
    2: 0.8,
    3: 0.9,
    4: 1,
    5: 1.08,
    6: 1.16,
    7: 1.24,
    8: 1.32
  };
  function sizeMultiplier(householdSize) {
    if (!Number.isInteger(householdSize) || householdSize < 1) throw new Error(`invalid household size ${householdSize}`);
    if (householdSize <= 8) return HUD_SIZE_MULTIPLIER[householdSize];
    return 1.32 + 0.08 * (householdSize - 8);
  }
  var TN_LIMITS_SEED = {
    version: "HUD-FY2026-seed",
    areas: {
      METRO34980M34980: {
        code: "METRO34980M34980",
        name: "Nashville-Davidson\u2013Murfreesboro\u2013Franklin, TN HUD Metro FMR Area",
        medianIncome: dollars(116100),
        fiscalYear: 2026,
        source: "HUD FY2026 Income Limits (huduser.gov)"
      },
      TN_STATEWIDE: {
        code: "TN_STATEWIDE",
        name: "Tennessee statewide (screening reference only)",
        medianIncome: dollars(92300),
        fiscalYear: 2025,
        source: "THDA 2025 statewide median family income"
      }
    },
    countyToArea: Object.fromEntries(
      ["cannon", "cheatham", "davidson", "dickson", "hickman", "macon", "robertson", "rutherford", "smith", "sumner", "trousdale", "williamson", "wilson"].map((c) => [c, "METRO34980M34980"])
    ),
    fallbackAreaCode: "TN_STATEWIDE"
  };
  function normalizeCounty(county) {
    return county.trim().toLowerCase().replace(/\s+county$/, "").replace(/[^a-z\s]/g, "").trim();
  }
  function resolveLimit(table, county, householdSize) {
    const code = table.countyToArea[normalizeCounty(county)];
    const isFallback = !code;
    const area = table.areas[code != null ? code : table.fallbackAreaCode];
    if (!area) throw new Error(`limits table ${table.version} has no area for county "${county}"`);
    const multiplier = sizeMultiplier(householdSize);
    const amgiAdjusted = Math.round(area.medianIncome * multiplier);
    return { area, multiplier, amgiAdjusted, limit: amgiAdjusted * 3, isFallback, limitsVersion: table.version };
  }

  // src/domain/eligibility.ts
  var CATEGORICAL_PROGRAMS = ["SNAP", "TANF", "WIC", "SECTION8", "SSI"];
  var GRADES = /* @__PURE__ */ new Set(["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  function monthsBetween(aISO, bISO) {
    const a = /* @__PURE__ */ new Date(aISO + "T00:00:00Z");
    const b = /* @__PURE__ */ new Date(bISO + "T00:00:00Z");
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
  }
  function tierFor(pctAmgi, categoricalOrFoster) {
    if (categoricalOrFoster || pctAmgi <= 1) return "A";
    if (pctAmgi <= 2) return "B";
    return "C";
  }
  function determineEligibility(input, table) {
    const reasons = [];
    const reviewFlags = [];
    const householdSize = input.household.length;
    const limit = resolveLimit(table, input.county, Math.max(householdSize, 1));
    const base = { householdSize, limit, limitsVersion: table.version };
    const measurementYear = Number(input.applicationDate.slice(0, 4)) - 1;
    if (input.state.toUpperCase() !== "TN" && !input.residencyException) {
      return {
        ...base,
        result: "INELIGIBLE_PROPOSED",
        method: null,
        incomeTotal: null,
        pctAmgi: null,
        tier: null,
        reasons: ["Student does not reside in Tennessee."],
        reviewFlags: ["Human must confirm before denial."]
      };
    }
    if (input.residencyException) reviewFlags.push(`Residency exception claimed: ${input.residencyException}.`);
    if (!input.residencyProof) reviewFlags.push("No proof of Tennessee address on file.");
    if (!GRADES.has(input.student.grade)) {
      return {
        ...base,
        result: "INELIGIBLE_PROPOSED",
        method: null,
        incomeTotal: null,
        pctAmgi: null,
        tier: null,
        reasons: [`Grade "${input.student.grade}" is outside K\u201312.`],
        reviewFlags: ["Human must confirm before denial."]
      };
    }
    if (input.student.age < 4 || input.student.age > 21) reviewFlags.push(`Student age ${input.student.age} is unusual for grade ${input.student.grade}.`);
    if (householdSize < 1) reviewFlags.push("Household roster is empty.");
    if (limit.isFallback) reviewFlags.push(`County "${input.county}" not in limits table ${table.version}; used statewide reference.`);
    if (input.categorical) {
      const prog = String(input.categorical.program).toUpperCase();
      const months = monthsBetween(input.categorical.letterDate, input.applicationDate);
      if (CATEGORICAL_PROGRAMS.includes(prog) && months >= 0 && months < 12 && input.categorical.nameMatchesHousehold) {
        reasons.push(`Household receives ${prog}; letter dated ${input.categorical.letterDate} (within 12 months).`);
        return { ...base, result: reviewFlags.length ? "NEEDS_REVIEW" : "ELIGIBLE", method: "categorical", incomeTotal: null, pctAmgi: null, tier: "A", reasons, reviewFlags };
      }
      if (!CATEGORICAL_PROGRAMS.includes(prog)) reasons.push(`${prog} is not on Treasury's categorical list (SNAP, TANF, WIC, Section 8, SSI); checking income instead.`);
      else if (!(months >= 0 && months < 12)) reasons.push(`${prog} letter is older than 12 months; checking income instead.`);
      else reviewFlags.push("Benefit letter name does not match the household roster.");
    }
    if (input.fosterPlacement) {
      reasons.push("Student is in foster care placement.");
      return { ...base, result: reviewFlags.length ? "NEEDS_REVIEW" : "ELIGIBLE", method: "foster", incomeTotal: null, pctAmgi: null, tier: "A", reasons, reviewFlags };
    }
    const wrongYear = input.incomeItems.filter((i) => i.year !== measurementYear);
    if (wrongYear.length) reviewFlags.push(`${wrongYear.length} income item(s) are not for ${measurementYear}.`);
    const nonCash = input.incomeItems.filter((i) => !i.cash);
    if (nonCash.length) reasons.push(`${nonCash.length} non-cash item(s) excluded under Section 8 rules.`);
    const adults = input.household.filter((m) => m.age >= 18).map((m) => m.personId);
    const covered = /* @__PURE__ */ new Set([...input.incomeItems.map((i) => i.personId), ...input.zeroIncomeAttested]);
    const missing = adults.filter((p) => !covered.has(p));
    if (missing.length) reviewFlags.push(`${missing.length} adult(s) in the household have no income documents or zero-income attestation.`);
    const attestedOnly = input.incomeItems.filter((i) => i.source === "attestation");
    if (attestedOnly.length) reviewFlags.push(`${attestedOnly.length} income item(s) rest on attestation only.`);
    const incomeTotal = sum(input.incomeItems.filter((i) => i.cash && i.year === measurementYear).map((i) => i.amount));
    const pctAmgi = incomeTotal / limit.amgiAdjusted;
    reasons.push(`${measurementYear} household income ${(incomeTotal / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} is ${(pctAmgi * 100).toFixed(0)}% of area median for ${householdSize} (limit 300%).`);
    if (incomeTotal > limit.limit) {
      if (limit.isFallback) {
        reviewFlags.push("Over the statewide reference, but county limit unknown. Do not deny until the county figure is loaded.");
        return { ...base, result: "NEEDS_REVIEW", method: "direct_income", incomeTotal, pctAmgi, tier: null, reasons, reviewFlags };
      }
      return {
        ...base,
        result: "INELIGIBLE_PROPOSED",
        method: "direct_income",
        incomeTotal,
        pctAmgi,
        tier: null,
        reasons: [...reasons, "Income is above 300% of area median."],
        reviewFlags: [...reviewFlags, "Human must confirm before denial."]
      };
    }
    return { ...base, result: reviewFlags.length ? "NEEDS_REVIEW" : "ELIGIBLE", method: "direct_income", incomeTotal, pctAmgi, tier: tierFor(pctAmgi, false), reasons, reviewFlags };
  }

  // src/domain/awards.ts
  var DEFAULT_POLICY = {
    version: "2027-28-v2",
    schedule: [
      { needIndex: 0, pctOfUnmet: 0.95, cap: 9e5 },
      { needIndex: 1, pctOfUnmet: 0.85, cap: 8e5 },
      { needIndex: 2, pctOfUnmet: 0.55, cap: 5e5 },
      { needIndex: 3, pctOfUnmet: 0.25, cap: 25e4 }
    ],
    categoricalNeedIndex: 0,
    rankBandWidth: 0.05,
    funding: { mode: "floor_then_topup", floor: 1e5, allowPartial: true },
    householdCap: null,
    minimumAward: 5e4,
    terms: [{ id: "fall", share: 0.5 }, { id: "spring", share: 0.5 }],
    strictOrder: true,
    schoolPreference: { enabled: true, minEligibleApplicants: 10 }
  };
  function normalizePolicy(params, version) {
    var _a, _b;
    const p = {
      ...DEFAULT_POLICY,
      ...params,
      funding: { ...DEFAULT_POLICY.funding, ...(_a = params.funding) != null ? _a : {} },
      schoolPreference: { ...DEFAULT_POLICY.schoolPreference, ...(_b = params.schoolPreference) != null ? _b : {} }
    };
    if (!Array.isArray(p.schedule) || !p.schedule.length) p.schedule = DEFAULT_POLICY.schedule;
    p.schedule = [...p.schedule].sort((a, b) => a.needIndex - b.needIndex);
    if (version) p.version = version;
    return p;
  }
  function unmetNeed(tuition, requiredFees, aid) {
    return Math.max(0, tuition + requiredFees - aid.efs - aid.schoolAid - aid.otherSgo - aid.other);
  }
  function needIndexOf(det, policy = DEFAULT_POLICY) {
    if (det.method === "categorical" || det.method === "foster") return policy.categoricalNeedIndex;
    return det.pctAmgi == null ? null : Math.max(0, det.pctAmgi);
  }
  function tierLabel(needIndex) {
    return needIndex <= 1 ? "A" : needIndex <= 2 ? "B" : "C";
  }
  function needBand(needIndex, policy = DEFAULT_POLICY) {
    const w = policy.rankBandWidth > 0 ? policy.rankBandWidth : 1e-9;
    return Math.floor(needIndex / w + 1e-9);
  }
  function interp(needIndex, key, policy) {
    const pts = policy.schedule;
    if (needIndex <= pts[0].needIndex) return pts[0][key];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (needIndex <= b.needIndex) {
        const t = b.needIndex === a.needIndex ? 1 : (needIndex - a.needIndex) / (b.needIndex - a.needIndex);
        return a[key] + (b[key] - a[key]) * t;
      }
    }
    return pts[pts.length - 1][key];
  }
  var coverageFor = (needIndex, policy = DEFAULT_POLICY) => Math.round(interp(needIndex, "pctOfUnmet", policy) * 1e4) / 1e4;
  var capFor = (needIndex, policy = DEFAULT_POLICY) => roundDollar(interp(needIndex, "cap", policy));
  function awardAmount(needIndex, unmet, policy = DEFAULT_POLICY) {
    const raw = Math.min(Math.round(unmet * coverageFor(needIndex, policy)), capFor(needIndex, policy), unmet);
    const amt = roundDollar(raw);
    return amt < policy.minimumAward ? 0 : amt;
  }
  function explainAward(needIndex, tuition, requiredFees, aid, policy = DEFAULT_POLICY) {
    const unmet = unmetNeed(tuition, requiredFees, aid);
    const coverage = coverageFor(needIndex, policy);
    const cap = capFor(needIndex, policy);
    const byShare = roundDollar(Math.round(unmet * coverage));
    const amount = awardAmount(needIndex, unmet, policy);
    const limitedBy = unmet === 0 ? "none" : amount === 0 ? "minimum" : byShare > cap ? "cap" : byShare >= unmet ? "unmet" : "share";
    return {
      needIndex,
      tier: tierLabel(needIndex),
      band: needBand(needIndex, policy),
      cost: tuition + requiredFees,
      unmet,
      coverage,
      cap,
      byShare,
      amount,
      limitedBy,
      familyShare: Math.max(0, unmet - amount),
      floorPart: Math.min(amount, policy.funding.floor)
    };
  }
  function splitTerms(amount, policy = DEFAULT_POLICY) {
    const out = policy.terms.map((t) => ({ term: t.id, amount: Math.floor(amount * t.share / 100) * 100 }));
    out[out.length - 1].amount += amount - sum(out.map((o) => o.amount));
    return out;
  }
  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  var lotteryNumber = (seed, applicantId) => hash32(`${seed}:${applicantId}`);
  function rankCandidates(cands, seed, policy = DEFAULT_POLICY) {
    return [...cands].sort((a, b) => a.priority - b.priority || needBand(a.needIndex, policy) - needBand(b.needIndex, policy) || lotteryNumber(seed, a.applicationId) - lotteryNumber(seed, b.applicationId) || a.applicationId.localeCompare(b.applicationId));
  }
  function allocateRound(input) {
    var _a, _b, _c, _d, _e;
    const policy = (_a = input.policy) != null ? _a : DEFAULT_POLICY;
    const ranked = rankCandidates(input.candidates, input.seed, policy);
    const eligibleBySchool = /* @__PURE__ */ new Map();
    for (const c of input.candidates) if (!c.hold) eligibleBySchool.set(c.schoolId, ((_b = eligibleBySchool.get(c.schoolId)) != null ? _b : 0) + 1);
    const pools = /* @__PURE__ */ new Map();
    const honored = [];
    const merged = [];
    let prefTotal = 0;
    for (const p of (_c = input.preferencePools) != null ? _c : []) {
      prefTotal += p.amount;
      if (policy.schoolPreference.enabled && ((_d = eligibleBySchool.get(p.schoolId)) != null ? _d : 0) >= policy.schoolPreference.minEligibleApplicants) {
        pools.set(p.schoolId, ((_e = pools.get(p.schoolId)) != null ? _e : 0) + p.amount);
        if (!honored.includes(p.schoolId)) honored.push(p.schoolId);
      } else if (!merged.includes(p.schoolId)) merged.push(p.schoolId);
    }
    if (prefTotal > input.cashAvailable) throw new Error("preference pools exceed available cash");
    let general = input.cashAvailable - sum([...pools.values()]);
    const householdUsed = /* @__PURE__ */ new Map();
    const st = ranked.map((c, i) => {
      var _a2, _b2;
      const unmet = unmetNeed(c.tuition, c.requiredFees, c.aid);
      let full = c.hold ? 0 : awardAmount(c.needIndex, unmet, policy);
      let note;
      if (full && policy.householdCap != null) {
        const left = Math.max(0, policy.householdCap - ((_a2 = householdUsed.get(c.householdId)) != null ? _a2 : 0));
        if (left < full) {
          full = left >= policy.minimumAward ? roundDollar(left) : 0;
          note = "Household cap reached.";
        }
        householdUsed.set(c.householdId, ((_b2 = householdUsed.get(c.householdId)) != null ? _b2 : 0) + full);
      }
      return { c, rank: i + 1, unmet, full, granted: 0, from: /* @__PURE__ */ new Map(), note };
    });
    const pass = (want) => {
      var _a2, _b2, _c2, _d2;
      let blocked2 = false;
      for (const s of st) {
        if (s.c.hold || !s.full) continue;
        const need = Math.min(want(s), s.full - s.granted);
        if (need <= 0) continue;
        const fromPool = Math.min((_a2 = pools.get(s.c.schoolId)) != null ? _a2 : 0, need);
        const rest = need - fromPool;
        let fromGen = 0;
        if (rest > 0) {
          if (!blocked2 && general >= rest) fromGen = rest;
          else {
            if (!policy.funding.allowPartial) {
              if (policy.strictOrder) blocked2 = true;
              continue;
            }
            if (!blocked2) fromGen = general;
            if (policy.strictOrder) blocked2 = true;
          }
        }
        if (fromPool) {
          pools.set(s.c.schoolId, ((_b2 = pools.get(s.c.schoolId)) != null ? _b2 : 0) - fromPool);
          s.from.set(s.c.schoolId, ((_c2 = s.from.get(s.c.schoolId)) != null ? _c2 : 0) + fromPool);
        }
        if (fromGen) {
          general -= fromGen;
          s.from.set("general", ((_d2 = s.from.get("general")) != null ? _d2 : 0) + fromGen);
        }
        s.granted += fromPool + fromGen;
      }
    };
    if (policy.funding.mode === "floor_then_topup") pass(() => Math.max(policy.funding.floor, policy.minimumAward));
    pass((s) => s.full);
    general += sum([...pools.values()]);
    pools.clear();
    pass((s) => s.full);
    for (const s of st) if (s.granted > 0 && s.granted < policy.minimumAward && s.granted < s.full) {
      general += s.granted;
      s.granted = 0;
      s.from.clear();
    }
    const lines = st.map((s) => {
      var _a2;
      const c = s.c;
      const base = {
        rank: s.rank,
        applicationId: c.applicationId,
        studentId: c.studentId,
        householdId: c.householdId,
        schoolId: c.schoolId,
        needIndex: c.needIndex,
        band: needBand(c.needIndex, policy),
        tier: tierLabel(c.needIndex),
        priority: c.priority,
        lottery: lotteryNumber(input.seed, c.applicationId),
        unmet: s.unmet,
        fullAmount: s.full,
        amount: s.granted,
        shortfall: s.full - s.granted,
        partial: s.granted > 0 && s.granted < s.full,
        terms: [],
        fundedFrom: [...s.from.entries()].map(([pool, amount]) => ({ pool, amount }))
      };
      if (c.hold) return { ...base, fullAmount: 0, amount: 0, shortfall: 0, outcome: "HELD", note: c.hold };
      if (!s.full) return { ...base, outcome: "NO_AWARD", note: (_a2 = s.note) != null ? _a2 : s.unmet === 0 ? "No unmet need after other aid." : "Below minimum award." };
      if (!s.granted) return { ...base, outcome: "WAITLISTED", note: "Insufficient cash on hand; offered automatically, in rank order, as gifts arrive." };
      return {
        ...base,
        terms: splitTerms(s.granted, policy),
        outcome: "AWARDED",
        note: base.partial ? `Partial award; ${(base.shortfall / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} more as gifts arrive.` : s.note
      };
    });
    const awarded = lines.filter((l) => l.outcome === "AWARDED");
    const students = awarded.length;
    const schools = new Set(awarded.map((l) => l.schoolId)).size;
    return {
      roundId: input.roundId,
      seed: input.seed,
      policyVersion: policy.version,
      mode: policy.funding.mode,
      lines,
      totals: {
        awarded: sum(awarded.map((l) => l.amount)),
        students,
        schools,
        partial: awarded.filter((l) => l.partial).length,
        waitlisted: lines.filter((l) => l.outcome === "WAITLISTED").length,
        held: lines.filter((l) => l.outcome === "HELD").length,
        noAward: lines.filter((l) => l.outcome === "NO_AWARD").length,
        cashRemaining: general,
        fullNeed: sum(lines.map((l) => l.fullAmount)),
        shortfall: sum(lines.map((l) => l.shortfall)),
        meetsBreadthRule: students >= 10 && schools >= 2
      },
      honoredPreferences: honored,
      mergedPreferences: merged
    };
  }

  // src/domain/credit.ts
  var CREDIT_CAP = 17e4;
  var CREDIT_START = "2027-01-01";
  var CASH_METHODS = ["card", "apple_pay", "google_pay", "ach", "paypal", "check"];
  function routeGift(g) {
    const reasons = [];
    if (g.donorType !== "individual") reasons.push(`Only individuals can make qualified contributions (donor type: ${g.donorType}).`);
    if (!CASH_METHODS.includes(g.method)) reasons.push(`${g.method} is not a cash contribution from the donor.`);
    if (g.chargeDate < CREDIT_START) reasons.push(`Gifts before ${CREDIT_START} do not qualify.`);
    if (!g.designate) reasons.push("Donor did not designate the gift as a \xA725F qualified contribution.");
    if (reasons.length) {
      return { qualified: false, reasons, lines: [{ fund: "general", amount: g.amount, designated: false }], creditEligible: 0, deductibleExcess: g.amount };
    }
    const roomLeft = Math.max(0, CREDIT_CAP - g.priorDesignatedThisYear);
    const creditEligible = Math.min(g.amount, roomLeft);
    const excess = g.amount - creditEligible;
    const lines = [];
    if (g.excessTo === "segregated") lines.push({ fund: "25F-TN", amount: g.amount, designated: true });
    else {
      if (creditEligible) lines.push({ fund: "25F-TN", amount: creditEligible, designated: true });
      if (excess) lines.push({ fund: "general", amount: excess, designated: false });
    }
    return { qualified: true, reasons: [], lines, creditEligible, deductibleExcess: excess };
  }
  function splitCouple(total) {
    const a = Math.ceil(total / 2 / 100) * 100;
    return [a, total - a];
  }
  function creditForYear(designatedGifts) {
    const designated = designatedGifts.reduce((a, b) => a + b, 0);
    const credit = Math.min(designated, CREDIT_CAP);
    return { designated, credit, excess: designated - credit };
  }

  // src/domain/disqualified.ts
  var FAMILY_RELATIONS = [
    "spouse",
    "parent",
    "grandparent",
    "child",
    "grandchild",
    "great_grandchild",
    "child_spouse",
    "grandchild_spouse",
    "great_grandchild_spouse",
    "sibling"
  ];
  var SUBSTANTIAL_THRESHOLD = 5e5;
  var SUBSTANTIAL_SHARE = 0.02;
  function substantialContributors(totals) {
    const all = totals.reduce((a, t) => a + t.amount, 0);
    return totals.filter((t) => t.amount > SUBSTANTIAL_THRESHOLD && t.amount > all * SUBSTANTIAL_SHARE).map((t) => t.householdKey);
  }
  var normName = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();
  var normAddr = (s) => s.toLowerCase().replace(/[.,#]/g, " ").replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave").replace(/\broad\b/g, "rd").replace(/\bdrive\b/g, "dr").replace(/\blane\b/g, "ln").replace(/\bcourt\b/g, "ct").replace(/\bapartment\b|\bapt\b|\bunit\b/g, "#").replace(/\s+/g, " ").trim();
  var lastName = (s) => {
    var _a;
    return (_a = normName(s).split(" ").pop()) != null ? _a : "";
  };
  function screen(people, registry, relatives, forYear) {
    const active = registry.filter((p) => p.year === forYear || p.role === "substantial_contributor" && p.year === forYear - 1);
    const targets = [
      ...active.map((p) => ({ label: `${p.fullName} (${p.role.replace("_", " ")})`, fullName: p.fullName, dob: p.dob, address: p.address })),
      ...relatives.filter((r) => active.some((p) => p.personId === r.ofPersonId)).map((r) => ({ label: `${r.fullName} (${r.relation} of DQ person)`, fullName: r.fullName, dob: r.dob, address: r.address }))
    ];
    const out = [];
    for (const s of people) {
      for (const t of targets) {
        const sameName = normName(s.fullName) === normName(t.fullName);
        const sameDob = !!s.dob && s.dob === t.dob;
        const sameAddr = !!s.address && !!t.address && normAddr(s.address) === normAddr(t.address);
        const sameLast = lastName(s.fullName) === lastName(t.fullName);
        if (sameName && sameDob) out.push({ screeneeId: s.personId, against: t.label, reason: "Name and date of birth match", strength: "exact" });
        else if (sameName && sameAddr) out.push({ screeneeId: s.personId, against: t.label, reason: "Name and address match", strength: "exact" });
        else if (sameAddr) out.push({ screeneeId: s.personId, against: t.label, reason: "Lives at the same address", strength: "strong" });
        else if (sameName) out.push({ screeneeId: s.personId, against: t.label, reason: "Same full name", strength: "possible" });
        else if (sameLast && sameDob) out.push({ screeneeId: s.personId, against: t.label, reason: "Same surname and date of birth", strength: "possible" });
      }
    }
    return out;
  }

  // src/domain/spend.ts
  function ninetyPercentTest(incomes, payments, asOf, scheduled = []) {
    const years = [...incomes].sort((a, b) => a.year - b.year);
    const buckets = years.map((y) => ({ year: y.year, income: y.contributions + y.earnings + y.refunds, remaining: y.contributions + y.earnings + y.refunds, spentByDeadline: 0 }));
    const all = [
      ...payments.map((p) => ({ ...p, scheduled: false })),
      ...scheduled.map((p) => ({ ...p, scheduled: true }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const p of all) {
      let left = p.amount;
      for (const b of buckets) {
        if (left <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, left);
        b.remaining -= take;
        left -= take;
        if (p.date <= `${b.year + 1}-12-31`) b.spentByDeadline += take;
      }
    }
    return buckets.map((b) => {
      const required = Math.ceil(b.income * 0.9);
      const deadline = `${b.year + 1}-12-31`;
      const pct = b.income ? b.spentByDeadline / b.income : 1;
      let status;
      if (b.spentByDeadline >= required) status = asOf > deadline || b.income === 0 ? "met" : "on_track";
      else if (asOf > deadline) status = "failed";
      else if (asOf < `${b.year}-12-31`) status = "open";
      else status = "at_risk";
      return { year: b.year, income: b.income, required, spent: b.spentByDeadline, deadline, pct, status, shortfall: Math.max(0, required - b.spentByDeadline) };
    });
  }

  // src/domain/disbursement.ts
  var BANK_CHANGE_HOLD_DAYS = 3;
  function buildBatch(batchId, term, awards, gates, payees, asOf, segregatedCash) {
    var _a;
    let cashLeft = segregatedCash;
    const lines = awards.filter((a) => a.term === term).map((a) => {
      const g = gates[a.awardId];
      const p = payees[a.schoolId];
      const blockers = [];
      if (!(g == null ? void 0 : g.enrollmentConfirmed)) blockers.push("School has not confirmed enrollment");
      if (!(g == null ? void 0 : g.residencyReattested)) blockers.push("Family has not re-attested Tennessee residency");
      if (g == null ? void 0 : g.hold) blockers.push(`On hold: ${g.hold}`);
      if (!(p == null ? void 0 : p.verified)) blockers.push("School bank account not verified");
      if ((p == null ? void 0 : p.changedAt) && !p.emailConfirmed) blockers.push("Bank account change not yet confirmed from the school\u2019s email on file");
      if ((p == null ? void 0 : p.payableAfter) && asOf < p.payableAfter.slice(0, 10)) blockers.push(`Bank account change in its cancel window until ${p.payableAfter.slice(0, 10)}`);
      if (!blockers.length) {
        if (cashLeft >= a.amount) cashLeft -= a.amount;
        else blockers.push("Insufficient cash in segregated account");
      }
      return { ...a, status: blockers.length ? "BLOCKED" : "READY", blockers };
    });
    const ready = lines.filter((l) => l.status === "READY");
    const bySchool = {};
    for (const l of ready) bySchool[l.schoolId] = ((_a = bySchool[l.schoolId]) != null ? _a : 0) + l.amount;
    return { batchId, term, lines, readyTotal: sum(ready.map((l) => l.amount)), bySchool };
  }
  function canRelease(approvals, preparedBy) {
    const distinct = new Set(approvals.map((a) => a.userId).filter((u) => u !== preparedBy));
    return distinct.size >= 2 ? { ok: true } : { ok: false, reason: `Needs 2 distinct approvers other than the preparer (has ${distinct.size}).` };
  }
  function batchSafety(i) {
    var _a, _b;
    const problems = [];
    const total = sum(Object.values(i.bySchool));
    if (total > i.segregatedCash) problems.push(`Batch total ${total} exceeds cash in the \xA725F account ${i.segregatedCash}.`);
    for (const [s, amt] of Object.entries(i.bySchool)) {
      const cap = ((_a = i.awardedForTermBySchool[s]) != null ? _a : 0) - ((_b = i.alreadySentForTermBySchool[s]) != null ? _b : 0);
      if (amt <= 0) problems.push(`School ${s}: non-positive amount.`);
      if (amt > cap) problems.push(`School ${s}: ${amt} is more than its unpaid awards for the term (${cap}).`);
    }
    for (const s of i.payeeChangedSince) problems.push(`School ${s}: bank account changed after approval; re-approve.`);
    return problems;
  }
  function netRefunds(bySchool, owed) {
    var _a;
    const pay = { ...bySchool };
    const applied = [];
    for (const r of [...owed].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt))) {
      if (r.amount > 0 && ((_a = pay[r.schoolId]) != null ? _a : 0) >= r.amount) {
        pay[r.schoolId] -= r.amount;
        applied.push(r);
      }
    }
    return { pay, applied };
  }
  function refundDue(paidForTerm, daysEnrolled, termDays) {
    if (termDays <= 0) throw new Error("termDays must be positive");
    const used = Math.min(1, Math.max(0, daysEnrolled / termDays));
    return Math.round(paidForTerm * (1 - used));
  }

  // src/domain/ledger.ts
  function assertBalanced(j) {
    var _a;
    const byFund = /* @__PURE__ */ new Map();
    for (const p of j.postings) {
      if (!Number.isInteger(p.amount)) throw new Error(`journal ${j.id}: non-integer amount`);
      byFund.set(p.fund, ((_a = byFund.get(p.fund)) != null ? _a : 0) + p.amount);
    }
    const total = [...byFund.values()].reduce((a, b) => a + b, 0);
    if (total !== 0) throw new Error(`journal ${j.id} is unbalanced by ${total}`);
  }
  function balance(journals, fund, account) {
    let b = 0;
    for (const j of journals) for (const p of j.postings) if (p.fund === fund && p.account === account) b += p.amount;
    return b;
  }
  var giftJournal = (id, date, ref, lines) => ({
    id,
    date,
    kind: "gift",
    ref,
    postings: lines.flatMap((l) => [{ fund: l.fund, account: "cash", amount: l.amount }, { fund: l.fund, account: "contributions", amount: -l.amount }])
  });
  var feeAndTopupJournal = (id, date, ref, fee) => ({
    id,
    date,
    kind: "fee_topup",
    ref,
    postings: [
      { fund: "operating", account: "processing_fees", amount: fee },
      { fund: "operating", account: "cash", amount: -fee }
      // segregated cash was reduced by the processor; top-up restores it (net zero to 25F cash)
    ]
  });
  var scholarshipJournal = (id, date, ref, amount) => ({
    id,
    date,
    kind: "scholarship_payment",
    ref,
    postings: [{ fund: "25F-TN", account: "scholarship_expense", amount }, { fund: "25F-TN", account: "cash", amount: -amount }]
  });
  var refundJournal = (id, date, ref, amount) => ({
    id,
    date,
    kind: "school_refund",
    ref,
    postings: [{ fund: "25F-TN", account: "cash", amount }, { fund: "25F-TN", account: "contributions", amount: -amount }]
  });
  function reconcile(settlements, bank, journals) {
    var _a, _b;
    const f = [];
    const bankByRef = /* @__PURE__ */ new Map();
    for (const b of bank) if (b.ref) bankByRef.set(b.ref, [...(_a = bankByRef.get(b.ref)) != null ? _a : [], b]);
    const ledgerRefs = new Set(journals.filter((j) => j.kind === "gift").map((j) => j.ref));
    for (const s of settlements) {
      if (s.gross - s.fee !== s.net) f.push({ severity: "critical", code: "PROCESSOR_MATH", message: `Settlement ${s.ref}: gross \u2212 fee \u2260 net`, ref: s.ref });
      const lines = (_b = bankByRef.get(s.ref)) != null ? _b : [];
      const target = s.fund === "25F-TN" ? "segregated" : "operating";
      const deposit = lines.find((l) => l.account === target && l.amount > 0);
      if (!deposit) f.push({ severity: "warn", code: "NOT_DEPOSITED", message: `Settlement ${s.ref} not yet seen in ${target} bank account`, ref: s.ref });
      else if (deposit.amount !== s.net) f.push({ severity: "critical", code: "DEPOSIT_MISMATCH", message: `Settlement ${s.ref}: bank ${deposit.amount} \u2260 processor net ${s.net}`, ref: s.ref });
      if (s.fund === "25F-TN" && s.fee > 0) {
        const topup = lines.find((l) => l.account === "segregated" && l.amount === s.fee && /top-?up/i.test(l.memo));
        if (!topup) f.push({ severity: "critical", code: "FEE_NOT_TOPPED_UP", message: `Segregated deposit ${s.ref} is short the ${s.fee}\xA2 card fee; operating fund top-up missing`, ref: s.ref });
      }
      if (!ledgerRefs.has(s.ref)) f.push({ severity: "critical", code: "NOT_IN_LEDGER", message: `Settlement ${s.ref} has no gift journal`, ref: s.ref });
    }
    const settlementRefs = new Set(settlements.filter((s) => s.fund === "25F-TN").map((s) => s.ref));
    const okRefs = new Set(journals.filter((j) => ["earnings", "school_refund"].includes(j.kind)).map((j) => j.ref));
    for (const b of bank.filter((x) => x.account === "segregated" && x.amount > 0)) {
      const explained = b.ref && (settlementRefs.has(b.ref) || okRefs.has(b.ref));
      if (!explained) f.push({ severity: "critical", code: "SEGREGATED_PURITY", message: `Unexplained deposit of ${b.amount}\xA2 into the \xA725F account ("${b.memo}")`, ref: b.id });
    }
    return f;
  }

  // src/domain/acknowledgments.ts
  var provisionalDonorNumber = ({ year, sequence }) => `LH${year}-${String(sequence).padStart(6, "0")}`;
  function buildYearEnd(year, sgoEin, donors, gifts, existingNumbers = {}, fmt = provisionalDonorNumber) {
    var _a, _b;
    const inYear = gifts.filter((g) => g.date.startsWith(String(year)) && !g.refunded);
    const byDonor = /* @__PURE__ */ new Map();
    for (const g of inYear) byDonor.set(g.donorId, [...(_a = byDonor.get(g.donorId)) != null ? _a : [], g]);
    let seq = Object.keys(existingNumbers).length;
    const acks = [];
    const rows = [];
    const donorsById = new Map(donors.map((d) => [d.donorId, d]));
    for (const [donorId, gs] of [...byDonor.entries()].sort()) {
      const d = donorsById.get(donorId);
      if (!d) throw new Error(`gift references unknown donor ${donorId}`);
      const donorNumber = (_b = existingNumbers[donorId]) != null ? _b : fmt({ sgoEin, year, sequence: ++seq, donorId });
      const total = sum(gs.map((g) => g.amount));
      acks.push({
        donorId,
        year,
        donorNumber,
        sgoEin,
        legalName: d.legalName,
        address: d.address,
        totalQualified: total,
        giftCount: gs.length,
        goodsOrServices: "none",
        delivery: "email",
        dueBy: `${year + 1}-01-31`
      });
      rows.push({ donorNumber, name: d.legalName, address: d.address, aggregateQualified: total });
    }
    return { acks, rows };
  }
  function tieOut(acks, rows, segregatedDesignatedDeposits) {
    const a = sum(acks.map((x) => x.totalQualified));
    const r = sum(rows.map((x) => x.aggregateQualified));
    const dupNumbers = rows.length - new Set(rows.map((x) => x.donorNumber)).size;
    const problems = [];
    if (a !== r) problems.push(`Acknowledgments total ${a} \u2260 IRS report total ${r}`);
    if (a !== segregatedDesignatedDeposits) problems.push(`Acknowledgments total ${a} \u2260 designated deposits in \xA725F account ${segregatedDesignatedDeposits}`);
    if (dupNumbers) problems.push(`${dupNumbers} duplicate donor number(s)`);
    return { ok: problems.length === 0, problems, total: a };
  }

  // src/domain/stateMachines.ts
  function machine(name, edges) {
    const allowed = /* @__PURE__ */ new Map();
    for (const e of edges) for (const f of Array.isArray(e.from) ? e.from : [e.from]) allowed.set(`${f}>${e.to}`, e);
    return {
      name,
      can(from, to, actor) {
        const e = allowed.get(`${from}>${to}`);
        if (!e) return { ok: false, reason: `${name}: ${from} \u2192 ${to} is not a legal transition` };
        if (e.humanOnly && actor.kind !== "person") return { ok: false, reason: `${name}: ${from} \u2192 ${to} requires a person (actor is ${actor.kind})` };
        if (e.roles && actor.kind === "person" && !e.roles.includes(actor.role)) return { ok: false, reason: `${name}: ${from} \u2192 ${to} not allowed for role ${actor.role}` };
        return { ok: true };
      },
      transition(from, to, actor) {
        const r = this.can(from, to, actor);
        if (!r.ok) throw new Error(r.reason);
        return to;
      },
      next(from) {
        return edges.filter((e) => (Array.isArray(e.from) ? e.from : [e.from]).includes(from)).map((e) => e.to);
      }
    };
  }
  var applicationMachine = machine("application", [
    { from: "DRAFT", to: "SUBMITTED", roles: ["family"] },
    { from: "SUBMITTED", to: "DOCS_PENDING" },
    { from: ["SUBMITTED", "DOCS_PENDING"], to: "AUTO_VERIFYING" },
    { from: "AUTO_VERIFYING", to: "ELIGIBLE" },
    { from: "AUTO_VERIFYING", to: "NEEDS_REVIEW" },
    { from: "AUTO_VERIFYING", to: "INELIGIBLE_PROPOSED" },
    { from: "AUTO_VERIFYING", to: "DOCS_PENDING" },
    { from: "NEEDS_REVIEW", to: "ELIGIBLE", humanOnly: true, roles: ["staff", "board"] },
    { from: "NEEDS_REVIEW", to: "DOCS_PENDING" },
    { from: ["NEEDS_REVIEW", "INELIGIBLE_PROPOSED"], to: "DENIED", humanOnly: true, roles: ["staff", "board"] },
    { from: "INELIGIBLE_PROPOSED", to: "ELIGIBLE", humanOnly: true, roles: ["staff", "board"] },
    { from: "DENIED", to: "APPEAL", roles: ["family"] },
    { from: "APPEAL", to: "ELIGIBLE", humanOnly: true, roles: ["board"] },
    { from: "APPEAL", to: "CLOSED", humanOnly: true, roles: ["board"] },
    { from: "ELIGIBLE", to: "QUEUED" },
    { from: "QUEUED", to: "AWARDED" },
    { from: "QUEUED", to: "WAITLISTED" },
    { from: "WAITLISTED", to: "AWARDED" },
    { from: ["QUEUED", "WAITLISTED", "AWARDED", "ACTIVE"], to: "HELD" },
    { from: "HELD", to: "QUEUED", humanOnly: true, roles: ["staff", "board"] },
    { from: "HELD", to: "DENIED", humanOnly: true, roles: ["board"] },
    { from: "AWARDED", to: "ACCEPTED", roles: ["family"] },
    { from: "AWARDED", to: "DECLINED", roles: ["family"] },
    { from: "AWARDED", to: "WAITLISTED" },
    // offer expired
    { from: "ACCEPTED", to: "SCHOOL_CONFIRMED", roles: ["school"] },
    { from: "SCHOOL_CONFIRMED", to: "ACTIVE" },
    { from: "ACTIVE", to: "WITHDRAWN" },
    { from: ["ACTIVE", "WITHDRAWN", "DECLINED"], to: "CLOSED" }
  ]);
  var giftMachine = machine("gift", [
    { from: "PLEDGED", to: "DESIGNATION_RECONFIRMED" },
    { from: "PLEDGED", to: "CANCELLED", roles: ["donor", "staff"] },
    { from: ["PLEDGED", "DESIGNATION_RECONFIRMED"], to: "CHARGED" },
    { from: "CHARGED", to: "FAILED" },
    { from: "FAILED", to: "CHARGED" },
    { from: "CHARGED", to: "SETTLED" },
    { from: "SETTLED", to: "DEPOSITED" },
    { from: "DEPOSITED", to: "RECONCILED" },
    { from: "RECONCILED", to: "ACKNOWLEDGED" },
    { from: "ACKNOWLEDGED", to: "REPORTED" },
    { from: ["SETTLED", "DEPOSITED", "RECONCILED", "ACKNOWLEDGED", "REPORTED"], to: "CHARGEBACK" }
  ]);
  var schoolMachine = machine("school", [
    { from: "UNCLAIMED", to: "CLAIM_PENDING", roles: ["school"] },
    { from: "CLAIM_PENDING", to: "DOMAIN_VERIFIED" },
    { from: "CLAIM_PENDING", to: "UNCLAIMED" },
    { from: "DOMAIN_VERIFIED", to: "AGREEMENT_SIGNED", roles: ["school"] },
    { from: "AGREEMENT_SIGNED", to: "PAYEE_VERIFIED" },
    { from: "PAYEE_VERIFIED", to: "ACTIVE" },
    { from: ["ACTIVE", "PAYEE_VERIFIED"], to: "SUSPENDED", humanOnly: true, roles: ["board", "staff"] },
    { from: "SUSPENDED", to: "ACTIVE", humanOnly: true, roles: ["board"] },
    { from: ["ACTIVE", "SUSPENDED"], to: "ENDED", humanOnly: true }
  ]);
  var batchMachine = machine("disbursement_batch", [
    { from: "DRAFT", to: "PREPARED" },
    { from: "PREPARED", to: "APPROVED_1", humanOnly: true, roles: ["staff", "board"] },
    { from: "APPROVED_1", to: "APPROVED_2", humanOnly: true, roles: ["board"] },
    { from: "APPROVED_2", to: "SENT" },
    { from: "SENT", to: "SETTLED" },
    { from: "SENT", to: "RETURNED" }
  ]);

  // src/domain/compliance.ts
  function deadlinesFor(year) {
    return [
      { id: `irs-portal-${year}`, label: "Registered in IRS SGO portal", due: `${year - 1}-12-31`, owner: "Ops lead" },
      { id: `tn-list-${year}`, label: "Tennessee submits its SGO list to the IRS", due: year === 2027 ? "2027-02-15" : `${year - 1}-12-31`, owner: "TDOE (we confirm listing)" },
      { id: `ack-${year}`, label: `Donor acknowledgments for ${year}`, due: `${year + 1}-01-31`, owner: "Automated \xB7 treasurer signs off" },
      { id: `irs-report-${year}`, label: `IRS contribution report for ${year}`, due: `${year + 1}-02-28`, owner: "Automated \xB7 treasurer submits" },
      { id: `990-${year}`, label: `Form 990 + \xA725F certification for ${year}`, due: `${year + 1}-05-15`, owner: "CPA \xB7 board signs" },
      { id: `ninety-${year}`, label: `${year} receipts \u226590% spent on scholarships`, due: `${year + 1}-12-31`, owner: "Award engine" },
      { id: `tn-charity-${year}`, label: "TN charitable solicitation renewal", due: `${year + 1}-06-30`, owner: "Ops lead" }
    ];
  }
  function evaluate(s) {
    var _a;
    const f = [];
    if (s.segregatedBankBalance !== s.segregatedLedgerBalance) {
      f.push({
        id: "seg-balance",
        severity: "critical",
        area: "Segregated account",
        blocks: ["disbursement", "acknowledgments"],
        message: `Bank balance ${s.segregatedBankBalance} \u2260 ledger ${s.segregatedLedgerBalance}. Money movement paused until reconciled.`
      });
    } else f.push({ id: "seg-balance", severity: "info", area: "Segregated account", message: "Bank and ledger agree to the cent." });
    for (const r of s.recon) f.push({ id: `recon-${r.code}-${(_a = r.ref) != null ? _a : ""}`, severity: r.severity, area: "Reconciliation", message: r.message, blocks: r.severity === "critical" ? ["disbursement"] : void 0 });
    for (const y of s.ninety) {
      if (y.status === "failed") f.push({ id: `ninety-${y.year}`, severity: "critical", area: "90% test", message: `${y.year} receipts: only ${(y.pct * 100).toFixed(1)}% spent by ${y.deadline}.` });
      else if (y.status === "at_risk") f.push({ id: `ninety-${y.year}`, severity: "warn", area: "90% test", message: `${y.year} receipts ${(y.pct * 100).toFixed(1)}% spent; ${(y.shortfall / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} more needed by ${y.deadline}.` });
      else f.push({ id: `ninety-${y.year}`, severity: "info", area: "90% test", message: `${y.year}: ${y.status.replace("_", " ")} (${(y.pct * 100).toFixed(1)}% incl. scheduled).` });
    }
    const years = [...new Set(s.awardedStudents.map((a) => a.year))];
    for (const y of years) {
      const rows = s.awardedStudents.filter((a) => a.year === y);
      const students = new Set(rows.map((r) => r.studentId)).size;
      const schools = new Set(rows.map((r) => r.schoolId)).size;
      if (students < 10 || schools < 2) f.push({ id: `ten-${y}`, severity: "warn", area: "10 students / 2 schools", message: `${y}: ${students} students at ${schools} schools. Law requires \u226510 students not all at one school.` });
      else f.push({ id: `ten-${y}`, severity: "info", area: "10 students / 2 schools", message: `${y}: ${students} students at ${schools} schools.` });
    }
    const q = s.acknowledgmentsQueued;
    if (q.queued < q.donorsWithGifts && s.asOf >= `${q.year + 1}-01-15`) f.push({ id: `ack-${q.year}`, severity: "critical", area: "Acknowledgments", blocks: ["acknowledgments"], message: `${q.donorsWithGifts - q.queued} donor(s) with ${q.year} gifts have no acknowledgment queued; due Jan 31.` });
    for (const d of s.deadlines.filter((d2) => !d2.done)) {
      const days = Math.ceil((Date.parse(d.due) - Date.parse(s.asOf)) / 864e5);
      if (days < 0) f.push({ id: `dl-${d.id}`, severity: "critical", area: "Deadline", message: `${d.label} was due ${d.due}.` });
      else if (days <= 30) f.push({ id: `dl-${d.id}`, severity: "warn", area: "Deadline", message: `${d.label} due in ${days} day(s) (${d.due}).` });
    }
    if (s.dqMatchesUnreviewed) f.push({ id: "dq", severity: "warn", area: "Disqualified persons", blocks: ["awards"], message: `${s.dqMatchesUnreviewed} possible disqualified-person match(es) awaiting board review.` });
    if (s.exceptionTicketsOverSla) f.push({ id: "sla", severity: "warn", area: "Exception queue", message: `${s.exceptionTicketsOverSla} ticket(s) past their response time.` });
    return f;
  }
  var blocked = (findings, flow) => findings.some((f) => {
    var _a;
    return f.severity === "critical" && ((_a = f.blocks) == null ? void 0 : _a.includes(flow));
  });

  // src/domain/irs.ts
  function transcriptToIncomeItems(o) {
    var _a;
    const who = o.coversMemberIds[0];
    const f = o.fields;
    const items = [
      ["wages", f.wages],
      ["interest_dividends", f.taxableInterest + f.ordinaryDividends],
      ["self_employment", Math.max(0, f.businessIncome) + Math.max(0, (_a = f.farmIncome) != null ? _a : 0)],
      ["rental", Math.max(0, f.rentalRoyalty)],
      ["unemployment", f.unemployment],
      ["social_security", f.socialSecurityGross],
      ["pension", f.pensionsTaxable],
      ["other_cash", Math.max(0, f.otherIncome)]
    ];
    const out = items.filter(([, a]) => a > 0).map(([type, amount]) => ({ personId: who, type, amount, year: o.taxYear, cash: true, source: "transcript" }));
    for (const m of o.coversMemberIds.slice(1)) out.push({ personId: m, type: "other_cash", amount: 0, year: o.taxYear, cash: true, source: "transcript" });
    if (!out.some((i) => i.personId === who)) out.push({ personId: who, type: "other_cash", amount: 0, year: o.taxYear, cash: true, source: "transcript" });
    return out;
  }
  var TAXABLE_TYPES = /* @__PURE__ */ new Set(["wages", "self_employment", "unemployment", "interest_dividends", "rental", "pension", "social_security", "other_cash"]);
  function mergeTranscripts(stated, outcomes, zeroIncomeAttested) {
    const returns = outcomes.filter((o) => o.kind === "return");
    const covered = new Set(returns.flatMap((o) => o.coversMemberIds));
    const kept = stated.filter((i) => !(covered.has(i.personId) && TAXABLE_TYPES.has(i.type)));
    const fromIrs = returns.flatMap(transcriptToIncomeItems);
    const notes = [];
    for (const o of returns) {
      const before = sum(stated.filter((i) => o.coversMemberIds.includes(i.personId) && TAXABLE_TYPES.has(i.type)).map((i) => i.amount));
      const after = sum(transcriptToIncomeItems(o).map((i) => i.amount));
      const fmt = (c) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      notes.push(Math.abs(after - before) <= Math.max(1e5, before * 0.05) ? `IRS transcript for ${o.taxYear} confirms stated income (${fmt(after)}).` : `IRS transcript for ${o.taxYear} shows ${fmt(after)}; the family stated ${fmt(before)}. The IRS figure is used.`);
    }
    for (const o of outcomes) if (o.kind === "no_record") notes.push(`IRS has no ${o.taxYear} return on file for ${o.coversMemberIds.length} person(s).`);
    const contradictsZeroIncome = returns.some((o) => o.coversMemberIds.some((m) => zeroIncomeAttested.includes(m)) && sum(transcriptToIncomeItems(o).map((i) => i.amount)) > 0);
    if (contradictsZeroIncome) notes.push("A person who reported no income has income on an IRS transcript. The IRS figure is used.");
    return { items: [...kept, ...fromIrs], verifiedMemberIds: [...covered], notes, contradictsZeroIncome };
  }
  function nextTranscriptRetry(taxYear, today) {
    const last = `${taxYear + 1}-10-15`;
    const d = /* @__PURE__ */ new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 14);
    const next = d.toISOString().slice(0, 10);
    return next <= last ? next : null;
  }
  var FORM_4506C_VALID_DAYS = 120;
  var consentValid = (signedAt, today) => ((/* @__PURE__ */ new Date(today + "T00:00:00Z")).getTime() - (/* @__PURE__ */ new Date(signedAt.slice(0, 10) + "T00:00:00Z")).getTime()) / 864e5 <= FORM_4506C_VALID_DAYS;

  // src/domain/beacon.ts
  var DRAND_QUICKNET = {
    chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    genesisTime: 1692803367,
    // unix seconds
    period: 3,
    // seconds
    relays: ["https://api.drand.sh", "https://api2.drand.sh", "https://api3.drand.sh", "https://drand.cloudflare.com"]
  };
  function beaconRoundAt(iso, c = DRAND_QUICKNET) {
    const t = Math.floor(new Date(iso).getTime() / 1e3);
    return Math.max(1, Math.ceil((t - c.genesisTime) / c.period) + 1);
  }
  function beaconTimeOf(round, c = DRAND_QUICKNET) {
    return new Date((c.genesisTime + (round - 1) * c.period) * 1e3).toISOString();
  }
  var beaconUrl = (round, relay = DRAND_QUICKNET.relays[0], c = DRAND_QUICKNET) => `${relay}/${c.chainHash}/public/${round}`;
  var seedFromBeacon = (round, randomness) => `drand-quicknet:${round}:${randomness.toLowerCase()}`;
  function roundPlan(year, slots = [
    { name: `${year}-R1`, date: `${year}-04-15` },
    { name: `${year}-R2`, date: `${year}-07-15` },
    { name: `${year}-R3`, date: `${year}-12-01` }
  ]) {
    return slots.map(({ name, date }) => {
      const runAt = (/* @__PURE__ */ new Date(`${date}T15:00:00Z`)).toISOString();
      const at = (h) => new Date(new Date(runAt).getTime() + h * 36e5).toISOString();
      return { name, runAt, announceAt: at(-14 * 24), freezeAt: at(-1), beaconRound: beaconRoundAt(runAt) };
    });
  }
  return __toCommonJS(index_exports);
})();
