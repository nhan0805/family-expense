-- Use the family's current automatic-transaction setup as the system seed.
-- Existing family choices remain untouched; this only affects missing rows and
-- families created after this migration.
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
      ('gold_purchase', 'Đầu tư vàng', 'Chuyển khoản'),
      ('gold_sale', 'Đầu tư vàng', 'Chuyển khoản')
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

select pg_notify('pgrst', 'reload schema');
