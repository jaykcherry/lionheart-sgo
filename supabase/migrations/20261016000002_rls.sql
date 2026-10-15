-- Row-level security. Default deny on every table; each role sees only its own rows.
-- Staff/board read broadly but change state only through the security-definer functions in 0003.
-- The service role (server jobs) bypasses RLS and is never exposed to browsers.

create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;
create or replace function is_ops() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role in ('staff','board'))
$$;
create or replace function my_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from user_roles where user_id = auth.uid() and role = 'family' and household_id is not null
  union select id from households where primary_user_id = auth.uid()
$$;
create or replace function my_school_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select school_id from user_roles where user_id = auth.uid() and role = 'school_admin' and school_id is not null
$$;
create or replace function my_donor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from donors where user_id = auth.uid()
$$;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy "own profile" on profiles for select using (id = auth.uid() or is_ops());
create policy "update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "roles readable by self" on user_roles for select using (user_id = auth.uid() or is_ops());

-- public directory (anyone may read the school list and published tuition)
create policy "school directory" on schools for select using (true);
create policy "tuition public" on tuition_schedules for select using (true);
create policy "school edits tuition" on tuition_schedules for all using (school_id in (select my_school_ids())) with check (school_id in (select my_school_ids()));

-- families
create policy "family households" on households for select using (id in (select my_household_ids()) or is_ops());
create policy "family creates household" on households for insert with check (primary_user_id = auth.uid());
create policy "family updates household" on households for update using (id in (select my_household_ids()));
create policy "family members" on household_members for all using (household_id in (select my_household_ids()) or is_ops())
  with check (household_id in (select my_household_ids()));
create policy "family applications read" on applications for select using (household_id in (select my_household_ids()) or is_ops()
  or (school_id in (select my_school_ids()) and state in ('AWARDED','ACCEPTED','SCHOOL_CONFIRMED','ACTIVE','WITHDRAWN')));
create policy "family drafts" on applications for insert with check (household_id in (select my_household_ids()) and state = 'DRAFT');
create policy "family edits drafts" on applications for update using (household_id in (select my_household_ids()) and state in ('DRAFT','DOCS_PENDING'))
  with check (household_id in (select my_household_ids()));
create policy "family documents" on documents for select using (household_id in (select my_household_ids()) or is_ops());
create policy "family uploads" on documents for insert with check (household_id in (select my_household_ids()));
create policy "family confirms extraction" on documents for update using (household_id in (select my_household_ids()));
create policy "income items" on income_items for all using (application_id in (select id from applications where household_id in (select my_household_ids())) or is_ops())
  with check (application_id in (select id from applications where household_id in (select my_household_ids()) and state in ('DRAFT','DOCS_PENDING')));
create policy "categorical" on categorical_proofs for all using (application_id in (select id from applications where household_id in (select my_household_ids())) or is_ops())
  with check (application_id in (select id from applications where household_id in (select my_household_ids())));
create policy "other aid" on other_aid for select using (application_id in (select id from applications where household_id in (select my_household_ids()) or school_id in (select my_school_ids())) or is_ops());
create policy "family attests aid" on other_aid for insert with check (application_id in (select id from applications where household_id in (select my_household_ids())));
create policy "determinations" on eligibility_determinations for select using (application_id in (select id from applications where household_id in (select my_household_ids())) or is_ops());
create policy "awards visible" on awards for select using (application_id in (select id from applications where household_id in (select my_household_ids()) or school_id in (select my_school_ids())) or is_ops());
create policy "award terms visible" on award_terms for select using (award_id in (select id from awards) );
create policy "residency" on residency_attestations for select using (household_id in (select my_household_ids()) or is_ops());

-- schools
create policy "claims own" on school_claims for select using (user_id = auth.uid() or is_ops());
create policy "agreements" on school_agreements for select using (school_id in (select my_school_ids()) or is_ops());
create policy "payee masked" on school_payees for select using (school_id in (select my_school_ids()) or is_ops());
create policy "confirmations" on enrollment_confirmations for select using (award_id in (select id from awards) or is_ops());
create policy "refunds" on refunds for select using (award_id in (select id from awards) or is_ops());
create policy "lines for school" on disbursement_lines for select using (school_id in (select my_school_ids()) or is_ops());

-- donors
create policy "donor self" on donors for select using (id in (select my_donor_ids()) or is_ops());
create policy "donor updates prefs" on donors for update using (id in (select my_donor_ids())) with check (id in (select my_donor_ids()));
create policy "donor gifts" on gifts for select using (donor_id in (select my_donor_ids()) or is_ops());
create policy "donor consents" on designation_consents for select using (donor_id in (select my_donor_ids()) or is_ops());
create policy "donor numbers" on donor_numbers for select using (donor_id in (select my_donor_ids()) or is_ops());
create policy "donor acks" on acknowledgments for select using (donor_id in (select my_donor_ids()) or is_ops());

-- ops-only reads
create policy "ops read" on award_policies for select using (true);
create policy "ops read" on limits_tables for select using (true);
create policy "ops read" on cycles for select using (true);
create policy "ops read" on award_rounds for select using (is_ops());
create policy "ops read" on disbursement_batches for select using (is_ops());
create policy "ops read" on batch_approvals for select using (is_ops());
create policy "ops read" on irs_reports for select using (is_ops());
create policy "ops read" on ledger_journals for select using (is_ops());
create policy "ops read" on ledger_postings for select using (is_ops());
create policy "ops read" on processor_settlements for select using (is_ops());
create policy "ops read" on bank_lines for select using (is_ops());
create policy "ops read" on dq_persons for select using (is_ops());
create policy "ops read" on dq_relatives for select using (is_ops());
create policy "ops read" on exception_tickets for select using (is_ops());
create policy "ops read" on compliance_runs for select using (is_ops());
create policy "ops read" on agent_actions for select using (is_ops());
create policy "board reads audit" on audit_events for select using (has_role('board'));

-- Storage: private bucket for family documents; path = <household_id>/<uuid>
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
create policy "family uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_household_ids()));
create policy "family reads own files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1]::uuid in (select my_household_ids()) or is_ops()));
