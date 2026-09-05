-- Preserve a recurring template's calendar anchor when editing its content.
-- A changed next_run_date or frequency is an explicit schedule change.
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
  previous_frequency text;
  previous_next_run_date date;
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
    select rt.frequency, rt.next_run_date into previous_frequency, previous_next_run_date
    from public.recurring_transactions rt
    where rt.id = p_id and rt.family_id = p_family_id
    for update;
    if previous_frequency is null then raise exception 'NOT_FOUND'; end if;
    update public.recurring_transactions
    set name = trim(p_name),
        template = p_template,
        frequency = p_frequency,
        next_run_date = p_next_run_date,
        end_date = p_end_date,
        anchor_day = case when previous_frequency <> p_frequency or previous_next_run_date is distinct from p_next_run_date then extract(day from p_next_run_date)::smallint else anchor_day end,
        anchor_month = case when previous_frequency <> p_frequency or previous_next_run_date is distinct from p_next_run_date then extract(month from p_next_run_date)::smallint else anchor_month end
    where id = p_id and family_id = p_family_id
    returning * into result;
  end if;
  return result;
end;
$$;

revoke all on function public.upsert_recurring_transaction(uuid, uuid, text, jsonb, text, date, date) from public;
grant execute on function public.upsert_recurring_transaction(uuid, uuid, text, jsonb, text, date, date) to authenticated;

-- A skipped occurrence is terminal.  Do not recreate its transaction when a
-- catch-up run reaches the same date again.
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
    where rt.active and rt.next_run_date is not null and rt.next_run_date <= today_date
      and (p_family_id is null or rt.family_id = p_family_id)
    order by rt.next_run_date, rt.id
    for update skip locked
  loop
    begin
      actor_id := item.actor_id;
      occurrence := item.next_run_date;
      while occurrence <= today_date and (item.end_date is null or occurrence <= item.end_date) loop
        if exists (
          select 1 from public.recurring_transaction_runs r
          where r.recurring_transaction_id = item.id
            and r.occurrence_date = occurrence
            and r.status = 'skipped'
        ) then
          next_date := public.recurring_next_date(occurrence, item.frequency, item.anchor_day, item.anchor_month);
          occurrence := next_date;
          continue;
        end if;

        if nullif(trim(coalesce(item.template->>'description', '')), '') is null
          or coalesce(item.template->>'transactionType', 'Chi tiêu') <> 'Chi tiêu'
          or (item.template->>'amount') is null
          or (item.template->>'amount')::numeric <= 0
          or not exists(select 1 from public.purposes p where p.id = (item.template->>'purposeId')::uuid and p.family_id = item.family_id)
          or not exists(select 1 from public.expense_types e where e.id = (item.template->>'expenseTypeId')::uuid and e.family_id = item.family_id)
          or not exists(select 1 from public.payment_methods m where m.id = (item.template->>'paymentMethodId')::uuid and m.family_id = item.family_id)
          or (nullif(item.template->>'beneficiaryId', '') is not null and not exists(select 1 from public.beneficiaries b where b.id = (item.template->>'beneficiaryId')::uuid and b.family_id = item.family_id))
        then raise exception 'INVALID_TEMPLATE'; end if;

        insert into public.transactions(
          family_id, transaction_date, transaction_type, status, description, amount,
          purpose_id, expense_type_id, beneficiary_id, payment_method_id, note,
          created_by, updated_by, source, source_reference, ai_generated, recurring_transaction_id
        ) values (
          item.family_id, occurrence, 'Chi tiêu', 'Dự kiến', trim(item.template->>'description'),
          (item.template->>'amount')::numeric, (item.template->>'purposeId')::uuid,
          (item.template->>'expenseTypeId')::uuid, nullif(item.template->>'beneficiaryId', '')::uuid,
          (item.template->>'paymentMethodId')::uuid, nullif(item.template->>'note', ''), actor_id, actor_id,
          'recurring', format('recurring:%s:%s', item.id, occurrence), false, item.id
        ) on conflict (family_id, source, source_reference) do nothing returning id into transaction_id;
        inserted := transaction_id is not null;
        if transaction_id is null then
          select t.id into transaction_id from public.transactions t
          where t.family_id = item.family_id and t.source = 'recurring'
            and t.source_reference = format('recurring:%s:%s', item.id, occurrence) limit 1;
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
          last_run_at = now(), last_error_code = null
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
