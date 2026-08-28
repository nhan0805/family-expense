create extension if not exists unaccent with schema extensions;

create or replace function public.list_family_transactions(
  p_family_id uuid,
  p_limit int default 50,
  p_offset int default 0,
  p_query text default '',
  p_transaction_type text default '',
  p_status text default '',
  p_purpose_id uuid default null,
  p_expense_type_id uuid default null,
  p_payment_method_id uuid default null,
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date-desc'
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
      and (p_purpose_id is null or t.purpose_id = p_purpose_id)
      and (p_expense_type_id is null or t.expense_type_id = p_expense_type_id)
      and (p_payment_method_id is null or t.payment_method_id = p_payment_method_id)
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
      select sum(
        case
          when b.transaction_type in ('Thu nhập','Hoàn tiền') then -b.amount
          else b.amount
        end
      )
      from base b
    ), 0),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.list_family_transactions(uuid,int,int,text,text,text,uuid,uuid,uuid,int,int,date,date,text) from public;
grant execute on function public.list_family_transactions(uuid,int,int,text,text,text,uuid,uuid,uuid,int,int,date,date,text) to authenticated;
