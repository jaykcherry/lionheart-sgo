/**
 * Scheduled jobs (Trigger.dev). Each job is idempotent and safe to re-run; each writes to the audit log.
 * Times are America/Chicago. Money never moves from a job without two human approvals (see sendBatch).
 */
import { schedules, task } from '@trigger.dev/sdk';
import { supabaseService } from '@/lib/supabase';
import { runCompliance } from '@/server/complianceService';
import { chargeDuePledges } from '@/server/giftService';
import { generateYearEnd, deliverAcknowledgments } from '@/server/yearEndService';
import { prepareBatch } from '@/server/disbursementService';
import { verifyApplication } from '@/server/eligibilityService';
import { draftRecommendations } from '@/agents/reviewAgent';
import { extractDocument } from '@/agents/documentAgent';
import { sendEmail } from '@/lib/email';

const TZ = 'America/Chicago';

/** Hourly: compliance monitor (90% test, segregated balance, 10-student rule, deadlines, SLAs). */
export const complianceMonitor = schedules.task({
  id: 'compliance-monitor', cron: { pattern: '0 * * * *', timezone: TZ },
  run: async () => { const f = await runCompliance(supabaseService()); return { critical: f.filter((x) => x.severity === 'critical').length, warn: f.filter((x) => x.severity === 'warn').length }; },
});

/** Daily 6:00: charge pledges that are due (only once Lionheart is on the IRS SGO list). */
export const chargePledges = schedules.task({
  id: 'charge-pledges', cron: { pattern: '0 6 * * *', timezone: TZ },
  run: async () => chargeDuePledges(supabaseService()),
});

/** On upload: read the document, then (if the application is submitted) run eligibility. */
export const onDocumentUploaded = task({
  id: 'document-uploaded',
  run: async (p: { documentId: string; expectedKind: string; applicationId?: string }) => {
    const sb = supabaseService();
    const ex = await extractDocument(sb, p.documentId, p.expectedKind);
    return { extracted: !!ex };
  },
});

/** When a family submits (and after parents confirm extracted values): deterministic eligibility. */
export const onApplicationReady = task({
  id: 'application-ready',
  run: async (p: { applicationId: string }) => {
    const sb = supabaseService();
    await sb.rpc('svc_transition_application', { p_app: p.applicationId, p_to: 'AUTO_VERIFYING', p_actor_kind: 'job', p_actor_id: 'job:application-ready' });
    const det = await verifyApplication(sb, p.applicationId);
    return { result: det.result, tier: det.tier };
  },
});

/** Every 2 hours on weekdays: AI drafts recommendations for the human review queue. */
export const reviewDrafts = schedules.task({
  id: 'review-drafts', cron: { pattern: '0 8-18/2 * * 1-5', timezone: TZ },
  run: async () => draftRecommendations(supabaseService()),
});

/** Daily: expire award offers not accepted within 10 days (back to the waitlist, money returns to the pool). */
export const expireOffers = schedules.task({
  id: 'expire-offers', cron: { pattern: '30 6 * * *', timezone: TZ },
  run: async () => {
    const sb = supabaseService();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('awards').select('id, application_id, applications!inner(state)').lt('offer_expires_on', today).is('accepted_at', null).eq('applications.state', 'AWARDED');
    for (const a of data ?? []) {
      await sb.rpc('svc_transition_application', { p_app: a.application_id, p_to: 'WAITLISTED', p_actor_kind: 'job', p_actor_id: 'job:expire-offers' });
      await sb.from('award_terms').delete().eq('award_id', a.id);
      await sb.from('awards').delete().eq('id', a.id);
    }
    return { expired: data?.length ?? 0 };
  },
});

/** Aug 1 and Jan 2: open the enrollment-confirmation window and email school admins; reminders follow. */
export const openRosterWindow = schedules.task({
  id: 'open-roster-window', cron: { pattern: '0 8 1 8 *', timezone: TZ },
  run: async () => notifySchools('fall'),
});
export const openSpringRosterWindow = schedules.task({
  id: 'open-spring-roster-window', cron: { pattern: '0 8 2 1 *', timezone: TZ },
  run: async () => notifySchools('spring'),
});
async function notifySchools(term: string) {
  const sb = supabaseService();
  const { data: admins } = await sb.from('user_roles').select('school_id, profiles(email)').eq('role', 'school_admin');
  for (const a of (admins ?? []) as unknown as { school_id: string; profiles: { email: string } }[]) {
    await sendEmail({ to: a.profiles.email, subject: `Confirm ${term} enrollment for your Lionheart students`,
      text: `Please confirm which Lionheart scholarship students are enrolled for ${term}. We pay only for confirmed students. Sign in: ${process.env.NEXT_PUBLIC_SITE_URL}/school` });
  }
  return { notified: admins?.length ?? 0 };
}

/** Aug 15 and Jan 15: build the term payment batch. Humans approve and send. */
export const prepareFallBatch = schedules.task({
  id: 'prepare-fall-batch', cron: { pattern: '0 7 15 8 *', timezone: TZ },
  run: async () => { const y = new Date().getFullYear(); const b = await prepareBatch(supabaseService(), 'fall', `${y}-FALL-1`); return { ready: b.readyTotal, lines: b.lines.length }; },
});
export const prepareSpringBatch = schedules.task({
  id: 'prepare-spring-batch', cron: { pattern: '0 7 15 1 *', timezone: TZ },
  run: async () => { const y = new Date().getFullYear(); const b = await prepareBatch(supabaseService(), 'spring', `${y}-SPRING-1`); return { ready: b.readyTotal, lines: b.lines.length }; },
});

/** Jan 5: generate acknowledgments + IRS report for last year (released only if everything ties out). Jan 10: deliver. */
export const yearEnd = schedules.task({
  id: 'year-end-generate', cron: { pattern: '0 7 5 1 *', timezone: TZ },
  run: async () => generateYearEnd(supabaseService(), new Date().getFullYear() - 1),
});
export const yearEndDeliver = schedules.task({
  id: 'year-end-deliver', cron: { pattern: '0 9 10 1 *', timezone: TZ },
  run: async () => deliverAcknowledgments(supabaseService(), new Date().getFullYear() - 1),
});

/** Monthly: delete raw tax documents 3 years after a final decision (extracted values and hashes stay). */
export const retention = schedules.task({
  id: 'document-retention', cron: { pattern: '0 3 1 * *', timezone: TZ },
  run: async () => {
    const sb = supabaseService();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('documents').select('id, storage_path').lte('delete_raw_after', today).neq('storage_path', 'deleted');
    for (const d of data ?? []) { await sb.storage.from('documents').remove([d.storage_path]); await sb.from('documents').update({ storage_path: 'deleted' }).eq('id', d.id); }
    return { deleted: data?.length ?? 0 };
  },
});
