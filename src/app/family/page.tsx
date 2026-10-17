import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, supabaseUser } from '@/lib/supabase';
import { fmtUSD } from '@/domain';
import { acceptAward, attestResidency, confirmExtraction } from './actions';

export const dynamic = 'force-dynamic';
const TRACK = ['SUBMITTED', 'ELIGIBLE', 'AWARDED', 'ACCEPTED', 'SCHOOL_CONFIRMED', 'ACTIVE'];
const LABEL: Record<string, string> = { DRAFT: 'Draft', SUBMITTED: 'Submitted', DOCS_PENDING: 'Documents needed', AUTO_VERIFYING: 'Checking', NEEDS_REVIEW: 'Being reviewed', INELIGIBLE_PROPOSED: 'Being reviewed',
  ELIGIBLE: 'Eligible', QUEUED: 'Eligible · in queue', WAITLISTED: 'Waitlisted', AWARDED: 'Award offered', ACCEPTED: 'Accepted', SCHOOL_CONFIRMED: 'School confirmed', ACTIVE: 'Paid', DENIED: 'Not approved', APPEAL: 'Appeal received', HELD: 'Being reviewed', WITHDRAWN: 'Withdrawn', DECLINED: 'Declined', CLOSED: 'Closed' };

export default async function FamilyPortal({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const householdId = s?.roles.find((r) => r.role === 'family')?.household_id;
  if (!s || !householdId) redirect('/onboarding');
  const sb = await supabaseUser();
  const { data: apps } = await sb.from('applications').select('id, ref, grade, state, student:household_members!applications_student_member_id_fkey(full_name), school:schools(name), awards(amount_cents, full_amount_cents, unmet_cents, tier, offer_expires_on, award_terms(term, amount_cents, pay_on)), eligibility_determinations(result, tier, pct_amgi, reasons, created_at)').eq('household_id', householdId);
  const { data: docs } = await sb.from('documents').select('id, kind, extracted, confirmed_by_parent_at').eq('household_id', householdId).not('extracted', 'is', null);
  const { data: resid } = await sb.from('residency_attestations').select('term').eq('household_id', householdId);
  const needsResidency = (apps ?? []).some((a) => ['ACCEPTED', 'SCHOOL_CONFIRMED', 'ACTIVE'].includes(a.state)) && !(resid ?? []).some((r) => r.term === 'fall');

  type App = { id: string; ref: string; grade: string; state: string; student: { full_name: string }; school: { name: string } | null;
    awards: { amount_cents: number; full_amount_cents: number | null; unmet_cents: number; tier: string; offer_expires_on: string; award_terms: { term: string; amount_cents: number; pay_on: string }[] }[] };
  return (
    <>
      <div className="band band-surface"><div className="wrap portal-head"><div><span className="eyebrow">Family</span><h1 className="h2" style={{ marginTop: 6 }}>Your applications</h1></div>
        <div className="btn-row"><Link className="btn btn-secondary btn-sm" href="/family/apply">Edit or add a child</Link></div></div></div>
      <div className="band"><section className="wrap" style={{ paddingBlock: '40px 84px' }}>
        {sp.submitted && <p className="notice notice-ok" style={{ marginBottom: 20 }}>Application submitted. We’ll email you when we’ve checked your documents, usually within two weeks.</p>}
        {needsResidency && <form action={attestResidency} className="todo stack-s" style={{ marginBottom: 24 }}><input type="hidden" name="term" value="fall" />
          <p className="label">Before the fall payment</p><label className="tick"><input type="checkbox" name="confirm" /><span>We still live at our address in Tennessee.</span></label><div><button className="btn btn-primary btn-sm">Confirm</button></div></form>}
        {(apps ?? []).length === 0 && <p className="body">No applications yet. <Link href="/family/apply">Start one</Link>.</p>}
        <div className="cols-2">{((apps ?? []) as unknown as App[]).map((a) => { const w = a.awards[0]; const at = Math.max(TRACK.indexOf(a.state), ['QUEUED', 'WAITLISTED'].includes(a.state) ? 1 : 0); return (
          <article key={a.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><span className="card-kicker">{a.grade === 'K' ? 'Kindergarten' : `Grade ${a.grade}`} · {a.school?.name ?? 'School not chosen'}</span><h2 style={{ fontSize: 28 }}>{a.student.full_name}</h2></div><span className="pill pill-gilt">{LABEL[a.state] ?? a.state}</span></div>
            <ol className="track">{['Submitted', 'Eligible', 'Awarded', 'Accepted', 'School confirmed', 'Paid'].map((l, i) => <li key={l} data-state={i < at ? 'done' : i === at ? 'current' : 'todo'}><span />{l}</li>)}</ol>
            {w && <div className="paper" style={{ padding: '14px 18px' }}>
              <div className="sumrow" style={{ paddingTop: 0 }}><span>Unmet tuition after other aid</span><span className="tnum">{fmtUSD(w.unmet_cents)}</span></div>
              <div className="sumrow total"><span style={{ fontWeight: 600 }}>Lionheart award</span><span className="v" style={{ fontSize: 34 }}>{fmtUSD(w.amount_cents)}</span></div>
              {w.full_amount_cents != null && w.full_amount_cents > w.amount_cents && <p className="small">Your full award is {fmtUSD(w.full_amount_cents)}. We’ll add the remaining {fmtUSD(w.full_amount_cents - w.amount_cents)} in order as gifts arrive.</p>}
              <p className="small muted">{w.award_terms.map((t) => `${t.term === 'fall' ? 'Fall' : 'Spring'} ${t.pay_on}: ${fmtUSD(t.amount_cents)}`).join(' · ')} · paid to the school</p></div>}
            {a.state === 'AWARDED' && <form action={acceptAward} className="btn-row"><input type="hidden" name="application_id" value={a.id} />
              <button className="btn btn-solid" name="accept" value="yes">Accept award</button><button className="btn btn-ghost" name="accept" value="no">Decline</button>
              {w && <span className="small muted">Respond by {w.offer_expires_on}</span>}</form>}
            <p className="hint">Reference {a.ref}</p>
          </article>); })}</div>
        {(docs ?? []).some((d) => !d.confirmed_by_parent_at) && <section style={{ marginTop: 40 }}><h2 className="h3">Please confirm what we read</h2>
          <div className="tablewrap" style={{ marginTop: 12 }}><table className="table"><tbody>{(docs ?? []).filter((d) => !d.confirmed_by_parent_at).map((d) => { const e = d.extracted as { personName?: string; taxYear?: number; amounts?: Record<string, number | null> }; return (
            <tr key={d.id}><td>{d.kind}</td><td className="small">{e.personName} · {e.taxYear} · {Object.entries(e.amounts ?? {}).filter(([, v]) => v != null).map(([k, v]) => `${k}: $${Number(v).toLocaleString()}`).join(', ')}</td>
              <td><form action={confirmExtraction}><input type="hidden" name="document_id" value={d.id} /><button className="btn btn-secondary btn-sm">Looks right</button></form></td></tr>); })}</tbody></table></div>
          <p className="hint">Something wrong? Upload a clearer copy or email families@lionheartscholars.org.</p></section>}
      </section></div>
    </>
  );
}
