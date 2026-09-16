-- Close a savings book in one transaction and record the principal and
-- interest received as separate income transactions. The maintenance job
-- uses the same internal function so manual and automatic settlement cannot
-- drift or create duplicate cash entries.

create or replace function public.settle_savings_account_internal(
  p_family_id uuid,
  p_savings_account_id uuid,
  p_interest_amount numeric,
  p_settlement_date date,
  p_payment_method_id uuid,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.savings_accounts%rowtype;
  settlement_movement_row public.savings_movements%rowtype;
  interest_movement_row public.savings_movements%rowtype;
  purpose_id uuid;
  settlement_expense_type_id uuid;
  interest_expense_type_id uuid;
  resolved_payment_method_id uuid;
  settlement_transaction_id uuid;
  interest_transaction_id uuid;
  principal_amount numeric;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_actor_id is null then raise exception 'ACTOR_NOT_FOUND'; end if;
  if p_interest_amount is null
    or p_interest_amount < 0
    or p_interest_amount <> trunc(p_interest_amount)
    or p_interest_amount > 999999999999999
  then
    raise exception 'INVALID_INTEREST_AMOUNT';
  end if;
  if p_settlement_date is null then raise exception 'INVALID_DATE'; end if;

  select * into account_row
  from public.savings_accounts sa
  where sa.id = p_savings_account_id
    and sa.family_id = p_family_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if account_row.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if account_row.current_balance <= 0 then raise exception 'ACCOUNT_EMPTY'; end if;
  principal_amount := account_row.current_balance;

  if p_payment_method_id is not null then
    select pm.id into resolved_payment_method_id
    from public.payment_methods pm
    where pm.id = p_payment_method_id
      and pm.family_id = p_family_id
      and pm.active;
    if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  else
    select pm.id into resolved_payment_method_id
    from public.payment_methods pm
    where pm.family_id = p_family_id
      and pm.active
    order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id
    limit 1;
  end if;

  select p.id into purpose_id
  from public.purposes p
  where p.family_id = p_family_id
    and p.active
    and p.code = 'purpose-8'
  limit 1;
  select e.id into settlement_expense_type_id
  from public.expense_types e
  where e.family_id = p_family_id
    and e.active
    and e.code = 'asset-savings-settlement'
  limit 1;
  if p_interest_amount > 0 then
    select e.id into interest_expense_type_id
    from public.expense_types e
    where e.family_id = p_family_id
      and e.active
      and e.code = 'asset-savings-interest'
    limit 1;
  end if;
  if purpose_id is null
    or settlement_expense_type_id is null
    or resolved_payment_method_id is null
    or (p_interest_amount > 0 and interest_expense_type_id is null)
  then
    raise exception 'CATALOG_NOT_READY';
  end if;

  insert into public.savings_movements(
    family_id, savings_account_id, movement_type, amount, balance_after,
    movement_date, payment_method_id, note, created_by
  ) values (
    p_family_id, p_savings_account_id, 'settlement', principal_amount, 0,
    p_settlement_date, resolved_payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''), p_actor_id
  ) returning * into settlement_movement_row;

  insert into public.transactions(
    family_id, transaction_date, transaction_type, status, description, amount,
    purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
    source, source_reference, ai_generated
  ) values (
    p_family_id, p_settlement_date, 'Thu nhập'::public.transaction_kind,
    case when p_settlement_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
    'Tất toán tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name,
    principal_amount, purpose_id, settlement_expense_type_id, resolved_payment_method_id,
    nullif(trim(coalesce(p_note, '')), ''), p_actor_id, p_actor_id,
    'asset'::public.transaction_source,
    'asset:savings:' || p_savings_account_id || ':settlement', false
  ) returning id into settlement_transaction_id;
  update public.savings_movements
  set transaction_id = settlement_transaction_id
  where id = settlement_movement_row.id
    and family_id = p_family_id;
  settlement_movement_row.transaction_id := settlement_transaction_id;

  if p_interest_amount > 0 then
    insert into public.savings_movements(
      family_id, savings_account_id, movement_type, amount, balance_after,
      movement_date, payment_method_id, note, created_by
    ) values (
      p_family_id, p_savings_account_id, 'interest', p_interest_amount, 0,
      p_settlement_date, resolved_payment_method_id,
      nullif(trim(coalesce(p_note, '')), ''), p_actor_id
    ) returning * into interest_movement_row;

    insert into public.transactions(
      family_id, transaction_date, transaction_type, status, description, amount,
      purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
      source, source_reference, ai_generated
    ) values (
      p_family_id, p_settlement_date, 'Thu nhập'::public.transaction_kind,
      case when p_settlement_date <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
      'Lãi tất toán sổ tiết kiệm: ' || account_row.bank_name || ' - ' || account_row.name,
      p_interest_amount, purpose_id, interest_expense_type_id, resolved_payment_method_id,
      nullif(trim(coalesce(p_note, '')), ''), p_actor_id, p_actor_id,
      'asset'::public.transaction_source,
      'asset:savings:' || p_savings_account_id || ':settlement-interest', false
    ) returning id into interest_transaction_id;
    update public.savings_movements
    set transaction_id = interest_transaction_id
    where id = interest_movement_row.id
      and family_id = p_family_id;
    interest_movement_row.transaction_id := interest_transaction_id;
  end if;

  update public.savings_accounts
  set current_balance = 0,
      status = 'closed',
      closed_at = now(),
      updated_by = p_actor_id
  where id = p_savings_account_id
    and family_id = p_family_id;
  select * into account_row
  from public.savings_accounts sa
  where sa.id = p_savings_account_id
    and sa.family_id = p_family_id;

  return jsonb_build_object(
    'account', to_jsonb(account_row),
    'settlementMovement', to_jsonb(settlement_movement_row),
    'interestMovement', case when p_interest_amount > 0 then to_jsonb(interest_movement_row) else 'null'::jsonb end,
    'principal', principal_amount,
    'interestAmount', p_interest_amount,
    'totalReceived', principal_amount + p_interest_amount
  );
