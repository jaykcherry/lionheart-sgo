-- Database integrity tests. Run: scripts/test-db.sh (applies migrations to a scratch Postgres, then this file).
\set ON_ERROR_STOP 1
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(needle in sqlerrm) = 0 then raise exception 'expected error containing "%", got "%"', needle, sqlerrm; end if;
    raise notice 'ok: % → %', left(sql, 60), sqlerrm; return;
  end;
  raise exception 'expected error containing "%" but statement succeeded: %', needle, sql;
end $$;

-- fixtures
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-0000000000cc');
insert into profiles (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@x'), ('00000000-0000-0000-0000-00000000000b', 'b@x'), ('00000000-0000-0000-0000-0000000000cc', 'staff@x');
insert into households (id, primary_user_id, county) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Davidson'), ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Wilson');
insert into user_roles (user_id, role, household_id) values ('00000000-0000-0000-0000-00000000000a', 'family', '10000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b', 'family', '10000000-0000-0000-0000-00000000000b');
insert into user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000cc', 'staff');
insert into household_members (id, household_id, full_name, relationship, is_student) values ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Sam Roe', 'child', true), ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Ann Lee', 'child', true);
insert into applications (id, household_id, student_member_id, cycle_id, school_id, grade) select '30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', c.id, s.id, '3' from cycles c, schools s where s.slug = 'ncs';
insert into applications (id, household_id, student_member_id, cycle_id, school_id, grade) select '30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', c.id, s.id, '5' from cycles c, schools s where s.slug = 'cpa';

-- 1. illegal transitions are refused
select expect_error($$update applications set state = 'ACTIVE' where id = '30000000-0000-0000-0000-00000000000a'$$, 'illegal application transition');
-- 2. a job/agent cannot make a human-only decision
update applications set state = 'SUBMITTED' where id = '30000000-0000-0000-0000-00000000000a';
update applications set state = 'AUTO_VERIFYING' where id = '30000000-0000-0000-0000-00000000000a';
update applications set state = 'NEEDS_REVIEW' where id = '30000000-0000-0000-0000-00000000000a';
select set_config('lh.actor_kind', 'agent', false);
select expect_error($$update applications set state = 'DENIED' where id = '30000000-0000-0000-0000-00000000000a'$$, 'requires a person');
select set_config('lh.actor_kind', '', false);
-- 3. every transition is audited
do $$ begin if (select count(*) from audit_events where entity_id = '30000000-0000-0000-0000-00000000000a') <> 3 then raise exception 'expected 3 audit events'; end if; raise notice 'ok: transitions audited'; end $$;
-- 4. audit log is append-only
select expect_error($$delete from audit_events$$, 'append-only');
-- 5. unbalanced journals fail at commit
insert into ledger_journals (id, date, kind, ref, created_by) values ('40000000-0000-0000-0000-000000000001', '2027-01-01', 'gift', 'ch_ok', 'test');
insert into ledger_postings values ('40000000-0000-0000-0000-000000000001', 1, '25F-TN', 'cash', 170000), ('40000000-0000-0000-0000-000000000001', 2, '25F-TN', 'contributions', -170000);
select expect_error($$
  with j as (insert into ledger_journals (date, kind, ref, created_by) values ('2027-01-02', 'gift', 'ch_bad', 'test') returning id)
  insert into ledger_postings select id, 1, '25F-TN', 'cash', 100 from j; set constraints all immediate$$, 'unbalanced');
-- 6. only allowed journal kinds may touch the §25F fund
select expect_error($$
  with j as (insert into ledger_journals (date, kind, ref, created_by) values ('2027-01-03', 'adjustment', 'adj1', 'test') returning id)
  insert into ledger_postings select id, 1, '25F-TN', 'cash', 0 from j$$, 'may not post to the §25F fund');
-- 7. a §25F gift needs a designation consent and a cash method
insert into donors (id, legal_name, email) values ('50000000-0000-0000-0000-000000000001', 'Jane Doe', 'j@x');
select expect_error($$insert into gifts (donor_id, amount_cents, method, fund, designated, charge_on) values ('50000000-0000-0000-0000-000000000001', 170000, 'daf', '25F-TN', true, '2027-01-01')$$, 'gifts_check');
-- 8. RLS: a family sees only its own applications
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin if (select count(*) from applications) <> 1 then raise exception 'family A sees % applications', (select count(*) from applications); end if; raise notice 'ok: RLS isolates households'; end $$;
-- 9. RLS: families cannot read the ledger
do $$ begin if (select count(*) from ledger_postings) <> 0 then raise exception 'family can read ledger'; end if; raise notice 'ok: ledger hidden from families'; end $$;
-- 10. staff can read all applications
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000cc', false);
do $$ begin if (select count(*) from applications) <> 2 then raise exception 'staff sees % applications', (select count(*) from applications); end if; raise notice 'ok: staff reads all'; end $$;
reset role;
\echo ALL DATABASE TESTS PASSED
