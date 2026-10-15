'use server';
import { redirect } from 'next/navigation';
import { supabaseUser } from '@/lib/supabase';

export async function sendMagicLink(form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const next = String(form.get('next') ?? '/onboarding');
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect('/signin?error=' + encodeURIComponent('Enter a valid email address.'));
  const sb = await supabaseUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next.startsWith('/') ? next : '/onboarding')}` } });
  if (error) redirect('/signin?error=' + encodeURIComponent(error.message));
  redirect('/signin?sent=1');
}

export async function signOut() {
  const sb = await supabaseUser();
  await sb.auth.signOut();
  redirect('/');
}
