-- Public, aggregated donor support by school (the Schools page tracker).
-- Totals of credit-designated gifts that name a preferred school. Never exposes donors or individual gifts;
-- donor counts below 3 are reported as null so a single gift can't be singled out by count.
alter table schools add column if not exists county text;
alter table schools add column if not exists region text check (region in ('West', 'Middle', 'East'));
alter table schools add column if not exists tdoe_category text;
alter table schools add column if not exists authorizer text;
alter table schools add column if not exists alt_email_domain text;
alter table schools alter column email_domain drop not null;

create or replace view school_support as
select s.id as school_id, s.slug, s.name, s.city, s.region,
       coalesce(sum(g.amount_cents) filter (where g.state not in ('FAILED', 'CHARGEBACK', 'CANCELLED')), 0)::bigint as designated_cents,
       case when count(distinct g.donor_id) >= 3 then count(distinct g.donor_id) end as donor_count
from schools s
left join gifts g on g.preferred_school_id = s.id and g.fund = '25F-TN' and g.designated
group by s.id;

revoke all on school_support from public;
grant select on school_support to anon, authenticated;
comment on view school_support is 'Aggregated, donor-anonymous support per school for the public tracker. Preferences fund a school pool only when the school has >= 10 eligible applicants in the round (POLICIES.md §5).';
