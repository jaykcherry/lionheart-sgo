import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, supabaseUser } from '@/lib/supabase';
import { saveHousehold, addMember, chooseSchools, saveIncome, uploadDocument, submitApplications } from '../actions';

export const dynamic = 'force-dynamic';
const STEPS = ['Home', 'Household', 'Children & schools', 'Income', 'Documents', 'Review'];
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default async function Apply({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; uploaded?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const householdId = s?.roles.find((r) => r.role === 'family')?.household_id;
  if (!s || !householdId) redirect('/onboarding');
  const step = Math.min(Math.max(Number(sp.step ?? 1), 1), 6);
  const sb = await supabaseUser();
  const [{ data: h }, { data: members }, { data: schools }, { data: apps }, { data: docs }] = await Promise.all([
    sb.from('households').select('*').eq('id', householdId).single(),
    sb.from('household_members').select('*').eq('household_id', householdId).order('created_at'),
    sb.from('schools').select('id, name, city, state').order('name'),
    sb.from('applications').select('id, student_member_id, school_id, grade, state, other_aid(efs_cents, school_aid_cents)').eq('household_id', householdId),
    sb.from('documents').select('id, kind, extracted, created_at').eq('household_id', householdId).order('created_at', { ascending: false }),
  ]);
  const students = (members ?? []).filter((m) => m.is_student);
  const adults = (members ?? []).filter((m) => !m.is_student);

  return (
    <div className="band"><section className="wrap" style={{ paddingBlock: '48px 84px' }}>
      <Link href="/family" className="small">← Family portal</Link>
      <h1 className="h2" style={{ margin: '14px 0 24px' }}>Scholarship application</h1>
      <ol className="stepper">{STEPS.map((l, i) => <li key={l} data-state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}><Link href={`?step=${i + 1}`} style={{ color: 'inherit', textDecoration: 'none' }}><span className="n">{i + 1 < step ? '✓' : i + 1}</span> {l}</Link></li>)}</ol>
      {sp.error && <p className="errbox" role="alert" style={{ marginBottom: 20 }}>{sp.error}</p>}
      <div className="wrap-narrow" style={{ margin: 0 }}>
        {step === 1 && <form action={saveHousehold} className="flow-body">
          <div><h2 className="h3">Where does your child live?</h2><p className="body">Scholarships go to students who live in Tennessee. Your county sets your income limit.</p></div>
          <div className="form-grid">
            <div className="field span-all"><label htmlFor="street">Street address</label><input className="input" id="street" name="street" defaultValue={h?.street ?? ''} required autoComplete="street-address" /></div>
            <div className="field"><label htmlFor="city">City</label><input className="input" id="city" name="city" defaultValue={h?.city ?? ''} required /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input className="input" id="zip" name="zip" defaultValue={h?.zip ?? ''} required inputMode="numeric" /></div>
            <div className="field"><label htmlFor="county">County</label><input className="input" id="county" name="county" defaultValue={h?.county ?? ''} required placeholder="e.g. Davidson" /></div>
            <div className="field"><label htmlFor="exception">Special residency situation</label><select className="input" id="exception" name="exception" defaultValue={h?.residency_exception ?? ''}><option value="">None</option><option value="military_dependent">Military family</option><option value="indian_lands">Living on Tribal lands</option></select></div>
          </div>
          <div className="form-actions"><span /><button className="btn btn-solid">Continue</button></div>
        </form>}

        {step === 2 && <div className="flow-body">
          <div><h2 className="h3">Who lives in your home?</h2><p className="body">List everyone who lives with your child, including grandparents or other adults. Mark each child applying for a scholarship.</p></div>
          <div className="tablewrap"><table className="table"><tbody>{(members ?? []).map((m) => <tr key={m.id}><td>{m.full_name}</td><td>{m.relationship}</td><td>{m.is_student ? <span className="pill pill-gilt">Applying</span> : ''}</td></tr>)}</tbody></table></div>
          <form action={addMember} className="form-grid paper" style={{ padding: 20 }}>
            <div className="field"><label htmlFor="full_name">Full name</label><input className="input" id="full_name" name="full_name" required /></div>
            <div className="field"><label htmlFor="relationship">Relationship to you</label><select className="input" id="relationship" name="relationship">{['self', 'spouse', 'partner', 'child', 'parent', 'other_relative', 'other'].map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></div>
            <div className="field"><label htmlFor="dob">Date of birth</label><input className="input" id="dob" name="dob" type="date" /></div>
            <label className="tick" style={{ alignSelf: 'end' }}><input type="checkbox" name="is_student" /><span>Applying for a scholarship</span></label>
            <div className="span-all"><button className="btn btn-secondary">Add person</button></div>
          </form>
          <div className="form-actions"><Link className="btn btn-secondary" href="?step=1">Back</Link><Link className="btn btn-solid" href="?step=3">Continue</Link></div>
        </div>}

        {step === 3 && <form action={chooseSchools} className="flow-body">
          <div><h2 className="h3">Schools for 2027–28</h2><p className="body">Tell us about other aid so we can fund what’s left. Tennessee EFS pays first.</p></div>
          {students.length === 0 && <p className="note">Add at least one child marked “Applying” in the previous step.</p>}
          {students.map((k) => { const a = apps?.find((x) => x.student_member_id === k.id); const aid = (a?.other_aid as unknown as { efs_cents: number; school_aid_cents: number } | null); return (
            <fieldset key={k.id} className="paper" style={{ padding: 20, margin: 0 }}><legend className="label" style={{ padding: '0 6px' }}>{k.full_name}</legend>
              <div className="form-grid">
                <div className="field span-all"><label htmlFor={`school_${k.id}`}>School</label><select className="input" id={`school_${k.id}`} name={`school_${k.id}`} defaultValue={a?.school_id ?? ''} required><option value="">Choose a school</option>{(schools ?? []).map((sc) => <option key={sc.id} value={sc.id}>{sc.name} · {sc.city}{sc.state === 'ACTIVE' ? ' (partner)' : ''}</option>)}</select></div>
                <div className="field"><label htmlFor={`grade_${k.id}`}>Grade in 2027–28</label><select className="input" id={`grade_${k.id}`} name={`grade_${k.id}`} defaultValue={a?.grade ?? ''} required><option value="">Choose</option>{GRADES.map((g) => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}</select></div>
                <div className="field"><label htmlFor={`efs_${k.id}`}>Tennessee EFS award ($)</label><input className="input" id={`efs_${k.id}`} name={`efs_${k.id}`} inputMode="decimal" defaultValue={aid ? aid.efs_cents / 100 : ''} placeholder="0" /></div>
                <div className="field"><label htmlFor={`aid_${k.id}`}>School financial aid ($)</label><input className="input" id={`aid_${k.id}`} name={`aid_${k.id}`} inputMode="decimal" defaultValue={aid ? aid.school_aid_cents / 100 : ''} placeholder="0" /></div>
              </div></fieldset>); })}
          <div className="form-actions"><Link className="btn btn-secondary" href="?step=2">Back</Link><button className="btn btn-solid">Continue</button></div>
        </form>}

        {step === 4 && <form action={saveIncome} className="flow-body">
          <div><h2 className="h3">Last year’s income</h2><p className="body">Enter each adult’s cash income for {new Date().getFullYear() - 1}: wages, self-employment, Social Security, child support. You’ll upload documents next. If someone in your home receives SNAP, TANF, WIC, Section 8 or SSI, you can use that letter instead.</p></div>
          <div className="form-grid">{adults.map((m) => <div key={m.id} className="field"><label htmlFor={`income_${m.id}`}>{m.full_name}</label><input className="input" id={`income_${m.id}`} name={`income_${m.id}`} inputMode="decimal" placeholder="$" />
            <label className="tick" style={{ fontSize: 13 }}><input type="checkbox" name={`zero_${m.id}`} defaultChecked={m.zero_income_attested} /><span>No income last year</span></label></div>)}</div>
          <fieldset className="paper" style={{ padding: 20, margin: 0 }}><legend className="label" style={{ padding: '0 6px' }}>Or: benefit letter (optional)</legend>
            <div className="form-grid"><div className="field"><label htmlFor="program">Program</label><select className="input" id="program" name="program" defaultValue=""><option value="">None</option><option value="SNAP">SNAP</option><option value="TANF">TANF (Families First)</option><option value="WIC">WIC</option><option value="SECTION8">Section 8 housing</option><option value="SSI">SSI</option></select></div>
              <div className="field"><label htmlFor="letter_date">Date on the letter</label><input className="input" id="letter_date" name="letter_date" type="date" /></div></div>
            <p className="hint">Letters must be dated within the last 12 months. TennCare and free school lunch don’t qualify on their own under federal rules.</p></fieldset>
          <div className="form-actions"><Link className="btn btn-secondary" href="?step=3">Back</Link><button className="btn btn-solid">Continue</button></div>
        </form>}

        {step === 5 && <div className="flow-body">
          <div><h2 className="h3">Upload documents</h2><p className="body">Last year’s W-2s or Form 1040, any benefit letter, and one proof of your Tennessee address. We read them automatically and show you what we found to confirm. Social Security numbers are never stored in our records.</p></div>
          {sp.uploaded && <p className="notice notice-ok">Uploaded. We’ll show what we read on your portal in a minute or two.</p>}
          <form action={uploadDocument} className="form-grid paper" style={{ padding: 20 }}>
            <div className="field"><label htmlFor="kind">Document type</label><select className="input" id="kind" name="kind">{[['w2', 'W-2'], ['1040', 'Form 1040'], ['paystub', 'Pay stub'], ['benefit_letter', 'Benefit letter'], ['proof_of_address', 'Proof of address'], ['other', 'Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="file">File (PDF or photo)</label><input className="input" id="file" name="file" type="file" accept=".pdf,image/*" required style={{ padding: 8 }} /></div>
            <div className="span-all"><button className="btn btn-secondary">Upload</button></div>
          </form>
          <div className="tablewrap"><table className="table"><tbody>{(docs ?? []).map((d) => <tr key={d.id}><td>{d.kind}</td><td className="small muted">{new Date(d.created_at).toLocaleDateString()}</td><td>{d.extracted ? <span className="pill pill-ok">Read</span> : <span className="pill pill-neutral">Reading…</span>}</td></tr>)}</tbody></table></div>
          <div className="form-actions"><Link className="btn btn-secondary" href="?step=4">Back</Link><Link className="btn btn-solid" href="?step=6">Continue</Link></div>
        </div>}

        {step === 6 && <form action={submitApplications} className="flow-body">
          <div><h2 className="h3">Review and submit</h2><p className="body">{students.length} child{students.length === 1 ? '' : 'ren'} · {members?.length ?? 0} people in the household · {docs?.length ?? 0} document(s) · {h?.county ?? '—'} County</p></div>
          <div className="stack-s">
            <label className="tick"><input type="checkbox" name="attest_true" /><span>The information I gave is true and complete to the best of my knowledge.</span></label>
            <label className="tick"><input type="checkbox" name="attest_verify" /><span>Lionheart may verify my income and residence, and I’ll provide documents if asked.</span></label>
            <label className="tick"><input type="checkbox" name="attest_nodirect" /><span>I understand awards depend on available funds and no donor can direct a scholarship to my child. No one in my household serves on Lionheart’s board or selection committee, or I have told Lionheart.</span></label>
          </div>
          <div className="form-actions"><Link className="btn btn-secondary" href="?step=5">Back</Link><button className="btn btn-solid">Submit application</button></div>
        </form>}
      </div>
    </section></div>
  );
}
