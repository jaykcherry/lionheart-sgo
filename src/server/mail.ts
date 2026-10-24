/** Ops alerts (tie-out problems, IRS report reminders, approvals) go to these addresses. */
export const opsAlertEmails = () => (process.env.OPS_ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
