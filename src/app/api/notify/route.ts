import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';

/** "Tell me when giving opens" sign-ups from the home page. */
export async function POST(req: Request) {
  const f = await req.formData();
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const back = new URL('/?notified=1#notify', req.url);
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.redirect(new URL('/#notify', req.url), 303);
  await supabaseService().from('notify_signups').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  return NextResponse.redirect(back, 303);
}
