import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { envPick } from '@/lib/env';
import { logAgentAction, openTicket } from '@/lib/audit';
import { redactDeep, MIN_CONFIDENCE } from './guardrails';

export const PROMPT_VERSION = 'document-agent@2027.1';

/** What we extract. No SSN fields exist in the schema, so the model has nowhere to put one. */
export const Extraction = z.object({
  documentType: z.enum(['w2', '1040', 'paystub', 'transcript', 'benefit_letter', 'foster_letter', 'proof_of_address', 'unknown']),
  taxYear: z.number().int().nullable(),
  personName: z.string().nullable(),
  employerName: z.string().nullable(),
  amounts: z.object({
    w2Box1Wages: z.number().nullable(),
    form1040Line11Agi: z.number().nullable(),
    form1040Line9TotalIncome: z.number().nullable(),
    paystubYtdGross: z.number().nullable(),
  }),
  benefit: z.object({ program: z.string().nullable(), letterDate: z.string().nullable(), recipientNames: z.array(z.string()) }).nullable(),
  address: z.string().nullable(),
  issues: z.array(z.string()).describe('Anything unreadable, altered, cropped, or inconsistent'),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof Extraction>;

const TOOL: Anthropic.Tool = {
  name: 'record_extraction',
  description: 'Record the structured fields read from one household document.',
  input_schema: {
    type: 'object',
    properties: {
      documentType: { type: 'string', enum: ['w2', '1040', 'paystub', 'transcript', 'benefit_letter', 'foster_letter', 'proof_of_address', 'unknown'] },
      taxYear: { type: ['integer', 'null'] },
      personName: { type: ['string', 'null'] },
      employerName: { type: ['string', 'null'] },
      amounts: { type: 'object', properties: {
        w2Box1Wages: { type: ['number', 'null'] }, form1040Line11Agi: { type: ['number', 'null'] },
        form1040Line9TotalIncome: { type: ['number', 'null'] }, paystubYtdGross: { type: ['number', 'null'] } },
        required: ['w2Box1Wages', 'form1040Line11Agi', 'form1040Line9TotalIncome', 'paystubYtdGross'] },
      benefit: { type: ['object', 'null'], properties: { program: { type: ['string', 'null'] }, letterDate: { type: ['string', 'null'] }, recipientNames: { type: 'array', items: { type: 'string' } } } },
      address: { type: ['string', 'null'] },
      issues: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['documentType', 'taxYear', 'personName', 'employerName', 'amounts', 'benefit', 'address', 'issues', 'confidence'],
  },
};

const SYSTEM = `You read household documents for a Tennessee K-12 scholarship organization.
Extract only the fields in the tool schema. Dollar amounts are numbers in dollars (no symbols).
Never output Social Security numbers, account numbers, or dates of birth, even in "issues".
If the document looks edited, cropped, mismatched, or is not the type expected, say so in "issues" and lower confidence.
You do not decide eligibility. Call record_extraction exactly once.`;

/**
 * Extracts fields from one uploaded document, logs the action, stores the extraction for the parent to confirm,
 * and opens a review ticket when confidence is low or issues are found. Never changes application state.
 */
export async function extractDocument(sb: SupabaseClient, documentId: string, expectedKind: string) {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = envPick('ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL');
  const { data: doc } = await sb.from('documents').select('id, storage_path, application_id, household_id').eq('id', documentId).single();
  if (!doc) throw new Error('document not found');
  const { data: file, error } = await sb.storage.from('documents').download(doc.storage_path);
  if (error || !file) throw new Error(`download failed: ${error?.message}`);
  const bytes = Buffer.from(await file.arrayBuffer()).toString('base64');
  const isPdf = file.type === 'application/pdf' || doc.storage_path.endsWith('.pdf');

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL, max_tokens: 1500, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: [
      isPdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes } }
            : { type: 'image', source: { type: 'base64', media_type: (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: bytes } },
      { type: 'text', text: `The family uploaded this as: ${expectedKind}.` },
    ] }],
  });
  const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
  const parsed = Extraction.safeParse(call?.input);
  const output = redactDeep(parsed.success ? parsed.data : { error: 'schema_mismatch', raw: call?.input ?? null });

  await logAgentAction(sb, { agent: 'document-agent', model: ANTHROPIC_MODEL, promptVersion: PROMPT_VERSION, entityType: 'document', entityId: doc.id, inputRef: doc.storage_path, output, toolsUsed: [TOOL.name] });
  if (!parsed.success) {
    await openTicket(sb, { kind: 'document_review', entityType: 'document', entityId: doc.id, recommendation: 'Automatic reading failed. A person should read this document.' });
    return null;
  }
  const ex = output as Extraction;
  await sb.from('documents').update({ extracted: ex, extraction_model: ANTHROPIC_MODEL, extraction_confidence: ex.confidence }).eq('id', doc.id);
  if (ex.confidence < MIN_CONFIDENCE || ex.issues.length || (ex.documentType !== expectedKind && expectedKind !== 'other')) {
    await openTicket(sb, { kind: 'document_review', entityType: 'document', entityId: doc.id,
      recommendation: `Confidence ${ex.confidence.toFixed(2)}. ${ex.issues.join(' ') || ''}${ex.documentType !== expectedKind ? ` Looks like ${ex.documentType}, uploaded as ${expectedKind}.` : ''}`.trim() });
  }
  // Fraud signal: identical file already used by a different household
  const { data: dup } = await sb.from('documents').select('household_id, sha256').eq('sha256', (await sb.from('documents').select('sha256').eq('id', doc.id).single()).data?.sha256 ?? '').neq('household_id', doc.household_id).limit(1);
  if (dup && dup.length) await openTicket(sb, { kind: 'fraud_flag', entityType: 'document', entityId: doc.id, severity: 'critical', recommendation: 'The same file was uploaded by another household. Hold both applications and review.' });
  return ex;
}
