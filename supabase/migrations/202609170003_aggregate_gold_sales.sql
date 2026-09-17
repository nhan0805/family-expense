-- Sell gold from the family's aggregate holding. The individual lot rows are
-- used only to preserve history and remaining quantities; the user does not
-- choose a lot and the cash ledger receives one income transaction.

create or replace function public.record_gold_sale_aggregate(
  p_family_id uuid,
  p_sale_date date,
  p_quantity_chi numeric,
  p_sale_price_per_chi numeric,
  p_payment_method_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_row public.gold_assets%rowtype;
  sale_row public.gold_sales%rowtype;
  purpose_id uuid;
  expense_type_id uuid;
  resolved_payment_method_id uuid;
  configured_purpose_id uuid;
  configured_expense_type_id uuid;
  configured_payment_method_id uuid;
  linked_transaction_id uuid;
  sale_batch_id uuid := gen_random_uuid();
  sale_amount numeric;
  available_quantity numeric := 0;
  remaining_to_sell numeric;
  allocated_quantity numeric;
  allocated_amount numeric := 0;
  row_amount numeric;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  sale_rows jsonb := '[]'::jsonb;
  is_last_allocation boolean;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_sale_date is null then
    raise exception 'INVALID_DATE';
  end if;
  if p_quantity_chi is null
    or p_quantity_chi <= 0
    or p_quantity_chi > 999999
    or p_quantity_chi <> round(p_quantity_chi, 3) then
    raise exception 'INVALID_QUANTITY';
  end if;
  if p_sale_price_per_chi is null
    or p_sale_price_per_chi <= 0
    or p_sale_price_per_chi > 999999999999
    or p_sale_price_per_chi <> trunc(p_sale_price_per_chi) then
    raise exception 'INVALID_PRICE';
  end if;

  sale_amount := round(p_quantity_chi * p_sale_price_per_chi);
  if sale_amount <= 0 or sale_amount <> trunc(sale_amount) then
    raise exception 'INVALID_AMOUNT';
  end if;

  select d.purpose_id, d.expense_type_id, d.payment_method_id
  into configured_purpose_id, configured_expense_type_id, configured_payment_method_id
  from public.automatic_transaction_defaults as d
  join public.purposes as configured_purpose
    on configured_purpose.family_id = d.family_id
   and configured_purpose.id = d.purpose_id
   and configured_purpose.active
  join public.expense_types as configured_expense_type
    on configured_expense_type.family_id = d.family_id
   and configured_expense_type.id = d.expense_type_id
   and configured_expense_type.active
  join public.payment_methods as configured_payment_method
    on configured_payment_method.family_id = d.family_id
   and configured_payment_method.id = d.payment_method_id
   and configured_payment_method.active
  where d.family_id = p_family_id
    and d.automation_key = 'gold_sale'
  limit 1;

  purpose_id := configured_purpose_id;
  expense_type_id := configured_expense_type_id;
  if purpose_id is null then
    select p.id
    into purpose_id
    from public.purposes as p
    where p.family_id = p_family_id
      and p.active
      and p.name = 'Đầu tư'
    limit 1;
  end if;
  if expense_type_id is null then
    select e.id
    into expense_type_id
    from public.expense_types as e
    where e.family_id = p_family_id
      and e.active
      and e.name = 'Đầu tư vàng'
    limit 1;
  end if;

  if p_payment_method_id is not null then
    select pm.id
    into resolved_payment_method_id
    from public.payment_methods as pm
    where pm.id = p_payment_method_id
      and pm.family_id = p_family_id
      and pm.active;
    if resolved_payment_method_id is null then
      raise exception 'PAYMENT_METHOD_NOT_FOUND';
    end if;
  else
    resolved_payment_method_id := configured_payment_method_id;
    if resolved_payment_method_id is null then
      select pm.id
      into resolved_payment_method_id
      from public.payment_methods as pm
      where pm.family_id = p_family_id
        and pm.active
      order by (pm.name = 'Tiền mặt') desc, pm.sort_order, pm.id
      limit 1;
    end if;
  end if;
  if purpose_id is null or expense_type_id is null or resolved_payment_method_id is null then
    raise exception 'CATALOG_NOT_READY';
  end if;

  -- Lock all active lots in FIFO order before checking the total, so two
  -- concurrent sales cannot both spend the same remaining quantity.
  for asset_row in
    select ga.*
    from public.gold_assets as ga
    where ga.family_id = p_family_id
      and ga.status = 'active'
      and ga.remaining_quantity_chi > 0
    order by ga.purchase_date asc, ga.created_at asc, ga.id asc
    for update
  loop
    available_quantity := available_quantity + asset_row.remaining_quantity_chi;
  end loop;
  if p_quantity_chi > available_quantity then
    raise exception 'INSUFFICIENT_QUANTITY';
  end if;

  insert into public.transactions(
    family_id, transaction_date, transaction_type, status, description, amount,
    purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
    source, source_reference, ai_generated
  ) values (
    p_family_id,
    p_sale_date,
    'Thu nhập',
    case when p_sale_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
    'Bán vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ',
    sale_amount,
    purpose_id,
    expense_type_id,
    resolved_payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    auth.uid(),
    'asset',
    'asset:gold:aggregate:sale:' || sale_batch_id,
    false
  )
  returning id into linked_transaction_id;

  remaining_to_sell := p_quantity_chi;
  for asset_row in
    select ga.*
    from public.gold_assets as ga
    where ga.family_id = p_family_id
      and ga.status = 'active'
      and ga.remaining_quantity_chi > 0
    order by ga.purchase_date asc, ga.created_at asc, ga.id asc
    for update
  loop
    exit when remaining_to_sell <= 0;
    is_last_allocation := remaining_to_sell <= asset_row.remaining_quantity_chi;
    allocated_quantity := round(least(remaining_to_sell, asset_row.remaining_quantity_chi), 3);
    row_amount := case
      when is_last_allocation then sale_amount - allocated_amount
      else round(allocated_quantity * p_sale_price_per_chi)
    end;
    if row_amount <= 0 or row_amount <> trunc(row_amount) then
      raise exception 'INVALID_AMOUNT';
    end if;

    insert into public.gold_sales(
      family_id, gold_asset_id, sale_date, quantity_chi, sale_price_per_chi,
      amount, payment_method_id, transaction_id, note, created_by
    ) values (
      p_family_id,
      asset_row.id,
      p_sale_date,
      allocated_quantity,
      p_sale_price_per_chi,
      row_amount,
      resolved_payment_method_id,
      linked_transaction_id,
      nullif(trim(coalesce(p_note, '')), ''),
      auth.uid()
    )
    returning * into sale_row;
    sale_rows := sale_rows || jsonb_build_array(to_jsonb(sale_row));

    update public.gold_assets
    set remaining_quantity_chi = round(asset_row.remaining_quantity_chi - allocated_quantity, 3),
        status = case when round(asset_row.remaining_quantity_chi - allocated_quantity, 3) = 0 then 'sold' else status end,
        updated_at = now()
    where family_id = p_family_id
      and id = asset_row.id;

    allocated_amount := allocated_amount + row_amount;
    remaining_to_sell := round(remaining_to_sell - allocated_quantity, 3);
  end loop;

  if remaining_to_sell > 0 then
    raise exception 'INSUFFICIENT_QUANTITY';
  end if;

  return jsonb_build_object(
    'transactionId', linked_transaction_id,
    'quantityChi', p_quantity_chi,
    'saleAmount', sale_amount,
    'sales', sale_rows
  );
end;
$$;

revoke all on function public.record_gold_sale_aggregate(uuid, date, numeric, numeric, uuid, text) from public;
grant execute on function public.record_gold_sale_aggregate(uuid, date, numeric, numeric, uuid, text) to authenticated;

-- Aggregate sale transactions can be referenced by more than one lot. Keep a
-- shared income transaction until its last gold-sale child is deleted.
create or replace function public.delete_gold_asset(
  p_family_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_transactions integer := 0;
  asset_id uuid;
  sale_transaction_ids uuid[];
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select ga.id
  into asset_id
  from public.gold_assets as ga
  where ga.id = p_id
    and ga.family_id = p_family_id
  for update;
  if asset_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select coalesce(
    array_agg(gs.transaction_id) filter (where gs.transaction_id is not null),
    '{}'::uuid[]
  )
  into sale_transaction_ids
  from public.gold_sales as gs
  where gs.family_id = p_family_id
    and gs.gold_asset_id = p_id;

  delete from public.gold_sales
  where family_id = p_family_id
    and gold_asset_id = p_id;

  update public.gold_assets
  set transaction_id = null
  where family_id = p_family_id
    and id = p_id;

  delete from public.transactions as t
  where t.family_id = p_family_id
    and t.source = 'asset'
    and (
      t.source_reference like 'asset:gold:' || p_id::text || ':%'
      or t.id = any(sale_transaction_ids)
    )
    and not exists (
      select 1
      from public.gold_sales as gs
      where gs.family_id = p_family_id
        and gs.transaction_id = t.id
    );
  get diagnostics deleted_transactions = row_count;

  delete from public.gold_assets
  where family_id = p_family_id
    and id = p_id;

  return jsonb_build_object(
    'deleted', true,
    'transactionsDeleted', deleted_transactions
  );
end;
$$;

revoke all on function public.delete_gold_asset(uuid, uuid) from public;
grant execute on function public.delete_gold_asset(uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
