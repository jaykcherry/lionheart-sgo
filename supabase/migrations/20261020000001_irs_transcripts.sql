-- IRS income verification (Form 4506-C through an IVES participant).
-- No Social Security numbers are stored: the full number goes to the transcript vendor when the family signs,
-- and only the last four digits are kept here.

create table irs_consents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  tax_year int not null,
  member_ids uuid[] not null,                 -- people on this return (two for a joint return)
  filing_status text not null check (filing_status in ('single', 'mfj', 'mfs', 'hoh', 'qss')),
  name_on_return text not null,
  spouse_name_on_return text,
  ssn_last4 text not null check (ssn_last4 ~ '^[0-9]{4}$'),
  spouse_ssn_last4 text check (spouse_ssn_last4 is null or spouse_ssn_last4 ~ '^[0-9]{4}$'),
  address_on_return text not null,
  -- Electronic signature record (IRS IVES e-signature requirements: identity, intent, consent, record retention)
  signer_user_id uuid not null references profiles(id),
  signer_typed_name text not null,
  spouse_typed_name text,
  signed_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text,
  consent_text_version text not null,
  consent_sha256 text not null,               -- hash of the exact form text and field values signed
  created_at timestamptz not null default now()
);
create index on irs_consents (household_id, tax_year);

create table irs_transcript_requests (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null references irs_consents(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  provider text not null,
  provider_ref text,
  state text not null default 'REQUESTED' check (state in ('REQUESTED', 'RECEIVED', 'NO_RECORD', 'REJECTED', 'ERROR')),
  outcome jsonb,                              -- normalized TranscriptOutcome (figures only; no SSNs)
  raw_sha256 text,                            -- hash of the vendor payload, for audit; the raw transcript is not kept
  attempts int not null default 1,
  next_retry_on date,
  last_error text,
  requested_at timestamptz not null default now(),
  received_at timestamptz
);
create index on irs_transcript_requests (state, next_retry_on);

alter table irs_consents enable row level security;
alter table irs_transcript_requests enable row level security;
create policy "family reads own consents" on irs_consents for select using (household_id in (select household_id from user_roles where user_id = auth.uid() and role = 'family'));
create policy "family reads own transcript status" on irs_transcript_requests for select using (household_id in (select household_id from user_roles where user_id = auth.uid() and role = 'family'));
create policy "ops read" on irs_consents for select using (is_ops());
create policy "ops read" on irs_transcript_requests for select using (is_ops());
-- Inserts and updates happen only through the service role (server actions and jobs).
