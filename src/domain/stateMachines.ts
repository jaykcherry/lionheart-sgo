/**
 * Case state machines. The database stores the current state; every change goes through
 * `transition()` so illegal jumps (e.g. paying an award the school never confirmed) are impossible.
 * `actor` records who/what moved it: a person, a job, or an agent. Agents may not perform
 * transitions marked humanOnly.
 */

export type Actor = { kind: 'person' | 'job' | 'agent'; id: string; role?: 'family' | 'school' | 'donor' | 'staff' | 'board' };

interface Edge<S extends string> { from: S | S[]; to: S; humanOnly?: boolean; roles?: Actor['role'][] }

function machine<S extends string>(name: string, edges: Edge<S>[]) {
  const allowed = new Map<string, Edge<S>>();
  for (const e of edges) for (const f of Array.isArray(e.from) ? e.from : [e.from]) allowed.set(`${f}>${e.to}`, e);
  return {
    name,
    can(from: S, to: S, actor: Actor): { ok: boolean; reason?: string } {
      const e = allowed.get(`${from}>${to}`);
      if (!e) return { ok: false, reason: `${name}: ${from} → ${to} is not a legal transition` };
      if (e.humanOnly && actor.kind !== 'person') return { ok: false, reason: `${name}: ${from} → ${to} requires a person (actor is ${actor.kind})` };
      if (e.roles && actor.kind === 'person' && !e.roles.includes(actor.role)) return { ok: false, reason: `${name}: ${from} → ${to} not allowed for role ${actor.role}` };
      return { ok: true };
    },
    transition(from: S, to: S, actor: Actor): S {
      const r = this.can(from, to, actor);
      if (!r.ok) throw new Error(r.reason);
      return to;
    },
    next(from: S): S[] { return edges.filter((e) => (Array.isArray(e.from) ? e.from : [e.from]).includes(from)).map((e) => e.to); },
  };
}

export type ApplicationState = 'DRAFT' | 'SUBMITTED' | 'DOCS_PENDING' | 'AUTO_VERIFYING' | 'NEEDS_REVIEW' | 'INELIGIBLE_PROPOSED'
  | 'ELIGIBLE' | 'DENIED' | 'APPEAL' | 'QUEUED' | 'WAITLISTED' | 'AWARDED' | 'ACCEPTED' | 'DECLINED' | 'SCHOOL_CONFIRMED'
  | 'ACTIVE' | 'WITHDRAWN' | 'CLOSED' | 'HELD';

export const applicationMachine = machine<ApplicationState>('application', [
  { from: 'DRAFT', to: 'SUBMITTED', roles: ['family'] },
  { from: 'SUBMITTED', to: 'DOCS_PENDING' },
  { from: ['SUBMITTED', 'DOCS_PENDING'], to: 'AUTO_VERIFYING' },
  { from: 'AUTO_VERIFYING', to: 'ELIGIBLE' },
  { from: 'AUTO_VERIFYING', to: 'NEEDS_REVIEW' },
  { from: 'AUTO_VERIFYING', to: 'INELIGIBLE_PROPOSED' },
  { from: 'AUTO_VERIFYING', to: 'DOCS_PENDING' },
  { from: 'NEEDS_REVIEW', to: 'ELIGIBLE', humanOnly: true, roles: ['staff', 'board'] },
  { from: 'NEEDS_REVIEW', to: 'DOCS_PENDING' },
  { from: ['NEEDS_REVIEW', 'INELIGIBLE_PROPOSED'], to: 'DENIED', humanOnly: true, roles: ['staff', 'board'] },
  { from: 'INELIGIBLE_PROPOSED', to: 'ELIGIBLE', humanOnly: true, roles: ['staff', 'board'] },
  { from: 'DENIED', to: 'APPEAL', roles: ['family'] },
  { from: 'APPEAL', to: 'ELIGIBLE', humanOnly: true, roles: ['board'] },
  { from: 'APPEAL', to: 'CLOSED', humanOnly: true, roles: ['board'] },
  { from: 'ELIGIBLE', to: 'QUEUED' },
  { from: 'QUEUED', to: 'AWARDED' },
  { from: 'QUEUED', to: 'WAITLISTED' },
  { from: 'WAITLISTED', to: 'AWARDED' },
  { from: ['QUEUED', 'WAITLISTED', 'AWARDED', 'ACTIVE'], to: 'HELD' },
  { from: 'HELD', to: 'QUEUED', humanOnly: true, roles: ['staff', 'board'] },
  { from: 'HELD', to: 'DENIED', humanOnly: true, roles: ['board'] },
  { from: 'AWARDED', to: 'ACCEPTED', roles: ['family'] },
  { from: 'AWARDED', to: 'DECLINED', roles: ['family'] },
  { from: 'AWARDED', to: 'WAITLISTED' }, // offer expired
  { from: 'ACCEPTED', to: 'SCHOOL_CONFIRMED', roles: ['school'] },
  { from: 'SCHOOL_CONFIRMED', to: 'ACTIVE' },
  { from: 'ACTIVE', to: 'WITHDRAWN' },
  { from: ['ACTIVE', 'WITHDRAWN', 'DECLINED'], to: 'CLOSED' },
]);

