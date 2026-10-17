-- Award policy v2: continuous need index (income ÷ size-adjusted AMGI) and partial awards.
alter table awards add column if not exists need_index numeric;
alter table awards add column if not exists full_amount_cents int check (full_amount_cents is null or full_amount_cents >= amount_cents);
comment on column awards.tier is 'Display label only (A ≤100% AMGI, B ≤200%, C ≤300%); ranking and amounts use need_index.';
comment on column awards.full_amount_cents is 'Formula amount; amount_cents may be lower for a partial award topped up as gifts arrive.';
