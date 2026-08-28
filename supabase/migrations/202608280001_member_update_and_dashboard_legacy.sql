-- Member chỉ được sửa giao dịch do chính mình tạo; owner được sửa toàn bộ.
create or replace function public.guard_transaction_creator_and_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'TRANSACTION_CREATOR_IMMUTABLE';
  end if;
  if not public.is_family_owner(old.family_id) and old.created_by is distinct from auth.uid() then
    raise exception 'UPDATE_TRANSACTION_FORBIDDEN';
  end if;
  if new.deleted_at is not null
    and old.deleted_at is distinct from new.deleted_at
    and old.created_by is distinct from auth.uid()
    and not public.is_family_owner(old.family_id)
  then raise exception 'DELETE_TRANSACTION_FORBIDDEN'; end if;
  return new;
end $$;

-- Bulk update áp dụng cùng quy tắc quyền với cập nhật đơn.
create or replace function public.bulk_update_transactions(
  p_family_id uuid, p_transaction_ids uuid[], p_changes jsonb
) returns integer language plpgsql security definer set search_path = ''
as $$
declare requested_count integer; target_count integer; updated_count integer;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  requested_count := coalesce(cardinality(p_transaction_ids), 0);
  if requested_count < 1 or requested_count > 100 then raise exception 'INVALID_SELECTION_SIZE'; end if;
  if (select count(distinct value) from unnest(p_transaction_ids) as value) <> requested_count then raise exception 'DUPLICATE_TRANSACTION_IDS'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then raise exception 'NO_CHANGES'; end if;
  if exists (select 1 from jsonb_object_keys(p_changes) as key where key not in ('purpose_id','expense_type_id','payment_method_id','status')) then raise exception 'INVALID_CHANGE_FIELD'; end if;
  if p_changes ? 'purpose_id' and not exists (select 1 from public.purposes p where p.id=(p_changes->>'purpose_id')::uuid and p.family_id=p_family_id and p.active) then raise exception 'INVALID_PURPOSE'; end if;
  if p_changes ? 'expense_type_id' and not exists (select 1 from public.expense_types e where e.id=(p_changes->>'expense_type_id')::uuid and e.family_id=p_family_id and e.active) then raise exception 'INVALID_EXPENSE_TYPE'; end if;
  if p_changes ? 'payment_method_id' and not exists (select 1 from public.payment_methods pm where pm.id=(p_changes->>'payment_method_id')::uuid and pm.family_id=p_family_id and pm.active) then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_changes ? 'status' and p_changes->>'status' not in ('Thực tế','Dự kiến') then raise exception 'INVALID_STATUS'; end if;
  select count(*) into target_count from public.transactions t where t.family_id=p_family_id and t.id=any(p_transaction_ids) and t.deleted_at is null and (public.is_family_owner(p_family_id) or t.created_by=auth.uid());
  if target_count <> requested_count then raise exception 'UPDATE_TRANSACTION_FORBIDDEN'; end if;
  update public.transactions t set purpose_id=case when p_changes ? 'purpose_id' then (p_changes->>'purpose_id')::uuid else t.purpose_id end, expense_type_id=case when p_changes ? 'expense_type_id' then (p_changes->>'expense_type_id')::uuid else t.expense_type_id end, payment_method_id=case when p_changes ? 'payment_method_id' then (p_changes->>'payment_method_id')::uuid else t.payment_method_id end, status=case when p_changes ? 'status' then (p_changes->>'status')::public.transaction_status else t.status end, updated_by=auth.uid()
  where t.family_id=p_family_id and t.id=any(p_transaction_ids) and t.deleted_at is null;
  get diagnostics updated_count=row_count; return updated_count;
end $$;

-- Dashboard chỉ tính hai loại nghiệp vụ hiện hành; dữ liệu legacy bị loại khỏi KPI/biểu đồ.
create or replace function public.get_dashboard_summary(p_family_id uuid,p_year int,p_month int) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; month_start date; month_end date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  month_start:=make_date(p_year,p_month,1); month_end:=(month_start+interval '1 month')::date;
  with actual_month as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=month_start and t.transaction_date<month_end and t.transaction_type in ('Chi tiêu','Thu nhập')),
  totals as (select coalesce(sum(amount) filter(where transaction_type='Thu nhập'),0) income,coalesce(sum(amount) filter(where transaction_type='Chi tiêu'),0) expense from actual_month),
  purpose_data as (select p.name,sum(t.amount) value from actual_month t join public.purposes p on p.id=t.purpose_id where t.transaction_type='Chi tiêu' group by p.id,p.name order by value desc),
  expense_data as (select e.name,sum(t.amount) value from actual_month t join public.expense_types e on e.id=t.expense_type_id where t.transaction_type='Chi tiêu' group by e.id,e.name order by value desc),
  trend_months as (select generate_series(month_start-interval '4 months',month_start,interval '1 month')::date start_date),
  trend_data as (select tm.start_date,coalesce(sum(case when t.transaction_type='Chi tiêu' then t.amount else 0 end),0) value from trend_months tm left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_type='Chi tiêu' and t.transaction_date>=tm.start_date and t.transaction_date<(tm.start_date+interval '1 month') group by tm.start_date order by tm.start_date),
  recent as (select t.* from actual_month t order by t.transaction_date desc,t.created_at desc,t.id limit 5), due as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Dự kiến' and t.transaction_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by t.transaction_date,t.created_at,t.id limit 20)
  select jsonb_build_object('totalIncome',totals.income,'totalExpense',totals.expense,'byPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from purpose_data),'[]'::jsonb),'byExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from expense_data),'[]'::jsonb),'trend',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',value)) from trend_data),'[]'::jsonb),'recentTransactions',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),'dueTransactions',coalesce((select jsonb_agg(to_jsonb(d)) from due d),'[]'::jsonb)) into result from totals;
  return result;
end $$;
