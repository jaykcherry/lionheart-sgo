import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** Refreshes the Supabase session cookie and keeps signed-out visitors out of the portals. */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const protectedPath = /^\/(family|school|donor(?!\/give)|board|onboarding)(\/|$)/.test(req.nextUrl.pathname);
  if (protectedPath && !user) {
    const to = req.nextUrl.clone(); to.pathname = '/signin'; to.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe).*)'] };
