-- Bổ sung phân rã thu nhập theo mục đích và danh mục cho Dashboard.
create or replace function public.get_dashboard_summary(p_family_id uuid,p_year int,p_month int)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; month_start date; month_end date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then raise exception 'INVALID_PERIOD'; end if;
  month_start:=make_date(p_year,p_month,1); month_end:=(month_start+interval '1 month')::date;
  with actual_month as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=month_start and t.transaction_date<month_end),
  totals as (select coalesce(sum(amount) filter(where transaction_type in ('Thu nhập','Hoàn tiền')),0) income,coalesce(sum(amount) filter(where transaction_type in ('Chi tiêu','Tạm ứng')),0) expense from actual_month),
  purpose_data as (select p.name,sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then -t.amount else 0 end) value from actual_month t join public.purposes p on p.id=t.purpose_id group by p.id,p.name having sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then -t.amount else 0 end)>0 order by value desc),
  expense_data as (select e.name,sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then -t.amount else 0 end) value from actual_month t join public.expense_types e on e.id=t.expense_type_id group by e.id,e.name having sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then -t.amount else 0 end)>0 order by value desc),
  income_purpose_data as (select p.name,sum(t.amount) value from actual_month t join public.purposes p on p.id=t.purpose_id where t.transaction_type in ('Thu nhập','Hoàn tiền') group by p.id,p.name order by value desc),
  income_expense_data as (select e.name,sum(t.amount) value from actual_month t join public.expense_types e on e.id=t.expense_type_id where t.transaction_type in ('Thu nhập','Hoàn tiền') group by e.id,e.name order by value desc),
  trend_months as (select generate_series(month_start-interval '4 months',month_start,interval '1 month')::date start_date),
  trend_data as (select tm.start_date,coalesce(sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then -t.amount else 0 end),0) value from trend_months tm left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=tm.start_date and t.transaction_date<(tm.start_date+interval '1 month') group by tm.start_date order by tm.start_date),
  recent as (select t.* from actual_month t order by t.transaction_date desc,t.created_at desc,t.id limit 5), due as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Dự kiến' and t.transaction_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by t.transaction_date,t.created_at,t.id limit 20)
  select jsonb_build_object('totalIncome',totals.income,'totalExpense',totals.expense,'byPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from purpose_data),'[]'::jsonb),'byExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from expense_data),'[]'::jsonb),'incomeByPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from income_purpose_data),'[]'::jsonb),'incomeByExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value)) from income_expense_data),'[]'::jsonb),'trend',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',value)) from trend_data),'[]'::jsonb),'recentTransactions',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),'dueTransactions',coalesce((select jsonb_agg(to_jsonb(d)) from due d),'[]'::jsonb)) into result from totals;
  return result;
end $$;
revoke all on function public.get_dashboard_summary(uuid,int,int) from public;
grant execute on function public.get_dashboard_summary(uuid,int,int) to authenticated;
