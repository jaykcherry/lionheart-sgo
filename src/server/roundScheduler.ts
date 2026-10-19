import type { SupabaseClient } from '@supabase/supabase-js';
import { DRAND_QUICKNET, beaconTimeOf, beaconUrl, roundPlan, seedFromBeacon, fmtUSD, type AllocationResult } from '@/domain';
import { buildRoundInput, inputSha256, runRound, type RoundInput } from './awardService';
import { sendEmail } from '@/lib/email';
import { audit, openTicket } from '@/lib/audit';
import { opsAlertEmails } from './mail';

const ACTOR = 'job:award-rounds';
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lionheartscholars.org';

async function boardEmails(sb: SupabaseClient) {
  const { data } = await sb.from('user_roles').select('profiles(email)').eq('role', 'board');
  const list = ((data ?? []) as unknown as { profiles: { email: string } }[]).map((r) => r.profiles.email);
  return [...new Set([...list, ...opsAlertEmails()])];
}

/** Creates the year's schedule rows (idempotent). Called when a cycle is created, and nightly as a safety net. */
export async function ensureSchedule(sb: SupabaseClient) {
  const { data: cycles } = await sb.from('cycles').select('id, school_year');
  let created = 0;
  for (const c of cycles ?? []) {
    const year = Number(String(c.school_year).slice(0, 4));
    for (const p of roundPlan(year)) {
      const { error } = await sb.from('award_round_schedule').upsert({ cycle_id: c.id, name: p.name, announce_at: p.announceAt, freeze_at: p.freezeAt, run_at: p.runAt, beacon_round: p.beaconRound },
        { onConflict: 'name', ignoreDuplicates: true });
      if (!error) created++;
    }
  }
  return { created };
}

/** Fetches the beacon from two independent relays and checks randomness = SHA-256(signature) and that they agree. */
export async function fetchBeacon(round: number): Promise<{ randomness: string; signature: string }> {
  const got: { randomness: string; signature: string }[] = [];
  for (const relay of DRAND_QUICKNET.relays) {
    try {
      const res = await fetch(beaconUrl(round, relay), { cache: 'no-store' });
      if (!res.ok) continue;
      const j = (await res.json()) as { round: number; randomness: string; signature: string };
      if (j.round !== round) continue;
      const sig = Uint8Array.from(j.signature.match(/../g)!.map((h) => parseInt(h, 16)));
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', sig))].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (digest !== j.randomness.toLowerCase()) continue;
      got.push({ randomness: j.randomness.toLowerCase(), signature: j.signature });
      if (got.length >= 2) break;
    } catch { /* try the next relay */ }
  }
  if (got.length < 2) throw new Error(`beacon round ${round}: fewer than two relays returned a valid value`);
  if (got[0]!.randomness !== got[1]!.randomness) throw new Error(`beacon round ${round}: relays disagree`);
  return got[0]!;
}

/**
 * Every 15 minutes. Moves each scheduled round along: announce → freeze applicants → run with the beacon →
 * email the board a one-click approval link → remind until approved. Only the approval is a person's job.
 */
