-- Withdrawal and fee are no longer savings-book workflows. Remove their
-- family-level automatic mappings while keeping the catalog rows available
-- for historical transactions.
alter table public.automatic_transaction_defaults
  drop constraint if exists automatic_transaction_defaults_automation_key_check;

alter table public.automatic_transaction_defaults
  add constraint automatic_transaction_defaults_automation_key_check
  check (automation_key in (
    'savings_opening',
    'savings_interest',
    'savings_settlement',
    'gold_purchase',
    'gold_sale'
  ));

delete from public.automatic_transaction_defaults
where automation_key in ('savings_withdrawal', 'savings_fee');

create or replace function public.seed_automatic_transaction_defaults(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  config record;
  resolved_purpose_id uuid;
  resolved_expense_type_id uuid;
  resolved_payment_method_id uuid;
begin
  for config in
    select * from (values
      ('savings_opening', 'Gửi tiết kiệm', 'Chuyển khoản'),
      ('savings_interest', 'Lãi tiền gửi', 'Tiền mặt'),
      ('savings_settlement', 'Tất toán tiết kiệm', 'Tiền mặt'),
      ('gold_purchase', 'Đầu tư vàng', 'Chuyển khoản'),
      ('gold_sale', 'Đầu tư vàng', 'Tiền mặt')
    ) as defaults(automation_key, expense_type_name, payment_method_name)
  loop
    select p.id into resolved_purpose_id
    from public.purposes p
    where p.family_id = p_family_id
      and p.active
      and p.name = 'Đầu tư'
    order by p.sort_order, p.id
    limit 1;

    select e.id into resolved_expense_type_id
    from public.expense_types e
    where e.family_id = p_family_id
      and e.active
      and e.name = config.expense_type_name
    order by e.sort_order, e.id
    limit 1;

    select pm.id into resolved_payment_method_id
    from public.payment_methods pm
    where pm.family_id = p_family_id
      and pm.active
      and pm.name = config.payment_method_name
    order by pm.sort_order, pm.id
    limit 1;

    if resolved_purpose_id is not null
      and resolved_expense_type_id is not null
      and resolved_payment_method_id is not null then
      insert into public.automatic_transaction_defaults(
        family_id, automation_key, purpose_id, expense_type_id, payment_method_id
      ) values (
        p_family_id, config.automation_key, resolved_purpose_id,
        resolved_expense_type_id, resolved_payment_method_id
      ) on conflict (family_id, automation_key) do nothing;
    end if;
  end loop;
end;
$$;

do $$
declare
  family_row record;
begin
  for family_row in select f.id from public.families f loop
    perform public.seed_automatic_transaction_defaults(family_row.id);
  end loop;
end;
$$;

create or replace function public.save_automatic_transaction_defaults(
  p_family_id uuid,
  p_defaults jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  key text;
  seen_keys text[] := array[]::text[];
  purpose_id uuid;
  expense_type_id uuid;
  payment_method_id uuid;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_typeof(p_defaults) <> 'array' or jsonb_array_length(p_defaults) <> 5 then
    raise exception 'INVALID_AUTOMATIC_TRANSACTION_DEFAULTS';
  end if;

  delete from public.automatic_transaction_defaults
  where family_id = p_family_id
    and automation_key in ('savings_withdrawal', 'savings_fee');

  for item in select value from jsonb_array_elements(p_defaults) loop
    key := item ->> 'automation_key';
    if key is null or key not in (
      'savings_opening',
      'savings_interest',
      'savings_settlement',
      'gold_purchase',
      'gold_sale'
    ) or key = any(seen_keys) then
      raise exception 'INVALID_AUTOMATIC_TRANSACTION_DEFAULTS';
    end if;
    seen_keys := array_append(seen_keys, key);

    purpose_id := nullif(item ->> 'purpose_id', '')::uuid;
    expense_type_id := nullif(item ->> 'expense_type_id', '')::uuid;
    payment_method_id := nullif(item ->> 'payment_method_id', '')::uuid;

    if not exists(
      select 1 from public.purposes p
      where p.family_id = p_family_id and p.id = purpose_id and p.active
    ) then
      raise exception 'INVALID_PURPOSE';
    end if;
    if not exists(
      select 1 from public.expense_types e
      where e.family_id = p_family_id and e.id = expense_type_id and e.active
    ) then
      raise exception 'INVALID_EXPENSE_TYPE';
    end if;
    if not exists(
      select 1 from public.payment_methods pm
      where pm.family_id = p_family_id and pm.id = payment_method_id and pm.active
    ) then
      raise exception 'INVALID_PAYMENT_METHOD';
    end if;

    insert into public.automatic_transaction_defaults(
      family_id, automation_key, purpose_id, expense_type_id, payment_method_id
    ) values (
      p_family_id, key, purpose_id, expense_type_id, payment_method_id
    ) on conflict (family_id, automation_key) do update set
      purpose_id = excluded.purpose_id,
      expense_type_id = excluded.expense_type_id,
      payment_method_id = excluded.payment_method_id,
      updated_at = now();
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'automation_key', d.automation_key,
      'purpose_id', d.purpose_id,
      'expense_type_id', d.expense_type_id,
      'payment_method_id', d.payment_method_id
    ) order by d.automation_key)
    from public.automatic_transaction_defaults d
    where d.family_id = p_family_id
  ), '[]'::jsonb);
end;
$$;

-- Withdrawal and fee are no longer configurable, but old movement data can
-- still be read without trying to resolve a removed mapping.
create or replace function public.apply_automatic_transaction_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_key text;
  default_row public.automatic_transaction_defaults%rowtype;
  savings_type text;
begin
  if new.source <> 'asset'::public.transaction_source or new.source_reference is null then
    return new;
  end if;

  resolved_key := public.automatic_transaction_default_key(new.source_reference);
  if resolved_key is null and new.source_reference like 'asset:savings:%:movement:%' then
    select sm.movement_type into savings_type
    from public.savings_movements sm
    where sm.family_id = new.family_id
      and sm.id::text = substring(new.source_reference from 'asset:savings:[^:]+:movement:([^:]+)$');
    resolved_key := case savings_type
      when 'interest' then 'savings_interest'
      when 'settlement' then 'savings_settlement'
      else null
    end;
  end if;
  if resolved_key is null then
    return new;
  end if;

  select d.* into default_row
  from public.automatic_transaction_defaults d
  where d.family_id = new.family_id
    and d.automation_key = resolved_key;
  if not found then
    return new;
  end if;

  new.purpose_id := default_row.purpose_id;
  new.expense_type_id := default_row.expense_type_id;
  new.payment_method_id := default_row.payment_method_id;
  return new;
end;
$$;

select pg_notify('pgrst', 'reload schema');
