-- Restore the AI context cache that was overwritten by the later security
-- hardening migration, and let dashboard summaries avoid re-aggregating data
-- when a fresh cached response already exists.

create or replace function public.get_ai_request_context(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalogs jsonb;
  reservation jsonb;
begin
  reservation := public.consume_ai_request_slot(p_family_id);

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
    )
    into catalogs;

    insert into public.ai_request_context_cache(family_id, catalogs, refreshed_at)
    values (p_family_id, catalogs, now())
    on conflict (family_id) do update
      set catalogs = excluded.catalogs,
          refreshed_at = excluded.refreshed_at;
  end if;

  return jsonb_build_object(
    'userId', reservation->>'userId',
    'slotId', reservation->>'slotId'
  ) || catalogs;
end;
$$;

revoke all on function public.get_ai_request_context(uuid) from public;
grant execute on function public.get_ai_request_context(uuid) to authenticated, service_role;

create or replace function public.get_ai_dashboard_context(
  p_family_id uuid,
  p_date_from date,
  p_date_to date,
  p_period_label text,
  p_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation jsonb;
  cached jsonb;
  result jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_date_from is null
    or p_date_to is null
    or p_date_from > p_date_to
    or p_date_to > (p_date_from + interval '120 months')::date
  then
    raise exception 'INVALID_DATE_RANGE';
  end if;
  if p_period_label is null
    or length(trim(p_period_label)) not between 1 and 100
    or p_language is null
    or p_language not in ('vi', 'en')
  then
    raise exception 'INVALID_REQUEST_BODY';
  end if;

  select jsonb_build_object(
    'summary', c.summary,
    'highlights', c.highlights
  )
  into cached
  from public.ai_summary_cache c
  where c.family_id = p_family_id
    and c.date_from = p_date_from
    and c.date_to = p_date_to
    and c.period_label = trim(p_period_label)
    and c.language = p_language
    and c.updated_at >= now() - interval '5 minutes';

  if cached is not null then
    return jsonb_build_object(
      'userId', auth.uid(),
      'slotId', null,
      'cached', cached
    );
  end if;

  reservation := public.consume_ai_request_slot(p_family_id);

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
    left join public.expense_types et
      on et.id = t.expense_type_id and et.family_id = t.family_id
    left join public.purposes p
      on p.id = t.purpose_id and p.family_id = t.family_id
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
    'userId', reservation->>'userId',
    'slotId', reservation->>'slotId',
    'cached', null,
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

revoke all on function public.get_ai_dashboard_context(uuid, date, date, text, text) from public;
grant execute on function public.get_ai_dashboard_context(uuid, date, date, text, text) to authenticated, service_role;
