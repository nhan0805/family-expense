-- Keep privileged maintenance functions independent from the caller's
-- search_path. Every relation and helper used below is schema-qualified.
create or replace function public.permanently_delete_transactions(p_family_id uuid, p_transaction_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare deleted_count integer;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if coalesce(array_length(p_transaction_ids, 1), 0) < 1 or array_length(p_transaction_ids, 1) > 100 then raise exception 'INVALID_IDS'; end if;
  if public.is_family_owner(p_family_id) then
    delete from public.transactions where family_id = p_family_id and id = any(p_transaction_ids) and deleted_at is not null;
  else
    delete from public.transactions where family_id = p_family_id and id = any(p_transaction_ids) and created_by = auth.uid() and deleted_at is not null;
  end if;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.permanently_delete_transactions(uuid, uuid[]) from public;
grant execute on function public.permanently_delete_transactions(uuid, uuid[]) to authenticated;

create or replace function public.purge_deleted_transactions_after_30_days()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare purged_count integer;
begin
  delete from public.transactions
  where deleted_at is not null
    and deleted_at < (now() - interval '30 days');
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;
revoke all on function public.purge_deleted_transactions_after_30_days() from public, anon, authenticated;

create or replace function public.purge_ai_usage_logs_after_30_days()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare purged_count integer;
begin
  delete from public.ai_usage_logs
  where created_at < (now() - interval '30 days');
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;
revoke all on function public.purge_ai_usage_logs_after_30_days() from public, anon, authenticated;
