-- Seed: award policy, limits table, 2027–28 cycle, and the pre-loaded school directory (SAMPLE — replace with Lionheart's accredited list).
insert into award_policies (version, params, adopted_at, adopted_minutes_ref) values ('2027-28-v2', '{
  "schedule": [{"needIndex": 0, "pctOfUnmet": 0.95, "cap": 900000}, {"needIndex": 1, "pctOfUnmet": 0.85, "cap": 800000},
               {"needIndex": 2, "pctOfUnmet": 0.55, "cap": 500000}, {"needIndex": 3, "pctOfUnmet": 0.25, "cap": 250000}],
  "categoricalNeedIndex": 0, "rankBandWidth": 0.05,
  "funding": {"mode": "floor_then_topup", "floor": 100000, "allowPartial": true}, "householdCap": null,
  "minimumAward": 50000, "terms": [{"id": "fall", "share": 0.5}, {"id": "spring", "share": 0.5}], "strictOrder": true,
  "schoolPreference": {"enabled": true, "minEligibleApplicants": 10}}', null, null);

insert into limits_tables (version, data, source) values ('HUD-FY2026-seed', '{
  "version": "HUD-FY2026-seed",
  "areas": {"METRO34980M34980": {"code": "METRO34980M34980", "name": "Nashville-Davidson–Murfreesboro–Franklin, TN HUD Metro FMR Area", "medianIncome": 11610000, "fiscalYear": 2026, "source": "HUD FY2026"},
            "TN_STATEWIDE": {"code": "TN_STATEWIDE", "name": "Tennessee statewide (screening reference only)", "medianIncome": 9230000, "fiscalYear": 2025, "source": "THDA 2025"}},
  "countyToArea": {"cannon": "METRO34980M34980", "cheatham": "METRO34980M34980", "davidson": "METRO34980M34980", "dickson": "METRO34980M34980", "hickman": "METRO34980M34980", "macon": "METRO34980M34980", "robertson": "METRO34980M34980", "rutherford": "METRO34980M34980", "smith": "METRO34980M34980", "sumner": "METRO34980M34980", "trousdale": "METRO34980M34980", "williamson": "METRO34980M34980", "wilson": "METRO34980M34980"},
  "fallbackAreaCode": "TN_STATEWIDE"}', 'HUD FY2026 Income Limits; run scripts/load-hud-limits.ts for all 95 counties');

insert into cycles (school_year, opens_on, policy_version, limits_version) values ('2027-28', '2027-02-16', '2027-28-v2', 'HUD-FY2026-seed');

insert into schools (slug, name, city, grades, email_domain) values
 ('cpa','Christ Presbyterian Academy','Nashville','PK–12','cpalions.org'),
 ('da','Davidson Academy','Nashville','PK–12','davidsonacademy.com'),
 ('dca','Donelson Christian Academy','Nashville','PK–12','dcalions.org'),
 ('ehcs','Ezell-Harding Christian School','Antioch','PK–12','ezellharding.com'),
 ('gcs','Goodpasture Christian School','Madison','PK–12','goodpasture.org'),
 ('la','Lipscomb Academy','Nashville','PK–12','lipscombacademy.org'),
 ('ncs','Nashville Christian School','Nashville','PK–12','nashvillechristian.org'),
 ('fcs','Friendship Christian School','Lebanon','PK–12','friendshipchristian.org'),
 ('ba','Brentwood Academy','Brentwood','6–12','brentwoodacademy.com'),
 ('mtcs','Middle Tennessee Christian School','Murfreesboro','PK–12','mtcs.org'),
 ('bcs','Briarcrest Christian School','Eads','PK–12','briarcrest.com'),
 ('ecs','Evangelical Christian School','Cordova','PK–12','ecseagles.com');
