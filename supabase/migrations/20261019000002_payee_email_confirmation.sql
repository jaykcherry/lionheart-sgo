-- Bank account changes are confirmed by email, never by phone.
-- A new account stays pending (inactive) until someone at the school's TDOE directory inbox clicks Confirm.
-- It then becomes the active account but is payable only after a cancel window (payable_after).
alter table school_payees add column if not exists status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE', 'REPLACED', 'CANCELLED'));
alter table school_payees add column if not exists requested_by uuid references profiles(id);
alter table school_payees add column if not exists replaces_payee_id uuid references school_payees(id);
alter table school_payees add column if not exists email_confirmed_at timestamptz;
alter table school_payees add column if not exists email_confirmed_to text;   -- masked address that confirmed
alter table school_payees add column if not exists payable_after timestamptz;
alter table school_payees add column if not exists cancelled_at timestamptz;
alter table school_payees drop column if exists callback_confirmed_at;
alter table school_payees drop column if exists callback_confirmed_by;

create table payee_tokens (
  id uuid primary key default gen_random_uuid(),
  payee_id uuid not null references school_payees(id) on delete cascade,
  school_id uuid not null references schools(id),
  kind text not null check (kind in ('confirm', 'cancel')),
  sent_to text not null,
  token_hash text not null unique,      -- sha256 of the emailed token; the token itself is never stored
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table payee_tokens enable row level security;   -- service role only
