-- Add an optional English label without changing catalog IDs or Vietnamese names.
alter table public.purposes add column name_en text;
alter table public.expense_types add column name_en text;
alter table public.payment_methods add column name_en text;

update public.purposes set name_en = case name
  when 'Sinh hoạt gia đình' then 'Family living'
  when 'Con cái' then 'Children'
  when 'Du lịch' then 'Travel'
  when 'Hiếu hỉ & quan hệ' then 'Family occasions & relationships'
  when 'Nhà cửa & gia dụng' then 'Home & household'
  when 'Xe cộ' then 'Vehicles'
  when 'Sức khỏe gia đình' then 'Family health'
  when 'Thai sản' then 'Maternity'
  when 'Đầu tư' then 'Investments'
  when 'Khác' then 'Other'
  else name_en
end where name_en is null;

update public.expense_types set name_en = case name
  when 'Ăn uống' then 'Dining'
  when 'Thực phẩm' then 'Groceries'
  when 'Điện' then 'Electricity'
  when 'Nước' then 'Water'
  when 'Internet' then 'Internet'
  when 'Di chuyển' then 'Transport'
  when 'Xăng' then 'Fuel'
  when 'ETC' then 'ETC'
  when 'Khách sạn' then 'Hotels'
  when 'Vé máy bay' then 'Flights'
  when 'Quần áo' then 'Clothing'
  when 'Giày dép' then 'Shoes'
  when 'Gia dụng' then 'Household goods'
  when 'Giáo dục' then 'Education'
  when 'Sức khỏe' then 'Healthcare'
  when 'Mỹ phẩm' then 'Cosmetics'
  when 'Giải trí' then 'Entertainment'
  when 'Đồ chơi' then 'Toys'
  when 'Tiêu dùng' then 'Shopping'
  when 'Thú cưng' then 'Pets'
  when 'Đám cưới' then 'Weddings'
  when 'Sinh nhật' then 'Birthdays'
  when 'Lì xì' then 'Lucky money'
  when 'Quà' then 'Gifts'
  when 'Đầu tư chứng khoán' then 'Stock investments'
  when 'Đầu tư vàng' then 'Gold investments'
  when 'Khác' then 'Other'
  else name_en
end where name_en is null;

update public.payment_methods set name_en = case name
  when 'Chuyển khoản' then 'Bank transfer'
  when 'Thẻ tín dụng' then 'Credit card'
  when 'Trả góp' then 'Installments'
  when 'Urbox' then 'Urbox'
  when 'Tiền mặt' then 'Cash'
  else name_en
end where name_en is null;

