'use server';
import { redirect } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import { confirmPayeeChange, cancelPayeeChange } from '@/server/schoolClaimService';

/** Runs only on a button press (POST), never on the GET that opens the link, so email scanners can't trigger it. */
export async function bankChangeAct(f: FormData) {
  const kind = String(f.get('kind')); const t = String(f.get('t') ?? '');
  try {
    if (kind === 'confirm') { const r = await confirmPayeeChange(supabaseService(), t); redirect(`/bank-change/done?what=confirmed&after=${encodeURIComponent(r.payableAfter)}`); }
    else { await cancelPayeeChange(supabaseService(), t); redirect('/bank-change/done?what=cancelled'); }
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e;
    redirect(`/bank-change/${kind === 'confirm' ? 'confirm' : 'cancel'}?t=${encodeURIComponent(t)}&error=${encodeURIComponent((e as Error).message)}`);
  }
}
