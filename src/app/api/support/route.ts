import { NextResponse, type NextRequest } from 'next/server';
import { getSession, supabaseService, supabaseUser } from '@/lib/supabase';
import { answer } from '@/agents/supportAgent';

/** Help assistant for signed-in users. Tools only see the caller's own records (RLS-bound client). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Sign in to ask about your account.' }, { status: 401 });
  const { question } = (await req.json()) as { question?: string };
  if (!question || question.length > 2000) return NextResponse.json({ error: 'Ask a question under 2,000 characters.' }, { status: 400 });
  const r = await answer(await supabaseUser(), supabaseService(), s.userId, question);
  return NextResponse.json(r);
}
