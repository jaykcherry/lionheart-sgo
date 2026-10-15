import type { Cents } from './money';
import { dollars } from './money';

/**
 * Income limits: 300% of area median gross income (AMGI), adjusted for household size
 * the HUD Section 8 way (prop. Treas. Reg. §1.25F-1(a); §25F(c)(2)(A)).
 *
 * Until the IRS publishes §25F limit tables in the Internal Revenue Bulletin, we use HUD's
 * median family income by HUD Metro FMR Area / county. Every determination stores the
 * `limitsVersion` it used so it can be re-run when official tables appear.
 */

export const HUD_SIZE_MULTIPLIER: Record<number, number> = {
  1: 0.7, 2: 0.8, 3: 0.9, 4: 1.0, 5: 1.08, 6: 1.16, 7: 1.24, 8: 1.32,
};

export function sizeMultiplier(householdSize: number): number {
  if (!Number.isInteger(householdSize) || householdSize < 1) throw new Error(`invalid household size ${householdSize}`);
  if (householdSize <= 8) return HUD_SIZE_MULTIPLIER[householdSize]!;
  return 1.32 + 0.08 * (householdSize - 8);
}

export interface AmgiArea {
  code: string;            // e.g. 'METRO34980M34980'
  name: string;
  medianIncome: Cents;     // median family income for a 4-person household
  fiscalYear: number;
  source: string;
}

export interface LimitsTable {
  version: string;                       // e.g. 'HUD-FY2026-v1'
  areas: Record<string, AmgiArea>;
  countyToArea: Record<string, string>;  // lowercase county name (no "county") → area code
  fallbackAreaCode: string;              // used only to *screen*, never to deny
}

/** Seed table. Load the full 95-county HUD FY2026 file with scripts/load-hud-limits.ts. */
export const TN_LIMITS_SEED: LimitsTable = {
  version: 'HUD-FY2026-seed',
  areas: {
    METRO34980M34980: {
      code: 'METRO34980M34980',
      name: 'Nashville-Davidson–Murfreesboro–Franklin, TN HUD Metro FMR Area',
      medianIncome: dollars(116_100),
      fiscalYear: 2026,
      source: 'HUD FY2026 Income Limits (huduser.gov)',
    },
    TN_STATEWIDE: {
      code: 'TN_STATEWIDE',
      name: 'Tennessee statewide (screening reference only)',
      medianIncome: dollars(92_300),
      fiscalYear: 2025,
      source: 'THDA 2025 statewide median family income',
    },
  },
  countyToArea: Object.fromEntries(
    ['cannon', 'cheatham', 'davidson', 'dickson', 'hickman', 'macon', 'robertson', 'rutherford', 'smith', 'sumner', 'trousdale', 'williamson', 'wilson']
      .map((c) => [c, 'METRO34980M34980']),
  ),
  fallbackAreaCode: 'TN_STATEWIDE',
};

export function normalizeCounty(county: string): string {
  return county.trim().toLowerCase().replace(/\s+county$/, '').replace(/[^a-z\s]/g, '').trim();
}

export interface ResolvedLimit {
  area: AmgiArea;
  multiplier: number;
  limit: Cents;          // 300% × AMGI × multiplier
  amgiAdjusted: Cents;   // 100% × AMGI × multiplier (used for need tiers)
  isFallback: boolean;
  limitsVersion: string;
}

export function resolveLimit(table: LimitsTable, county: string, householdSize: number): ResolvedLimit {
  const code = table.countyToArea[normalizeCounty(county)];
  const isFallback = !code;
  const area = table.areas[code ?? table.fallbackAreaCode];
  if (!area) throw new Error(`limits table ${table.version} has no area for county "${county}"`);
  const multiplier = sizeMultiplier(householdSize);
  const amgiAdjusted = Math.round(area.medianIncome * multiplier);
  return { area, multiplier, amgiAdjusted, limit: amgiAdjusted * 3, isFallback, limitsVersion: table.version };
}
