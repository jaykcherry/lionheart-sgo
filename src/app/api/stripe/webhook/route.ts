import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';
import { envPick } from '@/lib/env';
import { supabaseService } from '@/lib/supabase';
import { handleStripeEvent } from '@/server/giftService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let ev;
  try { ev = stripe().webhooks.constructEvent(body, sig ?? '', envPick('STRIPE_WEBHOOK_SECRET').STRIPE_WEBHOOK_SECRET); }
  catch (e) { return NextResponse.json({ error: `bad signature: ${(e as Error).message}` }, { status: 400 }); }
  try { await handleStripeEvent(supabaseService(), ev); }
  catch (e) { console.error('stripe webhook failed', ev.type, e); return NextResponse.json({ error: 'handler failed' }, { status: 500 }); } // Stripe retries
  return NextResponse.json({ received: true });
}
