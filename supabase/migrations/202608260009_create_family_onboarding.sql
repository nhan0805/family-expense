create or replace function public.create_family_with_defaults(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;clean_name text:=nullif(trim(regexp_replace(p_name,'\s+',' ','g')),'');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if clean_name is null or length(clean_name)>100 then raise exception 'INVALID_NAME'; end if;
  if exists(select 1 from public.family_members where user_id=auth.uid() and status='active') then raise exception 'ALREADY_HAS_FAMILY'; end if;
  fid:=public.create_family(clean_name);
  perform public.seed_family_defaults(fid);
  return fid;
end;
$$;
revoke all on function public.create_family_with_defaults(text) from public;
grant execute on function public.create_family_with_defaults(text) to authenticated;
