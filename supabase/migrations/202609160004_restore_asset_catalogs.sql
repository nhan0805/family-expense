-- Restore the built-in catalog rows required by the savings and gold RPCs.
-- Existing families may have removed or deactivated these rows before using
-- asset tracking; new families already receive them from seed_family_defaults.

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
where code in (
  'expense-25',
  'asset-savings-deposit',
  'asset-savings-interest',
  'asset-savings-withdrawal',
  'asset-savings-fee',
  'asset-savings-settlement'
);

insert into public.expense_types(family_id, name, name_en, code, icon, sort_order, active)
select f.id, v.name, v.name_en, v.code, v.icon, v.sort_order, true
from public.families f
cross join (values
  ('Đầu tư vàng', 'Gold investments', 'expense-25', 'coins', 25),
  ('Gửi tiết kiệm', 'Savings deposit', 'asset-savings-deposit', 'piggy-bank', 100),
  ('Lãi tiền gửi', 'Savings interest', 'asset-savings-interest', 'trending-up', 101),
  ('Rút tiết kiệm', 'Savings withdrawal', 'asset-savings-withdrawal', 'wallet', 102),
  ('Phí tiết kiệm', 'Savings fee', 'asset-savings-fee', 'receipt', 103),
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

-- Keep one known-good fallback payment method available for asset movements.
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

-- Asset RPCs use stable catalog codes so renaming a built-in label does not
-- make a savings or gold transaction impossible to create.
do $$
declare
  target_function regprocedure;
  old_definition text;
  new_definition text;
begin
  foreach target_function in array array[
    'public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure,
    'public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure,
    'public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure,
    'public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure
  ] loop
    old_definition := pg_get_functiondef(target_function::oid);
    new_definition := replace(
      old_definition,
      'p.active and p.name = ''Đầu tư''',
      'p.active and p.code = ''purpose-8'''
    );
    new_definition := replace(
      new_definition,
      'e.active and e.name = ''Đầu tư vàng''',
      'e.active and e.code = ''expense-25'''
    );
    if new_definition = old_definition then
      raise exception 'Asset catalog lookup was not found for %', target_function;
    end if;
    execute new_definition;
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