export type GiftState = 'PLEDGED' | 'DESIGNATION_RECONFIRMED' | 'CHARGED' | 'FAILED' | 'SETTLED' | 'DEPOSITED' | 'RECONCILED'
  | 'ACKNOWLEDGED' | 'REPORTED' | 'CHARGEBACK' | 'CANCELLED';
export const giftMachine = machine<GiftState>('gift', [
  { from: 'PLEDGED', to: 'DESIGNATION_RECONFIRMED' },
  { from: 'PLEDGED', to: 'CANCELLED', roles: ['donor', 'staff'] },
  { from: ['PLEDGED', 'DESIGNATION_RECONFIRMED'], to: 'CHARGED' },
  { from: 'CHARGED', to: 'FAILED' },
  { from: 'FAILED', to: 'CHARGED' },
  { from: 'CHARGED', to: 'SETTLED' },
  { from: 'SETTLED', to: 'DEPOSITED' },
  { from: 'DEPOSITED', to: 'RECONCILED' },
  { from: 'RECONCILED', to: 'ACKNOWLEDGED' },
  { from: 'ACKNOWLEDGED', to: 'REPORTED' },
  { from: ['SETTLED', 'DEPOSITED', 'RECONCILED', 'ACKNOWLEDGED', 'REPORTED'], to: 'CHARGEBACK' },
]);

export type SchoolState = 'UNCLAIMED' | 'CLAIM_PENDING' | 'DOMAIN_VERIFIED' | 'AGREEMENT_SIGNED' | 'PAYEE_VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export const schoolMachine = machine<SchoolState>('school', [
  { from: 'UNCLAIMED', to: 'CLAIM_PENDING', roles: ['school'] },
  { from: 'CLAIM_PENDING', to: 'DOMAIN_VERIFIED' },
  { from: 'CLAIM_PENDING', to: 'UNCLAIMED' },
  { from: 'DOMAIN_VERIFIED', to: 'AGREEMENT_SIGNED', roles: ['school'] },
  { from: 'AGREEMENT_SIGNED', to: 'PAYEE_VERIFIED' },
  { from: 'PAYEE_VERIFIED', to: 'ACTIVE' },
  { from: ['ACTIVE', 'PAYEE_VERIFIED'], to: 'SUSPENDED', humanOnly: true, roles: ['board', 'staff'] },
  { from: 'SUSPENDED', to: 'ACTIVE', humanOnly: true, roles: ['board'] },
  { from: ['ACTIVE', 'SUSPENDED'], to: 'ENDED', humanOnly: true },
]);

export type BatchState = 'DRAFT' | 'PREPARED' | 'APPROVED_1' | 'APPROVED_2' | 'SENT' | 'SETTLED' | 'RETURNED';
export const batchMachine = machine<BatchState>('disbursement_batch', [
  { from: 'DRAFT', to: 'PREPARED' },
  { from: 'PREPARED', to: 'APPROVED_1', humanOnly: true, roles: ['staff', 'board'] },
  { from: 'APPROVED_1', to: 'APPROVED_2', humanOnly: true, roles: ['board'] },
  { from: 'APPROVED_2', to: 'SENT' },
  { from: 'SENT', to: 'SETTLED' },
  { from: 'SENT', to: 'RETURNED' },
]);
