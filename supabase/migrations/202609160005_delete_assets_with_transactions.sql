-- Delete an asset and every transaction created by its asset workflow as one
-- atomic, family-scoped operation. Child rows are removed first so the
-- transaction foreign keys never leave a partially deleted asset behind.

create or replace function public.delete_savings_account(
  p_family_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_transactions integer := 0;
  account_id uuid;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select sa.id
  into account_id
  from public.savings_accounts sa
  where sa.id = p_id
    and sa.family_id = p_family_id
  for update;
  if account_id is null then
    raise exception 'NOT_FOUND';
  end if;

  delete from public.savings_movements
  where family_id = p_family_id
    and savings_account_id = p_id;

  delete from public.transactions
  where family_id = p_family_id
    and source = 'asset'
    and source_reference like 'asset:savings:' || p_id::text || ':%';
  get diagnostics deleted_transactions = row_count;

  delete from public.savings_accounts
  where family_id = p_family_id
    and id = p_id;

  return jsonb_build_object(
    'deleted', true,
    'transactionsDeleted', deleted_transactions
  );
end;
$$;

revoke all on function public.delete_savings_account(uuid, uuid) from public;
grant execute on function public.delete_savings_account(uuid, uuid) to authenticated;

create or replace function public.delete_gold_asset(
  p_family_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_transactions integer := 0;
  asset_id uuid;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select ga.id
  into asset_id
  from public.gold_assets ga
  where ga.id = p_id
    and ga.family_id = p_family_id
  for update;
  if asset_id is null then
    raise exception 'NOT_FOUND';
  end if;

  delete from public.gold_sales
  where family_id = p_family_id
    and gold_asset_id = p_id;

  update public.gold_assets
  set transaction_id = null
  where family_id = p_family_id
    and id = p_id;

  delete from public.transactions
  where family_id = p_family_id
    and source = 'asset'
    and source_reference like 'asset:gold:' || p_id::text || ':%';
  get diagnostics deleted_transactions = row_count;

  delete from public.gold_assets
  where family_id = p_family_id
    and id = p_id;

  return jsonb_build_object(
    'deleted', true,
    'transactionsDeleted', deleted_transactions
  );
end;
$$;

revoke all on function public.delete_gold_asset(uuid, uuid) from public;
grant execute on function public.delete_gold_asset(uuid, uuid) to authenticated;
