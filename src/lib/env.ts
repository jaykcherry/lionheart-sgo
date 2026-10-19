import { z } from 'zod';

/** Read lazily so `next build` works without secrets; each server path validates what it needs. */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  ANTHROPIC_API_KEY: z.string().min(10),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  RESEND_API_KEY: z.string().min(5),
  EMAIL_FROM: z.string().default('Lionheart <hello@lionheartscholars.org>'),
  SGO_EIN: z.string().default('[XX-XXXXXXX]'),
  SGO_LEGAL_NAME: z.string().default('Lionheart Scholarship Granting Organization, Inc.'),
  PAYOUT_PROVIDER: z.enum(['manual', 'increase', 'modern_treasury']).default('manual'),
  INCREASE_API_KEY: z.string().optional(),
  INCREASE_SEGREGATED_ACCOUNT_ID: z.string().optional(),
  CREDIT_ELIGIBLE_FROM: z.string().default('2027-01-01'),
  /** IRS income verification through an IVES participant (Form 4506-C). 'none' = families upload documents. */
  TRANSCRIPT_PROVIDER: z.enum(['none', 'mock', 'ives_vendor']).default('none'),
  IVES_API_URL: z.string().url().optional(),
  IVES_API_KEY: z.string().optional(),
  /** Mailed acknowledgments for donors without e-delivery consent. 'none' = staff mails them. */
  MAIL_PROVIDER: z.enum(['none', 'lob']).default('none'),
  LOB_API_KEY: z.string().optional(),
  LOB_FROM_ADDRESS_ID: z.string().optional(),
  /** Comma-separated: who gets tie-out problems, IRS report reminders and approval requests (besides board users). */
  OPS_ALERT_EMAILS: z.string().default(''),
  /** Set to 'true' once Lionheart appears on the IRS SGO list (pledges then charge automatically). */
  SGO_LISTED: z.enum(['true', 'false']).default('false'),
});
export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
/** Validates only the keys a code path needs, so one missing secret doesn't take down unrelated features. */
export function envPick<K extends keyof Env>(...keys: K[]): Pick<Env, K> {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const r = shape[k as string]!.safeParse(process.env[k as string]);
    if (!r.success) throw new Error(`Environment variable ${String(k)} is missing or invalid: ${r.error.issues[0]?.message}`);
    out[k as string] = r.data;
  }
  return out as Pick<Env, K>;
}
