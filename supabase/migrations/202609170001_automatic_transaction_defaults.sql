-- Store family-level catalog choices for transactions created by asset workflows.
create table public.automatic_transaction_defaults(
  family_id uuid not null references public.families(id) on delete cascade,
  automation_key text not null check (automation_key in (
    'savings_opening',
    'savings_interest',
    'savings_withdrawal',
    'savings_fee',
    'savings_settlement',
    'gold_purchase',
    'gold_sale'
  )),
  purpose_id uuid not null,
  expense_type_id uuid not null,
  payment_method_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, automation_key),
  foreign key (family_id, purpose_id) references public.purposes(family_id, id),
  foreign key (family_id, expense_type_id) references public.expense_types(family_id, id),
  foreign key (family_id, payment_method_id) references public.payment_methods(family_id, id)
);

create index automatic_transaction_defaults_family_idx
  on public.automatic_transaction_defaults(family_id);

create trigger automatic_transaction_defaults_touch
before update on public.automatic_transaction_defaults
for each row execute function public.touch_updated_at();

alter table public.automatic_transaction_defaults enable row level security;

revoke all on table public.automatic_transaction_defaults from anon, authenticated, public;
grant select on table public.automatic_transaction_defaults to authenticated;

create policy automatic_transaction_defaults_select
  on public.automatic_transaction_defaults for select to authenticated
  using (public.is_family_member(family_id));

-- Internal seeding helper. It is intentionally not exposed to browser clients.
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
      ('savings_withdrawal', 'Rút tiết kiệm', 'Tiền mặt'),
      ('savings_fee', 'Phí tiết kiệm', 'Chuyển khoản'),
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

revoke all on function public.seed_automatic_transaction_defaults(uuid) from public;

-- Seed existing families after the catalog migrations have run.
do $$
declare
  family_row record;
begin
  for family_row in select f.id from public.families f loop
    perform public.seed_automatic_transaction_defaults(family_row.id);
  end loop;
end;
$$;

-- The existing seed function already creates the family catalogs. Keep its
-- bilingual names, icons and stable asset codes intact, then seed the new
-- mapping from the family-creation wrapper below.
create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_id uuid;
begin
  insert into public.families(name, created_by)
  values (trim(p_name), auth.uid())
  returning id into family_id;

  insert into public.family_members(family_id, user_id, display_name, role)
  values (family_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Chủ gia đình'), 'owner');

  perform public.seed_family_defaults(family_id);
  perform public.seed_automatic_transaction_defaults(family_id);
  return family_id;
end;
$$;

grant execute on function public.create_family(text) to authenticated;

-- Owners update all seven mappings atomically. Catalog ids are rechecked here,
-- because the RPC is the authorization boundary for family configuration.
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
  if jsonb_typeof(p_defaults) <> 'array' or jsonb_array_length(p_defaults) <> 7 then
    raise exception 'INVALID_AUTOMATIC_TRANSACTION_DEFAULTS';
  end if;

  for item in select value from jsonb_array_elements(p_defaults) loop
    key := item ->> 'automation_key';
    if key is null or key not in (
      'savings_opening',
      'savings_interest',
      'savings_withdrawal',
      'savings_fee',
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

revoke all on function public.save_automatic_transaction_defaults(uuid, jsonb) from anon, authenticated, public;
grant execute on function public.save_automatic_transaction_defaults(uuid, jsonb) to authenticated;

-- Apply the configured mapping only when an asset workflow creates a new
-- transaction. Existing transactions are not rewritten by a settings change.
create or replace function public.automatic_transaction_default_key(p_source_reference text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source_reference like 'asset:savings:%:opening' then 'savings_opening'
    when p_source_reference like 'asset:savings:%:settlement-interest' then 'savings_interest'
    when p_source_reference like 'asset:savings:%:settlement' then 'savings_settlement'
    when p_source_reference like 'asset:gold:%:purchase' then 'gold_purchase'
    when p_source_reference like 'asset:gold:%:sale:%' then 'gold_sale'
    else null
  end;
$$;

-- Movement references do not include their movement type, so the trigger
-- resolves those rows from the linked movement/sale after insert instead.
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
      when 'withdrawal' then 'savings_withdrawal'
      when 'fee' then 'savings_fee'
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

revoke all on function public.automatic_transaction_default_key(text) from public;
revoke all on function public.apply_automatic_transaction_defaults() from public;

drop trigger if exists transactions_apply_automatic_defaults on public.transactions;
create trigger transactions_apply_automatic_defaults
before insert on public.transactions
for each row execute function public.apply_automatic_transaction_defaults();

-- Add the configuration rows to the existing catalog deletion guard.
create or replace function public.guard_catalog_delete_in_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'purposes' and (
    exists(select 1 from public.transactions t where t.purpose_id = old.id)
    or exists(select 1 from public.automatic_transaction_defaults d where d.family_id = old.family_id and d.purpose_id = old.id)
  ) then
    raise exception 'CATALOG_IN_USE';
  end if;
  if tg_table_name = 'expense_types' and (
    exists(select 1 from public.transactions t where t.expense_type_id = old.id)
    or exists(select 1 from public.automatic_transaction_defaults d where d.family_id = old.family_id and d.expense_type_id = old.id)
  ) then
    raise exception 'CATALOG_IN_USE';
  end if;
  if tg_table_name = 'payment_methods' and (
    exists(select 1 from public.transactions t where t.payment_method_id = old.id)
    or exists(select 1 from public.automatic_transaction_defaults d where d.family_id = old.family_id and d.payment_method_id = old.id)
  ) then
    raise exception 'CATALOG_IN_USE';
  end if;
  return old;
end;
$$;

revoke all on function public.guard_catalog_delete_in_use() from public;

select pg_notify('pgrst', 'reload schema');
