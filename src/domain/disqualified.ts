import type { Cents } from './money';

/**
 * Disqualified persons (prop. Treas. Reg. §1.25F-3(d)): officers, directors, trustees, anyone who
 * participates in selecting recipients (incl. committee members), substantial contributors, and
 * their family members. No scholarship may go to a disqualified person.
 *
 * Substantial contributor: > $5,000 to the segregated account in the taxable year AND > 2% of
 * that account's total contributions for the year; spouses aggregated; status covers that year
 * and the next.
 */

export type DqRole = 'officer' | 'director' | 'trustee' | 'selection_participant' | 'substantial_contributor';
export interface DqPerson { personId: string; fullName: string; dob?: string; address?: string; role: DqRole; year: number }
export interface DqRelative { ofPersonId: string; fullName: string; dob?: string; address?: string; relation: string }

/** §4946(d)-style family plus siblings (conservative; set includeSiblings=false to narrow). */
export const FAMILY_RELATIONS = ['spouse', 'parent', 'grandparent', 'child', 'grandchild', 'great_grandchild',
  'child_spouse', 'grandchild_spouse', 'great_grandchild_spouse', 'sibling'] as const;

export const SUBSTANTIAL_THRESHOLD: Cents = 500_000;
export const SUBSTANTIAL_SHARE = 0.02;

export interface ContributionTotal { householdKey: string; personIds: string[]; amount: Cents }

/** Returns household keys that are substantial contributors for `year` (and therefore also year+1). */
export function substantialContributors(totals: ContributionTotal[]): string[] {
  const all = totals.reduce((a, t) => a + t.amount, 0);
  return totals.filter((t) => t.amount > SUBSTANTIAL_THRESHOLD && t.amount > all * SUBSTANTIAL_SHARE).map((t) => t.householdKey);
}

export const normName = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
export const normAddr = (s: string) => s.toLowerCase().replace(/[.,#]/g, ' ')
  .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\broad\b/g, 'rd').replace(/\bdrive\b/g, 'dr')
  .replace(/\blane\b/g, 'ln').replace(/\bcourt\b/g, 'ct').replace(/\bapartment\b|\bapt\b|\bunit\b/g, '#').replace(/\s+/g, ' ').trim();
const lastName = (s: string) => normName(s).split(' ').pop() ?? '';

export interface Screenee { personId: string; fullName: string; dob?: string; address?: string }
export interface DqMatch { screeneeId: string; against: string; reason: string; strength: 'exact' | 'strong' | 'possible' }

/**
 * Screens applicants (students and adult household members) against the DQ registry.
 * Any match → award/payment HOLD. Never auto-denies; a board-designated person reviews.
 */
export function screen(people: Screenee[], registry: DqPerson[], relatives: DqRelative[], forYear: number): DqMatch[] {
  const active = registry.filter((p) => p.year === forYear || (p.role === 'substantial_contributor' && p.year === forYear - 1));
  const targets = [
    ...active.map((p) => ({ label: `${p.fullName} (${p.role.replace('_', ' ')})`, fullName: p.fullName, dob: p.dob, address: p.address })),
    ...relatives.filter((r) => active.some((p) => p.personId === r.ofPersonId))
      .map((r) => ({ label: `${r.fullName} (${r.relation} of DQ person)`, fullName: r.fullName, dob: r.dob, address: r.address })),
  ];
  const out: DqMatch[] = [];
  for (const s of people) {
    for (const t of targets) {
      const sameName = normName(s.fullName) === normName(t.fullName);
      const sameDob = !!s.dob && s.dob === t.dob;
      const sameAddr = !!s.address && !!t.address && normAddr(s.address) === normAddr(t.address);
      const sameLast = lastName(s.fullName) === lastName(t.fullName);
      if (sameName && sameDob) out.push({ screeneeId: s.personId, against: t.label, reason: 'Name and date of birth match', strength: 'exact' });
      else if (sameName && sameAddr) out.push({ screeneeId: s.personId, against: t.label, reason: 'Name and address match', strength: 'exact' });
      else if (sameAddr) out.push({ screeneeId: s.personId, against: t.label, reason: 'Lives at the same address', strength: 'strong' });
      else if (sameName) out.push({ screeneeId: s.personId, against: t.label, reason: 'Same full name', strength: 'possible' });
      else if (sameLast && sameDob) out.push({ screeneeId: s.personId, against: t.label, reason: 'Same surname and date of birth', strength: 'possible' });
    }
  }
  return out;
}
