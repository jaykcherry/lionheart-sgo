import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession, supabaseService } from '@/lib/supabase';
import { claimStart, claimVerify, claimSign } from '../../actions';
import { AGREEMENT_TEXT } from '../../agreement';
import { verifyOptions } from '@/server/schoolClaimService';

export const dynamic = 'force-dynamic';

export default async function Claim({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ step?: string; error?: string; via?: string; to?: string }> }) {
  const { slug } = await params; const sp = await searchParams;
  const s = await getSession();
  if (!s) redirect(`/signin?next=/school/claim/${slug}`);
  const { data: school } = await supabaseService().from('schools').select('id, slug, name, city, grades, email_domain, alt_email_domain, state').eq('slug', slug).single();
  if (!school) notFound();
  const step = sp.step ?? 'confirm';
  const opts = await verifyOptions(supabaseService(), school.id);
  const roles = ['Head of school', 'Business manager or CFO', 'Admissions director', 'Board chair', 'Other administrator'];
  return (
    <div className="band"><section className="wrap" style={{ paddingBlock: '48px 84px' }}>
      <Link href="/schools" className="small">← All schools</Link>
      <h1 className="h2" style={{ margin: '14px 0 24px' }}>{school.name}</h1>
      <ol className="stepper">{['Confirm', 'Verify', 'Agreement'].map((l, i) => { const idx = ['confirm', 'code', 'agreement'].indexOf(step); return <li key={l} data-state={i < idx ? 'done' : i === idx ? 'current' : 'todo'}><span className="n">{i < idx ? '✓' : i + 1}</span>{l}</li>; })}</ol>
      {sp.error && <p className="errbox" role="alert" style={{ marginBottom: 20 }}>{sp.error}</p>}
      <div className="wrap-narrow" style={{ margin: 0 }}>
        {step === 'confirm' && <form action={claimStart} className="flow-body"><input type="hidden" name="slug" value={slug} />
          <p className="body">Tell us who you are, then choose where we should email a six-digit code.</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="full_name">Your full name</label><input className="input" id="full_name" name="full_name" autoComplete="name" required /></div>
            <div className="field"><label htmlFor="title">Your role</label><select className="input" id="title" name="title">{roles.map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <fieldset className="choice-list"><legend className="label">Send the code to</legend>
            {opts.domains.length > 0 && <label className="choice"><input type="radio" name="how" value="domain" defaultChecked />
              <span><b>My school email</b><span className="small muted">An address ending in @{opts.domains.join(' or @')}. Fastest: the code arrives in a minute.</span>
                <input className="input" name="email" type="email" placeholder={`name@${opts.domains[0]}`} aria-label="Your school email" style={{ marginTop: 10 }} /></span></label>}
            {opts.contacts.map((c, i) => <label className="choice" key={c.index}><input type="radio" name="how" value={`directory:${c.index}`} defaultChecked={!opts.domains.length && i === 0} />
              <span><b>{c.masked}</b><span className="small muted">{i === 0 ? 'The school’s email' : 'The school’s alternate email'} on file with the Tennessee Department of Education. We’ll tell whoever reads it that you asked, and they can pass the code to you. It stays valid for 48 hours.</span></span></label>)}
          </fieldset>
          <p className="hint">Neither inbox works? Ask your school to update its email with the Tennessee Department of Education, or email schools@lionheartscholars.org from any school address.</p>
          <div className="form-actions"><Link className="btn btn-secondary" href="/schools">Cancel</Link><button className="btn btn-solid">Send the code</button></div></form>}
        {step === 'code' && <form action={claimVerify} className="flow-body"><input type="hidden" name="slug" value={slug} />
          <p className="body">{sp.via === 'directory'
            ? <>We emailed a code to <strong>{sp.to}</strong>, the school’s address on file with the state. Ask whoever reads that inbox for the code. It stays valid for 48 hours.</>
            : <>Enter the six-digit code we emailed to <strong>{sp.to || 'your school address'}</strong>. It expires in 15 minutes.</>}</p>
          <div className="field"><label htmlFor="code">Verification code</label><input className="input code-input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
          <div className="form-actions"><Link className="btn btn-ghost" href={`?step=confirm`}>Send a new code</Link><button className="btn btn-solid">Verify</button></div></form>}
        {step === 'agreement' && <form action={claimSign} className="flow-body"><input type="hidden" name="slug" value={slug} />
          <pre className="paper" style={{ padding: 20, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '23px', maxHeight: 420, overflow: 'auto' }}>{AGREEMENT_TEXT}</pre>
          <label className="tick"><input type="checkbox" name="agree" /><span>I’m authorized to sign for {school.name}, and we agree to these terms.</span></label>
          <div className="form-actions"><span /><button className="btn btn-solid">Sign agreement</button></div></form>}
      </div>
    </section></div>
  );
}
