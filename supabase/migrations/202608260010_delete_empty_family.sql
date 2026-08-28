create or replace function public.delete_empty_family(p_family_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.transactions where family_id=p_family_id) then raise exception 'FAMILY_HAS_TRANSACTIONS'; end if;
  delete from public.families where id=p_family_id;
  return found;
end;
$$;
revoke all on function public.delete_empty_family(uuid) from public;
grant execute on function public.delete_empty_family(uuid) to authenticated;
