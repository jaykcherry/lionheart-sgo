/**
 * Builds a full Tennessee limits table from HUD's FY income-limits file and loads it into Supabase.
 *
 * 1. Download HUD's "Section 8 Income Limits" Excel/CSV for the fiscal year from huduser.gov
 *    (Datasets → Income Limits → FY20xx → "Data for all areas"), save as CSV.
 * 2. Run: npm run limits:load -- path/to/Section8-FY26.csv FY2026
 *
 * Expected columns (HUD's names): state_alpha, county_name, hud_area_code, hud_area_name, median2026 (or medianYYYY).
 * Every determination stores the version it used; publishing a new version never changes past decisions,
 * but you can re-run open applications against it. Replace with IRS §25F tables when the IRS publishes them.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { LimitsTable } from '../src/domain';
import { normalizeCounty } from '../src/domain';

const [file, fy] = process.argv.slice(2);
if (!file || !fy) { console.error('usage: limits:load <hud.csv> <FY2026>'); process.exit(1); }
const year = fy.replace(/\D/g, '');

function parseCsv(text: string): Record<string, string>[] {
  const [head, ...rows] = text.split(/\r?\n/).filter(Boolean);
  const cols = head!.split(',').map((c) => c.trim().replace(/"/g, ''));
  return rows.map((r) => { const cells = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])); });
}

const rows = parseCsv(readFileSync(file, 'utf8')).filter((r) => r.state_alpha === 'TN');
const table: LimitsTable = { version: `HUD-${fy}`, areas: {}, countyToArea: {}, fallbackAreaCode: 'TN_STATEWIDE' };
for (const r of rows) {
  const median = Number(r[`median${year}`] ?? r.median ?? 0);
  if (!median) continue;
  table.areas[r.hud_area_code!] = { code: r.hud_area_code!, name: r.hud_area_name!, medianIncome: Math.round(median * 100), fiscalYear: Number(year), source: `HUD ${fy} Section 8 Income Limits` };
  table.countyToArea[normalizeCounty(r.county_name!)] = r.hud_area_code!;
}
const medians = Object.values(table.areas).map((a) => a.medianIncome).sort((a, b) => a - b);
table.areas.TN_STATEWIDE = { code: 'TN_STATEWIDE', name: 'Lowest Tennessee area (screening only)', medianIncome: medians[0] ?? 0, fiscalYear: Number(year), source: 'derived' };
console.log(`${Object.keys(table.countyToArea).length} counties, ${Object.keys(table.areas).length - 1} HUD areas`);
if (Object.keys(table.countyToArea).length < 95) console.warn('Warning: fewer than 95 Tennessee counties found. Check the file.');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { error } = await sb.from('limits_tables').upsert({ version: table.version, data: table, source: `HUD ${fy}` });
if (error) { console.error(error.message); process.exit(1); }
console.log(`Loaded ${table.version}. Point the cycle at it: update cycles set limits_version = '${table.version}' where school_year = '2027-28';`);
