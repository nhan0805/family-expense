-- Add first-class exclusion filters without changing the already-applied RPCs.
-- Empty include arrays still mean "all"; exclusion arrays are applied as NOT IN.

create function public.list_family_transactions_v2(
  p_family_id uuid,
  p_limit int default 50,
  p_offset int default 0,
  p_query text default '',
  p_transaction_type text default '',
  p_status text default '',
  p_purpose_ids uuid[] default '{}'::uuid[],
  p_expense_type_ids uuid[] default '{}'::uuid[],
  p_payment_method_ids uuid[] default '{}'::uuid[],
  p_exclude_purpose_ids uuid[] default '{}'::uuid[],
  p_exclude_expense_type_ids uuid[] default '{}'::uuid[],
  p_exclude_payment_method_ids uuid[] default '{}'::uuid[],
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date-desc',
  p_amount_min numeric default null,
  p_amount_max numeric default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGE'; end if;
  if p_sort not in ('date-desc','date-asc','amount-desc','amount-asc','description-asc') then raise exception 'INVALID_SORT'; end if;
  if p_amount_min is not null and p_amount_min < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_max is not null and p_amount_max < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_min is not null and p_amount_max is not null and p_amount_min > p_amount_max then raise exception 'INVALID_AMOUNT_FILTER'; end if;

  with base as (
    select t.*
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is null
      and (
        trim(p_query) = ''
        or extensions.unaccent(lower(t.description)) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
        or extensions.unaccent(lower(coalesce(t.note, ''))) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
      )
      and (p_transaction_type = '' or t.transaction_type::text = p_transaction_type)
      and (p_status = '' or t.status::text = p_status)
      and (cardinality(coalesce(p_purpose_ids, '{}'::uuid[])) = 0 or t.purpose_id = any(p_purpose_ids))
      and (cardinality(coalesce(p_expense_type_ids, '{}'::uuid[])) = 0 or t.expense_type_id = any(p_expense_type_ids))
      and (cardinality(coalesce(p_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id = any(p_payment_method_ids))
      and (cardinality(coalesce(p_exclude_purpose_ids, '{}'::uuid[])) = 0 or not (t.purpose_id = any(p_exclude_purpose_ids)))
      and (cardinality(coalesce(p_exclude_expense_type_ids, '{}'::uuid[])) = 0 or not (t.expense_type_id = any(p_exclude_expense_type_ids)))
      and (cardinality(coalesce(p_exclude_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id is null or not (t.payment_method_id = any(p_exclude_payment_method_ids)))
      and (p_amount_min is null or t.amount >= p_amount_min)
      and (p_amount_max is null or t.amount <= p_amount_max)
      and (p_month is null or extract(month from t.transaction_date)::int = p_month)
      and (p_year is null or extract(year from t.transaction_date)::int = p_year)
      and (p_date_from is null or t.transaction_date >= p_date_from)
      and (p_date_to is null or t.transaction_date <= p_date_to)
  ), filtered as (
    select * from base t
    order by
      case when p_sort = 'date-desc' then t.transaction_date end desc,
      case when p_sort = 'date-desc' then t.created_at end desc,
      case when p_sort = 'date-asc' then t.transaction_date end asc,
      case when p_sort = 'date-asc' then t.created_at end asc,
      case when p_sort = 'amount-desc' then t.amount end desc,
      case when p_sort = 'amount-asc' then t.amount end asc,
      case when p_sort = 'description-asc' then lower(t.description) end asc,
      t.id
    limit p_limit + 1 offset p_offset
  ), page as (
    select * from filtered limit p_limit
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from page p), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from filtered),
    'totalAmount', coalesce((
      select sum(case when b.transaction_type = 'Thu nhập' then -b.amount else b.amount end)
      from base b
    ), 0),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.list_family_transactions_v2(uuid,int,int,text,text,text,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) from public;
grant execute on function public.list_family_transactions_v2(uuid,int,int,text,text,text,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) to authenticated;

create function public.list_deleted_transactions_v2(
  p_family_id uuid,
  p_limit int default 50,
  p_offset int default 0,
  p_query text default '',
  p_transaction_type text default '',
  p_purpose_ids uuid[] default '{}'::uuid[],
  p_expense_type_ids uuid[] default '{}'::uuid[],
  p_payment_method_ids uuid[] default '{}'::uuid[],
  p_exclude_purpose_ids uuid[] default '{}'::uuid[],
  p_exclude_expense_type_ids uuid[] default '{}'::uuid[],
  p_exclude_payment_method_ids uuid[] default '{}'::uuid[],
  p_amount_min numeric default null,
  p_amount_max numeric default null,
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGE'; end if;
  if p_amount_min is not null and p_amount_min < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_max is not null and p_amount_max < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_min is not null and p_amount_max is not null and p_amount_min > p_amount_max then raise exception 'INVALID_AMOUNT_FILTER'; end if;

  with base as (
    select t.*
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is not null
      and (public.is_family_owner(p_family_id) or t.created_by = auth.uid())
      and (
        trim(p_query) = ''
        or extensions.unaccent(lower(t.description)) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
        or extensions.unaccent(lower(coalesce(t.note, ''))) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
      )
      and (p_transaction_type = '' or t.transaction_type::text = p_transaction_type)
      and (cardinality(coalesce(p_purpose_ids, '{}'::uuid[])) = 0 or t.purpose_id = any(p_purpose_ids))
      and (cardinality(coalesce(p_expense_type_ids, '{}'::uuid[])) = 0 or t.expense_type_id = any(p_expense_type_ids))
      and (cardinality(coalesce(p_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id = any(p_payment_method_ids))
      and (cardinality(coalesce(p_exclude_purpose_ids, '{}'::uuid[])) = 0 or not (t.purpose_id = any(p_exclude_purpose_ids)))
      and (cardinality(coalesce(p_exclude_expense_type_ids, '{}'::uuid[])) = 0 or not (t.expense_type_id = any(p_exclude_expense_type_ids)))
      and (cardinality(coalesce(p_exclude_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id is null or not (t.payment_method_id = any(p_exclude_payment_method_ids)))
      and (p_amount_min is null or t.amount >= p_amount_min)
      and (p_amount_max is null or t.amount <= p_amount_max)
      and (p_month is null or extract(month from t.transaction_date)::int = p_month)
      and (p_year is null or extract(year from t.transaction_date)::int = p_year)
      and (p_date_from is null or t.transaction_date >= p_date_from)
      and (p_date_to is null or t.transaction_date <= p_date_to)
  ), filtered as (
    select * from base order by deleted_at desc, id limit p_limit + 1 offset p_offset
  ), page as (
    select * from filtered limit p_limit
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from page p), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from filtered),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.list_deleted_transactions_v2(uuid,int,int,text,text,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],numeric,numeric,int,int,date,date) from public;
grant execute on function public.list_deleted_transactions_v2(uuid,int,int,text,text,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],numeric,numeric,int,int,date,date) to authenticated;

select pg_notify('pgrst', 'reload schema');
