import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import { payeeTokenInfo } from '@/server/schoolClaimService';
import { BANK_CHANGE_HOLD_DAYS } from '@/domain';
import { bankChangeAct } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false } };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });

export default async function BankChange({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ t?: string; error?: string; what?: string; after?: string }> }) {
  const { kind } = await params; const sp = await searchParams;
  if (kind === 'done') return (
    <div className="band"><section className="wrap wrap-narrow" style={{ paddingBlock: '72px 96px' }}>
      <h1 className="h2">{sp.what === 'confirmed' ? 'Bank account confirmed' : 'Bank account change cancelled'}</h1>
      <p className="lead" style={{ marginTop: 18 }}>{sp.what === 'confirmed'
        ? `Thank you. We’ll start paying the new account after ${sp.after ? fmtDate(sp.after) : `${BANK_CHANGE_HOLD_DAYS} days`}. Until then, anyone we notified can still cancel the change from their email.`
        : 'Nothing has changed: scholarship payments keep going to the school’s previous account. We’ve let your school’s administrators know.'}</p>
    </section></div>);
  if (kind !== 'confirm' && kind !== 'cancel') notFound();
  let info: Awaited<ReturnType<typeof payeeTokenInfo>> | null = null; let err = sp.error ?? '';
  try { if (sp.t) info = await payeeTokenInfo(supabaseService(), sp.t, kind); else err = 'This link is missing its code. Use the button in the email.'; } catch (e) { err = err || (e as Error).message; }
  return (
    <div className="band"><section className="wrap wrap-narrow" style={{ paddingBlock: '72px 96px' }}>
      <h1 className="h2">{kind === 'confirm' ? 'Confirm the new bank account' : 'Cancel the bank account change'}</h1>
      {err && <p className="errbox" role="alert" style={{ marginTop: 20 }}>{err}</p>}
      {info && <>
        <div className="paper" style={{ padding: 22, marginTop: 24 }}>
          <div className="sumrow" style={{ paddingTop: 0 }}><span>School</span><span>{info.school}</span></div>
          <div className="sumrow"><span>Account holder</span><span>{info.legalName}</span></div>
          <div className="sumrow" style={{ borderBottom: 0 }}><span>New account</span><span className="tnum">Checking ••••{info.last4}</span></div>
        </div>
        <p className="body" style={{ marginTop: 18 }}>{kind === 'confirm'
          ? `Confirm only if your school asked for scholarship payments to go to this account. We’ll wait ${BANK_CHANGE_HOLD_DAYS} days before paying it, and the change can still be cancelled until then.`
          : 'Cancel if your school didn’t ask for this. Payments will keep going to the previous account.'}</p>
        <form action={bankChangeAct} className="form-actions" style={{ marginTop: 18 }}>
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="t" value={sp.t} />
          <span className="small muted">Questions: schools@lionheartscholars.org</span>
          <button className={kind === 'confirm' ? 'btn btn-solid' : 'btn btn-primary'}>{kind === 'confirm' ? 'Confirm this account' : 'Cancel this change'}</button>
        </form></>}
    </section></div>);
}
