-- Allow owners to restore deleted recurring templates or permanently remove
-- the template and its run history. Generated transactions remain intact.
alter table public.recurring_transactions
  add column if not exists deleted_active_before boolean;

update public.recurring_transactions
set deleted_active_before = coalesce(deleted_active_before, false)
where deleted_at is not null;

drop policy if exists recurring_transactions_select on public.recurring_transactions;
create policy recurring_transactions_select
  on public.recurring_transactions for select to authenticated
  using (
    public.is_family_member(family_id)
    and (deleted_at is null or public.is_family_owner(family_id))
  );

create or replace function public.delete_recurring_transaction(
  p_family_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;

  update public.recurring_transactions
  set active = false,
      deleted_active_before = active,
      deleted_at = now(),
      deleted_by = auth.uid(),
      last_error_code = null
  where id = p_id
    and family_id = p_family_id
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.delete_recurring_transaction(uuid, uuid) from public, anon;
grant execute on function public.delete_recurring_transaction(uuid, uuid) to authenticated;

create or replace function public.restore_recurring_transaction(
  p_family_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;

  update public.recurring_transactions
  set active = coalesce(deleted_active_before, false),
      deleted_active_before = null,
      deleted_at = null,
      deleted_by = null,
      last_error_code = null
  where id = p_id
    and family_id = p_family_id
    and deleted_at is not null;

  return found;
end;
$$;

revoke all on function public.restore_recurring_transaction(uuid, uuid) from public, anon;
grant execute on function public.restore_recurring_transaction(uuid, uuid) to authenticated;

create or replace function public.permanently_delete_recurring_transaction(
  p_family_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;

  delete from public.recurring_transactions
  where id = p_id
    and family_id = p_family_id
    and deleted_at is not null;

  return found;
end;
$$;

revoke all on function public.permanently_delete_recurring_transaction(uuid, uuid) from public, anon;
grant execute on function public.permanently_delete_recurring_transaction(uuid, uuid) to authenticated;
