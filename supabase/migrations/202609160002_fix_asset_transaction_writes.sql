-- Fix asset-linked transaction writes.
--
-- CASE expressions resolve to text unless their branches are explicitly typed.
-- The transactions.status column is a transaction_status enum, so the asset
-- RPCs must cast both branches before inserting. The gold purchase RPC also
-- needs to use the actual transactions.payment_method_id column name.

create or replace function public.upsert_savings_account(
  p_family_id uuid,
  p_id uuid,
  p_bank_name text,
  p_name text,
  p_principal numeric,
  p_annual_interest_rate numeric,
  p_term_months int,
  p_opened_on date,
  p_maturity_on date,
  p_interest_method text,
  p_payment_method_id uuid,
  p_note text,
  p_create_transaction boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_row public.savings_accounts%rowtype;
  movement_row public.savings_movements%rowtype;
  purpose_id uuid;
  expense_type_id uuid;
  resolved_payment_method_id uuid;
  linked_transaction_id uuid;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(coalesce(p_bank_name, '')), '') is null or length(trim(p_bank_name)) > 120 then raise exception 'INVALID_BANK_NAME'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null or length(trim(p_name)) > 120 then raise exception 'INVALID_NAME'; end if;
  if p_principal is null or p_principal <= 0 or p_principal <> trunc(p_principal) then raise exception 'INVALID_PRINCIPAL'; end if;
  if p_annual_interest_rate is null or p_annual_interest_rate < 0 or p_annual_interest_rate > 100 then raise exception 'INVALID_RATE'; end if;
  if p_term_months is null or p_term_months not between 1 and 120 then raise exception 'INVALID_TERM'; end if;
  if p_opened_on is null or p_maturity_on is null or p_maturity_on < p_opened_on then raise exception 'INVALID_DATES'; end if;
  if p_interest_method not in ('end_of_term','monthly','upfront','renew') then raise exception 'INVALID_INTEREST_METHOD'; end if;

  if p_payment_method_id is not null then
    select pm.id into resolved_payment_method_id from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.family_id = p_family_id and pm.active;
    if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    select pm.id into resolved_payment_method_id from public.payment_methods pm
    where pm.family_id = p_family_id and pm.active
    order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id limit 1;
  end if;

  select p.id into purpose_id from public.purposes p
  where p.family_id = p_family_id and p.active and p.name = 'Đầu tư' limit 1;
  select e.id into expense_type_id from public.expense_types e
  where e.family_id = p_family_id and e.active and e.code = 'asset-savings-deposit' limit 1;
  if purpose_id is null or expense_type_id is null or resolved_payment_method_id is null then raise exception 'CATALOG_NOT_READY'; end if;

  if p_id is null then
    insert into public.savings_accounts(
      family_id, bank_name, name, principal, current_balance,
      annual_interest_rate, term_months, opened_on, maturity_on,
      interest_method, status, note, created_by, updated_by
    ) values (
      p_family_id, trim(p_bank_name), trim(p_name), p_principal, p_principal,
      p_annual_interest_rate, p_term_months, p_opened_on, p_maturity_on,
      p_interest_method, 'active', nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid()
    ) returning * into account_row;

    insert into public.savings_movements(
      family_id, savings_account_id, movement_type, amount, balance_after,
      movement_date, payment_method_id, note, created_by
    ) values (
      p_family_id, account_row.id, 'opening', p_principal, p_principal,
      p_opened_on, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid()
    ) returning * into movement_row;

    if p_create_transaction then
      insert into public.transactions(
        family_id, transaction_date, transaction_type, status, description, amount,
        purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
        source, source_reference, ai_generated
      ) values (
        p_family_id, p_opened_on, 'Chi tiêu',
        case when p_opened_on <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
        'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name), p_principal,
        purpose_id, expense_type_id, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''),
        auth.uid(), auth.uid(), 'asset', 'asset:savings:' || account_row.id || ':opening', false
      ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
      if linked_transaction_id is null then
        select t.id into linked_transaction_id from public.transactions t
        where t.family_id = p_family_id and t.source = 'asset' and t.source_reference = 'asset:savings:' || account_row.id || ':opening';
      end if;
      update public.savings_movements set transaction_id = linked_transaction_id where id = movement_row.id and family_id = p_family_id;
    end if;
  else
    select * into account_row from public.savings_accounts sa
    where sa.id = p_id and sa.family_id = p_family_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if p_principal <> account_row.principal then raise exception 'PRINCIPAL_EDIT_NOT_ALLOWED'; end if;
    if account_row.status = 'archived' then raise exception 'ACCOUNT_ARCHIVED'; end if;
    update public.savings_accounts set
      bank_name = trim(p_bank_name), name = trim(p_name), annual_interest_rate = p_annual_interest_rate,
      term_months = p_term_months, opened_on = p_opened_on, maturity_on = p_maturity_on,
      interest_method = p_interest_method, note = nullif(trim(coalesce(p_note, '')), ''), updated_by = auth.uid()
    where id = p_id and family_id = p_family_id returning * into account_row;

    select * into movement_row from public.savings_movements sm
    where sm.family_id = p_family_id and sm.savings_account_id = p_id and sm.movement_type = 'opening'
    order by sm.created_at limit 1 for update;
    if movement_row.id is not null then
      update public.savings_movements set movement_date = p_opened_on, payment_method_id = resolved_payment_method_id where id = movement_row.id;
      linked_transaction_id := movement_row.transaction_id;
      if linked_transaction_id is null and p_create_transaction then
        insert into public.transactions(
          family_id, transaction_date, transaction_type, status, description, amount,
          purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
          source, source_reference, ai_generated
        ) values (
          p_family_id, p_opened_on, 'Chi tiêu',
          case when p_opened_on <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
          'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name), account_row.principal,
          purpose_id, expense_type_id, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''),
          auth.uid(), auth.uid(), 'asset', 'asset:savings:' || p_id || ':opening', false
        ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
        if linked_transaction_id is null then
          select t.id into linked_transaction_id from public.transactions t
          where t.family_id = p_family_id and t.source = 'asset' and t.source_reference = 'asset:savings:' || p_id || ':opening';
        end if;
        update public.savings_movements set transaction_id = linked_transaction_id where id = movement_row.id;
      end if;
      if linked_transaction_id is not null then
        update public.transactions set transaction_date = p_opened_on,
          description = 'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name),
          payment_method_id = resolved_payment_method_id,
          note = nullif(trim(coalesce(p_note, '')), ''),
          updated_by = auth.uid()
        where id = linked_transaction_id and family_id = p_family_id and source = 'asset';
      end if;
    end if;
  end if;

  return jsonb_build_object('account', to_jsonb(account_row));
