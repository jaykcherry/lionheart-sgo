'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSession, supabaseService, supabaseUser } from '@/lib/supabase';
import { startGift } from '@/server/giftService';
import { dollars } from '@/domain';
import { audit } from '@/lib/audit';
import { byLabel } from '@/web/heritage';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function give(f: FormData) {
  const joint = str(f, 'filing') === 'joint' && !!str(f, 'name2');
  const amount = Number(str(f, 'amount').replace(/[^0-9.]/g, ''));
  if (!amount || amount < 10) redirect('/donor/give?error=' + encodeURIComponent('Enter an amount of at least $10.'));
  const prefLabel = str(f, 'preferred_school_label');
  let preferredSchoolId: string | null = null;
  if (prefLabel) {
    const dir = byLabel(prefLabel);
    if (!dir) redirect('/donor/give?error=' + encodeURIComponent('Choose your preferred school from the list, or leave it blank.'));
    if (f.get('pref_ack') !== 'on') redirect('/donor/give?error=' + encodeURIComponent('Please confirm the preferred-school acknowledgment.') + '&school=' + dir.id);
    const { data: row } = await supabaseService().from('schools').select('id').eq('slug', dir.id).single();
    preferredSchoolId = row?.id ?? null;
  }
  const h = await headers();
  const s = await getSession();
  let url: string | null = null;
  try {
    const r = await startGift(supabaseService(), {
      givers: joint ? [{ legalName: str(f, 'name1'), email: str(f, 'email') }, { legalName: str(f, 'name2'), email: str(f, 'email') }] : [{ legalName: str(f, 'name1'), email: str(f, 'email') }],
      totalCents: dollars(amount), street: str(f, 'street'), city: str(f, 'city'), state: str(f, 'state'), zip: str(f, 'zip'),
      designate: f.get('designate') === 'on', preferredSchoolId, eDeliveryConsent: true,
      ip: h.get('x-forwarded-for')?.split(',')[0], userAgent: h.get('user-agent') ?? undefined, userId: s?.userId ?? null,
    });
    url = r.url;
  } catch (e) { redirect('/donor/give?error=' + encodeURIComponent((e as Error).message)); }
  redirect(url ?? '/donor');
}

export async function cancelPledge(f: FormData) {
  const s = await getSession();
  if (!s) redirect('/signin');
  const sb = await supabaseUser();
  const { data: g } = await sb.from('gifts').select('id, state').eq('id', str(f, 'gift_id')).single();  // RLS: only the donor's own gifts are visible
  if (!g || g.state !== 'PLEDGED') return;
  await supabaseService().from('gifts').update({ state: 'CANCELLED' }).eq('id', g.id);
  await audit(supabaseService(), { actorKind: 'person', actorId: s.userId, action: 'pledge_cancelled', entityType: 'gift', entityId: g.id });
  revalidatePath('/donor');
}
