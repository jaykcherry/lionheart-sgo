-- Award rounds run on a published schedule. The lottery seed is a public drand beacon value whose round number
-- is announced 14 days ahead; applicants and cash are frozen (and hashed) before that beacon exists.
alter table award_rounds add column if not exists beacon_round bigint;
alter table award_rounds add column if not exists beacon_signature text;
alter table award_rounds add column if not exists input_sha256 text;
alter table award_rounds add column if not exists schedule_id uuid;
alter table award_rounds add column if not exists approval_reminders int not null default 0;

create table award_round_schedule (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id),
  name text not null unique,
  announce_at timestamptz not null,
  freeze_at timestamptz not null,
  run_at timestamptz not null,
  beacon_round bigint not null,
  state text not null default 'SCHEDULED' check (state in ('SCHEDULED', 'ANNOUNCED', 'FROZEN', 'RUN', 'SKIPPED', 'FAILED')),
  frozen_input jsonb,                 -- RoundInput: candidates, cash, preference pools, policy
  frozen_sha256 text,
  round_id uuid references award_rounds(id),
  last_error text,
  created_at timestamptz not null default now()
);
alter table award_round_schedule enable row level security;
create policy "ops read" on award_round_schedule for select using (is_ops());
-- Public transparency: the schedule and beacon round numbers (not the frozen applicant data) are public.
create or replace view public_round_schedule as
  select name, announce_at, freeze_at, run_at, beacon_round, state, frozen_sha256 from award_round_schedule where state <> 'SCHEDULED';
grant select on public_round_schedule to anon, authenticated;
