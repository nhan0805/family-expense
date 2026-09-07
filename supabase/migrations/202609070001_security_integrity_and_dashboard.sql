-- Security, idempotent import and server-side dashboard aggregation follow-up.

-- Member mutations are exposed only through the audited RPCs. The app still
-- needs read access for its bootstrap query and email export function.
revoke insert, update, delete, truncate, references, trigger on table public.family_members from authenticated;
grant select on table public.family_members to authenticated;

create unique index if not exists family_members_one_active_family_idx
  on public.family_members(user_id)
  where status = 'active';

-- Keep the suggestion table tenant-safe even though it is not currently used
-- by the UI. family_id is maintained from the purpose row by the trigger.
alter table public.purpose_expense_type_suggestions
  add column if not exists family_id uuid;
update public.purpose_expense_type_suggestions s
set family_id = p.family_id
from public.purposes p
where p.id = s.purpose_id and s.family_id is null;
alter table public.purpose_expense_type_suggestions
  alter column family_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'suggestions_family_id_fkey'
  ) then
    alter table public.purpose_expense_type_suggestions
      add constraint suggestions_family_id_fkey
      foreign key (family_id) references public.families(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'suggestions_purpose_same_family_fkey'
  ) then
    alter table public.purpose_expense_type_suggestions
      add constraint suggestions_purpose_same_family_fkey
      foreign key (family_id, purpose_id) references public.purposes(family_id, id)
      on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'suggestions_expense_type_same_family_fkey'
  ) then
    alter table public.purpose_expense_type_suggestions
      add constraint suggestions_expense_type_same_family_fkey
      foreign key (family_id, expense_type_id) references public.expense_types(family_id, id)
      on delete cascade;
  end if;
end $$;

create or replace function public.sync_suggestion_family()
returns trigger language plpgsql security definer set search_path = '' as $$
declare purpose_family uuid; expense_family uuid;
begin
  select family_id into purpose_family from public.purposes where id = new.purpose_id;
  select family_id into expense_family from public.expense_types where id = new.expense_type_id;
  if purpose_family is null or expense_family is null or purpose_family <> expense_family then
    raise exception 'CROSS_FAMILY_SUGGESTION';
  end if;
  new.family_id := purpose_family;
  return new;
end;
$$;
drop trigger if exists suggestions_sync_family on public.purpose_expense_type_suggestions;
create trigger suggestions_sync_family
before insert or update of purpose_id, expense_type_id, family_id
on public.purpose_expense_type_suggestions
for each row execute function public.sync_suggestion_family();
revoke all on function public.sync_suggestion_family() from public;

-- Cache rows are an implementation detail of the Edge Function. No signed-in
-- client may write another member's cached summary.
revoke all on table public.ai_summary_cache from authenticated;

