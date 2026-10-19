-- Email-only school verification.
-- school_contacts: the official contact emails each school gave the Tennessee Department of Education
-- (Non-Public Schools Directory). Server-only: RLS on with no policies, so only the service role reads it.
create table school_contacts (
  school_id uuid not null references schools(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind text not null check (kind in ('primary', 'alternate')),
  source text not null,
  added_at timestamptz not null default now(),
  primary key (school_id, email)
);
alter table school_contacts enable row level security;

-- How each claim was verified and where the code went.
alter table school_claims add column if not exists method text not null default 'domain' check (method in ('domain', 'directory'));
alter table school_claims add column if not exists sent_to text;
alter table school_claims add column if not exists full_name text;
create index if not exists school_claims_recent on school_claims (school_id, created_at desc);
comment on column school_claims.email is 'The claimant''s own email (their login). For method=directory the code goes to sent_to, the school''s directory address.';
