-- Budget management V1: monthly budgets by purpose.
-- Actual spending intentionally excludes planned, deleted and income transactions.

create or replace function public.get_budget_summary(
  p_family_id uuid,
  p_year int,
  p_month int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  month_start date;
  month_end date;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then
    raise exception 'INVALID_PERIOD';
  end if;

  month_start := make_date(p_year, p_month, 1);
  month_end := (month_start + interval '1 month')::date;

  with spent_by_purpose as (
    select
      t.purpose_id,
      coalesce(sum(t.amount), 0)::numeric as spent
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is null
      and t.status = 'Thực tế'
      and t.transaction_type = 'Chi tiêu'
      and t.transaction_date >= month_start
      and t.transaction_date < month_end
    group by t.purpose_id
  ),
  budget_rows as (
    select
      p.id as purpose_id,
      p.name,
      p.name_en,
      b.id as budget_id,
      b.amount::numeric as budget,
      coalesce(s.spent, 0)::numeric as spent,
      coalesce(b.warning_threshold, 0.8)::numeric as warning_threshold
    from public.purposes p
    left join public.budgets b
      on b.family_id = p_family_id
      and b.purpose_id = p.id
      and b.year = p_year
      and b.month = p_month
    left join spent_by_purpose s on s.purpose_id = p.id
    where p.family_id = p_family_id
      and p.active = true
  ),
  budget_items as (
    select
      purpose_id,
      budget_id,
      name,
      name_en,
      budget,
      spent,
      case when budget is null then null else budget - spent end as remaining,
      case
        when budget is null then null
        when budget = 0 and spent > 0 then 100::numeric
        when budget = 0 then 0::numeric
        else round((spent / budget) * 100, 2)
      end as usage_percent,
      warning_threshold,
      case
        when budget is null then 'unconfigured'
        when budget = 0 and spent > 0 then 'over'
        when budget = 0 then 'within'
        when spent >= budget then 'over'
        when spent >= budget * warning_threshold then 'warning'
        else 'within'
      end as status
    from budget_rows
  )
  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'totalBudget', coalesce((select sum(budget) from budget_items where budget is not null), 0),
    'totalSpent', coalesce((select sum(spent) from budget_items), 0),
    'budgetedSpent', coalesce((select sum(spent) from budget_items where budget is not null), 0),
    'unbudgetedSpent', coalesce((select sum(spent) from budget_items where budget is null), 0),
    'totalRemaining', coalesce((select sum(remaining) from budget_items where remaining is not null), 0),
    'budgetCount', (select count(*) from budget_items where budget is not null),
    'warningCount', (select count(*) from budget_items where status = 'warning'),
    'overCount', (select count(*) from budget_items where status = 'over'),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'purposeId', purpose_id,
          'budgetId', budget_id,
          'name', name,
          'nameEn', name_en,
          'budget', budget,
          'spent', spent,
          'remaining', remaining,
          'usagePercent', usage_percent,
          'warningThreshold', warning_threshold,
          'status', status
        ) order by name
      )
      from budget_items
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.upsert_budget(
  p_family_id uuid,
  p_year int,
  p_month int,
  p_purpose_id uuid,
  p_amount numeric,
  p_warning_threshold numeric default 0.8
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then
    raise exception 'INVALID_PERIOD';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 999999999999999 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_warning_threshold is null or p_warning_threshold <= 0 or p_warning_threshold > 1 then
    raise exception 'INVALID_WARNING_THRESHOLD';
  end if;
  if not exists (
    select 1
    from public.purposes p
    where p.id = p_purpose_id
      and p.family_id = p_family_id
      and p.active = true
  ) then
    raise exception 'PURPOSE_NOT_FOUND';
  end if;

  insert into public.budgets(family_id, year, month, purpose_id, amount, warning_threshold)
  values (p_family_id, p_year, p_month, p_purpose_id, p_amount, p_warning_threshold)
  on conflict (family_id, year, month, purpose_id)
  do update set
    amount = excluded.amount,
    warning_threshold = excluded.warning_threshold
  returning id into saved_id;

  return jsonb_build_object('id', saved_id);
end;
$$;

create or replace function public.delete_budget(
  p_family_id uuid,
  p_budget_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.budgets
  where id = p_budget_id
    and family_id = p_family_id;
  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'BUDGET_NOT_FOUND';
  end if;
  return true;
end;
$$;

create or replace function public.copy_budgets_from_month(
  p_family_id uuid,
  p_source_year int,
  p_source_month int,
  p_target_year int,
  p_target_month int
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied_count integer;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_source_year < 2000 or p_source_year > 2200
     or p_target_year < 2000 or p_target_year > 2200
     or p_source_month < 1 or p_source_month > 12
     or p_target_month < 1 or p_target_month > 12 then
    raise exception 'INVALID_PERIOD';
  end if;
  if p_source_year = p_target_year and p_source_month = p_target_month then
    raise exception 'SAME_PERIOD';
  end if;

  insert into public.budgets(family_id, year, month, purpose_id, amount, warning_threshold)
  select p_family_id, p_target_year, p_target_month, purpose_id, amount, warning_threshold
  from public.budgets
  where family_id = p_family_id
    and year = p_source_year
    and month = p_source_month
  on conflict (family_id, year, month, purpose_id)
  do update set
    amount = excluded.amount,
    warning_threshold = excluded.warning_threshold;

  get diagnostics copied_count = row_count;
  return copied_count;
end;
$$;

revoke all on function public.get_budget_summary(uuid, int, int) from public, anon, authenticated;
grant execute on function public.get_budget_summary(uuid, int, int) to authenticated;
revoke all on function public.upsert_budget(uuid, int, int, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.upsert_budget(uuid, int, int, uuid, numeric, numeric) to authenticated;
revoke all on function public.delete_budget(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_budget(uuid, uuid) to authenticated;
revoke all on function public.copy_budgets_from_month(uuid, int, int, int, int) from public, anon, authenticated;
grant execute on function public.copy_budgets_from_month(uuid, int, int, int, int) to authenticated;

create index if not exists transactions_budget_summary_idx
  on public.transactions(family_id, transaction_date, purpose_id)
  where deleted_at is null and status = 'Thực tế' and transaction_type = 'Chi tiêu';
