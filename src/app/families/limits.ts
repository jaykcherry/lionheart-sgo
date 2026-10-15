import { resolveLimit, TN_LIMITS_SEED } from '@/domain';

/** Dollars, Nashville HUD Metro FMR Area (FY2026), 300% of AMGI by household size. */
export const incomeLimit = (size: number) => resolveLimit(TN_LIMITS_SEED, 'Davidson', size).limit / 100;
