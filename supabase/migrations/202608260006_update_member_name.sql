create or replace function public.update_family_member_name(p_family_id uuid,p_member_id uuid,p_display_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_user_id uuid;clean_name text:=nullif(trim(p_display_name),'');
begin
  if clean_name is null then raise exception 'INVALID_NAME'; end if;
  select user_id into target_user_id from public.family_members where id=p_member_id and family_id=p_family_id and status='active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if target_user_id<>auth.uid() and not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  update public.family_members set display_name=clean_name where id=p_member_id and family_id=p_family_id;
  return true;
end;
$$;

revoke all on function public.update_family_member_name(uuid,uuid,text) from public;
grant execute on function public.update_family_member_name(uuid,uuid,text) to authenticated;
