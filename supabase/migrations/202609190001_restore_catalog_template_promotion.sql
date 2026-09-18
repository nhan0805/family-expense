-- Allow a family owner to refresh the catalog template used by future families.
-- Existing families keep their own catalog rows; this only changes onboarding defaults.
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

  lock table public.system_catalog_template_items in exclusive mode;

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

select pg_notify('pgrst', 'reload schema');
