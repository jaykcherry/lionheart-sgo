import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { envPick } from './env';

/** Per-request client acting as the signed-in user (RLS applies). */
export async function supabaseUser(): Promise<SupabaseClient> {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = envPick('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component */ } },
    },
  });
}

/**
 * Service-role client for jobs and webhooks only. Bypasses RLS. Never import from client components.
 * `actor` is recorded on every audited change via the lh.actor_* settings.
 */
export function supabaseService(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = envPick('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Role = 'family' | 'school_admin' | 'donor' | 'staff' | 'board';
export interface Session { userId: string; email: string; roles: { role: Role; household_id: string | null; school_id: string | null }[] }

export async function getSession(): Promise<Session | null> {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: roles } = await sb.from('user_roles').select('role, household_id, school_id').eq('user_id', user.id);
  return { userId: user.id, email: user.email ?? '', roles: (roles ?? []) as Session['roles'] };
}

export const hasRole = (s: Session | null, ...r: Role[]) => !!s && s.roles.some((x) => r.includes(x.role));
