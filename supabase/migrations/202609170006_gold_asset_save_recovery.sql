-- Keep a gold lot independent from the optional purchase transaction.
-- A family may still be fixing its transaction catalogs; recording the lot
-- itself must not be blocked when the user leaves automatic transaction
-- creation turned off.

-- Re-assert the built-in rows for families that existed before asset tracking
-- or had hidden one of these rows. This is idempotent and keeps the checked
-- automatic-transaction path working as soon as the migration is applied.
update public.purposes
set active = true
where code = 'purpose-8';

insert into public.purposes(family_id, name, name_en, code, color, icon, sort_order, active)
select f.id, 'Đầu tư', 'Investments', 'purpose-8', '#6081a8', 'trending-up', 8, true
from public.families f
where not exists (
  select 1
  from public.purposes p
  where p.family_id = f.id and p.code = 'purpose-8'
)
on conflict (family_id, code) do update
set active = true;

update public.expense_types
set active = true
where code = 'expense-25';

insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
select f.id, 'Đầu tư vàng', 'Gold investments', 'expense-25', 'coins', 25, true
from public.families f
where not exists (
  select 1
  from public.expense_types e
  where e.family_id = f.id and e.code = 'expense-25'
)
on conflict (family_id, code) do update
set active = true;

update public.payment_methods
set active = true
where name = 'Chuyển khoản';

insert into public.payment_methods(family_id, name, name_en, icon, sort_order, active)
select f.id, 'Chuyển khoản', 'Bank transfer', 'landmark', 0, true
from public.families f
where not exists (
  select 1
  from public.payment_methods pm
  where pm.family_id = f.id and pm.name = 'Chuyển khoản'
)
on conflict (family_id, name) do update
set active = true;

do $$
declare
  family_row record;
begin
  for family_row in select f.id from public.families f loop
    perform public.seed_automatic_transaction_defaults(family_row.id);
  end loop;
end;
$$;

