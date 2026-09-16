-- Minimal family asset tracking: savings books and physical gold lots.
-- Asset mutations are owner-only and create their linked cash transaction
-- inside the same database transaction.

do $$
begin
  alter type public.transaction_source add value if not exists 'asset';
exception when duplicate_object then null;
end $$;

-- These categories keep asset cash movements visible in the existing
-- transaction screen without introducing a new transaction kind.
insert into public.purposes(family_id, name, name_en, code, color, sort_order, active)
select f.id, 'Đầu tư', 'Investments', 'purpose-8', '#6081a8', 8, true
from public.families f
where not exists (
  select 1 from public.purposes p where p.family_id = f.id and p.name = 'Đầu tư'
)
on conflict (family_id, code) do nothing;

insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
select f.id, v.name, v.name_en, v.code, v.icon, v.sort_order, true
from public.families f
cross join (values
  ('Gửi tiết kiệm', 'Savings deposit', 'asset-savings-deposit', 'piggy-bank', 100),
  ('Lãi tiền gửi', 'Savings interest', 'asset-savings-interest', 'trending-up', 101),
  ('Rút tiết kiệm', 'Savings withdrawal', 'asset-savings-withdrawal', 'wallet', 102),
  ('Phí tiết kiệm', 'Savings fee', 'asset-savings-fee', 'receipt', 103),
  ('Tất toán tiết kiệm', 'Savings settlement', 'asset-savings-settlement', 'landmark', 104)
) as v(name, name_en, code, icon, sort_order)
where not exists (
  select 1 from public.expense_types e where e.family_id = f.id and e.code = v.code
)
on conflict (family_id, code) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_family_id_id_key'
  ) then
    alter table public.transactions add constraint transactions_family_id_id_key unique (family_id, id);
  end if;
end $$;

create table public.savings_accounts(
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  bank_name text not null check(length(trim(bank_name)) between 1 and 120),
  name text not null check(length(trim(name)) between 1 and 120),
  principal numeric(15,0) not null check(principal > 0 and principal = trunc(principal)),
  current_balance numeric(15,0) not null check(current_balance >= 0 and current_balance = trunc(current_balance)),
  annual_interest_rate numeric(7,4) not null check(annual_interest_rate between 0 and 100),
  term_months int not null check(term_months between 1 and 120),
  opened_on date not null,
  maturity_on date not null check(maturity_on >= opened_on),
  interest_method text not null check(interest_method in ('end_of_term','monthly','upfront','renew')),
  status text not null default 'active' check(status in ('active','closed','archived')),
  note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  archived_at timestamptz,
  unique(family_id, id)
);

create table public.savings_movements(
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  savings_account_id uuid not null,
  movement_type text not null check(movement_type in ('opening','interest','withdrawal','fee','settlement')),
  amount numeric(15,0) not null check(amount > 0 and amount = trunc(amount)),
  balance_after numeric(15,0) not null check(balance_after >= 0 and balance_after = trunc(balance_after)),
  movement_date date not null,
  payment_method_id uuid,
  transaction_id uuid,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(family_id, id)
);

create table public.gold_assets(
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  purchase_date date not null,
  quantity_chi numeric(10,3) not null check(quantity_chi > 0),
  remaining_quantity_chi numeric(10,3) not null check(remaining_quantity_chi >= 0 and remaining_quantity_chi <= quantity_chi),
  purchase_price_per_chi numeric(15,0) not null check(purchase_price_per_chi > 0 and purchase_price_per_chi = trunc(purchase_price_per_chi)),
  estimated_sell_price_per_chi numeric(15,0) check(estimated_sell_price_per_chi is null or (estimated_sell_price_per_chi > 0 and estimated_sell_price_per_chi = trunc(estimated_sell_price_per_chi))),
  status text not null default 'active' check(status in ('active','sold','archived')),
  transaction_id uuid,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(family_id, id),
  check(status <> 'sold' or remaining_quantity_chi = 0)
);

