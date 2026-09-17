-- Let a family owner promote the current active catalogs to the defaults used
-- when a new family is created. The template is system configuration, not a
-- tenant data table, so it is only reachable through guarded RPCs.
create table public.system_catalog_template_items(
  kind text not null check (kind in ('purpose','expense_type','payment_method')),
  catalog_key text not null check (length(trim(catalog_key)) > 0),
  name text not null check (length(trim(name)) > 0),
  name_en text,
  color text,
  icon text,
  budget_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, catalog_key)
);

create table public.system_catalog_template_meta(
  singleton boolean primary key default true check (singleton),
  source_family_id uuid references public.families(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.system_catalog_template_items enable row level security;
alter table public.system_catalog_template_meta enable row level security;
revoke all on table public.system_catalog_template_items from anon, authenticated, public;
revoke all on table public.system_catalog_template_meta from anon, authenticated, public;

create or replace function public.save_system_catalog_template(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  purpose_count integer;
  expense_type_count integer;
  payment_method_count integer;
begin
  if auth.uid() is null or not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into purpose_count
  from public.purposes
  where family_id = p_family_id and active;

  select count(*) into expense_type_count
  from public.expense_types
  where family_id = p_family_id and active;

  select count(*) into payment_method_count
  from public.payment_methods
  where family_id = p_family_id and active;

  if purpose_count = 0 or expense_type_count = 0 or payment_method_count = 0 then
    raise exception 'INVALID_CATALOG_TEMPLATE';
  end if;

  delete from public.system_catalog_template_items;

  insert into public.system_catalog_template_items(
    kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
  )
  select
    'purpose', p.code, p.name, p.name_en, p.color, p.icon,
    coalesce(p.budget_enabled, true), p.sort_order
  from public.purposes p
  where p.family_id = p_family_id and p.active;

  insert into public.system_catalog_template_items(
    kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
  )
  select
    'expense_type', e.code, e.name, e.name_en, null, e.icon, true, e.sort_order
  from public.expense_types e
  where e.family_id = p_family_id and e.active;

  insert into public.system_catalog_template_items(
    kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
  )
  select
    'payment_method', 'payment-' || md5(pm.name), pm.name, pm.name_en,
    null, pm.icon, true, pm.sort_order
  from public.payment_methods pm
  where pm.family_id = p_family_id and pm.active;

  insert into public.system_catalog_template_meta(singleton, source_family_id, updated_by, updated_at)
  values (true, p_family_id, auth.uid(), now())
  on conflict (singleton) do update
  set source_family_id = excluded.source_family_id,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'purposes', purpose_count,
    'expenseTypes', expense_type_count,
    'paymentMethods', payment_method_count
  );
end;
$$;

revoke all on function public.save_system_catalog_template(uuid) from anon, authenticated, public;
grant execute on function public.save_system_catalog_template(uuid) to authenticated;

-- New families use the promoted template when one exists. Built-in defaults
-- remain the fallback so onboarding keeps working before the first snapshot.
create or replace function public.seed_family_defaults(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  names text[] := array['Sinh hoạt gia đình','Con cái','Du lịch','Hiếu hỉ & quan hệ','Nhà cửa & gia dụng','Xe cộ','Sức khỏe gia đình','Thai sản','Đầu tư','Khác'];
  names_en text[] := array['Family living','Children','Travel','Family occasions & relationships','Home & household','Vehicles','Family health','Maternity','Investments','Other'];
  icons text[] := array['house','baby','plane','heart-handshake','house','car','heart-pulse','baby','trending-up','tag'];
  types text[] := array['Ăn uống','Thực phẩm','Điện','Nước','Internet','Di chuyển','Xăng','ETC','Khách sạn','Vé máy bay','Quần áo','Giày dép','Gia dụng','Giáo dục','Sức khỏe','Mỹ phẩm','Giải trí','Đồ chơi','Tiêu dùng','Thú cưng','Đám cưới','Sinh nhật','Lì xì','Quà','Đầu tư chứng khoán','Vàng','Khác','Gửi tiết kiệm','Lãi tiền gửi','Rút tiết kiệm','Phí tiết kiệm','Tất toán tiết kiệm'];
  types_en text[] := array['Dining','Groceries','Electricity','Water','Internet','Transport','Fuel','ETC','Hotels','Flights','Clothing','Shoes','Household goods','Education','Healthcare','Cosmetics','Entertainment','Toys','Shopping','Pets','Weddings','Birthdays','Lucky money','Gifts','Stock investments','Gold','Other','Savings deposit','Savings interest','Savings withdrawal','Savings fee','Savings settlement'];
  type_codes text[] := array['expense-0','expense-1','expense-2','expense-3','expense-4','expense-5','expense-6','expense-7','expense-8','expense-9','expense-10','expense-11','expense-12','expense-13','expense-14','expense-15','expense-16','expense-17','expense-18','expense-19','expense-20','expense-21','expense-22','expense-23','expense-24','expense-25','expense-26','asset-savings-deposit','asset-savings-interest','asset-savings-withdrawal','asset-savings-fee','asset-savings-settlement'];
  type_icons text[] := array['utensils','shopping-basket','lightbulb','droplets','wifi','bus','fuel','ticket','hotel','plane','shirt','footprints','house','graduation-cap','heart-pulse','sparkles','gamepad-2','toy-brick','shopping-cart','paw-print','heart','cake-slice','gift','gift','chart-candlestick','coins','tag','piggy-bank','trending-up','wallet','receipt','landmark'];
  payment_names text[] := array['Chuyển khoản','Thẻ tín dụng','Trả góp','Urbox','Tiền mặt'];
  payment_names_en text[] := array['Bank transfer','Credit card','Installments','Urbox','Cash'];
  payment_icons text[] := array['landmark','credit-card','credit-card','ticket','banknote'];
  template_item record;
  has_template boolean;
  n text;
  i integer;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select exists(
    select 1 from public.system_catalog_template_items limit 1
  ) into has_template;

  if has_template then
    for template_item in
      select *
      from public.system_catalog_template_items
      order by case kind when 'purpose' then 0 when 'expense_type' then 1 else 2 end,
        sort_order, catalog_key
    loop
      if template_item.kind = 'purpose' then
        insert into public.purposes(
          family_id, name, name_en, code, color, icon, sort_order, active, budget_enabled
        ) values (
          p_family_id, template_item.name, template_item.name_en, template_item.catalog_key,
          template_item.color, template_item.icon, template_item.sort_order, true,
          template_item.budget_enabled
        ) on conflict (family_id, code) do nothing;
      elsif template_item.kind = 'expense_type' then
        insert into public.expense_types(
          family_id, name, name_en, code, icon, sort_order, active
        ) values (
          p_family_id, template_item.name, template_item.name_en, template_item.catalog_key,
          template_item.icon, template_item.sort_order, true
        ) on conflict (family_id, code) do nothing;
      else
        insert into public.payment_methods(
          family_id, name, name_en, icon, sort_order, active
        ) values (
          p_family_id, template_item.name, template_item.name_en, template_item.icon,
          template_item.sort_order, true
        ) on conflict (family_id, name) do nothing;
      end if;
    end loop;
  else
    i := 1;
    foreach n in array names loop
      insert into public.purposes(
        family_id, name, name_en, code, icon, sort_order, active, budget_enabled
      ) values (
        p_family_id, n, names_en[i], 'purpose-' || (i - 1), icons[i], i - 1, true, true
      ) on conflict (family_id, code) do nothing;
      i := i + 1;
    end loop;

    i := 1;
    foreach n in array types loop
      insert into public.expense_types(
        family_id, name, name_en, code, icon, sort_order, active
      ) values (
        p_family_id, n, types_en[i], type_codes[i], type_icons[i], i - 1, true
      ) on conflict (family_id, code) do nothing;
      i := i + 1;
    end loop;

    i := 1;
    foreach n in array payment_names loop
      insert into public.payment_methods(
        family_id, name, name_en, icon, sort_order, active
      ) values (
        p_family_id, n, payment_names_en[i], payment_icons[i], i - 1, true
      ) on conflict (family_id, name) do nothing;
      i := i + 1;
    end loop;
  end if;

  -- Asset workflows always need these stable rows. Keep the promoted labels
  -- when the source family already has the corresponding stable code.
  insert into public.purposes(
    family_id, name, name_en, code, color, icon, sort_order, active, budget_enabled
  ) values (
    p_family_id, 'Đầu tư', 'Investments', 'purpose-8', '#6081a8', 'trending-up', 8, true, true
  ) on conflict (family_id, code) do nothing;

  insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
  select p_family_id, v.name, v.name_en, v.code, v.icon, v.sort_order, true
  from (values
    ('Vàng', 'Gold', 'expense-25', 'coins', 25),
    ('Gửi tiết kiệm', 'Savings deposit', 'asset-savings-deposit', 'piggy-bank', 100),
    ('Lãi tiền gửi', 'Savings interest', 'asset-savings-interest', 'trending-up', 101),
    ('Rút tiết kiệm', 'Savings withdrawal', 'asset-savings-withdrawal', 'wallet', 102),
    ('Phí tiết kiệm', 'Savings fee', 'asset-savings-fee', 'receipt', 103),
    ('Tất toán tiết kiệm', 'Savings settlement', 'asset-savings-settlement', 'landmark', 104)
  ) as v(name, name_en, code, icon, sort_order)
  on conflict (family_id, code) do nothing;

  insert into public.payment_methods(
    family_id, name, name_en, icon, sort_order, active
  ) values (
    p_family_id, 'Chuyển khoản', 'Bank transfer', 'landmark', 0, true
  ) on conflict (family_id, name) do nothing;
end;
$$;

grant execute on function public.seed_family_defaults(uuid) to authenticated;

-- Resolve automatic asset mappings by stable catalog code first, so custom
-- labels copied from the source family do not break onboarding.
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
      ('savings_opening', 'asset-savings-deposit', 'Gửi tiết kiệm', 'Chuyển khoản'),
      ('savings_interest', 'asset-savings-interest', 'Lãi tiền gửi', 'Chuyển khoản'),
      ('savings_settlement', 'asset-savings-settlement', 'Tất toán tiết kiệm', 'Chuyển khoản'),
      ('gold_purchase', 'expense-25', 'Vàng', 'Chuyển khoản'),
      ('gold_sale', 'expense-25', 'Vàng', 'Chuyển khoản')
    ) as defaults(automation_key, expense_type_code, expense_type_name, payment_method_name)
  loop
    select p.id into resolved_purpose_id
    from public.purposes p
    where p.family_id = p_family_id
      and p.active
      and (p.code = 'purpose-8' or p.name = 'Đầu tư')
    order by (p.code = 'purpose-8') desc, p.sort_order, p.id
    limit 1;

    select e.id into resolved_expense_type_id
    from public.expense_types e
    where e.family_id = p_family_id
      and e.active
      and (e.code = config.expense_type_code or e.name = config.expense_type_name)
    order by (e.code = config.expense_type_code) desc, e.sort_order, e.id
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

select pg_notify('pgrst', 'reload schema');