create or replace function public.upsert_gold_asset(
  p_family_id uuid,
  p_id uuid,
  p_purchase_date date,
  p_quantity_chi numeric,
  p_purchase_price_per_chi numeric,
  p_estimated_sell_price_per_chi numeric,
  p_payment_method_id uuid,
  p_note text,
  p_create_transaction boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_row public.gold_assets%rowtype;
  purpose_id uuid;
  expense_type_id uuid;
  resolved_payment_method_id uuid;
  linked_transaction_id uuid;
  asset_id uuid;
  purchase_amount numeric;
  has_sales boolean := false;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_purchase_date is null then raise exception 'INVALID_DATE'; end if;
  if p_quantity_chi is null or p_quantity_chi <= 0 or p_quantity_chi > 999999 then raise exception 'INVALID_QUANTITY'; end if;
  if p_purchase_price_per_chi is null or p_purchase_price_per_chi <= 0 or p_purchase_price_per_chi <> trunc(p_purchase_price_per_chi) then raise exception 'INVALID_PRICE'; end if;
  if p_estimated_sell_price_per_chi is not null and (p_estimated_sell_price_per_chi <= 0 or p_estimated_sell_price_per_chi <> trunc(p_estimated_sell_price_per_chi)) then raise exception 'INVALID_ESTIMATE'; end if;
  purchase_amount := round(p_quantity_chi * p_purchase_price_per_chi);
  if purchase_amount <= 0 or purchase_amount <> trunc(purchase_amount) then raise exception 'INVALID_AMOUNT'; end if;

  if p_id is null then
    insert into public.gold_assets(
      family_id, purchase_date, quantity_chi, remaining_quantity_chi,
      purchase_price_per_chi, estimated_sell_price_per_chi, status,
      note, created_by
    ) values (
      p_family_id, p_purchase_date, p_quantity_chi, p_quantity_chi,
      p_purchase_price_per_chi, p_estimated_sell_price_per_chi, 'active',
      nullif(trim(coalesce(p_note, '')), ''), auth.uid()
    ) returning * into asset_row;
    asset_id := asset_row.id;
  else
    asset_id := p_id;
    select * into asset_row
    from public.gold_assets ga
    where ga.id = p_id and ga.family_id = p_family_id
    for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if asset_row.status <> 'active' then raise exception 'ASSET_NOT_ACTIVE'; end if;
    select exists(
      select 1
      from public.gold_sales gs
      where gs.gold_asset_id = p_id and gs.family_id = p_family_id
    ) into has_sales;
    if has_sales and (asset_row.quantity_chi <> p_quantity_chi or asset_row.purchase_price_per_chi <> p_purchase_price_per_chi) then
      raise exception 'ASSET_HAS_SALES';
    end if;
    update public.gold_assets
    set purchase_date = p_purchase_date,
        quantity_chi = p_quantity_chi,
        remaining_quantity_chi = case when has_sales then remaining_quantity_chi else p_quantity_chi end,
        purchase_price_per_chi = p_purchase_price_per_chi,
        estimated_sell_price_per_chi = p_estimated_sell_price_per_chi,
        note = nullif(trim(coalesce(p_note, '')), ''),
        updated_at = now()
    where id = p_id and family_id = p_family_id
    returning * into asset_row;
  end if;

  linked_transaction_id := asset_row.transaction_id;

  -- A lot-only save does not use any transaction catalog or payment method.
  -- Resolve those values only when a new linked transaction is requested, or
  -- when an existing linked transaction needs its payment method updated.
  if p_create_transaction or linked_transaction_id is not null then
    if p_payment_method_id is not null then
      select pm.id into resolved_payment_method_id
      from public.payment_methods pm
      where pm.id = p_payment_method_id
        and pm.family_id = p_family_id
        and pm.active;
      if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
    else
      select pm.id into resolved_payment_method_id
      from public.payment_methods pm
      where pm.family_id = p_family_id
        and pm.active
      order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id
      limit 1;
    end if;

    if p_create_transaction then
      select p.id into purpose_id
      from public.purposes p
      where p.family_id = p_family_id
        and p.active
        and (p.code = 'purpose-8' or p.name = 'Đầu tư')
      order by (p.code = 'purpose-8') desc, p.id
      limit 1;

      select e.id into expense_type_id
      from public.expense_types e
      where e.family_id = p_family_id
        and e.active
        and (e.code = 'expense-25' or e.name = 'Đầu tư vàng')
      order by (e.code = 'expense-25') desc, e.id
      limit 1;

      if purpose_id is null or expense_type_id is null or resolved_payment_method_id is null then
        raise exception 'CATALOG_NOT_READY';
      end if;
    end if;
  end if;

  if linked_transaction_id is null and p_create_transaction then
    insert into public.transactions(
      family_id, transaction_date, transaction_type, status, description, amount,
      purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
      source, source_reference, ai_generated
    ) values (
      p_family_id, p_purchase_date, 'Chi tiêu',
      case when p_purchase_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
      'Mua vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ', purchase_amount,
      purpose_id, expense_type_id, resolved_payment_method_id,
      nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid(),
      'asset', 'asset:gold:' || asset_row.id || ':purchase', false
    ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
    if linked_transaction_id is null then
      select t.id into linked_transaction_id
      from public.transactions t
      where t.family_id = p_family_id
        and t.source = 'asset'
        and t.source_reference = 'asset:gold:' || asset_row.id || ':purchase';
    end if;
    update public.gold_assets
    set transaction_id = linked_transaction_id, updated_at = now()
    where id = asset_row.id and family_id = p_family_id;
  elsif linked_transaction_id is not null and not has_sales then
    update public.transactions
    set transaction_date = p_purchase_date,
        amount = purchase_amount,
        description = 'Mua vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ',
        payment_method_id = resolved_payment_method_id,
        note = nullif(trim(coalesce(p_note, '')), ''),
        updated_by = auth.uid()
    where id = linked_transaction_id
      and family_id = p_family_id
      and source = 'asset';
  end if;

  select * into asset_row
  from public.gold_assets ga
  where ga.id = asset_id and ga.family_id = p_family_id;
  return jsonb_build_object('asset', to_jsonb(asset_row));
end;
$$;

revoke all on function public.upsert_gold_asset(uuid, uuid, date, numeric, numeric, numeric, uuid, text, boolean) from public;
grant execute on function public.upsert_gold_asset(uuid, uuid, date, numeric, numeric, numeric, uuid, text, boolean) to authenticated;

select pg_notify('pgrst', 'reload schema');
