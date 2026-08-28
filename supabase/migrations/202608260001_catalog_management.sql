create or replace function public.delete_catalog_item(
  p_family_id uuid,
  p_kind text,
  p_item_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  item_exists boolean;
  transaction_exists boolean;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_kind = 'purpose' then
    select exists(select 1 from public.purposes where id = p_item_id and family_id = p_family_id) into item_exists;
    select exists(select 1 from public.transactions where family_id = p_family_id and purpose_id = p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.budgets where family_id = p_family_id and purpose_id = p_item_id;
    delete from public.purpose_expense_type_suggestions where purpose_id = p_item_id;
    delete from public.purposes where id = p_item_id and family_id = p_family_id;
  elsif p_kind = 'expenseType' then
    select exists(select 1 from public.expense_types where id = p_item_id and family_id = p_family_id) into item_exists;
    select exists(select 1 from public.transactions where family_id = p_family_id and expense_type_id = p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.purpose_expense_type_suggestions where expense_type_id = p_item_id;
    delete from public.expense_types where id = p_item_id and family_id = p_family_id;
  elsif p_kind = 'paymentMethod' then
    select exists(select 1 from public.payment_methods where id = p_item_id and family_id = p_family_id) into item_exists;
    select exists(select 1 from public.transactions where family_id = p_family_id and payment_method_id = p_item_id) into transaction_exists;
    if transaction_exists then raise exception 'CATALOG_IN_USE'; end if;
    delete from public.payment_methods where id = p_item_id and family_id = p_family_id;
  else
    raise exception 'INVALID_CATALOG_KIND';
  end if;

  return coalesce(item_exists, false);
end;
$$;

revoke all on function public.delete_catalog_item(uuid, text, uuid) from public;
grant execute on function public.delete_catalog_item(uuid, text, uuid) to authenticated;
