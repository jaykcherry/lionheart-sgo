import { NextResponse, type NextRequest } from 'next/server';
import { supabaseUser, supabaseService } from '@/lib/supabase';

/** Exchanges the magic-link code for a session and makes sure the person has a profile row. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/onboarding';
  if (code) {
    const sb = await supabaseUser();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabaseService().from('profiles').upsert({ id: data.user.id, email: data.user.email ?? '' }, { onConflict: 'id', ignoreDuplicates: true });
    }
  }
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/onboarding', req.url));
}