create table public.gold_sales(
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  gold_asset_id uuid not null,
  sale_date date not null,
  quantity_chi numeric(10,3) not null check(quantity_chi > 0),
  sale_price_per_chi numeric(15,0) not null check(sale_price_per_chi > 0 and sale_price_per_chi = trunc(sale_price_per_chi)),
  amount numeric(15,0) not null check(amount > 0 and amount = trunc(amount)),
  payment_method_id uuid,
  transaction_id uuid,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(family_id, id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'savings_movements_account_same_family_fkey') then
    alter table public.savings_movements add constraint savings_movements_account_same_family_fkey
      foreign key (family_id, savings_account_id) references public.savings_accounts(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'savings_movements_transaction_same_family_fkey') then
    alter table public.savings_movements add constraint savings_movements_transaction_same_family_fkey
      foreign key (family_id, transaction_id) references public.transactions(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gold_assets_transaction_same_family_fkey') then
    alter table public.gold_assets add constraint gold_assets_transaction_same_family_fkey
      foreign key (family_id, transaction_id) references public.transactions(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gold_sales_asset_same_family_fkey') then
    alter table public.gold_sales add constraint gold_sales_asset_same_family_fkey
      foreign key (family_id, gold_asset_id) references public.gold_assets(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gold_sales_transaction_same_family_fkey') then
    alter table public.gold_sales add constraint gold_sales_transaction_same_family_fkey
      foreign key (family_id, transaction_id) references public.transactions(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'savings_movements_payment_method_same_family_fkey') then
    alter table public.savings_movements add constraint savings_movements_payment_method_same_family_fkey
      foreign key (family_id, payment_method_id) references public.payment_methods(family_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gold_sales_payment_method_same_family_fkey') then
    alter table public.gold_sales add constraint gold_sales_payment_method_same_family_fkey
      foreign key (family_id, payment_method_id) references public.payment_methods(family_id, id);
  end if;
end $$;

create index savings_accounts_family_status_idx on public.savings_accounts(family_id, status, maturity_on);
create index savings_movements_family_account_date_idx on public.savings_movements(family_id, savings_account_id, movement_date desc);
create index gold_assets_family_status_idx on public.gold_assets(family_id, status, purchase_date desc);
create index gold_sales_family_asset_date_idx on public.gold_sales(family_id, gold_asset_id, sale_date desc);

create trigger savings_accounts_touch before update on public.savings_accounts for each row execute function public.touch_updated_at();
create trigger gold_assets_touch before update on public.gold_assets for each row execute function public.touch_updated_at();

alter table public.savings_accounts enable row level security;
alter table public.savings_movements enable row level security;
alter table public.gold_assets enable row level security;
alter table public.gold_sales enable row level security;

drop policy if exists savings_accounts_select on public.savings_accounts;
create policy savings_accounts_select on public.savings_accounts for select to authenticated
  using(public.is_family_member(family_id) and (status <> 'archived' or public.is_family_owner(family_id)));
drop policy if exists savings_movements_select on public.savings_movements;
create policy savings_movements_select on public.savings_movements for select to authenticated
  using(public.is_family_member(family_id));
drop policy if exists gold_assets_select on public.gold_assets;
create policy gold_assets_select on public.gold_assets for select to authenticated
  using(public.is_family_member(family_id) and (status <> 'archived' or public.is_family_owner(family_id)));
drop policy if exists gold_sales_select on public.gold_sales;
create policy gold_sales_select on public.gold_sales for select to authenticated
  using(public.is_family_member(family_id));

revoke all on table public.savings_accounts, public.savings_movements, public.gold_assets, public.gold_sales from anon, authenticated;
grant select on table public.savings_accounts, public.savings_movements, public.gold_assets, public.gold_sales to authenticated;

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
        p_family_id, p_opened_on, 'Chi tiêu', case when p_opened_on <= today_date then 'Thực tế' else 'Dự kiến' end,
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
          p_family_id, p_opened_on, 'Chi tiêu', case when p_opened_on <= today_date then 'Thực tế' else 'Dự kiến' end,
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
    case when p_movement_date <= today_date then 'Thực tế' else 'Dự kiến' end,
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

create or replace function public.archive_savings_account(p_family_id uuid, p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  update public.savings_accounts set status = 'archived', archived_at = now(), updated_by = auth.uid()
  where id = p_id and family_id = p_family_id and status = 'closed' and current_balance = 0;
  if not found then raise exception 'ACCOUNT_NOT_CLOSED'; end if;
  return true;
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
      purpose_id, expense_type_id, resolved_payment_method_id, note, created_by, updated_by,
      source, source_reference, ai_generated
    ) values (
      p_family_id, p_purchase_date, 'Chi tiêu', case when p_purchase_date <= today_date then 'Thực tế' else 'Dự kiến' end,
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
    p_family_id, p_sale_date, 'Thu nhập', case when p_sale_date <= today_date then 'Thực tế' else 'Dự kiến' end,
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

create or replace function public.archive_gold_asset(p_family_id uuid, p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  update public.gold_assets set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_id and family_id = p_family_id and status = 'sold' and remaining_quantity_chi = 0;
  if not found then raise exception 'ASSET_NOT_SOLD'; end if;
  return true;
end;
$$;

create or replace function public.get_asset_summary(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'netCash', coalesce((select sum(case when t.transaction_type = 'Thu nhập' then t.amount when t.transaction_type = 'Chi tiêu' then -t.amount else 0 end) from public.transactions t where t.family_id = p_family_id and t.status = 'Thực tế' and t.deleted_at is null), 0),
    'savingsTotal', coalesce((select sum(sa.current_balance) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'), 0),
    'goldEstimatedTotal', coalesce((select sum(ga.remaining_quantity_chi * coalesce(ga.estimated_sell_price_per_chi, 0)) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldCost', coalesce((select sum(ga.remaining_quantity_chi * ga.purchase_price_per_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldQuantityChi', coalesce((select sum(ga.remaining_quantity_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'savingsCount', (select count(*) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'),
    'goldCount', (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'),
    'goldMissingEstimateCount', (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active' and ga.estimated_sell_price_per_chi is null),
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
      'purchase_price_per_chi', ga.purchase_price_per_chi, 'estimated_sell_price_per_chi', ga.estimated_sell_price_per_chi,
      'status', ga.status, 'transaction_id', ga.transaction_id, 'note', ga.note,
      'created_by', ga.created_by, 'created_at', ga.created_at, 'updated_at', ga.updated_at, 'archived_at', ga.archived_at
    ) order by ga.purchase_date desc) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,int,date,date,text,uuid,text,boolean) from public;
revoke all on function public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean) from public;
revoke all on function public.archive_savings_account(uuid,uuid) from public;
revoke all on function public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean) from public;
revoke all on function public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text) from public;
revoke all on function public.archive_gold_asset(uuid,uuid) from public;
revoke all on function public.get_asset_summary(uuid) from public;
grant execute on function public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,int,date,date,text,uuid,text,boolean) to authenticated;
grant execute on function public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean) to authenticated;
grant execute on function public.archive_savings_account(uuid,uuid) to authenticated;
grant execute on function public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean) to authenticated;
grant execute on function public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text) to authenticated;
grant execute on function public.archive_gold_asset(uuid,uuid) to authenticated;
grant execute on function public.get_asset_summary(uuid) to authenticated;

-- Keep the asset categories available for families created after this migration.
create or replace function public.seed_family_defaults(p_family_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  names text[] := array['Sinh hoạt gia đình','Con cái','Du lịch','Hiếu hỉ & quan hệ','Nhà cửa & gia dụng','Xe cộ','Sức khỏe gia đình','Thai sản','Đầu tư','Khác'];
  names_en text[] := array['Family living','Children','Travel','Family occasions & relationships','Home & household','Vehicles','Family health','Maternity','Investments','Other'];
  icons text[] := array['house','baby','plane','heart-handshake','house','car','heart-pulse','baby','trending-up','tag'];
  types text[] := array['Ăn uống','Thực phẩm','Điện','Nước','Internet','Di chuyển','Xăng','ETC','Khách sạn','Vé máy bay','Quần áo','Giày dép','Gia dụng','Giáo dục','Sức khỏe','Mỹ phẩm','Giải trí','Đồ chơi','Tiêu dùng','Thú cưng','Đám cưới','Sinh nhật','Lì xì','Quà','Đầu tư chứng khoán','Đầu tư vàng','Khác','Gửi tiết kiệm','Lãi tiền gửi','Rút tiết kiệm','Phí tiết kiệm','Tất toán tiết kiệm'];
  types_en text[] := array['Dining','Groceries','Electricity','Water','Internet','Transport','Fuel','ETC','Hotels','Flights','Clothing','Shoes','Household goods','Education','Healthcare','Cosmetics','Entertainment','Toys','Shopping','Pets','Weddings','Birthdays','Lucky money','Gifts','Stock investments','Gold investments','Other','Savings deposit','Savings interest','Savings withdrawal','Savings fee','Savings settlement'];
  type_codes text[] := array['expense-0','expense-1','expense-2','expense-3','expense-4','expense-5','expense-6','expense-7','expense-8','expense-9','expense-10','expense-11','expense-12','expense-13','expense-14','expense-15','expense-16','expense-17','expense-18','expense-19','expense-20','expense-21','expense-22','expense-23','expense-24','expense-25','expense-26','asset-savings-deposit','asset-savings-interest','asset-savings-withdrawal','asset-savings-fee','asset-savings-settlement'];
  type_icons text[] := array['utensils','shopping-basket','lightbulb','droplets','wifi','bus','fuel','ticket','hotel','plane','shirt','footprints','house','graduation-cap','heart-pulse','sparkles','gamepad-2','toy-brick','shopping-cart','paw-print','heart','cake-slice','gift','gift','chart-candlestick','coins','tag','piggy-bank','trending-up','wallet','receipt','landmark'];
  payment_names text[] := array['Chuyển khoản','Thẻ tín dụng','Trả góp','Urbox','Tiền mặt'];
  payment_names_en text[] := array['Bank transfer','Credit card','Installments','Urbox','Cash'];
  payment_icons text[] := array['landmark','credit-card','credit-card','ticket','banknote'];
  n text;
  i int;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  i := 1;
  foreach n in array names loop
    insert into public.purposes(family_id,name,name_en,code,icon,sort_order)
      values(p_family_id,n,names_en[i],'purpose-'||(i - 1),icons[i],i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array types loop
    insert into public.expense_types(family_id,name,name_en,code,icon,sort_order)
      values(p_family_id,n,types_en[i],type_codes[i],type_icons[i],i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array payment_names loop
    insert into public.payment_methods(family_id,name,name_en,icon,sort_order)
      values(p_family_id,n,payment_names_en[i],payment_icons[i],i - 1)
      on conflict(family_id,name) do nothing;
    i := i + 1;
  end loop;
end $$;
grant execute on function public.seed_family_defaults(uuid) to authenticated;
