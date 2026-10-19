/**
 * Lottery seeds from a public randomness beacon, so no one at Lionheart picks (or can predict) the tie-breaks.
 *
 * drand "quicknet" (League of Entropy: Cloudflare, Protocol Labs, EPFL, Kudelski and others) publishes a new
 * random value every 3 seconds, signed by a threshold of independent operators. Before each award round we
 * announce the exact beacon round number that will seed it, and freeze the list of applicants before that
 * beacon exists. Anyone can later fetch the same value and re-run the lottery.
 *   https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/<round>
 */
export const DRAND_QUICKNET = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  genesisTime: 1692803367,   // unix seconds
  period: 3,                 // seconds
  relays: ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com'],
} as const;

/** The first beacon round published at or after the given time. */
export function beaconRoundAt(iso: string, c = DRAND_QUICKNET): number {
  const t = Math.floor(new Date(iso).getTime() / 1000);
  return Math.max(1, Math.ceil((t - c.genesisTime) / c.period) + 1);
}
export function beaconTimeOf(round: number, c = DRAND_QUICKNET): string {
  return new Date((c.genesisTime + (round - 1) * c.period) * 1000).toISOString();
}
export const beaconUrl = (round: number, relay: string = DRAND_QUICKNET.relays[0], c = DRAND_QUICKNET) => `${relay}/${c.chainHash}/public/${round}`;

/** The seed the allocation engine uses. Contains the round so the result can be reproduced from the public record. */
export const seedFromBeacon = (round: number, randomness: string) => `drand-quicknet:${round}:${randomness.toLowerCase()}`;

/**
 * Award rounds for a school year starting in `year` (e.g. 2027 for 2027–28), in Central time.
 * Announced 14 days ahead; applicants frozen 1 hour before the beacon; run right after it.
 */
export interface RoundPlan { name: string; runAt: string; announceAt: string; freezeAt: string; beaconRound: number }
export function roundPlan(year: number, slots: { name: string; date: string }[] = [
  { name: `${year}-R1`, date: `${year}-04-15` }, { name: `${year}-R2`, date: `${year}-07-15` }, { name: `${year}-R3`, date: `${year}-12-01` },
]): RoundPlan[] {
  return slots.map(({ name, date }) => {
    const runAt = new Date(`${date}T15:00:00Z`).toISOString();   // 10:00 a.m. Central (CDT) / 9:00 (CST)
    const at = (h: number) => new Date(new Date(runAt).getTime() + h * 3_600_000).toISOString();
    return { name, runAt, announceAt: at(-14 * 24), freezeAt: at(-1), beaconRound: beaconRoundAt(runAt) };
  });
}
