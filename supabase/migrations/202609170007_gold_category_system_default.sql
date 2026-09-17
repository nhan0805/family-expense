-- Use one stable, user-facing category for both gold workflows.
-- Keep expense-25 so existing transactions and mappings keep their identity.

update public.expense_types
set name = 'Vàng',
    name_en = 'Gold',
    icon = 'coins',
    active = true
where code = 'expense-25';

insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
select f.id, 'Vàng', 'Gold', 'expense-25', 'coins', 25, true
from public.families f
where not exists (
  select 1
  from public.expense_types e
  where e.family_id = f.id
    and e.code = 'expense-25'
)
on conflict (family_id, code) do update
set name = 'Vàng',
    name_en = 'Gold',
    icon = 'coins',
    active = true;

-- New families should receive the same canonical label and stable code.
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
end;
$$;

grant execute on function public.seed_family_defaults(uuid) to authenticated;

-- Seed functions must resolve the canonical gold code, including for families
-- created after this migration. Legacy name support keeps old catalogs safe.
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
      ('savings_interest', 'Lãi tiền gửi', 'Chuyển khoản'),
      ('savings_settlement', 'Tất toán tiết kiệm', 'Chuyển khoản'),
      ('gold_purchase', 'Vàng', 'Chuyển khoản'),
      ('gold_sale', 'Vàng', 'Chuyển khoản')
    ) as defaults(automation_key, expense_type_name, payment_method_name)
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
      and (
        (config.automation_key in ('gold_purchase', 'gold_sale') and (e.code = 'expense-25' or e.name in ('Vàng', 'Đầu tư vàng')))
        or (config.automation_key not in ('gold_purchase', 'gold_sale') and e.name = config.expense_type_name)
      )
    order by (e.code = 'expense-25') desc, e.sort_order, e.id
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

-- Replace the two gold mappings with the requested system defaults for every
-- existing family, including rows previously saved as the Khác fallback.
do $$
declare
  family_row record;
  investment_purpose_id uuid;
  gold_expense_type_id uuid;
  transfer_payment_method_id uuid;
begin
  for family_row in select f.id from public.families f loop
    perform public.seed_automatic_transaction_defaults(family_row.id);

    select p.id into investment_purpose_id
    from public.purposes p
    where p.family_id = family_row.id and p.active and p.code = 'purpose-8'
    limit 1;

    select e.id into gold_expense_type_id
    from public.expense_types e
    where e.family_id = family_row.id and e.active and e.code = 'expense-25'
    limit 1;

    select pm.id into transfer_payment_method_id
    from public.payment_methods pm
    where pm.family_id = family_row.id and pm.active and pm.name = 'Chuyển khoản'
    limit 1;

    if investment_purpose_id is not null
      and gold_expense_type_id is not null
      and transfer_payment_method_id is not null then
      insert into public.automatic_transaction_defaults(
        family_id, automation_key, purpose_id, expense_type_id, payment_method_id
      ) values
        (family_row.id, 'gold_purchase', investment_purpose_id, gold_expense_type_id, transfer_payment_method_id),
        (family_row.id, 'gold_sale', investment_purpose_id, gold_expense_type_id, transfer_payment_method_id)
      on conflict (family_id, automation_key) do update set
        purpose_id = excluded.purpose_id,
        expense_type_id = excluded.expense_type_id,
        payment_method_id = excluded.payment_method_id,
        updated_at = now();
    end if;
  end loop;
end;
$$;

-- Gold creation must use the same family mapping shown in Settings. The
-- explicit payment chosen in the form still wins over the mapped payment.
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
  configured_purpose_id uuid;
  configured_expense_type_id uuid;
  configured_payment_method_id uuid;
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

  if p_create_transaction then
    select d.purpose_id, d.expense_type_id, d.payment_method_id
    into configured_purpose_id, configured_expense_type_id, configured_payment_method_id
    from public.automatic_transaction_defaults d
    join public.purposes p
      on p.family_id = d.family_id and p.id = d.purpose_id and p.active
    join public.expense_types e
      on e.family_id = d.family_id and e.id = d.expense_type_id and e.active
    join public.payment_methods pm
      on pm.family_id = d.family_id and pm.id = d.payment_method_id and pm.active
    where d.family_id = p_family_id
      and d.automation_key = 'gold_purchase'
    limit 1;

    if configured_purpose_id is null or configured_expense_type_id is null or configured_payment_method_id is null then
      perform public.seed_automatic_transaction_defaults(p_family_id);
      select d.purpose_id, d.expense_type_id, d.payment_method_id
      into configured_purpose_id, configured_expense_type_id, configured_payment_method_id
      from public.automatic_transaction_defaults d
      join public.purposes p
        on p.family_id = d.family_id and p.id = d.purpose_id and p.active
      join public.expense_types e
        on e.family_id = d.family_id and e.id = d.expense_type_id and e.active
      join public.payment_methods pm
        on pm.family_id = d.family_id and pm.id = d.payment_method_id and pm.active
      where d.family_id = p_family_id
        and d.automation_key = 'gold_purchase'
      limit 1;
    end if;

    purpose_id := configured_purpose_id;
    expense_type_id := configured_expense_type_id;
  end if;

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
      resolved_payment_method_id := case when p_create_transaction then configured_payment_method_id else null end;
      if resolved_payment_method_id is null then
        select pm.id into resolved_payment_method_id
        from public.payment_methods pm
        where pm.family_id = p_family_id
          and pm.active
        order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id
        limit 1;
      end if;
    end if;

    if p_create_transaction and (purpose_id is null or expense_type_id is null or resolved_payment_method_id is null) then
      raise exception 'CATALOG_NOT_READY';
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
