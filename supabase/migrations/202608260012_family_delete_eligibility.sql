create or replace function public.can_delete_family(p_family_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return not exists(select 1 from public.transactions t where t.family_id=p_family_id);
end;
$$;
revoke all on function public.can_delete_family(uuid) from public;
grant execute on function public.can_delete_family(uuid) to authenticated;
