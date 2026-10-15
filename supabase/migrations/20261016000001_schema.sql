-- Lionheart SGO core schema. Money is integer cents everywhere.
-- Mirrors src/domain. State columns are enforced by transition tables + triggers (see 0003).

create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type app_role as enum ('family', 'school_admin', 'donor', 'staff', 'board');
create type application_state as enum ('DRAFT','SUBMITTED','DOCS_PENDING','AUTO_VERIFYING','NEEDS_REVIEW','INELIGIBLE_PROPOSED',
  'ELIGIBLE','DENIED','APPEAL','QUEUED','WAITLISTED','AWARDED','ACCEPTED','DECLINED','SCHOOL_CONFIRMED','ACTIVE','WITHDRAWN','CLOSED','HELD');
create type gift_state as enum ('PLEDGED','DESIGNATION_RECONFIRMED','CHARGED','FAILED','SETTLED','DEPOSITED','RECONCILED','ACKNOWLEDGED','REPORTED','CHARGEBACK','CANCELLED');
create type school_state as enum ('UNCLAIMED','CLAIM_PENDING','DOMAIN_VERIFIED','AGREEMENT_SIGNED','PAYEE_VERIFIED','ACTIVE','SUSPENDED','ENDED');
create type batch_state as enum ('DRAFT','PREPARED','APPROVED_1','APPROVED_2','SENT','SETTLED','RETURNED');
create type fund as enum ('25F-TN','general','operating');
create type need_tier as enum ('A','B','C');
create type payment_method as enum ('card','apple_pay','google_pay','ach','paypal','check','daf','stock','crypto');
create type eligibility_result as enum ('ELIGIBLE','INELIGIBLE_PROPOSED','NEEDS_REVIEW');
create type severity as enum ('critical','warn','info');

-- ───────────────────────── People & roles ─────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  mfa_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid not null references profiles(id),
  street text, city text, state text not null default 'TN', zip text, county text,
  residency_exception text check (residency_exception in ('military_dependent','indian_lands')),
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  full_name text not null,
  relationship text not null check (relationship in ('self','spouse','partner','child','parent','other_relative','other')),
  dob date,
  is_student boolean not null default false,
  zero_income_attested boolean not null default false,
  created_at timestamptz not null default now()
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  city text not null,
  grades text,
  email_domain text not null,
  main_phone text,
  accreditor text,
  state school_state not null default 'UNCLAIMED',
  created_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role app_role not null,
  household_id uuid references households(id),
  school_id uuid references schools(id),
  granted_at timestamptz not null default now(),
  scope_key text generated always as (coalesce(household_id::text, school_id::text, '-')) stored,
  primary key (user_id, role, scope_key)
);

-- ───────────────────────── Schools ─────────────────────────
create table school_claims (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  user_id uuid not null references profiles(id),
  title text not null,
  email text not null,
  code_hash text not null,           -- sha256 of the 6-digit code; code itself is never stored
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table school_agreements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  version text not null,
  text_sha256 text not null,
  signed_by uuid not null references profiles(id),
  signed_at timestamptz not null default now(),
  ip inet
);

create table school_payees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  legal_name text not null,
  ein text not null,
  processor_account_ref text not null,  -- tokenized bank account at the payments provider; raw numbers never stored
  last4 text not null,
  verified_at timestamptz,
  changed_at timestamptz not null default now(),
  callback_confirmed_at timestamptz,
  callback_confirmed_by uuid references profiles(id),
  active boolean not null default true
);
create unique index one_active_payee on school_payees(school_id) where active;

create table tuition_schedules (
  school_id uuid not null references schools(id),
  school_year text not null,              -- '2027-28'
  grade text not null,
  tuition_cents int not null check (tuition_cents >= 0),
  required_fees_cents int not null default 0 check (required_fees_cents >= 0),
  primary key (school_id, school_year, grade)
);

-- ───────────────────────── Applications & eligibility ─────────────────────────
create table award_policies (
  version text primary key,
  params jsonb not null,                  -- serialized AwardPolicy from src/domain/awards.ts
  adopted_at timestamptz,
  adopted_minutes_ref text,
  created_at timestamptz not null default now()
);

create table limits_tables (
  version text primary key,
  data jsonb not null,                    -- serialized LimitsTable
  source text not null,
  loaded_at timestamptz not null default now()
);

