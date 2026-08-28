create or replace function public.bulk_update_transactions(
  p_family_id uuid,
  p_transaction_ids uuid[],
  p_changes jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer;
  target_count integer;
  updated_count integer;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  requested_count := coalesce(cardinality(p_transaction_ids), 0);
  if requested_count < 1 or requested_count > 100 then
    raise exception 'INVALID_SELECTION_SIZE';
  end if;
  if (select count(distinct value) from unnest(p_transaction_ids) as value) <> requested_count then
    raise exception 'DUPLICATE_TRANSACTION_IDS';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'NO_CHANGES';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) as key
    where key not in ('purpose_id', 'expense_type_id', 'payment_method_id', 'status')
  ) then
    raise exception 'INVALID_CHANGE_FIELD';
  end if;

  if p_changes ? 'purpose_id' and not exists (
    select 1 from public.purposes p
    where p.id = (p_changes->>'purpose_id')::uuid and p.family_id = p_family_id and p.active
  ) then raise exception 'INVALID_PURPOSE'; end if;
  if p_changes ? 'expense_type_id' and not exists (
    select 1 from public.expense_types e
    where e.id = (p_changes->>'expense_type_id')::uuid and e.family_id = p_family_id and e.active
  ) then raise exception 'INVALID_EXPENSE_TYPE'; end if;
  if p_changes ? 'payment_method_id' and not exists (
    select 1 from public.payment_methods pm
    where pm.id = (p_changes->>'payment_method_id')::uuid and pm.family_id = p_family_id and pm.active
  ) then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_changes ? 'status' and p_changes->>'status' not in ('Thực tế', 'Dự kiến') then
    raise exception 'INVALID_STATUS';
  end if;

  select count(*) into target_count
  from public.transactions t
  where t.family_id = p_family_id
    and t.id = any(p_transaction_ids)
    and t.deleted_at is null;
  if target_count <> requested_count then
    raise exception 'TRANSACTION_SELECTION_CHANGED';
  end if;

  update public.transactions t set
    purpose_id = case when p_changes ? 'purpose_id' then (p_changes->>'purpose_id')::uuid else t.purpose_id end,
    expense_type_id = case when p_changes ? 'expense_type_id' then (p_changes->>'expense_type_id')::uuid else t.expense_type_id end,
    payment_method_id = case when p_changes ? 'payment_method_id' then (p_changes->>'payment_method_id')::uuid else t.payment_method_id end,
    status = case when p_changes ? 'status' then (p_changes->>'status')::public.transaction_status else t.status end,
    updated_by = auth.uid()
  where t.family_id = p_family_id
    and t.id = any(p_transaction_ids)
    and t.deleted_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end
$$;

revoke all on function public.bulk_update_transactions(uuid, uuid[], jsonb) from public;
grant execute on function public.bulk_update_transactions(uuid, uuid[], jsonb) to authenticated;
