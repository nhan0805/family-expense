create or replace function public.guard_catalog_delete_in_use()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='purposes' and exists(select 1 from public.transactions t where t.purpose_id=old.id) then raise exception 'CATALOG_IN_USE'; end if;
  if tg_table_name='expense_types' and exists(select 1 from public.transactions t where t.expense_type_id=old.id) then raise exception 'CATALOG_IN_USE'; end if;
  if tg_table_name='payment_methods' and exists(select 1 from public.transactions t where t.payment_method_id=old.id) then raise exception 'CATALOG_IN_USE'; end if;
  return old;
end;
$$;

drop trigger if exists guard_purpose_delete_in_use on public.purposes;
create trigger guard_purpose_delete_in_use before delete on public.purposes for each row execute function public.guard_catalog_delete_in_use();
drop trigger if exists guard_expense_type_delete_in_use on public.expense_types;
create trigger guard_expense_type_delete_in_use before delete on public.expense_types for each row execute function public.guard_catalog_delete_in_use();
drop trigger if exists guard_payment_method_delete_in_use on public.payment_methods;
create trigger guard_payment_method_delete_in_use before delete on public.payment_methods for each row execute function public.guard_catalog_delete_in_use();

create or replace function public.delete_catalog_item(p_family_id uuid,p_kind text,p_item_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare item_exists boolean:=false;transaction_exists boolean:=false;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_kind='purpose' then
    select exists(select 1 from public.purposes p where p.id=p_item_id and p.family_id=p_family_id) into item_exists;
    select exists(select 1 from public.transactions t where t.family_id=p_family_id and t.purpose_id=p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.budgets b where b.family_id=p_family_id and b.purpose_id=p_item_id;
    delete from public.purpose_expense_type_suggestions s where s.purpose_id=p_item_id;
    delete from public.purposes p where p.id=p_item_id and p.family_id=p_family_id;
  elsif p_kind='expenseType' then
    select exists(select 1 from public.expense_types e where e.id=p_item_id and e.family_id=p_family_id) into item_exists;
    select exists(select 1 from public.transactions t where t.family_id=p_family_id and t.expense_type_id=p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.purpose_expense_type_suggestions s where s.expense_type_id=p_item_id;
    delete from public.expense_types e where e.id=p_item_id and e.family_id=p_family_id;
  elsif p_kind='paymentMethod' then
    select exists(select 1 from public.payment_methods pm where pm.id=p_item_id and pm.family_id=p_family_id) into item_exists;
    select exists(select 1 from public.transactions t where t.family_id=p_family_id and t.payment_method_id=p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.payment_methods pm where pm.id=p_item_id and pm.family_id=p_family_id;
  else raise exception 'INVALID_CATALOG_KIND';
  end if;
  return item_exists;
end;
$$;