create table cycles (
  id uuid primary key default gen_random_uuid(),
  school_year text unique not null,
  opens_on date not null,
  closes_on date,
  policy_version text references award_policies(version),
  limits_version text references limits_tables(version)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default ('LH-A-' || upper(substr(md5(random()::text), 1, 6))),
  household_id uuid not null references households(id),
  student_member_id uuid not null references household_members(id),
  cycle_id uuid not null references cycles(id),
  school_id uuid references schools(id),
  grade text not null check (grade in ('K','1','2','3','4','5','6','7','8','9','10','11','12')),
  state application_state not null default 'DRAFT',
  priority smallint not null default 3 check (priority in (1,2,3)),
  hold_reason text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_member_id, cycle_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  application_id uuid references applications(id),
  kind text not null check (kind in ('w2','1040','paystub','transcript','benefit_letter','foster_letter','proof_of_address','other')),
  storage_path text not null,             -- private bucket "documents", SSNs redacted on ingest
  sha256 text not null,
  extracted jsonb,                        -- structured fields from the document agent
  extraction_model text,
  extraction_confidence numeric,
  confirmed_by_parent_at timestamptz,
  delete_raw_after date,                  -- retention: raw file deleted, extracted values + hash kept
  created_at timestamptz not null default now()
);
create index on documents (sha256);       -- reused-document fraud check

create table income_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  member_id uuid not null references household_members(id),
  type text not null,
  amount_cents int not null check (amount_cents >= 0),
  year int not null,
  cash boolean not null default true,
  source text not null,
  document_id uuid references documents(id)
);

create table categorical_proofs (
  application_id uuid primary key references applications(id) on delete cascade,
  program text not null,
  letter_date date not null,
  name_matches boolean not null,
  document_id uuid references documents(id)
);

create table other_aid (
  application_id uuid primary key references applications(id) on delete cascade,
  efs_cents int not null default 0,
  school_aid_cents int not null default 0,
  other_sgo_cents int not null default 0,
  other_cents int not null default 0,
  family_attested_at timestamptz,
  school_confirmed_at timestamptz
);

create table eligibility_determinations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  result eligibility_result not null,
  method text,
  household_size int not null,
  income_total_cents int,
  pct_amgi numeric,
  tier need_tier,
  limits_version text not null references limits_tables(version),
  reasons jsonb not null default '[]',
  review_flags jsonb not null default '[]',
  engine_version text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Awards & payments ─────────────────────────
create table award_rounds (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id),
  name text not null,
  seed text not null,                     -- published to the board before the run
  cash_available_cents int not null,
  policy_version text not null references award_policies(version),
  result jsonb,                           -- full AllocationResult (audit)
  run_at timestamptz,
  run_by text,
  approved_at timestamptz,
  approved_by uuid references profiles(id)
);

create table awards (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id),
  round_id uuid not null references award_rounds(id),
  tier need_tier not null,
  unmet_cents int not null,
  amount_cents int not null check (amount_cents > 0),
  offer_expires_on date,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table award_terms (
  award_id uuid not null references awards(id) on delete cascade,
  term text not null,
  amount_cents int not null check (amount_cents >= 0),
  pay_on date not null,
  primary key (award_id, term)
);

create table enrollment_confirmations (
  award_id uuid not null references awards(id),
  term text not null,
  enrolled boolean not null,
  tuition_cents int,
  confirmed_by uuid not null references profiles(id),
  confirmed_at timestamptz not null default now(),
  primary key (award_id, term)
);

create table residency_attestations (
  household_id uuid not null references households(id),
  term text not null,
  attested_by uuid not null references profiles(id),
  attested_at timestamptz not null default now(),
  primary key (household_id, term)
);

create table disbursement_batches (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  term text not null,
  state batch_state not null default 'DRAFT',
  prepared_by text not null,              -- usually 'job:disbursement-preparer'
  ready_total_cents int not null default 0,
  sent_at timestamptz,
  provider_ref text,
  created_at timestamptz not null default now()
);

create table disbursement_lines (
  batch_id uuid not null references disbursement_batches(id) on delete cascade,
  award_id uuid not null references awards(id),
  school_id uuid not null references schools(id),
  term text not null,
  amount_cents int not null,
  status text not null check (status in ('READY','BLOCKED','SENT','RETURNED')),
  blockers jsonb not null default '[]',
  primary key (batch_id, award_id)
);

