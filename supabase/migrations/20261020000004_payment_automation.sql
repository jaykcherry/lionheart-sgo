-- School payments: two people still approve every batch (the second a board officer; unchanged). Around that,
-- everything is automatic: safety checks, approval requests and reminders, sending through the bank's API on
-- the pay date once both approvals are in, enrollment/residency reminders, and refund invoicing and netting.

alter table disbursement_batches add column if not exists pay_on date;
alter table disbursement_batches add column if not exists safety_problems jsonb not null default '[]';
alter table disbursement_batches add column if not exists approval_reminders int not null default 0;

-- Refunds owed by schools after a withdrawal: invoiced by email, netted from the next payment if unpaid.
alter table refunds add column if not exists school_id uuid references schools(id);
alter table refunds add column if not exists due_on date;
alter table refunds add column if not exists invoice_sent_at timestamptz;
alter table refunds add column if not exists reminders_sent int not null default 0;
alter table refunds add column if not exists netted_batch_id uuid references disbursement_batches(id);

-- Reminder log (one row per recipient per term per reminder day), so jobs never send the same reminder twice.
create table reminder_log (
  kind text not null,                 -- 'enrollment' | 'residency' | 'refund' | 'batch_approval'
  term text not null,
  recipient text not null,
  day int not null,
  sent_at timestamptz not null default now(),
  primary key (kind, term, recipient, day)
);
alter table reminder_log enable row level security;
create policy "ops read" on reminder_log for select using (is_ops());

-- Per-school tracker: monthly designated totals (aggregated; never individual gifts or donors).
create or replace view school_support_monthly as
select s.slug, to_char(date_trunc('month', coalesce(g.charge_on, g.created_at::date)), 'YYYY-MM') as month,
       sum(g.amount_cents)::bigint as designated_cents
from schools s
join gifts g on g.preferred_school_id = s.id and g.fund = '25F-TN' and g.designated and g.state not in ('FAILED', 'CHARGEBACK', 'CANCELLED')
group by s.slug, 2;
revoke all on school_support_monthly from public;
grant select on school_support_monthly to anon, authenticated;
