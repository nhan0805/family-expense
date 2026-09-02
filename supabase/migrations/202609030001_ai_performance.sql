create table if not exists public.ai_request_context_cache(
  family_id uuid primary key references public.families(id) on delete cascade,
  catalogs jsonb not null check (jsonb_typeof(catalogs) = 'object'),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.ai_summary_cache(
  family_id uuid not null references public.families(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  period_label text not null check (length(trim(period_label)) between 1 and 100),
  language text not null check (language in ('vi', 'en')),
  summary text not null,
  highlights jsonb not null check (jsonb_typeof(highlights) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, date_from, date_to, period_label, language),
  check (date_from <= date_to)
);

create index if not exists ai_summary_cache_family_updated_idx
  on public.ai_summary_cache(family_id, updated_at desc);

alter table public.ai_request_context_cache enable row level security;
alter table public.ai_summary_cache enable row level security;
revoke all on table public.ai_request_context_cache, public.ai_summary_cache from public;
grant select, insert, update on table public.ai_summary_cache to authenticated;

drop policy if exists ai_summary_cache_select on public.ai_summary_cache;
drop policy if exists ai_summary_cache_insert on public.ai_summary_cache;
drop policy if exists ai_summary_cache_update on public.ai_summary_cache;
create policy ai_summary_cache_select on public.ai_summary_cache
  for select to authenticated using (public.is_family_member(family_id));
create policy ai_summary_cache_insert on public.ai_summary_cache
  for insert to authenticated with check (public.is_family_member(family_id));
create policy ai_summary_cache_update on public.ai_summary_cache
  for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create or replace function public.invalidate_ai_request_context_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_family_id uuid;
begin
  changed_family_id := case when tg_op = 'DELETE' then old.family_id else new.family_id end;
  delete from public.ai_request_context_cache where family_id = changed_family_id;
  delete from public.ai_summary_cache where family_id = changed_family_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.invalidate_ai_request_context_cache() from public;
grant execute on function public.invalidate_ai_request_context_cache() to authenticated, service_role;

drop trigger if exists ai_context_cache_purpose_invalidate on public.purposes;
create trigger ai_context_cache_purpose_invalidate
  after insert or update or delete on public.purposes
  for each row execute function public.invalidate_ai_request_context_cache();
drop trigger if exists ai_context_cache_expense_type_invalidate on public.expense_types;
create trigger ai_context_cache_expense_type_invalidate
  after insert or update or delete on public.expense_types
  for each row execute function public.invalidate_ai_request_context_cache();
drop trigger if exists ai_context_cache_payment_method_invalidate on public.payment_methods;
create trigger ai_context_cache_payment_method_invalidate
  after insert or update or delete on public.payment_methods
  for each row execute function public.invalidate_ai_request_context_cache();
drop trigger if exists ai_summary_cache_transaction_invalidate on public.transactions;
create trigger ai_summary_cache_transaction_invalidate
  after insert or update or delete on public.transactions
  for each row execute function public.invalidate_ai_request_context_cache();

create or replace function public.get_ai_request_context(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalogs jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  if (
    select count(*)
    from public.ai_usage_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 minute'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  select c.catalogs
  into catalogs
  from public.ai_request_context_cache c
  where c.family_id = p_family_id
    and c.refreshed_at >= now() - interval '60 seconds';

  if catalogs is null then
    select jsonb_build_object(
      'purposes', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
        from public.purposes
        where family_id = p_family_id and active = true
      ), '[]'::jsonb),
      'expenseTypes', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
        from public.expense_types
        where family_id = p_family_id and active = true
      ), '[]'::jsonb),
      'paymentMethods', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
        from public.payment_methods
        where family_id = p_family_id and active = true
      ), '[]'::jsonb)
    ) into catalogs;

    insert into public.ai_request_context_cache(family_id, catalogs, refreshed_at)
    values (p_family_id, catalogs, now())
    on conflict (family_id) do update
      set catalogs = excluded.catalogs, refreshed_at = excluded.refreshed_at;
  end if;

  return jsonb_build_object('userId', auth.uid()) || catalogs;
end;
$$;

revoke all on function public.get_ai_request_context(uuid) from public;
grant execute on function public.get_ai_request_context(uuid) to authenticated, service_role;

create or replace function public.get_ai_dashboard_facts(
  p_family_id uuid,
  p_date_from date,
  p_date_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to
    or p_date_to > (p_date_from + interval '120 months')::date then
    raise exception 'INVALID_DATE_RANGE';
  end if;
  if (
    select count(*)
    from public.ai_usage_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 minute'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  with months as (
    select month_start::date,
      to_char(month_start, 'YYYY-MM') as month_key
    from generate_series(
      date_trunc('month', p_date_from)::date,
      date_trunc('month', p_date_to)::date,
      interval '1 month'
    ) as month_start
  ), rows_in_range as (
    select
      t.transaction_date,
      t.transaction_type,
      t.amount,
      coalesce(et.name, 'Chưa phân loại') as category_name,
      coalesce(p.name, 'Chưa phân loại') as purpose_name
    from public.transactions t
    left join public.expense_types et on et.id = t.expense_type_id
      and et.family_id = t.family_id
    left join public.purposes p on p.id = t.purpose_id
      and p.family_id = t.family_id
    where t.family_id = p_family_id
      and t.status = 'Thực tế'
      and t.deleted_at is null
      and t.transaction_date between p_date_from and p_date_to
      and t.transaction_type in ('Chi tiêu', 'Thu nhập')
  ), totals as (
    select
      coalesce(sum(amount) filter (where transaction_type = 'Thu nhập'), 0) as total_income,
      coalesce(sum(amount) filter (where transaction_type = 'Chi tiêu'), 0) as total_expense
    from rows_in_range
  ), category_totals as (
    select category_name as name, sum(amount) as value
    from rows_in_range
    where transaction_type = 'Chi tiêu'
    group by category_name
    order by value desc
    limit 5
  ), purpose_totals as (
    select purpose_name as name, sum(amount) as value
    from rows_in_range
    where transaction_type = 'Chi tiêu'
    group by purpose_name
    order by value desc
    limit 5
  ), monthly_totals as (
    select
      m.month_key,
      m.month_start,
      coalesce(sum(r.amount) filter (where r.transaction_type = 'Chi tiêu'), 0) as expense,
      coalesce(sum(r.amount) filter (where r.transaction_type = 'Thu nhập'), 0) as income
    from months m
    left join rows_in_range r on to_char(r.transaction_date, 'YYYY-MM') = m.month_key
    group by m.month_key, m.month_start
  )
  select jsonb_build_object(
    'userId', auth.uid(),
    'facts', jsonb_build_object(
      'totalIncome', totals.total_income,
      'totalExpense', totals.total_expense,
      'netValue', totals.total_income - totals.total_expense,
      'averageExpense', totals.total_expense / greatest((select count(*) from months), 1),
      'periodMonths', (select count(*) from months),
      'topCategories', coalesce((
        select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
        from category_totals
      ), '[]'::jsonb),
      'topPurposes', coalesce((
        select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
        from purpose_totals
      ), '[]'::jsonb),
      'monthlyTrend', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month', concat('T', extract(month from month_start)::int, '/', extract(year from month_start)::int),
          'expense', expense,
          'income', income
        ) order by month_start)
        from monthly_totals
      ), '[]'::jsonb)
    )
  )
  into result
  from totals;

  return result;
end;
$$;

revoke all on function public.get_ai_dashboard_facts(uuid, date, date) from public;
grant execute on function public.get_ai_dashboard_facts(uuid, date, date) to authenticated, service_role;
