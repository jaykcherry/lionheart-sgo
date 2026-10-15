-- Service-only RPCs used by jobs and agents. They set the actor so DB triggers audit and enforce
-- human-only transitions correctly. Not callable by browsers.
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;

create or replace function svc_transition_application(p_app uuid, p_to application_state, p_actor_kind text, p_actor_id text, p_hold text default null)
returns application_state language plpgsql security definer set search_path = public as $$
begin
  if p_actor_kind not in ('job','agent','system','person') then raise exception 'bad actor kind %', p_actor_kind; end if;
  perform set_config('lh.actor_kind', p_actor_kind, true);
  perform set_config('lh.actor_id', p_actor_id, true);
  update applications set state = p_to, hold_reason = coalesce(p_hold, hold_reason) where id = p_app;
  return (select state from applications where id = p_app);
end $$;

create or replace function svc_transition_batch(p_batch uuid, p_to batch_state, p_actor_id text)
returns batch_state language plpgsql security definer set search_path = public as $$
begin
  perform set_config('lh.actor_kind', 'job', true);
  perform set_config('lh.actor_id', p_actor_id, true);
  update disbursement_batches set state = p_to, sent_at = case when p_to = 'SENT' then now() else sent_at end where id = p_batch;
  return (select state from disbursement_batches where id = p_batch);
end $$;

/** Posts a balanced journal atomically (idempotent on kind+ref). */
create or replace function svc_post_journal(p_date date, p_kind text, p_ref text, p_postings jsonb, p_actor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare j uuid; p jsonb; i int := 0;
begin
  select id into j from ledger_journals where kind = p_kind and ref = p_ref;
  if found then return j; end if;
  insert into ledger_journals (date, kind, ref, created_by) values (p_date, p_kind, p_ref, p_actor) returning id into j;
  for p in select * from jsonb_array_elements(p_postings) loop
    i := i + 1;
    insert into ledger_postings (journal_id, line, fund, account, amount_cents) values (j, i, (p->>'fund')::fund, p->>'account', (p->>'amount')::bigint);
  end loop;
  return j;
end $$;

revoke all on function svc_transition_application, svc_transition_batch, svc_post_journal from public, authenticated, anon;
grant execute on function svc_transition_application, svc_transition_batch, svc_post_journal to service_role;

-- What a school sees about its Lionheart students: no income, no documents.
create or replace view school_roster with (security_invoker = true) as
  select w.id as award_id, a.id as application_id, a.school_id, m.full_name as student_name, a.grade, a.state,
         w.amount_cents, t.term, t.amount_cents as term_amount_cents, t.pay_on,
         oa.efs_cents, oa.school_aid_cents, ec.enrolled, ec.confirmed_at
  from awards w
  join applications a on a.id = w.application_id
  join household_members m on m.id = a.student_member_id
  join award_terms t on t.award_id = w.id
  left join other_aid oa on oa.application_id = a.id
  left join enrollment_confirmations ec on ec.award_id = w.id and ec.term = t.term;
grant select on school_roster to authenticated;