-- Reserve the AI request slot while holding a per-user advisory lock. This
-- closes the check-then-log race that allowed concurrent calls to exceed 10/min.
create or replace function public.consume_ai_request_slot(p_family_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare slot_id uuid;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (
    select count(*) from public.ai_usage_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 minute'
      and status in ('pending','success','error')
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.ai_usage_logs(family_id,user_id,request_date,model,status,input_length)
    values (p_family_id,auth.uid(),current_date,'pending','pending',0)
    returning id into slot_id;
  return jsonb_build_object('userId', auth.uid(), 'slotId', slot_id);
end;
$$;

create or replace function public.complete_ai_request(
  p_slot_id uuid,
  p_model text,
  p_status text,
  p_latency_ms int default null,
  p_input_length int default 0,
  p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('success','error') then raise exception 'INVALID_AI_STATUS'; end if;
  update public.ai_usage_logs
  set model = left(coalesce(nullif(trim(p_model),''),'unknown'), 120),
      status = p_status,
      latency_ms = greatest(coalesce(p_latency_ms,0),0),
      input_length = greatest(coalesce(p_input_length,0),0),
      error_code = nullif(left(coalesce(p_error_code,''),80),'')
  where id = p_slot_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'AI_SLOT_NOT_FOUND'; end if;
  return true;
end;
$$;
revoke all on function public.consume_ai_request_slot(uuid) from public;
revoke all on function public.complete_ai_request(uuid,text,text,int,int,text) from public;
grant execute on function public.consume_ai_request_slot(uuid), public.complete_ai_request(uuid,text,text,int,int,text) to authenticated, service_role;

create or replace function public.get_ai_request_context(p_family_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; reservation jsonb;
begin
  reservation := public.consume_ai_request_slot(p_family_id);
  select jsonb_build_object(
    'userId', reservation->>'userId',
    'slotId', reservation->>'slotId',
    'purposes', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order) from public.purposes where family_id=p_family_id and active=true),'[]'::jsonb),
    'expenseTypes', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order) from public.expense_types where family_id=p_family_id and active=true),'[]'::jsonb),
    'paymentMethods', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order) from public.payment_methods where family_id=p_family_id and active=true),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_ai_dashboard_facts(p_family_id uuid,p_date_from date,p_date_to date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; reservation jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to or p_date_to > (p_date_from + interval '120 months')::date then raise exception 'INVALID_DATE_RANGE'; end if;
  reservation := public.consume_ai_request_slot(p_family_id);
  with months as (
    select month_start::date, to_char(month_start,'YYYY-MM') month_key from generate_series(date_trunc('month',p_date_from)::date,date_trunc('month',p_date_to)::date,interval '1 month') month_start
  ), rows_in_range as (
    select t.transaction_date,t.transaction_type,t.amount,coalesce(et.name,'Chưa phân loại') category_name,coalesce(p.name,'Chưa phân loại') purpose_name
    from public.transactions t left join public.expense_types et on et.id=t.expense_type_id and et.family_id=t.family_id left join public.purposes p on p.id=t.purpose_id and p.family_id=t.family_id
    where t.family_id=p_family_id and t.status='Thực tế' and t.deleted_at is null and t.transaction_date between p_date_from and p_date_to and t.transaction_type in ('Chi tiêu','Thu nhập')
  ), totals as (
    select coalesce(sum(amount) filter(where transaction_type='Thu nhập'),0) total_income,coalesce(sum(amount) filter(where transaction_type='Chi tiêu'),0) total_expense from rows_in_range
  ), category_totals as (select category_name name,sum(amount) value from rows_in_range where transaction_type='Chi tiêu' group by category_name order by value desc limit 5), purpose_totals as (select purpose_name name,sum(amount) value from rows_in_range where transaction_type='Chi tiêu' group by purpose_name order by value desc limit 5), monthly_totals as (
    select m.month_key,m.month_start,coalesce(sum(r.amount) filter(where r.transaction_type='Chi tiêu'),0) expense,coalesce(sum(r.amount) filter(where r.transaction_type='Thu nhập'),0) income from months m left join rows_in_range r on to_char(r.transaction_date,'YYYY-MM')=m.month_key group by m.month_key,m.month_start
  )
  select jsonb_build_object('userId',reservation->>'userId','slotId',reservation->>'slotId','facts',jsonb_build_object('totalIncome',totals.total_income,'totalExpense',totals.total_expense,'netValue',totals.total_income-totals.total_expense,'averageExpense',totals.total_expense/greatest((select count(*) from months),1),'periodMonths',(select count(*) from months),'topCategories',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value) order by value desc) from category_totals),'[]'::jsonb),'topPurposes',coalesce((select jsonb_agg(jsonb_build_object('name',name,'value',value) order by value desc) from purpose_totals),'[]'::jsonb),'monthlyTrend',coalesce((select jsonb_agg(jsonb_build_object('month',concat('T',extract(month from month_start)::int,'/',extract(year from month_start)::int),'expense',expense,'income',income) order by month_start) from monthly_totals),'[]'::jsonb))) into result from totals;
  return result;
end;
$$;

-- Stable import key makes retries return the original batch instead of
-- creating a second set of rows.
alter table public.import_batches add column if not exists import_key text;
create unique index if not exists import_batches_family_key_uidx
  on public.import_batches(family_id, import_key)
  where import_key is not null;

