-- Soft-delete recurring templates without touching transactions already created.
alter table public.recurring_transactions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists recurring_transactions_active_due_idx
  on public.recurring_transactions(active, next_run_date)
  where active = true and deleted_at is null;

drop policy if exists recurring_transactions_select on public.recurring_transactions;
create policy recurring_transactions_select
  on public.recurring_transactions for select to authenticated
  using (public.is_family_member(family_id) and deleted_at is null);

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

-- A deleted template cannot be resumed through the pause/resume RPC.
create or replace function public.set_recurring_transaction_active(
  p_family_id uuid,
  p_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;

  update public.recurring_transactions
  set active = p_active
  where id = p_id
    and family_id = p_family_id
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.set_recurring_transaction_active(uuid, uuid, boolean) from public;
grant execute on function public.set_recurring_transaction_active(uuid, uuid, boolean) to authenticated;
