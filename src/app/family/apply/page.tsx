import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, supabaseUser } from '@/lib/supabase';
import { saveHousehold, addMember, chooseSchools, saveIncome, uploadDocument, submitApplications, signIrsConsent } from '../actions';
import { CONSENT_4506C_TEXT } from '../irsConsent';

export const dynamic = 'force-dynamic';
const STEPS = ['Home', 'Household', 'Children & schools', 'Income', 'Verify income', 'Review'];
const IRS_STATE: Record<string, [string, string]> = { REQUESTED: ['Waiting for the IRS', 'pill-neutral'], RECEIVED: ['Verified by the IRS', 'pill-ok'], NO_RECORD: ['IRS has no return on file yet', 'pill-gilt'], REJECTED: ['IRS could not match', 'pill-gilt'], ERROR: ['Retrying', 'pill-neutral'] };
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default async function Apply({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; uploaded?: string; school?: string; irs?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const householdId = s?.roles.find((r) => r.role === 'family')?.household_id;
  if (!s || !householdId) redirect('/onboarding' + (sp.school ? `?school=${encodeURIComponent(sp.school)}` : ''));
  const step = Math.min(Math.max(Number(sp.step ?? 1), 1), 6);
  const sb = await supabaseUser();
  const [{ data: h }, { data: members }, { data: schools }, { data: apps }, { data: docs }] = await Promise.all([
    sb.from('households').select('*').eq('id', householdId).single(),
    sb.from('household_members').select('*').eq('household_id', householdId).order('created_at'),
    sb.from('schools').select('id, slug, name, city, state').order('name'),
    sb.from('applications').select('id, student_member_id, school_id, grade, state, other_aid(efs_cents, school_aid_cents)').eq('household_id', householdId),
    sb.from('documents').select('id, kind, extracted, created_at').eq('household_id', householdId).order('created_at', { ascending: false }),
  ]);
  const { data: irs } = await sb.from('irs_transcript_requests').select('id, state, requested_at, consent:irs_consents(tax_year, name_on_return, ssn_last4)').eq('household_id', householdId).order('requested_at', { ascending: false });
  const irsOn = (process.env.TRANSCRIPT_PROVIDER ?? 'none') !== 'none';
  const taxYear = new Date().getFullYear() - 1;
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
                <div className="field span-all"><label htmlFor={`school_${k.id}`}>School</label><select className="input" id={`school_${k.id}`} name={`school_${k.id}`} defaultValue={a?.school_id ?? (schools ?? []).find((x) => x.slug === sp.school)?.id ?? ''} required><option value="">Choose a school</option>{(schools ?? []).map((sc) => <option key={sc.id} value={sc.id}>{sc.name} · {sc.city}{sc.state === 'ACTIVE' ? ' (partner)' : ''}</option>)}</select></div>
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
          {irsOn && <>
            <div><h2 className="h3">Let the IRS confirm your income</h2><p className="body">The fastest way: sign IRS Form 4506-C here and the IRS sends us a copy of your {taxYear} tax return figures, usually within a few business days. You won’t need to upload W-2s or a 1040. If you filed jointly, one spouse signs. Your Social Security number goes straight to the IRS service and is never stored by Lionheart.</p></div>
            {sp.irs && <p className="notice notice-ok">Signed. We’ve asked the IRS for your {taxYear} return. We’ll email you when it arrives.</p>}
            {!!irs?.length && <div className="tablewrap"><table className="table"><tbody>{irs.map((r) => { const c = r.consent as unknown as { tax_year: number; name_on_return: string; ssn_last4: string }; const st = IRS_STATE[r.state] ?? [r.state, 'pill-neutral']; return <tr key={r.id}><td>{c.name_on_return} · •••-••-{c.ssn_last4}</td><td>{c.tax_year} return</td><td><span className={`pill ${st[1]}`}>{st[0]}</span></td></tr>; })}</tbody></table></div>}
            <form action={signIrsConsent} className="form-grid paper" style={{ padding: 20 }}>
              <input type="hidden" name="tax_year" value={taxYear} />
              <div className="field"><label htmlFor="filing_status">How did you file for {taxYear}?</label><select className="input" id="filing_status" name="filing_status" defaultValue="mfj"><option value="mfj">Married filing jointly</option><option value="single">Single</option><option value="hoh">Head of household</option><option value="mfs">Married filing separately</option><option value="qss">Qualifying surviving spouse</option></select></div>
              <div className="field"><label htmlFor="member_primary">Who filed</label><select className="input" id="member_primary" name="member_primary" required>{adults.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
              <div className="field"><label htmlFor="name_on_return">Name on the return</label><input className="input" id="name_on_return" name="name_on_return" required autoComplete="name" /></div>
              <div className="field"><label htmlFor="ssn">Social Security number or ITIN</label><input className="input" id="ssn" name="ssn" required inputMode="numeric" autoComplete="off" placeholder="•••-••-••••" /></div>
              <div className="field"><label htmlFor="member_spouse">Spouse on a joint return</label><select className="input" id="member_spouse" name="member_spouse" defaultValue=""><option value="">Not a joint return</option>{adults.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
              <div className="field"><label htmlFor="spouse_name_on_return">Spouse’s name on the return</label><input className="input" id="spouse_name_on_return" name="spouse_name_on_return" /></div>
              <div className="field"><label htmlFor="spouse_ssn">Spouse’s SSN or ITIN</label><input className="input" id="spouse_ssn" name="spouse_ssn" inputMode="numeric" autoComplete="off" /></div>
              <div className="field span-all"><label htmlFor="address_on_return">Address on the return</label><input className="input" id="address_on_return" name="address_on_return" required defaultValue={[h?.street, h?.city, 'TN', h?.zip].filter(Boolean).join(', ')} /></div>
              <p className="hint span-all" style={{ whiteSpace: 'normal' }}>{CONSENT_4506C_TEXT}</p>
              <label className="tick span-all"><input type="checkbox" name="consent" required /><span>I authorize this request.</span></label>
              <div className="field"><label htmlFor="signature">Sign by typing your name as it appears on the return</label><input className="input" id="signature" name="signature" required /></div>
              <div className="field" style={{ justifyContent: 'end' }}><button className="btn btn-solid">Sign and send to the IRS</button></div>
            </form>
          </>}
          <div><h2 className="h3">{irsOn ? 'Documents' : 'Upload documents'}</h2><p className="body">{irsOn ? 'Everyone needs one proof of your Tennessee address, plus any benefit letter. Upload W-2s or a Form 1040 only if you didn’t use the IRS option above or didn’t file a return.' : 'Last year’s W-2s or Form 1040, any benefit letter, and one proof of your Tennessee address.'} We read them automatically and show you what we found to confirm. Social Security numbers are never stored in our records.</p></div>
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
