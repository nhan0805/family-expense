-- Automatically create planned expense transactions for active recurring templates.
-- The scheduled function is idempotent: retries cannot create the same occurrence twice.

alter type public.transaction_source add value if not exists 'recurring';

alter table public.recurring_transactions
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists end_date date,
  add column if not exists anchor_day smallint,
  add column if not exists anchor_month smallint,
  add column if not exists last_run_at timestamptz,
  add column if not exists last_error_code text;

update public.recurring_transactions
set anchor_day = coalesce(anchor_day, extract(day from next_run_date)::smallint),
    anchor_month = coalesce(anchor_month, extract(month from next_run_date)::smallint)
where next_run_date is not null;

create index if not exists recurring_transactions_due_idx
  on public.recurring_transactions(active, next_run_date)
  where active = true;

create table if not exists public.recurring_transaction_runs(
  id uuid primary key default gen_random_uuid(),
  recurring_transaction_id uuid not null references public.recurring_transactions(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  occurrence_date date not null,
  status text not null check(status in ('generated','skipped')),
  transaction_id uuid references public.transactions(id) on delete set null,
  performed_by uuid references auth.users(id),
  performed_at timestamptz not null default now(),
  unique(recurring_transaction_id, occurrence_date)
);

create index if not exists recurring_transaction_runs_family_idx
  on public.recurring_transaction_runs(family_id, occurrence_date desc);

alter table public.transactions
  add column if not exists recurring_transaction_id uuid references public.recurring_transactions(id) on delete set null;

create index if not exists transactions_recurring_idx
  on public.transactions(family_id, recurring_transaction_id)
  where recurring_transaction_id is not null;

alter table public.recurring_transaction_runs enable row level security;

drop policy if exists recurring_transaction_runs_select on public.recurring_transaction_runs;
create policy recurring_transaction_runs_select
  on public.recurring_transaction_runs for select to authenticated
  using(public.is_family_member(family_id));

drop policy if exists recurring_transaction_runs_owner on public.recurring_transaction_runs;
create policy recurring_transaction_runs_owner
  on public.recurring_transaction_runs for all to authenticated
  using(public.is_family_owner(family_id))
  with check(public.is_family_owner(family_id));

drop trigger if exists recurring_transactions_touch on public.recurring_transactions;
create trigger recurring_transactions_touch
  before update on public.recurring_transactions
  for each row execute function public.touch_updated_at();

-- Recurring writes go through the validated RPCs below. Keep browser clients
-- read-only on the template and run-history tables.
revoke insert, update, delete on table public.recurring_transactions from anon, authenticated;
grant select on table public.recurring_transactions to authenticated;
revoke insert, update, delete on table public.recurring_transaction_runs from anon, authenticated;
grant select on table public.recurring_transaction_runs to authenticated;

create or replace function public.recurring_next_date(
  p_date date,
  p_frequency text,
  p_anchor_day int default null,
  p_anchor_month int default null
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  next_month date;
  next_year_month date;
  last_day date;
  target_day int;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  end if;

  if p_frequency = 'monthly' then
    next_month := (date_trunc('month', p_date::timestamp) + interval '1 month')::date;
    last_day := (next_month + interval '1 month' - interval '1 day')::date;
    target_day := least(coalesce(p_anchor_day, extract(day from p_date)::int), extract(day from last_day)::int);
    return next_month + target_day - 1;
  end if;

  if p_frequency = 'yearly' then
    next_year_month := make_date(
      extract(year from p_date)::int + 1,
      coalesce(p_anchor_month, extract(month from p_date)::int),
      1
    );
    last_day := (next_year_month + interval '1 month' - interval '1 day')::date;
    target_day := least(coalesce(p_anchor_day, extract(day from p_date)::int), extract(day from last_day)::int);
    return next_year_month + target_day - 1;
  end if;

  raise exception 'INVALID_FREQUENCY';
end;
$$;

revoke all on function public.recurring_next_date(date, text, int, int) from public;
grant execute on function public.recurring_next_date(date, text, int, int) to authenticated;

create or replace function public.upsert_recurring_transaction(
  p_family_id uuid,
  p_id uuid default null,
  p_name text default null,
  p_template jsonb default '{}'::jsonb,
  p_frequency text default null,
  p_next_run_date date default null,
  p_end_date date default null
)
returns public.recurring_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.recurring_transactions;
  purpose_id uuid;
  expense_type_id uuid;
  payment_method_id uuid;
  beneficiary_id uuid;
  amount_value numeric;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null or length(trim(p_name)) > 100 then raise exception 'INVALID_NAME'; end if;
  if p_frequency not in ('weekly', 'monthly', 'yearly') then raise exception 'INVALID_FREQUENCY'; end if;
  if p_next_run_date is null then raise exception 'INVALID_NEXT_RUN_DATE'; end if;
  if p_end_date is not null and p_end_date < p_next_run_date then raise exception 'INVALID_END_DATE'; end if;
  if jsonb_typeof(p_template) <> 'object' then raise exception 'INVALID_TEMPLATE'; end if;
  if coalesce(p_template->>'transactionType', 'Chi tiêu') <> 'Chi tiêu' then raise exception 'INVALID_TRANSACTION_TYPE'; end if;

  begin
    amount_value := (p_template->>'amount')::numeric;
    purpose_id := (p_template->>'purposeId')::uuid;
    expense_type_id := (p_template->>'expenseTypeId')::uuid;
    payment_method_id := (p_template->>'paymentMethodId')::uuid;
    if nullif(p_template->>'beneficiaryId', '') is not null then beneficiary_id := (p_template->>'beneficiaryId')::uuid; end if;
  exception when others then
    raise exception 'INVALID_TEMPLATE';
  end;

  if amount_value is null or amount_value <= 0 or amount_value > 999999999999999 or amount_value <> trunc(amount_value) then raise exception 'INVALID_AMOUNT'; end if;
  if nullif(trim(coalesce(p_template->>'description', '')), '') is null then raise exception 'INVALID_TEMPLATE'; end if;
  if not exists(select 1 from public.purposes where id = purpose_id and family_id = p_family_id) then raise exception 'PURPOSE_NOT_FOUND'; end if;
  if not exists(select 1 from public.expense_types where id = expense_type_id and family_id = p_family_id) then raise exception 'EXPENSE_TYPE_NOT_FOUND'; end if;
  if not exists(select 1 from public.payment_methods where id = payment_method_id and family_id = p_family_id) then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  if beneficiary_id is not null and not exists(select 1 from public.beneficiaries where id = beneficiary_id and family_id = p_family_id) then raise exception 'BENEFICIARY_NOT_FOUND'; end if;

  if p_id is null then
    insert into public.recurring_transactions(
      family_id, name, template, frequency, next_run_date, end_date,
      anchor_day, anchor_month, created_by
    ) values (
      p_family_id, trim(p_name), p_template, p_frequency, p_next_run_date, p_end_date,
      extract(day from p_next_run_date)::smallint,
      extract(month from p_next_run_date)::smallint,
      auth.uid()
    ) returning * into result;
  else
    update public.recurring_transactions
    set name = trim(p_name),
        template = p_template,
        frequency = p_frequency,
        next_run_date = p_next_run_date,
        end_date = p_end_date,
        anchor_day = extract(day from p_next_run_date)::smallint,
        anchor_month = extract(month from p_next_run_date)::smallint
    where id = p_id and family_id = p_family_id
    returning * into result;
    if result.id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return result;
end;
$$;

revoke all on function public.upsert_recurring_transaction(uuid, uuid, text, jsonb, text, date, date) from public;
grant execute on function public.upsert_recurring_transaction(uuid, uuid, text, jsonb, text, date, date) to authenticated;

create or replace function public.set_recurring_transaction_active(
  p_family_id uuid,
  p_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  update public.recurring_transactions
  set active = p_active
  where id = p_id and family_id = p_family_id;
  return found;
end;
$$;

revoke all on function public.set_recurring_transaction_active(uuid, uuid, boolean) from public;
grant execute on function public.set_recurring_transaction_active(uuid, uuid, boolean) to authenticated;

create or replace function public.skip_recurring_occurrence(
  p_family_id uuid,
  p_id uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.recurring_transactions;
  next_date date;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  select * into item from public.recurring_transactions where id = p_id and family_id = p_family_id and active for update;
  if item.id is null then raise exception 'NOT_FOUND'; end if;
  if item.next_run_date is null then raise exception 'INVALID_NEXT_RUN_DATE'; end if;
  if item.end_date is not null and item.next_run_date > item.end_date then
    update public.recurring_transactions set active = false, last_run_at = now(), last_error_code = null where id = item.id;
    return null;
  end if;

  insert into public.recurring_transaction_runs(
    recurring_transaction_id, family_id, occurrence_date, status, performed_by
  ) values (item.id, item.family_id, item.next_run_date, 'skipped', auth.uid())
  on conflict (recurring_transaction_id, occurrence_date) do nothing;

  next_date := public.recurring_next_date(item.next_run_date, item.frequency, item.anchor_day, item.anchor_month);
  update public.recurring_transactions
  set next_run_date = next_date,
      active = case when item.end_date is not null and next_date > item.end_date then false else active end,
      last_run_at = now(),
      last_error_code = null
  where id = item.id;
  return next_date;
end;
$$;

revoke all on function public.skip_recurring_occurrence(uuid, uuid) from public;
grant execute on function public.skip_recurring_occurrence(uuid, uuid) to authenticated;

create or replace function public.generate_due_recurring_transactions(
  p_family_id uuid default null,
  p_until date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  actor_id uuid;
  occurrence date;
  next_date date;
  transaction_id uuid;
  generated_count integer := 0;
  today_date date := least(coalesce(p_until, (now() at time zone 'Asia/Ho_Chi_Minh')::date), (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  inserted boolean;
begin
  if p_family_id is not null and not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_family_id is null and auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  for item in
    select rt.*,
      coalesce(rt.created_by, (
        select fm.user_id from public.family_members fm
        where fm.family_id = rt.family_id and fm.role = 'owner' and fm.status = 'active'
        order by fm.created_at limit 1
      )) as actor_id
    from public.recurring_transactions rt
    where rt.active
      and rt.next_run_date is not null
      and rt.next_run_date <= today_date
      and (p_family_id is null or rt.family_id = p_family_id)
    order by rt.next_run_date, rt.id
    for update skip locked
  loop
    begin
      actor_id := item.actor_id;
      occurrence := item.next_run_date;

      while occurrence <= today_date and (item.end_date is null or occurrence <= item.end_date) loop
        if nullif(trim(coalesce(item.template->>'description', '')), '') is null
          or coalesce(item.template->>'transactionType', 'Chi tiêu') <> 'Chi tiêu'
          or (item.template->>'amount') is null
          or (item.template->>'amount')::numeric <= 0
          or not exists(select 1 from public.purposes p where p.id = (item.template->>'purposeId')::uuid and p.family_id = item.family_id)
          or not exists(select 1 from public.expense_types e where e.id = (item.template->>'expenseTypeId')::uuid and e.family_id = item.family_id)
          or not exists(select 1 from public.payment_methods m where m.id = (item.template->>'paymentMethodId')::uuid and m.family_id = item.family_id)
          or (nullif(item.template->>'beneficiaryId', '') is not null and not exists(select 1 from public.beneficiaries b where b.id = (item.template->>'beneficiaryId')::uuid and b.family_id = item.family_id))
        then
          raise exception 'INVALID_TEMPLATE';
        end if;

        insert into public.transactions(
          family_id, transaction_date, transaction_type, status, description, amount,
          purpose_id, expense_type_id, beneficiary_id, payment_method_id, note,
          created_by, updated_by, source, source_reference, ai_generated,
          recurring_transaction_id
        ) values (
          item.family_id, occurrence, 'Chi tiêu', 'Dự kiến',
          trim(item.template->>'description'), (item.template->>'amount')::numeric,
          (item.template->>'purposeId')::uuid, (item.template->>'expenseTypeId')::uuid,
          nullif(item.template->>'beneficiaryId', '')::uuid, (item.template->>'paymentMethodId')::uuid,
          nullif(item.template->>'note', ''), actor_id, actor_id, 'recurring',
          format('recurring:%s:%s', item.id, occurrence), false, item.id
        ) on conflict (family_id, source, source_reference) do nothing
        returning id into transaction_id;

        inserted := transaction_id is not null;

        if transaction_id is null then
          select t.id into transaction_id
          from public.transactions t
          where t.family_id = item.family_id
            and t.source = 'recurring'
            and t.source_reference = format('recurring:%s:%s', item.id, occurrence)
          limit 1;
        end if;

        insert into public.recurring_transaction_runs(
          recurring_transaction_id, family_id, occurrence_date, status, transaction_id, performed_by
        ) values (item.id, item.family_id, occurrence, 'generated', transaction_id, actor_id)
        on conflict (recurring_transaction_id, occurrence_date) do nothing;

        if inserted then generated_count := generated_count + 1; end if;
        next_date := public.recurring_next_date(occurrence, item.frequency, item.anchor_day, item.anchor_month);
        occurrence := next_date;
        transaction_id := null;
      end loop;

      update public.recurring_transactions
      set next_run_date = occurrence,
          active = case when item.end_date is not null and occurrence > item.end_date then false else active end,
          last_run_at = now(),
          last_error_code = null
      where id = item.id;
    exception when others then
      update public.recurring_transactions
      set last_run_at = now(), last_error_code = case when sqlstate = 'P0001' then 'INVALID_TEMPLATE' when sqlstate = '23503' then 'REFERENCE_NOT_FOUND' else 'GENERATION_FAILED' end
      where id = item.id;
    end;
  end loop;
  return generated_count;
end;
$$;

revoke all on function public.generate_due_recurring_transactions(uuid, date) from public, anon;
grant execute on function public.generate_due_recurring_transactions(uuid, date) to authenticated;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job
  where jobname = 'generate-due-recurring-transactions';
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
  perform cron.schedule(
    'generate-due-recurring-transactions',
    '5 17 * * *',
    'select public.generate_due_recurring_transactions();'
  );
end;
$$;
