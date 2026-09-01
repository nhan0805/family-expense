-- The legacy values were migrated to the two supported transaction kinds.
-- Keep the mapping here as a safety net for old local fixtures or any row that
-- was missed by the data migration before removing the values from the enum.
alter type public.transaction_kind rename to transaction_kind_legacy;
create type public.transaction_kind as enum ('Chi tiêu', 'Thu nhập');

alter table public.transactions
  alter column transaction_type type public.transaction_kind
  using (
    case transaction_type::text
      when 'Hoàn tiền' then 'Thu nhập'
      when 'Tạm ứng' then 'Chi tiêu'
      else transaction_type::text
    end
  )::public.transaction_kind;

drop type public.transaction_kind_legacy;

create or replace function public.get_dashboard_trends(p_family_id uuid,p_year int,p_month int)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; month_start date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then raise exception 'INVALID_PERIOD'; end if;
  month_start:=make_date(p_year,p_month,1);
  with months as (select generate_series(month_start-interval '5 months',month_start,interval '1 month')::date start_date), data as (
    select m.start_date,
      coalesce(sum(t.amount) filter (where t.transaction_type = 'Thu nhập'),0) income,
      coalesce(sum(t.amount) filter (where t.transaction_type = 'Chi tiêu'),0) expense
    from months m left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=m.start_date and t.transaction_date<(m.start_date+interval '1 month')
    group by m.start_date order by m.start_date
  )
  select jsonb_build_object(
    'income',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',income)) from data),'[]'::jsonb),
    'expense',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',expense)) from data),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.get_dashboard_summary(p_family_id uuid,p_year int,p_month int)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; month_start date; month_end date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then raise exception 'INVALID_PERIOD'; end if;
  month_start := make_date(p_year,p_month,1); month_end := (month_start + interval '1 month')::date;
  with actual_month as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=month_start and t.transaction_date<month_end),
  totals as (select coalesce(sum(amount) filter(where transaction_type = 'Thu nhập'),0) income,coalesce(sum(amount) filter(where transaction_type = 'Chi tiêu'),0) expense from actual_month),
  purpose_data as (select p.name,p.name_en,sum(case when t.transaction_type='Chi tiêu' then t.amount when t.transaction_type='Thu nhập' then -t.amount else 0 end) value from actual_month t join public.purposes p on p.id=t.purpose_id group by p.id,p.name,p.name_en having sum(case when t.transaction_type='Chi tiêu' then t.amount when t.transaction_type='Thu nhập' then -t.amount else 0 end)>0 order by value desc),
  expense_data as (select e.name,e.name_en,sum(case when t.transaction_type='Chi tiêu' then t.amount when t.transaction_type='Thu nhập' then -t.amount else 0 end) value from actual_month t join public.expense_types e on e.id=t.expense_type_id group by e.id,e.name,e.name_en having sum(case when t.transaction_type='Chi tiêu' then t.amount when t.transaction_type='Thu nhập' then -t.amount else 0 end)>0 order by value desc),
  income_purpose_data as (select p.name,p.name_en,sum(t.amount) value from actual_month t join public.purposes p on p.id=t.purpose_id where t.transaction_type = 'Thu nhập' group by p.id,p.name,p.name_en order by value desc),
  income_expense_data as (select e.name,e.name_en,sum(t.amount) value from actual_month t join public.expense_types e on e.id=t.expense_type_id where t.transaction_type = 'Thu nhập' group by e.id,e.name,e.name_en order by value desc),
  trend_months as (select generate_series(month_start-interval '5 months',month_start,interval '1 month')::date start_date),
  trend_data as (select tm.start_date,coalesce(sum(case when t.transaction_type = 'Chi tiêu' then -t.amount when t.transaction_type = 'Thu nhập' then t.amount else 0 end),0) value from trend_months tm left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=tm.start_date and t.transaction_date<(tm.start_date+interval '1 month') group by tm.start_date order by tm.start_date),
  recent as (select t.* from actual_month t order by t.transaction_date desc,t.created_at desc,t.id limit 5), due as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Dự kiến' and t.transaction_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by t.transaction_date,t.created_at,t.id limit 20)
  select jsonb_build_object('totalIncome',totals.income,'totalExpense',totals.expense,'byPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from purpose_data),'[]'::jsonb),'byExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from expense_data),'[]'::jsonb),'incomeByPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from income_purpose_data),'[]'::jsonb),'incomeByExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from income_expense_data),'[]'::jsonb),'trend',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',value)) from trend_data),'[]'::jsonb),'recentTransactions',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),'dueTransactions',coalesce((select jsonb_agg(to_jsonb(d)) from due d),'[]'::jsonb)) into result from totals;
  return result;
end $$;

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
      and (p_purpose_id is null or t.purpose_id = p_purpose_id)
      and (p_expense_type_id is null or t.expense_type_id = p_expense_type_id)
      and (p_payment_method_id is null or t.payment_method_id = p_payment_method_id)
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
