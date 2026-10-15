import type { SupabaseClient } from '@supabase/supabase-js';
import { determineEligibility, type EligibilityInput, type LimitsTable, type IncomeItem } from '@/domain';
import { openTicket } from '@/lib/audit';

export const ENGINE_VERSION = 'eligibility@1.0.0';

const ageOn = (dob: string | null, on: string) => {
  if (!dob) return 30;
  const d = new Date(dob), o = new Date(on);
  return o.getFullYear() - d.getFullYear() - (o < new Date(o.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

/**
 * AUTO_VERIFYING → ELIGIBLE | NEEDS_REVIEW | INELIGIBLE_PROPOSED.
 * Pure engine decides; this service only loads data, stores the determination, and opens a review ticket.
 * It never moves an application to DENIED (the database forbids it for non-persons anyway).
 */
export async function verifyApplication(sb: SupabaseClient, applicationId: string) {
  const { data: app, error } = await sb.from('applications')
    .select('id, state, grade, submitted_at, household:households(id, county, state, residency_exception), student:household_members!applications_student_member_id_fkey(id, dob), cycle:cycles(limits_version)')
    .eq('id', applicationId).single();
  if (error || !app) throw new Error(`application ${applicationId} not found: ${error?.message}`);
  const a = app as unknown as {
    id: string; state: string; grade: string; submitted_at: string;
    household: { id: string; county: string; state: string; residency_exception: 'military_dependent' | 'indian_lands' | null };
    student: { id: string; dob: string | null }; cycle: { limits_version: string };
  };
  const date = (a.submitted_at ?? new Date().toISOString()).slice(0, 10);

  const [{ data: members }, { data: income }, { data: cat }, { data: proof }, { data: limits }] = await Promise.all([
    sb.from('household_members').select('id, relationship, dob, zero_income_attested').eq('household_id', a.household.id),
    sb.from('income_items').select('member_id, type, amount_cents, year, cash, source').eq('application_id', a.id),
    sb.from('categorical_proofs').select('program, letter_date, name_matches').eq('application_id', a.id).maybeSingle(),
    sb.from('documents').select('id').eq('household_id', a.household.id).eq('kind', 'proof_of_address').limit(1),
    sb.from('limits_tables').select('data').eq('version', a.cycle.limits_version).single(),
  ]);
  if (!limits) throw new Error(`limits table ${a.cycle.limits_version} missing`);

  const input: EligibilityInput = {
    applicationDate: date, county: a.household.county ?? '', state: a.household.state, residencyException: a.household.residency_exception ?? undefined,
    residencyProof: proof && proof.length ? 'utility' : undefined,
    household: (members ?? []).map((m) => ({ personId: m.id, relationship: m.relationship, age: ageOn(m.dob, date) })),
    incomeItems: (income ?? []).map((i) => ({ personId: i.member_id, type: i.type, amount: i.amount_cents, year: i.year, cash: i.cash, source: i.source }) as IncomeItem),
    zeroIncomeAttested: (members ?? []).filter((m) => m.zero_income_attested).map((m) => m.id),
    categorical: cat ? { program: cat.program, letterDate: cat.letter_date, nameMatchesHousehold: cat.name_matches } : undefined,
    student: { grade: a.grade, age: ageOn(a.student.dob, date) },
  };
  const det = determineEligibility(input, limits.data as LimitsTable);

  const { error: insErr } = await sb.from('eligibility_determinations').insert({
    application_id: a.id, result: det.result, method: det.method, household_size: det.householdSize, income_total_cents: det.incomeTotal,
    pct_amgi: det.pctAmgi, tier: det.tier, limits_version: det.limitsVersion, reasons: det.reasons, review_flags: det.reviewFlags, engine_version: ENGINE_VERSION,
  });
  if (insErr) throw new Error(insErr.message);

  await sb.rpc('svc_transition_application', { p_app: a.id, p_to: det.result, p_actor_kind: 'job', p_actor_id: ENGINE_VERSION });
  if (det.result === 'ELIGIBLE') await sb.rpc('svc_transition_application', { p_app: a.id, p_to: 'QUEUED', p_actor_kind: 'job', p_actor_id: ENGINE_VERSION });
  else await openTicket(sb, { kind: 'eligibility_review', entityType: 'application', entityId: a.id, severity: 'warn',
    recommendation: [...det.reasons, ...det.reviewFlags].join(' ') });
  return det;
}
