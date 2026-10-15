import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { envPick } from '@/lib/env';
import { logAgentAction } from '@/lib/audit';
import { redact } from './guardrails';

export const PROMPT_VERSION = 'review-agent@2027.1';

const SYSTEM = `You help a small scholarship organization's staff clear their review queue.
For one ticket, write a short recommendation (3 sentences max): what the problem is, the most likely resolution,
and the exact document or action that would resolve it. Cite the rule when relevant
(26 U.S.C. §25F and Treasury's 2026 regulations: 300% of area median income, Tennessee residency, categorical programs SNAP/TANF/WIC/Section 8/SSI only,
no awards to disqualified persons, no earmarking). You never decide; a person does. Never include SSNs or account numbers.`;

/** Drafts recommendations for open tickets that lack one. Writes only the recommendation text. */
export async function draftRecommendations(sb: SupabaseClient, limit = 20) {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = envPick('ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL');
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const { data: tickets } = await sb.from('exception_tickets').select('id, kind, entity_type, entity_id, agent_recommendation').eq('status', 'open').limit(limit);
  let n = 0;
  for (const t of tickets ?? []) {
    if (t.agent_recommendation && t.agent_recommendation.length > 40) continue;
    let context = '';
    if (t.entity_type === 'application' && t.entity_id) {
      const { data } = await sb.from('eligibility_determinations').select('result, method, household_size, pct_amgi, tier, reasons, review_flags').eq('application_id', t.entity_id).order('created_at', { ascending: false }).limit(1).single();
      context = JSON.stringify(data);
    }
    const msg = await client.messages.create({ model: ANTHROPIC_MODEL, max_tokens: 300, system: SYSTEM,
      messages: [{ role: 'user', content: `Ticket kind: ${t.kind}\nExisting note: ${t.agent_recommendation ?? '(none)'}\nContext: ${context}` }] });
    const text = redact(msg.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join(' ').trim());
    await logAgentAction(sb, { agent: 'review-agent', model: ANTHROPIC_MODEL, promptVersion: PROMPT_VERSION, entityType: 'exception_ticket', entityId: t.id, output: { text } });
    await sb.from('exception_tickets').update({ agent_recommendation: text }).eq('id', t.id);
    n++;
  }
  return { drafted: n };
}
