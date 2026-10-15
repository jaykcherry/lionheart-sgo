'use server';
import { redirect } from 'next/navigation';
import { getSession, supabaseService } from '@/lib/supabase';

export async function startFamily() {
  const s = await getSession();
  if (!s) redirect('/signin');
  const sb = supabaseService();
  const existing = s.roles.find((r) => r.role === 'family' && r.household_id);
  if (!existing) {
    const { data: h, error } = await sb.from('households').insert({ primary_user_id: s.userId }).select('id').single();
    if (error || !h) throw new Error(error?.message);
    await sb.from('user_roles').insert({ user_id: s.userId, role: 'family', household_id: h.id });
  }
  redirect('/family/apply');
}

/** Links donor records made at checkout (matched by verified sign-in email) to this account. */
export async function linkDonor() {
  const s = await getSession();
  if (!s) redirect('/signin');
  const sb = supabaseService();
  await sb.from('donors').update({ user_id: s.userId }).eq('email', s.email).is('user_id', null);
  if (!s.roles.some((r) => r.role === 'donor')) await sb.from('user_roles').insert({ user_id: s.userId, role: 'donor' });
  redirect('/donor');
}
