-- PostgreSQL yêu cầu từng cột RETURN QUERY khớp chính xác kiểu RETURNS TABLE.
-- auth.users.email là varchar, trong khi API công khai trả email dạng text.
create or replace function public.get_family_members(p_family_id uuid)
returns table(id uuid,user_id uuid,display_name text,email text,role public.family_role,status public.member_status,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query
    select m.id,m.user_id,m.display_name,coalesce(u.email,'')::text,m.role,m.status,m.created_at
    from public.family_members m join auth.users u on u.id=m.user_id
    where m.family_id=p_family_id and m.status='active'
    order by (m.role='owner') desc,m.created_at;
end;
$$;
