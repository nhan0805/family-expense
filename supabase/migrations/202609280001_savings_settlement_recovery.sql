-- Keep savings settlement working for families whose asset catalogs or
-- automatic-transaction mappings were created before the newer settings flow.
-- The settlement RPC must honor active family mappings, while retaining stable
-- catalog fallbacks so a renamed or partially configured family can still
-- close a book and record the cash received.

update public.purposes
set active = true
where code = 'purpose-8';

insert into public.purposes(family_id, name, name_en, code, color, icon, sort_order, active)
select f.id, 'Đầu tư', 'Investments', 'purpose-8', '#6081a8', 'trending-up', 8, true
from public.families f
where not exists (
  select 1
  from public.purposes p
  where p.family_id = f.id
    and p.code = 'purpose-8'
)
on conflict (family_id, code) do update
set active = true;

update public.expense_types
set active = true
where code in ('asset-savings-interest', 'asset-savings-settlement');

insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
select f.id, v.name, v.name_en, v.code, v.icon, v.sort_order, true
from public.families f
cross join (values
  ('Lãi tiền gửi', 'Savings interest', 'asset-savings-interest', 'trending-up', 101),
  ('Tất toán tiết kiệm', 'Savings settlement', 'asset-savings-settlement', 'landmark', 104)
) as v(name, name_en, code, icon, sort_order)
where not exists (
  select 1
  from public.expense_types e
  where e.family_id = f.id
    and e.code = v.code
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
  where pm.family_id = f.id
    and pm.name = 'Chuyển khoản'
)
on conflict (family_id, name) do update
set active = true;

-- Recreate only missing mappings. Existing owner choices remain authoritative.
do $$
declare
  family_row record;
begin
  for family_row in select f.id from public.families f loop
    perform public.seed_automatic_transaction_defaults(family_row.id);
  end loop;
end;
$$;

