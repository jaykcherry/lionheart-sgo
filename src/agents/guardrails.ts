/**
 * Guardrails shared by every agent.
 * - Agents read and recommend. They never change application, gift, or payment state directly;
 *   the database also refuses human-only transitions from non-person actors.
 * - Every output is logged (agent_actions) before anything uses it.
 * - SSNs/TINs are stripped from any text an agent emits or stores.
 */
export const SSN_RE = /\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g;
export const EIN_RE = /\b\d{2}-\d{7}\b/g;

export function redact(text: string): string {
  return text.replace(SSN_RE, '[SSN removed]');
}

export function redactDeep<T>(v: T): T {
  if (typeof v === 'string') return redact(v) as T;
  if (Array.isArray(v)) return v.map(redactDeep) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /ssn|tin|social/i.test(k) ? '[removed]' : redactDeep(x)])) as T;
  return v;
}

/** Confidence below this, or any disagreement with what the parent typed, sends the document to a person. */
export const MIN_CONFIDENCE = 0.9;

export const AGENT_PERMISSIONS = {
  'document-agent': { reads: ['documents'], writes: ['documents.extracted', 'agent_actions', 'exception_tickets'] },
  'review-agent': { reads: ['applications', 'eligibility_determinations', 'documents.extracted'], writes: ['exception_tickets.agent_recommendation', 'agent_actions'] },
  'support-agent': { reads: ['own applications (via the signed-in user)', 'public FAQ'], writes: ['agent_actions', 'exception_tickets (handoff)'] },
} as const;
