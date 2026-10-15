import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { envPick } from '@/lib/env';
import { logAgentAction, openTicket } from '@/lib/audit';
import { redact } from './guardrails';

export const PROMPT_VERSION = 'support-agent@2027.1';

const FAQ = `
- Credit: up to $1,700 per person per year ($3,400 for a married couple when each spouse gives in their own name). Gifts on or after Jan 1, 2027. Cash only (card, Apple Pay, PayPal, bank). DAF grants are welcome but do not earn the credit.
- Donors receive an acknowledgment with a donor number by Jan 31 and enter it on IRS Form 8525.
- Donors cannot choose a student. A school preference is optional and non-binding.
- Families: Tennessee residents, K-12, household income for last year at or below 300% of area median income. Renewals and siblings of recipients are funded first.
- Awards pay tuition and required fees directly to the school, in fall (Aug 20) and spring (Jan 20), after the school confirms enrollment.
- Schools: partnering is free and non-exclusive; schools confirm enrollment each term and refund prorated amounts if a student withdraws.`;

const SYSTEM = `You are Lionheart's help assistant for families, schools and donors. Be brief and plain.
Answer only from the FAQ and the tool results. If the question involves a decision (eligibility exceptions, appeals, custody, a denied application,
money movement, bank changes, or anything you aren't sure of), call handoff_to_staff and tell the person a staff member will reply within one business day.
Never give tax or legal advice beyond the FAQ. Never ask for or repeat SSNs or bank numbers.
FAQ:${FAQ}`;

const TOOLS: Anthropic.Tool[] = [
  { name: 'my_application_status', description: 'Status of the signed-in family’s applications and awards.', input_schema: { type: 'object', properties: {} } },
  { name: 'my_gifts', description: 'The signed-in donor’s gifts this year and remaining credit room.', input_schema: { type: 'object', properties: {} } },
  { name: 'handoff_to_staff', description: 'Send this conversation to a person.', input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } },
];

/**
 * `sbUser` is the RLS-bound client for the signed-in person, so tools can only ever see that person's own records.
 * `sbService` is used only to log and to open a handoff ticket.
 */
export async function answer(sbUser: SupabaseClient, sbService: SupabaseClient, userId: string, question: string) {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = envPick('ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL');
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: redact(question) }];
  const used: string[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const msg = await client.messages.create({ model: ANTHROPIC_MODEL, max_tokens: 600, system: SYSTEM, tools: TOOLS, messages });
    const calls = msg.content.filter((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    if (!calls.length) {
      const text = redact(msg.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n'));
      await logAgentAction(sbService, { agent: 'support-agent', model: ANTHROPIC_MODEL, promptVersion: PROMPT_VERSION, entityType: 'profile', entityId: userId, output: { question: redact(question), text }, toolsUsed: used });
      return { text, handedOff: used.includes('handoff_to_staff') };
    }
    messages.push({ role: 'assistant', content: msg.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const c of calls) {
      used.push(c.name);
      let out: unknown;
      if (c.name === 'my_application_status') out = (await sbUser.from('applications').select('ref, state, grade, awards(amount_cents, award_terms(term, amount_cents, pay_on))')).data;
      else if (c.name === 'my_gifts') out = (await sbUser.from('gifts').select('amount_cents, charge_on, state, designated')).data;
      else { await openTicket(sbService, { kind: 'support_handoff', entityType: 'profile', entityId: userId, recommendation: `${(c.input as { reason: string }).reason}\nQuestion: ${redact(question)}` }); out = { ok: true }; }
      results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out ?? null) });
    }
    messages.push({ role: 'user', content: results });
  }
  await openTicket(sbService, { kind: 'support_handoff', entityType: 'profile', entityId: userId, recommendation: `Agent could not resolve: ${redact(question)}` });
  return { text: 'A staff member will reply within one business day.', handedOff: true };
}