create table batch_approvals (
  batch_id uuid not null references disbursement_batches(id),
  user_id uuid not null references profiles(id),
  role app_role not null,
  approved_at timestamptz not null default now(),
  primary key (batch_id, user_id)
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references awards(id),
  term text not null,
  days_enrolled int not null,
  term_days int not null,
  amount_cents int not null,
  reported_by uuid references profiles(id),
  reported_at timestamptz not null default now(),
  received_at timestamptz
);

-- ───────────────────────── Donors & gifts ─────────────────────────
create table donors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  legal_name text not null,
  street text, city text, state text, zip text,
  email text not null,
  household_key text,                     -- links spouses for substantial-contributor aggregation
  e_delivery_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table designation_consents (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references donors(id),
  text_version text not null,
  text_sha256 text not null,
  amount_cents int not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  context text not null check (context in ('checkout','pledge_charge_reconfirm'))
);

create table gifts (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references donors(id),
  amount_cents int not null check (amount_cents > 0),
  method payment_method not null,
  fund fund not null,
  designated boolean not null default false,
  designation_consent_id uuid references designation_consents(id),
  state gift_state not null default 'PLEDGED',
  charge_on date not null,
  processor text,
  processor_ref text unique,
  processor_customer text,
  processor_payment_method text,
  fee_cents int,
  preferred_school_id uuid references schools(id),   -- non-binding preference
  created_at timestamptz not null default now(),
  check (fund <> '25F-TN' or (designated and designation_consent_id is not null and method in ('card','apple_pay','google_pay','ach','paypal','check')))
);

create table donor_numbers (
  donor_id uuid not null references donors(id),
  year int not null,
  value text not null unique,
  primary key (donor_id, year)
);

create table acknowledgments (
  donor_id uuid not null references donors(id),
  year int not null,
  donor_number text not null,
  total_cents int not null,
  pdf_path text,
  pdf_sha256 text,
  delivery text not null check (delivery in ('email','mail')),
  delivered_at timestamptz,
  primary key (donor_id, year)
);

create table irs_reports (
  year int primary key,
  row_count int not null,
  total_cents int not null,
  file_path text not null,
  file_sha256 text not null,
  submitted_at timestamptz,
  submitted_by uuid references profiles(id)
);

-- ───────────────────────── Ledger & bank ─────────────────────────
create table ledger_journals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null,
  ref text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (kind, ref)                       -- idempotency: one journal per event
);
create table ledger_postings (
  journal_id uuid not null references ledger_journals(id),
  line int not null,
  fund fund not null,
  account text not null,
  amount_cents bigint not null,
  primary key (journal_id, line)
);
create table processor_settlements (
  ref text primary key,
  date date not null,
  gross_cents int not null, fee_cents int not null, net_cents int not null,
  fund fund not null,
  payout_ref text
);
create table bank_lines (
  id text primary key,                     -- bank's transaction id
  account text not null check (account in ('segregated','operating')),
  date date not null,
  amount_cents bigint not null,
  memo text,
  ref text
);

-- ───────────────────────── Compliance, review, audit ─────────────────────────
create table dq_persons (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, dob date, address text,
  role text not null check (role in ('officer','director','trustee','selection_participant','substantial_contributor')),
  year int not null,
  source text not null default 'manual'
);
create table dq_relatives (
  id uuid primary key default gen_random_uuid(),
  dq_person_id uuid not null references dq_persons(id) on delete cascade,
  full_name text not null, dob date, address text, relation text not null
);

create table exception_tickets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                      -- 'eligibility_review','dq_match','fraud_flag','recon','payee_change','support_handoff'
  entity_type text not null,
  entity_id uuid,
  severity severity not null default 'warn',
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  assigned_to uuid references profiles(id),
  sla_due timestamptz not null default now() + interval '2 days',          -- SLA; business-day logic lives in the job
  agent_recommendation text,
  resolution text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table compliance_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  findings jsonb not null,
  critical_count int not null
);

create table agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  model text not null,
  prompt_version text not null,
  entity_type text, entity_id uuid,
  input_ref text,                          -- storage path / ids, never raw SSNs
  output jsonb not null,
  tools_used jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_kind text not null check (actor_kind in ('person','job','agent','system')),
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb, after jsonb
);

create index on applications (state);
create index on applications (household_id);
create index on gifts (donor_id, charge_on);
create index on gifts (state, charge_on);
create index on exception_tickets (status, sla_due);