end;
$$;

create or replace function public.record_savings_movement(
  p_family_id uuid,
  p_savings_account_id uuid,
  p_movement_type text,
  p_amount numeric,
  p_movement_date date,
  p_payment_method_id uuid,
  p_note text,
  p_close_account boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_row public.savings_accounts%rowtype;
  movement_row public.savings_movements%rowtype;
  purpose_id uuid;
  expense_type_id uuid;
  payment_method_id uuid;
  linked_transaction_id uuid;
  balance_after numeric;
  transaction_kind public.transaction_kind;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_movement_type not in ('interest','withdrawal','fee','settlement') then raise exception 'INVALID_MOVEMENT_TYPE'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then raise exception 'INVALID_AMOUNT'; end if;
  if p_movement_date is null then raise exception 'INVALID_DATE'; end if;
  if p_movement_type = 'settlement' and not coalesce(p_close_account, false) then raise exception 'SETTLEMENT_MUST_CLOSE'; end if;

  select * into account_row from public.savings_accounts sa
  where sa.id = p_savings_account_id and sa.family_id = p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if account_row.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if p_movement_type <> 'interest' and p_amount > account_row.current_balance then raise exception 'INSUFFICIENT_BALANCE'; end if;
  if p_movement_type = 'settlement' and p_amount <> account_row.current_balance then raise exception 'SETTLEMENT_MUST_MATCH_BALANCE'; end if;

  if p_payment_method_id is not null then
    select pm.id into payment_method_id from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.family_id = p_family_id and pm.active;
    if payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    select pm.id into payment_method_id from public.payment_methods pm
    where pm.family_id = p_family_id and pm.active
    order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id limit 1;
  end if;
  select p.id into purpose_id from public.purposes p where p.family_id = p_family_id and p.active and p.name = 'Đầu tư' limit 1;
  select e.id into expense_type_id from public.expense_types e
  where e.family_id = p_family_id and e.active and e.code = case p_movement_type
    when 'interest' then 'asset-savings-interest'
    when 'withdrawal' then 'asset-savings-withdrawal'
    when 'fee' then 'asset-savings-fee'
    else 'asset-savings-settlement'
  end limit 1;
  if purpose_id is null or expense_type_id is null or payment_method_id is null then raise exception 'CATALOG_NOT_READY'; end if;

  balance_after := case when p_movement_type = 'interest' then account_row.current_balance else account_row.current_balance - p_amount end;
  transaction_kind := case when p_movement_type = 'fee' then 'Chi tiêu'::public.transaction_kind else 'Thu nhập'::public.transaction_kind end;
  insert into public.savings_movements(
    family_id, savings_account_id, movement_type, amount, balance_after,
    movement_date, payment_method_id, note, created_by
  ) values (
    p_family_id, p_savings_account_id, p_movement_type, p_amount, balance_after,
    p_movement_date, payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid()
  ) returning * into movement_row;

  insert into public.transactions(
    family_id, transaction_date, transaction_type, status, description, amount,
    purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
    source, source_reference, ai_generated
  ) values (
    p_family_id, p_movement_date, transaction_kind,
    case when p_movement_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
    case p_movement_type
      when 'interest' then 'Lãi sổ tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name
      when 'withdrawal' then 'Rút tiền tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name
      when 'fee' then 'Phí sổ tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name
      else 'Tất toán tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name
    end,
    p_amount, purpose_id, expense_type_id, payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid(), 'asset',
    'asset:savings:' || p_savings_account_id || ':movement:' || movement_row.id, false
  ) returning id into linked_transaction_id;

  update public.savings_movements set transaction_id = linked_transaction_id where id = movement_row.id and family_id = p_family_id;
  movement_row.transaction_id := linked_transaction_id;
  update public.savings_accounts set current_balance = balance_after,
    status = case when p_movement_type = 'settlement' then 'closed' else status end,
    closed_at = case when p_movement_type = 'settlement' then now() else closed_at end,
    updated_by = auth.uid()
  where id = p_savings_account_id and family_id = p_family_id;
  select * into account_row from public.savings_accounts sa where sa.id = p_savings_account_id and sa.family_id = p_family_id;
  return jsonb_build_object('account', to_jsonb(account_row), 'movement', to_jsonb(movement_row));
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
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_purchase_date is null then raise exception 'INVALID_DATE'; end if;
  if p_quantity_chi is null or p_quantity_chi <= 0 or p_quantity_chi > 999999 then raise exception 'INVALID_QUANTITY'; end if;
  if p_purchase_price_per_chi is null or p_purchase_price_per_chi <= 0 or p_purchase_price_per_chi <> trunc(p_purchase_price_per_chi) then raise exception 'INVALID_PRICE'; end if;
  if p_estimated_sell_price_per_chi is not null and (p_estimated_sell_price_per_chi <= 0 or p_estimated_sell_price_per_chi <> trunc(p_estimated_sell_price_per_chi)) then raise exception 'INVALID_ESTIMATE'; end if;
  purchase_amount := round(p_quantity_chi * p_purchase_price_per_chi);
  if purchase_amount <= 0 or purchase_amount <> trunc(purchase_amount) then raise exception 'INVALID_AMOUNT'; end if;

  select p.id into purpose_id from public.purposes p where p.family_id = p_family_id and p.active and p.name = 'Đầu tư' limit 1;
  select e.id into expense_type_id from public.expense_types e where e.family_id = p_family_id and e.active and e.name = 'Đầu tư vàng' limit 1;
  if p_payment_method_id is not null then
    select pm.id into resolved_payment_method_id from public.payment_methods pm where pm.id = p_payment_method_id and pm.family_id = p_family_id and pm.active;
    if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    select pm.id into resolved_payment_method_id from public.payment_methods pm where pm.family_id = p_family_id and pm.active order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id limit 1;
  end if;
  if purpose_id is null or expense_type_id is null or resolved_payment_method_id is null then raise exception 'CATALOG_NOT_READY'; end if;

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
    select * into asset_row from public.gold_assets ga where ga.id = p_id and ga.family_id = p_family_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if asset_row.status <> 'active' then raise exception 'ASSET_NOT_ACTIVE'; end if;
    select exists(select 1 from public.gold_sales gs where gs.gold_asset_id = p_id and gs.family_id = p_family_id) into has_sales;
    if has_sales and (asset_row.quantity_chi <> p_quantity_chi or asset_row.purchase_price_per_chi <> p_purchase_price_per_chi) then raise exception 'ASSET_HAS_SALES'; end if;
    update public.gold_assets set purchase_date = p_purchase_date,
      quantity_chi = p_quantity_chi,
      remaining_quantity_chi = case when has_sales then remaining_quantity_chi else p_quantity_chi end,
      purchase_price_per_chi = p_purchase_price_per_chi,
      estimated_sell_price_per_chi = p_estimated_sell_price_per_chi,
      note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
    where id = p_id and family_id = p_family_id returning * into asset_row;
  end if;

  linked_transaction_id := asset_row.transaction_id;
  if linked_transaction_id is null and p_create_transaction then
    insert into public.transactions(
      family_id, transaction_date, transaction_type, status, description, amount,
      purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
      source, source_reference, ai_generated
    ) values (
      p_family_id, p_purchase_date, 'Chi tiêu',
      case when p_purchase_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
      'Mua vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ', purchase_amount,
      purpose_id, expense_type_id, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid(),
      'asset', 'asset:gold:' || asset_row.id || ':purchase', false
    ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
    if linked_transaction_id is null then
      select t.id into linked_transaction_id from public.transactions t where t.family_id = p_family_id and t.source = 'asset' and t.source_reference = 'asset:gold:' || asset_row.id || ':purchase';
    end if;
    update public.gold_assets set transaction_id = linked_transaction_id, updated_at = now() where id = asset_row.id and family_id = p_family_id;
  elsif linked_transaction_id is not null and not has_sales then
    update public.transactions set transaction_date = p_purchase_date, amount = purchase_amount,
      description = 'Mua vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ',
      payment_method_id = resolved_payment_method_id,
      note = nullif(trim(coalesce(p_note, '')), ''), updated_by = auth.uid()
    where id = linked_transaction_id and family_id = p_family_id and source = 'asset';
  end if;
  select * into asset_row from public.gold_assets ga where ga.id = asset_id and ga.family_id = p_family_id;
  return jsonb_build_object('asset', to_jsonb(asset_row));
end;
$$;

create or replace function public.record_gold_sale(
  p_family_id uuid,
  p_gold_asset_id uuid,
  p_sale_date date,
  p_quantity_chi numeric,
  p_sale_price_per_chi numeric,
  p_payment_method_id uuid,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  asset_row public.gold_assets%rowtype;
  sale_row public.gold_sales%rowtype;
  purpose_id uuid;
  expense_type_id uuid;
  payment_method_id uuid;
  linked_transaction_id uuid;
  sale_id uuid;
  sale_amount numeric;
  remaining numeric;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_sale_date is null then raise exception 'INVALID_DATE'; end if;
  if p_quantity_chi is null or p_quantity_chi <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_sale_price_per_chi is null or p_sale_price_per_chi <= 0 or p_sale_price_per_chi <> trunc(p_sale_price_per_chi) then raise exception 'INVALID_PRICE'; end if;
  sale_amount := round(p_quantity_chi * p_sale_price_per_chi);
  if sale_amount <= 0 or sale_amount <> trunc(sale_amount) then raise exception 'INVALID_AMOUNT'; end if;
  select * into asset_row from public.gold_assets ga where ga.id = p_gold_asset_id and ga.family_id = p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if asset_row.status <> 'active' then raise exception 'ASSET_NOT_ACTIVE'; end if;
  if p_quantity_chi > asset_row.remaining_quantity_chi then raise exception 'INSUFFICIENT_QUANTITY'; end if;
  remaining := round(asset_row.remaining_quantity_chi - p_quantity_chi, 3);

  select p.id into purpose_id from public.purposes p where p.family_id = p_family_id and p.active and p.name = 'Đầu tư' limit 1;
  select e.id into expense_type_id from public.expense_types e where e.family_id = p_family_id and e.active and e.name = 'Đầu tư vàng' limit 1;
  if p_payment_method_id is not null then
    select pm.id into payment_method_id from public.payment_methods pm where pm.id = p_payment_method_id and pm.family_id = p_family_id and pm.active;
    if payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    select pm.id into payment_method_id from public.payment_methods pm where pm.family_id = p_family_id and pm.active order by (pm.name = 'Tiền mặt') desc, pm.sort_order, pm.id limit 1;
  end if;
  if purpose_id is null or expense_type_id is null or payment_method_id is null then raise exception 'CATALOG_NOT_READY'; end if;

  insert into public.gold_sales(
    family_id, gold_asset_id, sale_date, quantity_chi, sale_price_per_chi,
    amount, payment_method_id, note, created_by
  ) values (
    p_family_id, p_gold_asset_id, p_sale_date, p_quantity_chi, p_sale_price_per_chi,
    sale_amount, payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid()
  ) returning * into sale_row;

  insert into public.transactions(
    family_id, transaction_date, transaction_type, status, description, amount,
    purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
    source, source_reference, ai_generated
  ) values (
    p_family_id, p_sale_date, 'Thu nhập',
    case when p_sale_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
    'Bán vàng: ' || trim(to_char(p_quantity_chi, 'FM999999990.###')) || ' chỉ', sale_amount,
    purpose_id, expense_type_id, payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid(),
    'asset', 'asset:gold:' || p_gold_asset_id || ':sale:' || sale_row.id, false
  ) returning id into linked_transaction_id;
  sale_id := sale_row.id;
  update public.gold_sales set transaction_id = linked_transaction_id where id = sale_id and family_id = p_family_id;
  update public.gold_assets set remaining_quantity_chi = remaining,
    status = case when remaining = 0 then 'sold' else status end, updated_at = now()
  where id = p_gold_asset_id and family_id = p_family_id;
  select * into asset_row from public.gold_assets ga where ga.id = p_gold_asset_id and ga.family_id = p_family_id;
  select * into sale_row from public.gold_sales gs where gs.id = sale_id and gs.family_id = p_family_id;
  return jsonb_build_object('asset', to_jsonb(asset_row), 'sale', to_jsonb(sale_row));
end;
$$;

-- CREATE OR REPLACE preserves the grants established by the asset migration.
