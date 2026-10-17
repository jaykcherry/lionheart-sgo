import type { SupabaseClient } from '@supabase/supabase-js';
import { allocateRound, screen, needIndexOf, normalizePolicy, type AwardPolicy, type Candidate, type AllocationResult } from '@/domain';
import { audit } from '@/lib/audit';

const PAY_ON: Record<string, (year: number) => string> = { fall: (y) => `${y}-08-20`, spring: (y) => `${y + 1}-01-20` };

/** Uncommitted cash in the §25F fund = ledger cash − awards not yet paid. Awards are always cash-backed. */
export async function uncommittedCash(sb: SupabaseClient): Promise<number> {
  const { data: cash } = await sb.from('ledger_postings').select('amount_cents').eq('fund', '25F-TN').eq('account', 'cash');
  const balance = (cash ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
  const { data: terms } = await sb.from('award_terms').select('amount_cents, award_id');
  const { data: sent } = await sb.from('disbursement_lines').select('award_id, term, amount_cents').eq('status', 'SENT');
  const committed = (terms ?? []).reduce((s, t) => s + t.amount_cents, 0) - (sent ?? []).reduce((s, l) => s + l.amount_cents, 0);
  return balance - committed;
}

/** Runs a round with the published seed. Stores the full result for audit; awards are created only on approval. */
export async function runRound(sb: SupabaseClient, opts: { cycleId: string; name: string; seed: string; runBy: string }): Promise<{ roundId: string; result: AllocationResult }> {
  const { data: cycle } = await sb.from('cycles').select('school_year, policy_version, award_policies(params)').eq('id', opts.cycleId).single();
  if (!cycle) throw new Error('cycle not found');
  const policy = normalizePolicy((cycle as unknown as { award_policies: { params: Partial<AwardPolicy> & Record<string, unknown> } }).award_policies.params, cycle.policy_version);
  const year = Number(String(cycle.school_year).slice(0, 4));

  const { data: apps } = await sb.from('applications')
    .select('id, household_id, school_id, grade, priority, state, hold_reason, student_member_id, household:households(street, city, household_members(full_name, dob)), det:eligibility_determinations(result, method, pct_amgi, created_at), aid:other_aid(*)')
    .eq('cycle_id', opts.cycleId).in('state', ['QUEUED', 'WAITLISTED']);
  const { data: tuition } = await sb.from('tuition_schedules').select('school_id, grade, tuition_cents, required_fees_cents').eq('school_year', cycle.school_year);
  const { data: dq } = await sb.from('dq_persons').select('id, full_name, dob, address, role, year').in('year', [year, year - 1]);
  const { data: dqRel } = await sb.from('dq_relatives').select('dq_person_id, full_name, dob, address, relation');

  const candidates: Candidate[] = [];
  for (const raw of apps ?? []) {
    const a = raw as unknown as { id: string; household_id: string; school_id: string; grade: string; priority: 1 | 2 | 3; hold_reason: string | null; student_member_id: string;
      household: { street: string; city: string; household_members: { full_name: string; dob: string | null }[] }; det: { result: string; method: string | null; pct_amgi: number | null; created_at: string }[];
      aid: { efs_cents: number; school_aid_cents: number; other_sgo_cents: number; other_cents: number } | null };
    const det = [...a.det].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
    const t = (tuition ?? []).find((r) => r.school_id === a.school_id && r.grade === a.grade);
    const needIndex = det && det.result === 'ELIGIBLE' ? needIndexOf({ method: det.method, pctAmgi: det.pct_amgi == null ? null : Number(det.pct_amgi) }, policy) : null;
    if (needIndex == null || !t) continue;
    const matches = screen(a.household.household_members.map((m, i) => ({ personId: `${a.id}:${i}`, fullName: m.full_name, dob: m.dob ?? undefined, address: `${a.household.street}` })),
      (dq ?? []).map((d) => ({ personId: d.id, fullName: d.full_name, dob: d.dob ?? undefined, address: d.address ?? undefined, role: d.role, year: d.year })),
      (dqRel ?? []).map((r) => ({ ofPersonId: r.dq_person_id, fullName: r.full_name, dob: r.dob ?? undefined, address: r.address ?? undefined, relation: r.relation })), year)
      .filter((m) => m.strength !== 'possible');
    candidates.push({
      applicationId: a.id, studentId: a.student_member_id, householdId: a.household_id, schoolId: a.school_id, needIndex, priority: a.priority,
      tuition: t.tuition_cents, requiredFees: t.required_fees_cents,
      aid: { efs: a.aid?.efs_cents ?? 0, schoolAid: a.aid?.school_aid_cents ?? 0, otherSgo: a.aid?.other_sgo_cents ?? 0, other: a.aid?.other_cents ?? 0 },
      hold: a.hold_reason ?? (matches.length ? `Possible disqualified person: ${matches[0]!.against}` : undefined),
    });
  }

  // Non-binding school preferences from designated gifts not yet applied to a round
  const { data: prefs } = await sb.from('gifts').select('preferred_school_id, amount_cents').eq('fund', '25F-TN').not('preferred_school_id', 'is', null).in('state', ['RECONCILED', 'ACKNOWLEDGED', 'REPORTED']);
  const pools = new Map<string, number>();
  for (const p of prefs ?? []) pools.set(p.preferred_school_id!, (pools.get(p.preferred_school_id!) ?? 0) + p.amount_cents);
  const cash = await uncommittedCash(sb);
  const prefList = [...pools.entries()].map(([schoolId, amount]) => ({ schoolId, amount: Math.min(amount, cash) }));
  const scale = prefList.reduce((s, p) => s + p.amount, 0) > cash ? cash / prefList.reduce((s, p) => s + p.amount, 0) : 1;

  const result = allocateRound({ roundId: opts.name, seed: opts.seed, cashAvailable: cash, candidates, policy,
    preferencePools: prefList.map((p) => ({ ...p, amount: Math.floor(p.amount * scale) })) });

  const { data: round, error } = await sb.from('award_rounds').insert({ cycle_id: opts.cycleId, name: opts.name, seed: opts.seed, cash_available_cents: cash,
    policy_version: policy.version, result, run_at: new Date().toISOString(), run_by: opts.runBy }).select('id').single();
  if (error || !round) throw new Error(error?.message);
  return { roundId: round.id, result };
}

/** Board approval: creates awards + terms and moves applications. Requires a board user id (checked by caller via RLS/session). */
export async function approveRound(sb: SupabaseClient, roundId: string, boardUserId: string) {
  const { data: round } = await sb.from('award_rounds').select('id, approved_at, result, cycle:cycles(school_year)').eq('id', roundId).single();
  if (!round) throw new Error('round not found');
  if (round.approved_at) throw new Error('round already approved');
  const result = round.result as AllocationResult;
  const year = Number(String((round as unknown as { cycle: { school_year: string } }).cycle.school_year).slice(0, 4));
  const expires = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

  for (const l of result.lines) {
    if (l.outcome === 'AWARDED') {
      const { data: aw, error } = await sb.from('awards').insert({ application_id: l.applicationId, round_id: roundId, tier: l.tier, need_index: l.needIndex, unmet_cents: l.unmet, full_amount_cents: l.fullAmount, amount_cents: l.amount, offer_expires_on: expires }).select('id').single();
      if (error || !aw) throw new Error(error?.message);
      await sb.from('award_terms').insert(l.terms.map((t) => ({ award_id: aw.id, term: t.term, amount_cents: t.amount, pay_on: (PAY_ON[t.term] ?? PAY_ON.fall!)(year) })));
      await sb.rpc('svc_transition_application', { p_app: l.applicationId, p_to: 'AWARDED', p_actor_kind: 'job', p_actor_id: `round:${roundId}` });
    } else if (l.outcome === 'WAITLISTED') {
      await sb.rpc('svc_transition_application', { p_app: l.applicationId, p_to: 'WAITLISTED', p_actor_kind: 'job', p_actor_id: `round:${roundId}` });
    } else if (l.outcome === 'HELD') {
      await sb.rpc('svc_transition_application', { p_app: l.applicationId, p_to: 'HELD', p_actor_kind: 'job', p_actor_id: `round:${roundId}`, p_hold: l.note ?? 'Held' });
    }
  }
  await sb.from('award_rounds').update({ approved_at: new Date().toISOString(), approved_by: boardUserId }).eq('id', roundId);
  await audit(sb, { actorKind: 'person', actorId: boardUserId, action: 'approve_round', entityType: 'award_round', entityId: roundId, after: result.totals });
  return result.totals;
}
