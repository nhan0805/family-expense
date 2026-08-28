-- Guard cấp bảng: không phụ thuộc UI/RPC/RLS và áp dụng cho mọi lệnh DELETE families.
create or replace function public.guard_family_delete_with_transactions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.transactions t where t.family_id=old.id) then
    raise exception 'FAMILY_HAS_TRANSACTIONS';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_family_delete_with_transactions on public.families;
create trigger guard_family_delete_with_transactions
before delete on public.families
for each row execute function public.guard_family_delete_with_transactions();

create or replace function public.delete_empty_family(p_family_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare locked_family uuid;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  select id into locked_family from public.families where id=p_family_id for update;
  if not found then raise exception 'FAMILY_NOT_FOUND'; end if;
  if exists(select 1 from public.transactions t where t.family_id=p_family_id) then raise exception 'FAMILY_HAS_TRANSACTIONS'; end if;
  delete from public.families where id=p_family_id;
  return found;
end;
$$;