create or replace function public.settle_savings_account_internal(
  p_family_id uuid,
  p_savings_account_id uuid,
  p_interest_amount numeric,
  p_settlement_date date,
  p_payment_method_id uuid,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.savings_accounts%rowtype;
  settlement_movement_row public.savings_movements%rowtype;
  interest_movement_row public.savings_movements%rowtype;
  configured_settlement_purpose_id uuid;
  configured_settlement_expense_type_id uuid;
  configured_settlement_payment_method_id uuid;
  configured_interest_purpose_id uuid;
  configured_interest_expense_type_id uuid;
  settlement_purpose_id uuid;
  interest_purpose_id uuid;
  settlement_expense_type_id uuid;
  interest_expense_type_id uuid;
  resolved_payment_method_id uuid;
  settlement_transaction_id uuid;
  interest_transaction_id uuid;
  principal_amount numeric;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_actor_id is null then raise exception 'ACTOR_NOT_FOUND'; end if;
  if p_interest_amount is null
    or p_interest_amount < 0
    or p_interest_amount <> trunc(p_interest_amount)
    or p_interest_amount > 999999999999999
  then
    raise exception 'INVALID_INTEREST_AMOUNT';
  end if;
  if p_settlement_date is null then raise exception 'INVALID_DATE'; end if;

  select * into account_row
  from public.savings_accounts sa
  where sa.id = p_savings_account_id
    and sa.family_id = p_family_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if account_row.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if account_row.current_balance <= 0 then raise exception 'ACCOUNT_EMPTY'; end if;
  principal_amount := account_row.current_balance;

  -- A valid family setting is preferred. The joins deliberately ignore stale
  -- mappings that point to a deactivated catalog item so fallback resolution
  -- below can keep the settlement recoverable.
  select d.purpose_id, d.expense_type_id, d.payment_method_id
  into configured_settlement_purpose_id,
       configured_settlement_expense_type_id,
       configured_settlement_payment_method_id
  from public.automatic_transaction_defaults d
  join public.purposes p
    on p.family_id = d.family_id
   and p.id = d.purpose_id
   and p.active
  join public.expense_types e
    on e.family_id = d.family_id
   and e.id = d.expense_type_id
   and e.active
  join public.payment_methods pm
    on pm.family_id = d.family_id
   and pm.id = d.payment_method_id
   and pm.active
  where d.family_id = p_family_id
    and d.automation_key = 'savings_settlement'
  limit 1;

  select d.purpose_id, d.expense_type_id
  into configured_interest_purpose_id,
       configured_interest_expense_type_id
  from public.automatic_transaction_defaults d
  join public.purposes p
    on p.family_id = d.family_id
   and p.id = d.purpose_id
   and p.active
  join public.expense_types e
    on e.family_id = d.family_id
   and e.id = d.expense_type_id
   and e.active
  join public.payment_methods pm
    on pm.family_id = d.family_id
   and pm.id = d.payment_method_id
   and pm.active
  where d.family_id = p_family_id
    and d.automation_key = 'savings_interest'
  limit 1;

  settlement_purpose_id := configured_settlement_purpose_id;
  if settlement_purpose_id is null then
    select p.id
    into settlement_purpose_id
    from public.purposes p
    where p.family_id = p_family_id
      and p.active
      and (p.code = 'purpose-8' or p.name = 'Đầu tư')
    order by (p.code = 'purpose-8') desc, p.sort_order, p.id
    limit 1;
  end if;
  if settlement_purpose_id is null then
    select p.id
    into settlement_purpose_id
    from public.purposes p
    where p.family_id = p_family_id
      and p.active
    order by p.sort_order, p.id
    limit 1;
  end if;

  interest_purpose_id := configured_interest_purpose_id;
  if interest_purpose_id is null then
    interest_purpose_id := settlement_purpose_id;
  end if;
  if interest_purpose_id is null then
    select p.id
    into interest_purpose_id
    from public.purposes p
    where p.family_id = p_family_id
      and p.active
    order by p.sort_order, p.id
    limit 1;
  end if;

  settlement_expense_type_id := configured_settlement_expense_type_id;
  if settlement_expense_type_id is null then
    select e.id
    into settlement_expense_type_id
    from public.expense_types e
    where e.family_id = p_family_id
      and e.active
      and (e.code = 'asset-savings-settlement' or e.name = 'Tất toán tiết kiệm')
    order by (e.code = 'asset-savings-settlement') desc, e.sort_order, e.id
    limit 1;
  end if;

  interest_expense_type_id := configured_interest_expense_type_id;
  if interest_expense_type_id is null then
    select e.id
    into interest_expense_type_id
    from public.expense_types e
    where e.family_id = p_family_id
      and e.active
      and (e.code = 'asset-savings-interest' or e.name = 'Lãi tiền gửi')
    order by (e.code = 'asset-savings-interest') desc, e.sort_order, e.id
    limit 1;
  end if;

  if p_payment_method_id is not null then
    select pm.id
    into resolved_payment_method_id
    from public.payment_methods pm
    where pm.id = p_payment_method_id
      and pm.family_id = p_family_id
      and pm.active;
    if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    resolved_payment_method_id := configured_settlement_payment_method_id;
    if resolved_payment_method_id is null then
      select pm.id
      into resolved_payment_method_id
      from public.payment_methods pm
      where pm.family_id = p_family_id
        and pm.active
      order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id
      limit 1;
    end if;
  end if;

  if settlement_purpose_id is null
    or settlement_expense_type_id is null
    or resolved_payment_method_id is null
    or (p_interest_amount > 0 and (interest_purpose_id is null or interest_expense_type_id is null))
  then
    raise exception 'CATALOG_NOT_READY';
  end if;

  insert into public.savings_movements(
    family_id, savings_account_id, movement_type, amount, balance_after,
    movement_date, payment_method_id, note, created_by
  ) values (
    p_family_id, p_savings_account_id, 'settlement', principal_amount, 0,
    p_settlement_date, resolved_payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''), p_actor_id
  ) returning * into settlement_movement_row;

  insert into public.transactions(
    family_id, transaction_date, transaction_type, status, description, amount,
    purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
    source, source_reference, ai_generated
  ) values (
    p_family_id, p_settlement_date, 'Thu nhập'::public.transaction_kind,
    case when p_settlement_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
    'Tất toán tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name,
    principal_amount, settlement_purpose_id, settlement_expense_type_id, resolved_payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''), p_actor_id, p_actor_id,
    'asset'::public.transaction_source,
    'asset:savings:' || p_savings_account_id || ':settlement', false
  ) returning id into settlement_transaction_id;
  update public.savings_movements
  set transaction_id = settlement_transaction_id
  where id = settlement_movement_row.id
    and family_id = p_family_id;
  settlement_movement_row.transaction_id := settlement_transaction_id;

  if p_interest_amount > 0 then
    insert into public.savings_movements(
      family_id, savings_account_id, movement_type, amount, balance_after,
      movement_date, payment_method_id, note, created_by
    ) values (
      p_family_id, p_savings_account_id, 'interest', p_interest_amount, 0,
      p_settlement_date, resolved_payment_method_id,
      nullif(trim(coalesce(p_note, '')), ''), p_actor_id
    ) returning * into interest_movement_row;

    insert into public.transactions(
      family_id, transaction_date, transaction_type, status, description, amount,
      purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
      source, source_reference, ai_generated
    ) values (
      p_family_id, p_settlement_date, 'Thu nhập'::public.transaction_kind,
      case when p_settlement_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
      'Lãi tất toán sổ tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name,
      p_interest_amount, interest_purpose_id, interest_expense_type_id, resolved_payment_method_id,
      nullif(trim(coalesce(p_note, '')), ''), p_actor_id, p_actor_id,
      'asset'::public.transaction_source,
      'asset:savings:' || p_savings_account_id || ':settlement-interest', false
    ) returning id into interest_transaction_id;
    update public.savings_movements
    set transaction_id = interest_transaction_id
    where id = interest_movement_row.id
      and family_id = p_family_id;
    interest_movement_row.transaction_id := interest_transaction_id;
  end if;

  update public.savings_accounts
  set current_balance = 0,
      status = 'closed',
      closed_at = now(),
      updated_by = p_actor_id
  where id = p_savings_account_id
    and family_id = p_family_id;
  select * into account_row
  from public.savings_accounts sa
  where sa.id = p_savings_account_id
    and sa.family_id = p_family_id;

  return jsonb_build_object(
    'account', to_jsonb(account_row),
    'settlementMovement', to_jsonb(settlement_movement_row),
    'interestMovement', case when p_interest_amount > 0 then to_jsonb(interest_movement_row) else 'null'::jsonb end,
    'principal', principal_amount,
    'interestAmount', p_interest_amount,
    'totalReceived', principal_amount + p_interest_amount
  );
end;
$$;

revoke all on function public.settle_savings_account_internal(uuid, uuid, numeric, date, uuid, text, uuid) from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');
