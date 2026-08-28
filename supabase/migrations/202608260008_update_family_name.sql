create or replace function public.update_family_name(p_family_id uuid,p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare clean_name text:=nullif(trim(regexp_replace(p_name,'\s+',' ','g')),'');
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if clean_name is null or length(clean_name)>100 then raise exception 'INVALID_NAME'; end if;
  update public.families set name=clean_name where id=p_family_id;
  return clean_name;
end;
$$;
revoke all on function public.update_family_name(uuid,text) from public;
grant execute on function public.update_family_name(uuid,text) to authenticated;
