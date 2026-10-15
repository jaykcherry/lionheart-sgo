import type { SupabaseClient } from '@supabase/supabase-js';

export type ActorKind = 'person' | 'job' | 'agent' | 'system';

/** Append-only audit trail. State transitions are audited by DB triggers; use this for everything else. */
export async function audit(sb: SupabaseClient, e: { actorKind: ActorKind; actorId: string; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown }) {
  const { error } = await sb.from('audit_events').insert({
    actor_kind: e.actorKind, actor_id: e.actorId, action: e.action, entity_type: e.entityType, entity_id: e.entityId ?? null,
    before: e.before ?? null, after: e.after ?? null,
  });
  if (error) throw new Error(`audit write failed: ${error.message}`);
}

/** Every agent output is logged with its model and prompt version before anything acts on it. */
export async function logAgentAction(sb: SupabaseClient, a: { agent: string; model: string; promptVersion: string; entityType?: string; entityId?: string; inputRef?: string; output: unknown; toolsUsed?: string[] }) {
  const { error } = await sb.from('agent_actions').insert({
    agent: a.agent, model: a.model, prompt_version: a.promptVersion, entity_type: a.entityType ?? null, entity_id: a.entityId ?? null,
    input_ref: a.inputRef ?? null, output: a.output, tools_used: a.toolsUsed ?? [],
  });
  if (error) throw new Error(`agent log failed: ${error.message}`);
}

export async function openTicket(sb: SupabaseClient, t: { kind: string; entityType: string; entityId?: string; severity?: 'critical' | 'warn' | 'info'; recommendation?: string }) {
  const { error } = await sb.from('exception_tickets').insert({
    kind: t.kind, entity_type: t.entityType, entity_id: t.entityId ?? null, severity: t.severity ?? 'warn', agent_recommendation: t.recommendation ?? null,
  });
  if (error) throw new Error(`ticket write failed: ${error.message}`);
}
