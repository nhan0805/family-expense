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
      coalesce(sum(t.amount) filter (where t.transaction_type in ('Thu nhập','Hoàn tiền')),0) income,
      coalesce(sum(t.amount) filter (where t.transaction_type in ('Chi tiêu','Tạm ứng')),0) expense
    from months m left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=m.start_date and t.transaction_date<(m.start_date+interval '1 month')
    group by m.start_date order by m.start_date
  )
  select jsonb_build_object(
    'income',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',income)) from data),'[]'::jsonb),
    'expense',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',expense)) from data),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_dashboard_trends(uuid,int,int) from public;
grant execute on function public.get_dashboard_trends(uuid,int,int) to authenticated;