create or replace function public.seed_family_defaults(p_family_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  names text[] := array['Sinh hoạt gia đình','Con cái','Du lịch','Hiếu hỉ & quan hệ','Nhà cửa & gia dụng','Xe cộ','Sức khỏe gia đình','Thai sản','Đầu tư','Khác'];
  names_en text[] := array['Family living','Children','Travel','Family occasions & relationships','Home & household','Vehicles','Family health','Maternity','Investments','Other'];
  types text[] := array['Ăn uống','Thực phẩm','Điện','Nước','Internet','Di chuyển','Xăng','ETC','Khách sạn','Vé máy bay','Quần áo','Giày dép','Gia dụng','Giáo dục','Sức khỏe','Mỹ phẩm','Giải trí','Đồ chơi','Tiêu dùng','Thú cưng','Đám cưới','Sinh nhật','Lì xì','Quà','Đầu tư chứng khoán','Đầu tư vàng','Khác'];
  types_en text[] := array['Dining','Groceries','Electricity','Water','Internet','Transport','Fuel','ETC','Hotels','Flights','Clothing','Shoes','Household goods','Education','Healthcare','Cosmetics','Entertainment','Toys','Shopping','Pets','Weddings','Birthdays','Lucky money','Gifts','Stock investments','Gold investments','Other'];
  payment_names text[] := array['Chuyển khoản','Thẻ tín dụng','Trả góp','Urbox','Tiền mặt'];
  payment_names_en text[] := array['Bank transfer','Credit card','Installments','Urbox','Cash'];
  n text;
  i int;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  i := 1;
  foreach n in array names loop
    insert into public.purposes(family_id,name,name_en,code,sort_order)
      values(p_family_id,n,names_en[i],'purpose-'||(i - 1),i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array types loop
    insert into public.expense_types(family_id,name,name_en,code,sort_order)
      values(p_family_id,n,types_en[i],'expense-'||(i - 1),i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array payment_names loop
    insert into public.payment_methods(family_id,name,name_en,sort_order)
      values(p_family_id,n,payment_names_en[i],i - 1)
      on conflict(family_id,name) do nothing;
    i := i + 1;
  end loop;
end $$;
grant execute on function public.seed_family_defaults(uuid) to authenticated;

create or replace function public.get_dashboard_summary(p_family_id uuid,p_year int,p_month int)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; month_start date; month_end date;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year < 2000 or p_year > 2200 or p_month < 1 or p_month > 12 then raise exception 'INVALID_PERIOD'; end if;
  month_start := make_date(p_year,p_month,1); month_end := (month_start + interval '1 month')::date;
  with actual_month as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=month_start and t.transaction_date<month_end),
  totals as (select coalesce(sum(amount) filter(where transaction_type in ('Thu nhập','Hoàn tiền')),0) income,coalesce(sum(amount) filter(where transaction_type in ('Chi tiêu','Tạm ứng')),0) expense from actual_month),
  purpose_data as (select p.name,p.name_en,sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type='Hoàn tiền' then -t.amount else 0 end) value from actual_month t join public.purposes p on p.id=t.purpose_id group by p.id,p.name,p.name_en having sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type='Hoàn tiền' then -t.amount else 0 end)>0 order by value desc),
  expense_data as (select e.name,e.name_en,sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type='Hoàn tiền' then -t.amount else 0 end) value from actual_month t join public.expense_types e on e.id=t.expense_type_id group by e.id,e.name,e.name_en having sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then t.amount when t.transaction_type='Hoàn tiền' then -t.amount else 0 end)>0 order by value desc),
  income_purpose_data as (select p.name,p.name_en,sum(t.amount) value from actual_month t join public.purposes p on p.id=t.purpose_id where t.transaction_type in ('Thu nhập','Hoàn tiền') group by p.id,p.name,p.name_en order by value desc),
  income_expense_data as (select e.name,e.name_en,sum(t.amount) value from actual_month t join public.expense_types e on e.id=t.expense_type_id where t.transaction_type in ('Thu nhập','Hoàn tiền') group by e.id,e.name,e.name_en order by value desc),
  trend_months as (select generate_series(month_start-interval '5 months',month_start,interval '1 month')::date start_date),
  trend_data as (select tm.start_date,coalesce(sum(case when t.transaction_type in ('Chi tiêu','Tạm ứng') then -t.amount when t.transaction_type in ('Thu nhập','Hoàn tiền') then t.amount else 0 end),0) value from trend_months tm left join public.transactions t on t.family_id=p_family_id and t.deleted_at is null and t.status='Thực tế' and t.transaction_date>=tm.start_date and t.transaction_date<(tm.start_date+interval '1 month') group by tm.start_date order by tm.start_date),
  recent as (select t.* from actual_month t order by t.transaction_date desc,t.created_at desc,t.id limit 5), due as (select t.* from public.transactions t where t.family_id=p_family_id and t.deleted_at is null and t.status='Dự kiến' and t.transaction_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by t.transaction_date,t.created_at,t.id limit 20)
  select jsonb_build_object('totalIncome',totals.income,'totalExpense',totals.expense,'byPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from purpose_data),'[]'::jsonb),'byExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from expense_data),'[]'::jsonb),'incomeByPurpose',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from income_purpose_data),'[]'::jsonb),'incomeByExpenseType',coalesce((select jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'value',value)) from income_expense_data),'[]'::jsonb),'trend',coalesce((select jsonb_agg(jsonb_build_object('m','T'||extract(month from start_date)::int,'v',value)) from trend_data),'[]'::jsonb),'recentTransactions',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),'dueTransactions',coalesce((select jsonb_agg(to_jsonb(d)) from due d),'[]'::jsonb)) into result from totals;
  return result;
end $$;
revoke all on function public.get_dashboard_summary(uuid,int,int) from public;
grant execute on function public.get_dashboard_summary(uuid,int,int) to authenticated;
