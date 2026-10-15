import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession, supabaseService } from '@/lib/supabase';
import { claimStart, claimVerify, claimSign } from '../../actions';
import { AGREEMENT_TEXT } from '../../agreement';

export const dynamic = 'force-dynamic';

export default async function Claim({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ step?: string; error?: string }> }) {
  const { slug } = await params; const sp = await searchParams;
  const s = await getSession();
  if (!s) redirect(`/signin?next=/school/claim/${slug}`);
  const { data: school } = await supabaseService().from('schools').select('id, slug, name, city, grades, email_domain, state').eq('slug', slug).single();
  if (!school) notFound();
  const step = sp.step ?? 'confirm';
  return (
    <div className="band"><section className="wrap" style={{ paddingBlock: '48px 84px' }}>
      <Link href="/schools" className="small">← All schools</Link>
      <h1 className="h2" style={{ margin: '14px 0 24px' }}>{school.name}</h1>
      <ol className="stepper">{['Confirm', 'Verify', 'Agreement'].map((l, i) => { const idx = ['confirm', 'code', 'agreement'].indexOf(step); return <li key={l} data-state={i < idx ? 'done' : i === idx ? 'current' : 'todo'}><span className="n">{i < idx ? '✓' : i + 1}</span>{l}</li>; })}</ol>
      {sp.error && <p className="errbox" role="alert" style={{ marginBottom: 20 }}>{sp.error}</p>}
      <div className="wrap-narrow" style={{ margin: 0 }}>
        {step === 'confirm' && <form action={claimStart} className="flow-body"><input type="hidden" name="slug" value={slug} />
          <p className="body">We’ll send a code to your @{school.email_domain} address to confirm you work at {school.name}.</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="title">Your role</label><select className="input" id="title" name="title">{['Head of school', 'Business manager or CFO', 'Admissions director', 'Board chair', 'Other administrator'].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label htmlFor="email">School email</label><input className="input" id="email" name="email" type="email" required placeholder={`name@${school.email_domain}`} /></div>
          </div>
          <div className="form-actions"><Link className="btn btn-secondary" href="/schools">Cancel</Link><button className="btn btn-solid">Yes, partner with Lionheart</button></div></form>}
        {step === 'code' && <form action={claimVerify} className="flow-body"><input type="hidden" name="slug" value={slug} />
          <p className="body">Enter the six-digit code we emailed you. It expires in 15 minutes.</p>
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
