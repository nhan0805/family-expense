-- Quản lý thành viên tối giản: owner thêm một tài khoản Supabase đã đăng ký bằng email.
create or replace function public.get_family_members(p_family_id uuid)
returns table(id uuid,user_id uuid,display_name text,email text,role public.family_role,status public.member_status,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query
    select m.id,m.user_id,m.display_name,coalesce(u.email,''),m.role,m.status,m.created_at
    from public.family_members m join auth.users u on u.id=m.user_id
    where m.family_id=p_family_id and m.status='active'
    order by (m.role='owner') desc,m.created_at;
end;
$$;

create or replace function public.add_family_member(p_family_id uuid,p_email text,p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_user auth.users%rowtype;clean_email text:=lower(trim(p_email));clean_name text:=nullif(trim(coalesce(p_display_name,'')),'');member_id uuid;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if clean_email='' then raise exception 'INVALID_EMAIL'; end if;
  select * into target_user from auth.users where lower(email)=clean_email limit 1;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if exists(select 1 from public.family_members where family_id=p_family_id and user_id=target_user.id) then raise exception 'ALREADY_MEMBER'; end if;
  if exists(select 1 from public.family_members where user_id=target_user.id and status='active') then raise exception 'USER_IN_ANOTHER_FAMILY'; end if;
  insert into public.family_members(family_id,user_id,display_name,role,status)
    values(p_family_id,target_user.id,coalesce(clean_name,target_user.email,'Thành viên'),'member','active') returning id into member_id;
  return member_id;
end;
$$;

revoke all on function public.get_family_members(uuid) from public;
revoke all on function public.add_family_member(uuid,text,text) from public;
grant execute on function public.get_family_members(uuid) to authenticated;
grant execute on function public.add_family_member(uuid,text,text) to authenticated;
