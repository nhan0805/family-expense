create or replace function public.remove_family_member(p_family_id uuid,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_role public.family_role;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  select role into target_role from public.family_members where id=p_member_id and family_id=p_family_id and status='active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if target_role='owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;
  delete from public.family_members where id=p_member_id and family_id=p_family_id;
  return true;
end;
$$;

revoke all on function public.remove_family_member(uuid,uuid) from public;
grant execute on function public.remove_family_member(uuid,uuid) to authenticated;
