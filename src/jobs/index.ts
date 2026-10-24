/**
 * Scheduled jobs (Trigger.dev). Each job is idempotent and safe to re-run; each writes to the audit log.
 * Times are America/Chicago. Money never moves from a job without two human approvals (see sendBatch); once both
 * are in, the daily-payments job sends on the pay date.
 */
import { schedules, task } from '@trigger.dev/sdk';
import { supabaseService } from '@/lib/supabase';
import { runCompliance } from '@/server/complianceService';
import { chargeDuePledges } from '@/server/giftService';
import { generateYearEnd, deliverAcknowledgments, remindIrsReport } from '@/server/yearEndService';
import { enrollmentReminders, prepareTermBatch, dailyPayments } from '@/server/paymentAutomation';
import { verifyApplication } from '@/server/eligibilityService';
import { collectTranscripts, transcriptsPending } from '@/server/irsTranscripts';
import { draftRecommendations } from '@/agents/reviewAgent';
import { advanceRounds, ensureSchedule } from '@/server/roundScheduler';
import { extractDocument } from '@/agents/documentAgent';

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

/**
 * When a family submits (and after parents confirm extracted values): deterministic eligibility.
 * If an IRS transcript is on its way, the application waits in DOCS_PENDING; the transcript job re-runs it.
 */
export const onApplicationReady = task({
  id: 'application-ready',
  run: async (p: { applicationId: string; force?: boolean }) => {
    const sb = supabaseService();
    const { data: app } = await sb.from('applications').select('household_id, state').eq('id', p.applicationId).single();
    if (app && !p.force && (await transcriptsPending(sb, app.household_id))) {
      if (app.state === 'SUBMITTED') await sb.rpc('svc_transition_application', { p_app: p.applicationId, p_to: 'DOCS_PENDING', p_actor_kind: 'job', p_actor_id: 'job:application-ready' });
      return { waitingFor: 'irs_transcript' };
    }
    return reverify(p.applicationId);
  },
});
async function reverify(applicationId: string) {
  const sb = supabaseService();
  await sb.rpc('svc_transition_application', { p_app: applicationId, p_to: 'AUTO_VERIFYING', p_actor_kind: 'job', p_actor_id: 'job:application-ready' });
  const det = await verifyApplication(sb, applicationId);
  return { result: det.result, tier: det.tier };
}

/**
 * Hourly: collect IRS transcripts (Form 4506-C via IVES), replace typed/uploaded income with the IRS figures,
 * and re-run eligibility. Applications never wait more than 10 days: after that they continue on documents.
 */
export const irsTranscripts = schedules.task({
  id: 'irs-transcripts', cron: { pattern: '15 * * * *', timezone: TZ },
  run: async () => {
    const sb = supabaseService();
    const r = await collectTranscripts(sb, async (id) => { await reverify(id); });
    const stale = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const { data: late } = await sb.from('irs_transcript_requests').select('id, household_id').eq('state', 'REQUESTED').lt('requested_at', stale);
    for (const l of late ?? []) {
      await sb.from('irs_transcript_requests').update({ state: 'ERROR', last_error: 'No answer from the IRS within 10 days', next_retry_on: null }).eq('id', l.id);
      const { data: waiting } = await sb.from('applications').select('id').eq('household_id', l.household_id).eq('state', 'DOCS_PENDING');
      for (const a of waiting ?? []) await reverify(a.id);
    }
    return { ...r, timedOut: late?.length ?? 0 };
  },
});

/** Every 2 hours on weekdays: AI drafts recommendations for the human review queue. */
export const reviewDrafts = schedules.task({
  id: 'review-drafts', cron: { pattern: '0 8-18/2 * * 1-5', timezone: TZ },
  run: async () => draftRecommendations(supabaseService()),
});

/**
 * Every 15 minutes: award rounds run themselves on the published schedule (announce 14 days ahead with the
 * beacon round number → freeze applicants 1 hour before → run with the public beacon → board approval link).
 */
export const awardRounds = schedules.task({
  id: 'award-rounds', cron: { pattern: '*/15 * * * *', timezone: TZ },
  run: async () => { const sb = supabaseService(); await ensureSchedule(sb); return { log: await advanceRounds(sb) }; },
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

/**
 * Enrollment windows (Aug 1–13, Jan 2–13): reminders on days 1, 5, 9 and 12 to schools with unconfirmed students
 * (or their TDOE directory address if no one has claimed the school) and to families who haven't re-attested residency.
 */
export const enrollmentReminderJob = schedules.task({
  id: 'enrollment-reminders', cron: { pattern: '0 8 * 1,8 *', timezone: TZ },
  run: async () => enrollmentReminders(supabaseService()),
});

/** Aug 15 / Jan 15: build the term batch and email approvers. Weekly afterwards: catch-up batches for late confirmations. */
export const prepareFallBatch = schedules.task({
  id: 'prepare-fall-batch', cron: { pattern: '0 7 15 8 *', timezone: TZ },
  run: async () => prepareTermBatch(supabaseService(), 'fall'),
});
export const prepareSpringBatch = schedules.task({
  id: 'prepare-spring-batch', cron: { pattern: '0 7 15 1 *', timezone: TZ },
  run: async () => prepareTermBatch(supabaseService(), 'spring'),
});
export const catchUpBatches = schedules.task({
  id: 'catch-up-batches', cron: { pattern: '0 7 * 8-12,1-4 1', timezone: TZ },
  run: async () => {
    const m = new Date().getMonth() + 1; const sb = supabaseService();
    if (m === 8 && new Date().getDate() < 22) return { skipped: 'term batch not yet sent' };
    if (m === 1 && new Date().getDate() < 22) return { skipped: 'term batch not yet sent' };
    return prepareTermBatch(sb, m >= 8 ? 'fall' : 'spring');
  },
});

/**
 * Daily 7:00: send fully approved batches on their pay date through the bank's API (two approvals still
 * required), remind approvers from 3 days before, and handle refund reminders.
 */
export const dailyPaymentsJob = schedules.task({
  id: 'daily-payments', cron: { pattern: '0 7 * * *', timezone: TZ },
  run: async () => dailyPayments(supabaseService()),
});

/**
 * Jan 5–31, every morning: release last year's acknowledgments as soon as everything ties out, then deliver
 * (by email). No sign-off; a mismatch emails the treasurer once and retries daily.
 * Feb 1–28: IRS contribution report reminders until the confirmation number is recorded.
 */
export const yearEnd = schedules.task({
  id: 'year-end', cron: { pattern: '0 7 5-31 1 *', timezone: TZ },
  run: async () => {
    const sb = supabaseService(); const year = new Date().getFullYear() - 1;
    const g = await generateYearEnd(sb, year);
    const d = g.released ? await deliverAcknowledgments(sb, year) : { sent: 0 };
    return { ...g, ...d };
  },
});
export const irsReportReminders = schedules.task({
  id: 'irs-report-reminders', cron: { pattern: '0 8 1-28 2 *', timezone: TZ },
  run: async () => remindIrsReport(supabaseService(), new Date().getFullYear() - 1),
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
