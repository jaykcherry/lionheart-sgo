-- Integrity: legal state transitions, append-only records, balanced ledger, audited RPCs.
-- These mirror src/domain/stateMachines.ts so the database refuses illegal moves even if app code is wrong.

-- ───────────── Allowed application transitions ─────────────
create table application_transitions (
  from_state application_state not null,
  to_state application_state not null,
  human_only boolean not null default false,
  primary key (from_state, to_state)
);
insert into application_transitions (from_state, to_state, human_only) values
 ('DRAFT','SUBMITTED',false),('SUBMITTED','DOCS_PENDING',false),('SUBMITTED','AUTO_VERIFYING',false),('DOCS_PENDING','AUTO_VERIFYING',false),
 ('AUTO_VERIFYING','ELIGIBLE',false),('AUTO_VERIFYING','NEEDS_REVIEW',false),('AUTO_VERIFYING','INELIGIBLE_PROPOSED',false),('AUTO_VERIFYING','DOCS_PENDING',false),
 ('NEEDS_REVIEW','ELIGIBLE',true),('NEEDS_REVIEW','DOCS_PENDING',false),('NEEDS_REVIEW','DENIED',true),('INELIGIBLE_PROPOSED','DENIED',true),
 ('INELIGIBLE_PROPOSED','ELIGIBLE',true),('DENIED','APPEAL',false),('APPEAL','ELIGIBLE',true),('APPEAL','CLOSED',true),
 ('ELIGIBLE','QUEUED',false),('QUEUED','AWARDED',false),('QUEUED','WAITLISTED',false),('WAITLISTED','AWARDED',false),
 ('QUEUED','HELD',false),('WAITLISTED','HELD',false),('AWARDED','HELD',false),('ACTIVE','HELD',false),('HELD','QUEUED',true),('HELD','DENIED',true),
 ('AWARDED','ACCEPTED',false),('AWARDED','DECLINED',false),('AWARDED','WAITLISTED',false),('ACCEPTED','SCHOOL_CONFIRMED',false),
 ('SCHOOL_CONFIRMED','ACTIVE',false),('ACTIVE','WITHDRAWN',false),('ACTIVE','CLOSED',false),('WITHDRAWN','CLOSED',false),('DECLINED','CLOSED',false);

-- Session settings carry the actor for audit: set by RPCs/jobs via set_config('lh.actor_kind', ...)
create or replace function current_actor_kind() returns text language sql stable as $$
  select coalesce(nullif(current_setting('lh.actor_kind', true), ''), case when auth.uid() is null then 'system' else 'person' end)
$$;
create or replace function current_actor_id() returns text language sql stable as $$
  select coalesce(nullif(current_setting('lh.actor_id', true), ''), auth.uid()::text, 'system')
$$;

create or replace function enforce_application_transition() returns trigger language plpgsql as $$
declare t application_transitions;
begin
  if new.state = old.state then new.updated_at := now(); return new; end if;
  select * into t from application_transitions where from_state = old.state and to_state = new.state;
  if not found then raise exception 'illegal application transition % -> %', old.state, new.state using errcode = 'check_violation'; end if;
  if t.human_only and current_actor_kind() <> 'person' then
    raise exception 'transition % -> % requires a person (actor: %)', old.state, new.state, current_actor_kind() using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  insert into audit_events (actor_kind, actor_id, action, entity_type, entity_id, before, after)
  values (current_actor_kind(), current_actor_id(), 'state_change', 'application', new.id::text, jsonb_build_object('state', old.state), jsonb_build_object('state', new.state, 'hold_reason', new.hold_reason));
  return new;
end $$;
create trigger application_transition before update of state on applications for each row execute function enforce_application_transition();

-- Same pattern for batches: second approval must be a board member; send only after two approvals.
create or replace function enforce_batch_transition() returns trigger language plpgsql as $$
declare n int; nb int;
begin
  if new.state = old.state then return new; end if;
  if not ((old.state, new.state) in (('DRAFT','PREPARED'),('PREPARED','APPROVED_1'),('APPROVED_1','APPROVED_2'),('APPROVED_2','SENT'),('SENT','SETTLED'),('SENT','RETURNED'))) then
    raise exception 'illegal batch transition % -> %', old.state, new.state;
  end if;
  if new.state = 'SENT' then
    select count(distinct user_id), count(*) filter (where role = 'board') into n, nb from batch_approvals where batch_id = new.id and user_id::text <> new.prepared_by;
    if n < 2 or nb < 1 then raise exception 'batch % needs two distinct approvers including a board member (has %, board %)', new.name, n, nb; end if;
  end if;
  insert into audit_events (actor_kind, actor_id, action, entity_type, entity_id, before, after)
  values (current_actor_kind(), current_actor_id(), 'state_change', 'disbursement_batch', new.id::text, jsonb_build_object('state', old.state), jsonb_build_object('state', new.state));
  return new;
end $$;
create trigger batch_transition before update of state on disbursement_batches for each row execute function enforce_batch_transition();

-- ───────────── Append-only tables ─────────────
create or replace function forbid_change() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger append_only before update or delete on audit_events for each row execute function forbid_change();
create trigger append_only before update or delete on agent_actions for each row execute function forbid_change();
create trigger append_only before update or delete on designation_consents for each row execute function forbid_change();
create trigger append_only before update or delete on ledger_postings for each row execute function forbid_change();
create trigger append_only before update or delete on ledger_journals for each row execute function forbid_change();

