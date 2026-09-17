-- Keep saving a book independent from the optional opening transaction.
-- When an opening transaction is requested, use the family-level automatic
-- transaction mapping first so catalog labels can be changed in Settings.

create or replace function public.upsert_savings_account(
  p_family_id uuid,
  p_id uuid,
  p_bank_name text,
  p_name text,
  p_principal numeric,
  p_annual_interest_rate numeric,
  p_term_months int,
  p_opened_on date,
  p_maturity_on date,
  p_interest_method text,
  p_payment_method_id uuid,
  p_note text,
  p_create_transaction boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_row public.savings_accounts%rowtype;
  movement_row public.savings_movements%rowtype;
  configured_purpose_id uuid;
  configured_expense_type_id uuid;
  configured_payment_method_id uuid;
  purpose_id uuid;
  expense_type_id uuid;
  resolved_payment_method_id uuid;
  linked_transaction_id uuid;
  today_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(coalesce(p_bank_name, '')), '') is null or length(trim(p_bank_name)) > 120 then raise exception 'INVALID_BANK_NAME'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null or length(trim(p_name)) > 120 then raise exception 'INVALID_NAME'; end if;
  if p_principal is null or p_principal <= 0 or p_principal <> trunc(p_principal) then raise exception 'INVALID_PRINCIPAL'; end if;
  if p_annual_interest_rate is null or p_annual_interest_rate < 0 or p_annual_interest_rate > 100 then raise exception 'INVALID_RATE'; end if;
  if p_term_months is null or p_term_months not between 1 and 120 then raise exception 'INVALID_TERM'; end if;
  if p_opened_on is null or p_maturity_on is null or p_maturity_on < p_opened_on then raise exception 'INVALID_DATES'; end if;
  if p_interest_method not in ('end_of_term','monthly','upfront','renew') then raise exception 'INVALID_INTEREST_METHOD'; end if;

  if p_create_transaction then
    -- A saved mapping is authoritative. Require active referenced rows here so
    -- the trigger can safely apply the same values to the linked transaction.
    select d.purpose_id, d.expense_type_id, d.payment_method_id
    into configured_purpose_id, configured_expense_type_id, configured_payment_method_id
    from public.automatic_transaction_defaults d
    join public.purposes p on p.family_id = d.family_id and p.id = d.purpose_id and p.active
    join public.expense_types e on e.family_id = d.family_id and e.id = d.expense_type_id and e.active
    join public.payment_methods pm on pm.family_id = d.family_id and pm.id = d.payment_method_id and pm.active
    where d.family_id = p_family_id and d.automation_key = 'savings_opening';
  end if;

  if p_payment_method_id is not null then
    select pm.id into resolved_payment_method_id from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.family_id = p_family_id and pm.active;
    if resolved_payment_method_id is null then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  elsif p_create_transaction and configured_payment_method_id is not null then
    resolved_payment_method_id := configured_payment_method_id;
  else
    select pm.id into resolved_payment_method_id from public.payment_methods pm
    where pm.family_id = p_family_id and pm.active
    order by (pm.name = 'Chuyển khoản') desc, pm.sort_order, pm.id limit 1;
  end if;

  if p_create_transaction then
    purpose_id := configured_purpose_id;
    expense_type_id := configured_expense_type_id;

    -- Keep compatibility for families created before automatic defaults and
    -- for a partially configured family. The final active-row fallback lets a
    -- saved Settings mapping use any renamed/custom catalog item.
    if purpose_id is null then
      select p.id into purpose_id from public.purposes p
      where p.family_id = p_family_id and p.active
        and (p.code = 'purpose-8' or p.name = 'Đầu tư')
      order by (p.code = 'purpose-8') desc, p.id limit 1;
    end if;
    if purpose_id is null then
      select p.id into purpose_id from public.purposes p
      where p.family_id = p_family_id and p.active
      order by p.sort_order, p.id limit 1;
    end if;

    if expense_type_id is null then
      select e.id into expense_type_id from public.expense_types e
      where e.family_id = p_family_id and e.active
        and (e.code = 'asset-savings-deposit' or e.name = 'Gửi tiết kiệm')
      order by (e.code = 'asset-savings-deposit') desc, e.id limit 1;
    end if;
    if expense_type_id is null then
      select e.id into expense_type_id from public.expense_types e
      where e.family_id = p_family_id and e.active
      order by e.sort_order, e.id limit 1;
    end if;

    if purpose_id is null or expense_type_id is null or resolved_payment_method_id is null then raise exception 'CATALOG_NOT_READY'; end if;
  end if;

  if p_id is null then
    insert into public.savings_accounts(
      family_id, bank_name, name, principal, current_balance,
      annual_interest_rate, term_months, opened_on, maturity_on,
      interest_method, status, note, created_by, updated_by
    ) values (
      p_family_id, trim(p_bank_name), trim(p_name), p_principal, p_principal,
      p_annual_interest_rate, p_term_months, p_opened_on, p_maturity_on,
      p_interest_method, 'active', nullif(trim(coalesce(p_note, '')), ''), auth.uid(), auth.uid()
    ) returning * into account_row;

    insert into public.savings_movements(
      family_id, savings_account_id, movement_type, amount, balance_after,
      movement_date, payment_method_id, note, created_by
    ) values (
      p_family_id, account_row.id, 'opening', p_principal, p_principal,
      p_opened_on, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid()
    ) returning * into movement_row;

    if p_create_transaction then
      insert into public.transactions(
        family_id, transaction_date, transaction_type, status, description, amount,
        purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
        source, source_reference, ai_generated
      ) values (
        p_family_id, p_opened_on, 'Chi tiêu',
        case when p_opened_on <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
        'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name), p_principal,
        purpose_id, expense_type_id, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''),
        auth.uid(), auth.uid(), 'asset', 'asset:savings:' || account_row.id || ':opening', false
      ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
      if linked_transaction_id is null then
        select t.id into linked_transaction_id from public.transactions t
        where t.family_id = p_family_id and t.source = 'asset' and t.source_reference = 'asset:savings:' || account_row.id || ':opening';
      end if;
      update public.savings_movements set transaction_id = linked_transaction_id where id = movement_row.id and family_id = p_family_id;
    end if;
  else
    select * into account_row from public.savings_accounts sa
    where sa.id = p_id and sa.family_id = p_family_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if p_principal <> account_row.principal then raise exception 'PRINCIPAL_EDIT_NOT_ALLOWED'; end if;
    if account_row.status = 'archived' then raise exception 'ACCOUNT_ARCHIVED'; end if;
    update public.savings_accounts set
      bank_name = trim(p_bank_name), name = trim(p_name), annual_interest_rate = p_annual_interest_rate,
      term_months = p_term_months, opened_on = p_opened_on, maturity_on = p_maturity_on,
      interest_method = p_interest_method, note = nullif(trim(coalesce(p_note, '')), ''), updated_by = auth.uid()
    where id = p_id and family_id = p_family_id returning * into account_row;

    select * into movement_row from public.savings_movements sm
    where sm.family_id = p_family_id and sm.savings_account_id = p_id and sm.movement_type = 'opening'
    order by sm.created_at limit 1 for update;
    if movement_row.id is not null then
      update public.savings_movements set movement_date = p_opened_on, payment_method_id = resolved_payment_method_id where id = movement_row.id;
      linked_transaction_id := movement_row.transaction_id;
      if linked_transaction_id is null and p_create_transaction then
        insert into public.transactions(
          family_id, transaction_date, transaction_type, status, description, amount,
          purpose_id, expense_type_id, payment_method_id, note, created_by, updated_by,
          source, source_reference, ai_generated
        ) values (
          p_family_id, p_opened_on, 'Chi tiêu',
          case when p_opened_on <= today_date then 'Thực tế'::public.transaction_status else 'Dự kiến'::public.transaction_status end,
          'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name), account_row.principal,
          purpose_id, expense_type_id, resolved_payment_method_id, nullif(trim(coalesce(p_note, '')), ''),
          auth.uid(), auth.uid(), 'asset', 'asset:savings:' || p_id || ':opening', false
        ) on conflict (family_id, source, source_reference) do nothing returning id into linked_transaction_id;
        if linked_transaction_id is null then
          select t.id into linked_transaction_id from public.transactions t
          where t.family_id = p_family_id and t.source = 'asset' and t.source_reference = 'asset:savings:' || p_id || ':opening';
        end if;
        update public.savings_movements set transaction_id = linked_transaction_id where id = movement_row.id;
      end if;
      if linked_transaction_id is not null then
        update public.transactions set transaction_date = p_opened_on,
          description = 'Gửi tiết kiệm: ' || trim(p_bank_name) || ' - ' || trim(p_name),
          payment_method_id = resolved_payment_method_id,
          note = nullif(trim(coalesce(p_note, '')), ''),
          updated_by = auth.uid()
        where id = linked_transaction_id and family_id = p_family_id and source = 'asset';
      end if;
    end if;
  end if;

  return jsonb_build_object('account', to_jsonb(account_row));
end;
$$;

revoke all on function public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean) from public;
grant execute on function public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean) to authenticated;

select pg_notify('pgrst', 'reload schema');