create or replace function public.import_template_transactions(
  p_family_id uuid,p_file_name text,p_rows jsonb,p_issues jsonb default '[]'::jsonb,p_mode text default 'insert',p_import_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch_id uuid; r jsonb; inserted_count int:=0; updated_count int:=0; net numeric:=0; existing public.import_batches%rowtype;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('insert','update') or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>1000 then raise exception 'INVALID_IMPORT'; end if;
  if nullif(trim(p_import_key),'') is not null then
    select * into existing from public.import_batches where family_id=p_family_id and import_key=trim(p_import_key) limit 1;
    if found then return jsonb_build_object('batchId',existing.id,'imported',existing.imported_count,'inserted',existing.imported_count,'updated',0,'replayed',true); end if;
  end if;
  batch_id:=gen_random_uuid();
  insert into public.import_batches(id,family_id,file_name,import_key,source_row_count,error_count,status,created_by) values(batch_id,p_family_id,left(p_file_name,255),nullif(trim(p_import_key),''),jsonb_array_length(p_rows)+jsonb_array_length(p_issues),jsonb_array_length(p_issues),'processing',auth.uid());
  for r in select value from jsonb_array_elements(p_rows) loop
    if p_mode='update' and nullif(r->>'id','') is null then raise exception 'UPDATE_REQUIRES_ID'; end if;
    if not exists(select 1 from public.purposes where id=(r->>'purposeId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_PURPOSE'; end if;
    if not exists(select 1 from public.expense_types where id=(r->>'expenseTypeId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_EXPENSE_TYPE'; end if;
    if not exists(select 1 from public.payment_methods where id=(r->>'paymentMethodId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_PAYMENT_METHOD'; end if;
    if nullif(r->>'id','') is not null then
      update public.transactions set transaction_date=(r->>'transactionDate')::date,transaction_type=(r->>'transactionType')::public.transaction_kind,status=(r->>'status')::public.transaction_status,description=trim(r->>'description'),amount=(r->>'amount')::numeric,purpose_id=(r->>'purposeId')::uuid,expense_type_id=(r->>'expenseTypeId')::uuid,payment_method_id=(r->>'paymentMethodId')::uuid,note=nullif(trim(coalesce(r->>'note','')),''),updated_by=auth.uid() where id=(r->>'id')::uuid and family_id=p_family_id and deleted_at is null;
      if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if; updated_count:=updated_count+1;
    else
      insert into public.transactions(family_id,transaction_date,transaction_type,status,description,amount,purpose_id,expense_type_id,payment_method_id,note,created_by,updated_by,source,source_reference,ai_generated) values(p_family_id,(r->>'transactionDate')::date,(r->>'transactionType')::public.transaction_kind,(r->>'status')::public.transaction_status,trim(r->>'description'),(r->>'amount')::numeric,(r->>'purposeId')::uuid,(r->>'expenseTypeId')::uuid,(r->>'paymentMethodId')::uuid,nullif(trim(coalesce(r->>'note','')),''),auth.uid(),auth.uid(),'excel_import','template:'||batch_id||':'||(r->>'rowNumber'),false); inserted_count:=inserted_count+1;
    end if;
  end loop;
  insert into public.import_issues(batch_id,family_id,source_row,severity,messages,source_values) select batch_id,p_family_id,(i->>'rowNumber')::int,'error',array(select jsonb_array_elements_text(i->'messages')),'{}'::jsonb from jsonb_array_elements(p_issues) i;
  update public.import_batches set imported_count=inserted_count+updated_count,skipped_count=0,status='completed',completed_at=now() where id=batch_id;
  return jsonb_build_object('batchId',batch_id,'inserted',inserted_count,'updated',updated_count,'imported',inserted_count+updated_count,'replayed',false);
end $$;
revoke all on function public.import_template_transactions(uuid,text,jsonb,jsonb,text,text) from public;
grant execute on function public.import_template_transactions(uuid,text,jsonb,jsonb,text,text) to authenticated;

-- Server-side dashboard aggregation. The browser receives aggregates rather
-- than loading every transaction row just to calculate charts.
create or replace function public.get_dashboard_aggregate(p_family_id uuid,p_date_from date,p_date_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to or p_date_to > p_date_from + 366 then raise exception 'INVALID_DATE_RANGE'; end if;
  with months as (select month_start::date start_date,to_char(month_start,'YYYY-MM') key from generate_series(date_trunc('month',p_date_from)::date,date_trunc('month',p_date_to)::date,interval '1 month') month_start), rows_in_range as (
    select t.transaction_date,t.transaction_type,t.amount,t.purpose_id,t.expense_type_id,coalesce(p.name,'Chưa phân loại') purpose_name,coalesce(p.name_en,p.name,'Uncategorized') purpose_name_en,coalesce(e.name,'Chưa phân loại') expense_name,coalesce(e.name_en,e.name,'Uncategorized') expense_name_en
    from public.transactions t left join public.purposes p on p.id=t.purpose_id and p.family_id=t.family_id left join public.expense_types e on e.id=t.expense_type_id and e.family_id=t.family_id
    where t.family_id=p_family_id and t.status='Thực tế' and t.deleted_at is null and t.transaction_date between p_date_from and p_date_to and t.transaction_type in ('Chi tiêu','Thu nhập')
  ), totals as (select coalesce(sum(amount) filter(where transaction_type='Thu nhập'),0) income,coalesce(sum(amount) filter(where transaction_type='Chi tiêu'),0) expense from rows_in_range), purpose_data as (select purpose_id id,max(purpose_name) name,max(purpose_name_en) name_en,sum(amount) value from rows_in_range where transaction_type='Chi tiêu' group by purpose_id order by value desc), expense_data as (select expense_type_id id,max(expense_name) name,max(expense_name_en) name_en,sum(amount) value from rows_in_range where transaction_type='Chi tiêu' group by expense_type_id order by value desc), income_purpose_data as (select purpose_id id,max(purpose_name) name,max(purpose_name_en) name_en,sum(amount) value from rows_in_range where transaction_type='Thu nhập' group by purpose_id order by value desc), income_expense_data as (select expense_type_id id,max(expense_name) name,max(expense_name_en) name_en,sum(amount) value from rows_in_range where transaction_type='Thu nhập' group by expense_type_id order by value desc), monthly as (select m.key,m.start_date,coalesce(sum(r.amount) filter(where r.transaction_type='Chi tiêu'),0) expense,coalesce(sum(r.amount) filter(where r.transaction_type='Thu nhập'),0) income from months m left join rows_in_range r on to_char(r.transaction_date,'YYYY-MM')=m.key group by m.key,m.start_date), monthly_categories as (select to_char(r.transaction_date,'YYYY-MM') month,r.expense_type_id id,sum(r.amount) value from rows_in_range r where r.transaction_type='Chi tiêu' group by month,r.expense_type_id)
  select jsonb_build_object('totalIncome',totals.income,'totalExpense',totals.expense,'byPurpose',coalesce((select jsonb_agg(to_jsonb(x) order by x.value desc) from purpose_data x),'[]'::jsonb),'byExpenseType',coalesce((select jsonb_agg(to_jsonb(x) order by x.value desc) from expense_data x),'[]'::jsonb),'incomeByPurpose',coalesce((select jsonb_agg(to_jsonb(x) order by x.value desc) from income_purpose_data x),'[]'::jsonb),'incomeByExpenseType',coalesce((select jsonb_agg(to_jsonb(x) order by x.value desc) from income_expense_data x),'[]'::jsonb),'monthlyTrend',coalesce((select jsonb_agg(jsonb_build_object('key',key,'expense',expense,'income',income,'net',income-expense) order by start_date) from monthly),'[]'::jsonb),'monthlyCategories',coalesce((select jsonb_agg(jsonb_build_object('month',month,'id',id,'value',value)) from monthly_categories),'[]'::jsonb)) into result from totals;
  return result;
end $$;
revoke all on function public.get_dashboard_aggregate(uuid,date,date) from public;
grant execute on function public.get_dashboard_aggregate(uuid,date,date) to authenticated;