-- ───────────── Balanced journals (checked at commit) ─────────────
create or replace function check_journal_balanced() returns trigger language plpgsql as $$
declare s bigint;
begin
  select coalesce(sum(amount_cents), 0) into s from ledger_postings where journal_id = new.journal_id;
  if s <> 0 then raise exception 'journal % is unbalanced by % cents', new.journal_id, s; end if;
  return null;
end $$;
create constraint trigger journal_balanced after insert on ledger_postings deferrable initially deferred
  for each row execute function check_journal_balanced();

-- Segregated-fund purity: only these journal kinds may touch the §25F fund.
create or replace function check_segregated_kind() returns trigger language plpgsql as $$
declare k text;
begin
  if new.fund <> '25F-TN' then return new; end if;
  select kind into k from ledger_journals where id = new.journal_id;
  if k not in ('gift','earnings','scholarship_payment','school_refund','chargeback','fee_topup') then
    raise exception 'journal kind % may not post to the §25F fund', k;
  end if;
  return new;
end $$;
create trigger segregated_kind before insert on ledger_postings for each row execute function check_segregated_kind();

-- ───────────── RPCs (security definer, each checks the caller's role) ─────────────
create or replace function accept_award(p_application uuid, p_accept boolean) returns application_state
language plpgsql security definer set search_path = public as $$
declare a applications;
begin
  select * into a from applications where id = p_application for update;
  if a.household_id not in (select my_household_ids()) then raise exception 'not your application'; end if;
  perform set_config('lh.actor_kind', 'person', true);
  update applications set state = case when p_accept then 'ACCEPTED'::application_state else 'DECLINED'::application_state end where id = p_application;
  if p_accept then update awards set accepted_at = now() where application_id = p_application; end if;
  return (select state from applications where id = p_application);
end $$;

create or replace function attest_residency(p_household uuid, p_term text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_household not in (select my_household_ids()) then raise exception 'not your household'; end if;
  insert into residency_attestations (household_id, term, attested_by) values (p_household, p_term, auth.uid())
  on conflict (household_id, term) do update set attested_by = excluded.attested_by, attested_at = now();
end $$;

create or replace function confirm_enrollment(p_award uuid, p_term text, p_enrolled boolean, p_tuition_cents int) returns void
language plpgsql security definer set search_path = public as $$
declare a applications;
begin
  select ap.* into a from awards w join applications ap on ap.id = w.application_id where w.id = p_award;
  if a.school_id not in (select my_school_ids()) then raise exception 'not your student'; end if;
  insert into enrollment_confirmations (award_id, term, enrolled, tuition_cents, confirmed_by) values (p_award, p_term, p_enrolled, p_tuition_cents, auth.uid())
  on conflict (award_id, term) do update set enrolled = excluded.enrolled, tuition_cents = excluded.tuition_cents, confirmed_by = excluded.confirmed_by, confirmed_at = now();
  perform set_config('lh.actor_kind', 'person', true);
  if p_enrolled and a.state = 'ACCEPTED' then update applications set state = 'SCHOOL_CONFIRMED' where id = a.id; end if;
  if not p_enrolled then
    insert into exception_tickets (kind, entity_type, entity_id, severity, agent_recommendation)
    values ('enrollment_mismatch', 'application', a.id, 'warn', 'School reports the student is not enrolled. Hold payment and contact the family.');
  end if;
end $$;

create or replace function review_application(p_application uuid, p_to application_state, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'staff or board only'; end if;
  if p_to in ('DENIED') and not has_role('board') and exists (select 1 from applications where id = p_application and state = 'HELD') then
    raise exception 'only the board may deny a held application';
  end if;
  perform set_config('lh.actor_kind', 'person', true);
  update applications set state = p_to, hold_reason = case when p_to = 'QUEUED' then null else hold_reason end where id = p_application;
  update exception_tickets set status = 'resolved', resolution = p_note, resolved_by = auth.uid(), resolved_at = now()
  where entity_id = p_application and status <> 'resolved';
end $$;

create or replace function approve_batch(p_batch uuid) returns batch_state
language plpgsql security definer set search_path = public as $$
declare b disbursement_batches; r app_role; n int;
begin
  if not is_ops() then raise exception 'staff or board only'; end if;
  select * into b from disbursement_batches where id = p_batch for update;
  r := case when has_role('board') then 'board'::app_role else 'staff'::app_role end;
  select count(*) into n from batch_approvals where batch_id = p_batch;
  if n = 1 and r <> 'board' then raise exception 'the second approval must come from a board officer'; end if;
  insert into batch_approvals (batch_id, user_id, role) values (p_batch, auth.uid(), r);
  perform set_config('lh.actor_kind', 'person', true);
  update disbursement_batches set state = case when n = 0 then 'APPROVED_1'::batch_state else 'APPROVED_2'::batch_state end where id = p_batch;
  return (select state from disbursement_batches where id = p_batch);
end $$;

grant execute on function accept_award, attest_residency, confirm_enrollment, review_application, approve_batch to authenticated;