end;
$$;

create or replace function public.settle_savings_account(
  p_family_id uuid,
  p_savings_account_id uuid,
  p_interest_amount numeric,
  p_settlement_date date,
  p_payment_method_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return public.settle_savings_account_internal(
    p_family_id,
    p_savings_account_id,
    p_interest_amount,
    p_settlement_date,
    p_payment_method_id,
    p_note,
    auth.uid()
  );
end;
$$;

create or replace function public.auto_settle_due_savings_accounts(
  p_until date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  today_date date := least(coalesce(p_until, (now() at time zone 'Asia/Ho_Chi_Minh')::date), (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  interest_amount numeric;
  settled_count integer := 0;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  for item in
    select sa.*,
      coalesce(sa.created_by, (
        select fm.user_id
        from public.family_members fm
        where fm.family_id = sa.family_id
          and fm.role = 'owner'
          and fm.status = 'active'
        order by fm.created_at
        limit 1
      )) as actor_id
    from public.savings_accounts sa
    where sa.status = 'active'
      and sa.current_balance > 0
      and sa.maturity_on <= today_date
    order by sa.maturity_on, sa.id
    for update skip locked
  loop
    begin
      interest_amount := round(
        item.current_balance
        * (item.annual_interest_rate / 100)
        * greatest(item.maturity_on - item.opened_on, 0)
        / 365
      );
      perform public.settle_savings_account_internal(
        item.family_id,
        item.id,
        interest_amount,
        item.maturity_on,
        null,
        'Tự động tất toán khi đến ngày đáo hạn',
        item.actor_id
      );
      settled_count := settled_count + 1;
    exception when others then
      -- Keep one unavailable catalog or malformed book from blocking the
      -- remaining due books. The next daily run will retry this account.
      null;
    end;
  end loop;
  return settled_count;
end;
$$;

revoke all on function public.settle_savings_account_internal(uuid,uuid,numeric,date,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.settle_savings_account(uuid,uuid,numeric,date,uuid,text) from public, anon;
grant execute on function public.settle_savings_account(uuid,uuid,numeric,date,uuid,text) to authenticated;
revoke all on function public.auto_settle_due_savings_accounts(date) from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'auto-settle-due-savings-accounts';
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
  perform cron.schedule(
    'auto-settle-due-savings-accounts',
    '15 17 * * *',
    'select public.auto_settle_due_savings_accounts();'
  );
end;
$$;

select pg_notify('pgrst', 'reload schema');
