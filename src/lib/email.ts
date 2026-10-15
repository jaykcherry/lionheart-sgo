import { envPick } from './env';

/** Transactional email via Resend's HTTP API. Swap the fetch for Postmark/SES if preferred. */
export async function sendEmail(m: { to: string; subject: string; text: string; html?: string }) {
  const { RESEND_API_KEY, EMAIL_FROM } = envPick('RESEND_API_KEY', 'EMAIL_FROM');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
}
