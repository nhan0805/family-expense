create or replace function public.guard_transaction_creator_and_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'TRANSACTION_CREATOR_IMMUTABLE';
  end if;

  if new.deleted_at is not null
    and old.deleted_at is distinct from new.deleted_at
    and old.created_by is distinct from auth.uid()
    and not public.is_family_owner(old.family_id)
  then
    raise exception 'DELETE_TRANSACTION_FORBIDDEN';
  end if;

  return new;
end
$$;

drop trigger if exists transactions_guard_creator_and_delete on public.transactions;
create trigger transactions_guard_creator_and_delete
before update on public.transactions
for each row execute function public.guard_transaction_creator_and_delete();
