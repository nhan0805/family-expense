-- Let every active family member manage the family's savings and gold assets.
-- Keep the shop buy-back price as one family setting and calculate maturity in
-- the database so the UI and direct RPC callers cannot drift apart.

alter table public.families
  add column if not exists gold_buyback_price_per_chi numeric(15,0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'families_gold_buyback_price_check'
      and conrelid = 'public.families'::regclass
  ) then
    alter table public.families
      add constraint families_gold_buyback_price_check
      check (
        gold_buyback_price_per_chi is null
        or (
          gold_buyback_price_per_chi > 0
          and gold_buyback_price_per_chi = trunc(gold_buyback_price_per_chi)
        )
      );
  end if;
end $$;

-- Preserve the first existing estimate as the family's initial shared price.
-- The application no longer reads the legacy per-lot estimate when this
-- setting is null, so an explicitly cleared family price stays cleared.
update public.families f
set gold_buyback_price_per_chi = legacy.price
from (
  select distinct on (ga.family_id)
    ga.family_id,
    ga.estimated_sell_price_per_chi as price
  from public.gold_assets ga
  where ga.estimated_sell_price_per_chi is not null
  order by ga.family_id, ga.updated_at desc nulls last, ga.purchase_date desc, ga.id desc
) as legacy
where f.id = legacy.family_id
  and f.gold_buyback_price_per_chi is null;

drop policy if exists savings_accounts_select on public.savings_accounts;
create policy savings_accounts_select on public.savings_accounts for select to authenticated
  using(public.is_family_member(family_id));

drop policy if exists gold_assets_select on public.gold_assets;
create policy gold_assets_select on public.gold_assets for select to authenticated
  using(public.is_family_member(family_id));

create or replace function public.calculate_savings_maturity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.maturity_on := (
    new.opened_on + pg_catalog.make_interval(months => new.term_months)
  )::date;
  return new;
end;
$$;

drop trigger if exists savings_accounts_calculate_maturity on public.savings_accounts;
create trigger savings_accounts_calculate_maturity
before insert or update on public.savings_accounts
for each row execute function public.calculate_savings_maturity();

update public.savings_accounts sa
set maturity_on = (
  sa.opened_on + pg_catalog.make_interval(months => sa.term_months)
)::date
where sa.maturity_on is distinct from (
  sa.opened_on + pg_catalog.make_interval(months => sa.term_months)
)::date;

-- The existing asset RPCs were created as owner-only in 202609160001 and
-- transaction-write fixes were applied in 202609160002. Recreate those exact
-- functions with the same bodies, changing only the authorization guard so
-- all active members can use the already-audited mutation paths.
do $$
declare
  target_function regprocedure;
  old_definition text;
  new_definition text;
begin
  foreach target_function in array array[
    'public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure,
    'public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure,
    'public.archive_savings_account(uuid,uuid)'::regprocedure,
    'public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure,
    'public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure,
    'public.archive_gold_asset(uuid,uuid)'::regprocedure
  ] loop
    old_definition := pg_get_functiondef(target_function::oid);
    new_definition := replace(old_definition, 'public.is_family_owner(', 'public.is_family_member(');
    if new_definition = old_definition then
      raise exception 'Asset RPC authorization guard was not found for %', target_function;
    end if;
    execute new_definition;
  end loop;
end $$;

create or replace function public.set_gold_buyback_price(
  p_family_id uuid,
  p_price_per_chi numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_price_per_chi is not null and (
    p_price_per_chi <= 0
    or p_price_per_chi <> trunc(p_price_per_chi)
    or p_price_per_chi > 999999999999
  ) then
    raise exception 'INVALID_PRICE';
  end if;

  update public.families
  set gold_buyback_price_per_chi = p_price_per_chi,
      updated_at = now()
  where id = p_family_id;
  if not found then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  return jsonb_build_object('goldBuybackPricePerChi', p_price_per_chi);
end;
$$;

revoke all on function public.set_gold_buyback_price(uuid,numeric) from public;
grant execute on function public.set_gold_buyback_price(uuid,numeric) to authenticated;

create or replace function public.get_asset_summary(p_family_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  gold_buyback_price numeric;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select f.gold_buyback_price_per_chi
  into gold_buyback_price
  from public.families f
  where f.id = p_family_id;

  select jsonb_build_object(
    'netCash', coalesce((select sum(case when t.transaction_type = 'Thu nhập' then t.amount when t.transaction_type = 'Chi tiêu' then -t.amount else 0 end) from public.transactions t where t.family_id = p_family_id and t.status = 'Thực tế' and t.deleted_at is null), 0),
    'savingsTotal', coalesce((select sum(sa.current_balance) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'), 0),
    'goldEstimatedTotal', coalesce((select sum(ga.remaining_quantity_chi * coalesce(gold_buyback_price, 0)) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldCost', coalesce((select sum(ga.remaining_quantity_chi * ga.purchase_price_per_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldQuantityChi', coalesce((select sum(ga.remaining_quantity_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'savingsCount', (select count(*) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'),
    'goldCount', (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'),
    'goldMissingEstimateCount', case when gold_buyback_price is null then (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active') else 0 end,
    'goldBuybackPricePerChi', gold_buyback_price,
    'savings', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sa.id, 'family_id', sa.family_id, 'bank_name', sa.bank_name, 'name', sa.name,
      'principal', sa.principal, 'current_balance', sa.current_balance,
      'annual_interest_rate', sa.annual_interest_rate, 'term_months', sa.term_months,
      'opened_on', sa.opened_on, 'maturity_on', sa.maturity_on,
      'interest_method', sa.interest_method, 'status', sa.status, 'note', sa.note,
      'created_by', sa.created_by, 'updated_by', sa.updated_by, 'created_at', sa.created_at,
      'updated_at', sa.updated_at, 'closed_at', sa.closed_at, 'archived_at', sa.archived_at
    ) order by sa.maturity_on) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'), '[]'::jsonb),
    'gold', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ga.id, 'family_id', ga.family_id, 'purchase_date', ga.purchase_date,
      'quantity_chi', ga.quantity_chi, 'remaining_quantity_chi', ga.remaining_quantity_chi,
      'purchase_price_per_chi', ga.purchase_price_per_chi, 'estimated_sell_price_per_chi', gold_buyback_price,
      'status', ga.status, 'transaction_id', ga.transaction_id, 'note', ga.note,
      'created_by', ga.created_by, 'created_at', ga.created_at, 'updated_at', ga.updated_at, 'archived_at', ga.archived_at
    ) order by ga.purchase_date desc) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

-- CREATE OR REPLACE preserves the grants established by the asset migration.