export async function advanceRounds(sb: SupabaseClient, now = new Date()) {
  const iso = now.toISOString();
  const log: string[] = [];
  const { data: rows } = await sb.from('award_round_schedule').select('*').in('state', ['SCHEDULED', 'ANNOUNCED', 'FROZEN']).order('run_at');
  for (const r of rows ?? []) {
    try {
      if (r.state === 'SCHEDULED' && r.announce_at <= iso) {
        const to = await boardEmails(sb);
        for (const e of to) await sendEmail({ to: e, subject: `Award round ${r.name} runs ${new Date(r.run_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric' })}`,
          text: [`Award round ${r.name} will run automatically on ${new Date(r.run_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central.`, '',
            `Lottery tie-breaks will use public drand beacon round ${r.beacon_round} (published at ${beaconTimeOf(r.beacon_round)}), which no one can know in advance. This number is now posted at ${site()}/about#rounds.`,
            'Applicants and available cash are frozen one hour before. You will get a one-click approval link when the results are ready. Nothing else is needed.'].join('\n') });
        await sb.from('award_round_schedule').update({ state: 'ANNOUNCED' }).eq('id', r.id);
        await audit(sb, { actorKind: 'job', actorId: ACTOR, action: 'round_announced', entityType: 'award_round_schedule', entityId: r.id, after: { beacon_round: r.beacon_round } });
        log.push(`${r.name}: announced`); continue;
      }
      if (r.state === 'ANNOUNCED' && r.freeze_at <= iso) {
        const input = await buildRoundInput(sb, r.cycle_id);
        const sha = await inputSha256(input);
        await sb.from('award_round_schedule').update({ state: 'FROZEN', frozen_input: input, frozen_sha256: sha }).eq('id', r.id);
        await audit(sb, { actorKind: 'job', actorId: ACTOR, action: 'round_frozen', entityType: 'award_round_schedule', entityId: r.id, after: { sha256: sha, candidates: input.candidates.length, cash: input.cashAvailable } });
        log.push(`${r.name}: frozen (${input.candidates.length} applicants)`); continue;
      }
      if (r.state === 'FROZEN' && beaconTimeOf(r.beacon_round) <= new Date(now.getTime() - 30_000).toISOString()) {
        const input = r.frozen_input as RoundInput;
        if ((await inputSha256(input)) !== r.frozen_sha256) throw new Error('frozen input does not match its hash');
        const b = await fetchBeacon(r.beacon_round);
        const { roundId, result } = await runRound(sb, { cycleId: r.cycle_id, name: r.name, seed: seedFromBeacon(r.beacon_round, b.randomness), runBy: ACTOR, input, beaconRound: r.beacon_round, inputSha: r.frozen_sha256 });
        await sb.from('award_rounds').update({ beacon_signature: b.signature, schedule_id: r.id }).eq('id', roundId);
        await sb.from('award_round_schedule').update({ state: 'RUN', round_id: roundId }).eq('id', r.id);
        await notifyApproval(sb, roundId, r.name, result, false);
        log.push(`${r.name}: run`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      // A beacon outage or relay disagreement just retries next tick; anything else needs a person.
      if (!/beacon/.test(msg)) {
        await sb.from('award_round_schedule').update({ state: 'FAILED', last_error: msg }).eq('id', r.id);
        await openTicket(sb, { kind: 'award_round_failed', entityType: 'award_round_schedule', entityId: r.id, severity: 'critical', recommendation: `${r.name}: ${msg}` });
      } else await sb.from('award_round_schedule').update({ last_error: msg }).eq('id', r.id);
      log.push(`${r.name}: ${msg}`);
    }
  }
  // Approval reminders on day 3 and day 7.
  const { data: waiting } = await sb.from('award_rounds').select('id, name, result, run_at, approval_reminders').is('approved_at', null).not('schedule_id', 'is', null);
  for (const w of waiting ?? []) {
    const days = (now.getTime() - new Date(w.run_at).getTime()) / 86_400_000;
    if ((w.approval_reminders === 0 && days >= 3) || (w.approval_reminders === 1 && days >= 7)) {
      await notifyApproval(sb, w.id, w.name, w.result as AllocationResult, true);
      await sb.from('award_rounds').update({ approval_reminders: w.approval_reminders + 1 }).eq('id', w.id);
    }
  }
  return log;
}

async function notifyApproval(sb: SupabaseClient, roundId: string, name: string, res: AllocationResult, reminder: boolean) {
  const t = res.totals;
  for (const e of await boardEmails(sb)) await sendEmail({ to: e, subject: `${reminder ? 'Reminder: ' : ''}Approve award round ${name}`,
    text: [`Award round ${name} has run. Families hear nothing until one board member approves.`, '',
      `${fmtUSD(t.awarded)} to ${t.students} students at ${t.schools} schools · ${t.waitlisted} waitlisted · ${t.held} on hold · ${fmtUSD(t.cashRemaining)} left`,
      `10-student rule: ${t.meetsBreadthRule ? 'met' : 'NOT met'}`, '',
      `Review and approve (one click, sign-in required): ${site()}/board/rounds/${roundId}`].join('\n') });
}
