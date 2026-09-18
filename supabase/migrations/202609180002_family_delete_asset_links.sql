-- Family deletion also removes soft-deleted transactions. Clear the optional
-- asset-to-transaction links first so their composite foreign keys do not
-- block the final family delete.
create or replace function public.delete_empty_family(p_family_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_family uuid;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select f.id
  into locked_family
  from public.families f
  where f.id = p_family_id
  for update;
  if not found then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is null
  ) then
    raise exception 'FAMILY_HAS_ACTIVE_TRANSACTIONS';
  end if;

  update public.savings_movements sm
  set transaction_id = null
  where sm.family_id = p_family_id
    and sm.transaction_id is not null
    and exists (
      select 1
      from public.transactions t
      where t.family_id = sm.family_id
        and t.id = sm.transaction_id
        and t.deleted_at is not null
    );

  update public.gold_assets ga
  set transaction_id = null
  where ga.family_id = p_family_id
    and ga.transaction_id is not null
    and exists (
      select 1
      from public.transactions t
      where t.family_id = ga.family_id
        and t.id = ga.transaction_id
        and t.deleted_at is not null
    );

  update public.gold_sales gs
  set transaction_id = null
  where gs.family_id = p_family_id
    and gs.transaction_id is not null
    and exists (
      select 1
      from public.transactions t
      where t.family_id = gs.family_id
        and t.id = gs.transaction_id
        and t.deleted_at is not null
    );

  delete from public.transactions t
  where t.family_id = p_family_id
    and t.deleted_at is not null;

  delete from public.families f
  where f.id = p_family_id;
  return found;
end;
$$;

revoke all on function public.delete_empty_family(uuid) from public;
grant execute on function public.delete_empty_family(uuid) to authenticated;
