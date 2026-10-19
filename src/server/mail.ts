/**
 * Print-and-mail for donors who didn't consent to electronic delivery. 'lob' sends a first-class letter through
 * Lob's API (https://docs.lob.com); 'none' opens a ticket for staff to mail it by hand.
 */
export interface Letter { to: { name: string; street: string; city: string; state: string; zip: string }; html: string; idempotencyKey: string; description: string }

export function mailProvider(): { name: string; send(l: Letter): Promise<{ ref: string }> } | null {
  if ((process.env.MAIL_PROVIDER ?? 'none') !== 'lob') return null;
  const key = process.env.LOB_API_KEY, from = process.env.LOB_FROM_ADDRESS_ID;
  if (!key || !from) throw new Error('LOB_API_KEY and LOB_FROM_ADDRESS_ID must be set for MAIL_PROVIDER=lob');
  return {
    name: 'lob',
    async send(l) {
      const res = await fetch('https://api.lob.com/v1/letters', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(`${key}:`), 'Content-Type': 'application/json', 'Idempotency-Key': l.idempotencyKey },
        body: JSON.stringify({
          description: l.description, from, color: false, use_type: 'operational', mail_type: 'usps_first_class', file: l.html,
          to: { name: l.to.name, address_line1: l.to.street, address_city: l.to.city, address_state: l.to.state, address_zip: l.to.zip },
        }),
      });
      if (!res.ok) throw new Error(`Lob letter failed: ${res.status} ${await res.text()}`);
      return { ref: ((await res.json()) as { id: string }).id };
    },
  };
}

/** Ops alerts (tie-out problems, IRS report reminders, approvals) go to these addresses. */
export const opsAlertEmails = () => (process.env.OPS_ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
