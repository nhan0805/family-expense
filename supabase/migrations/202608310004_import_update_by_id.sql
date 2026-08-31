create or replace function public.import_template_transactions(
  p_family_id uuid, p_file_name text, p_rows jsonb,
  p_issues jsonb default '[]'::jsonb, p_mode text default 'insert'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch_id uuid:=gen_random_uuid(); r jsonb; inserted_count int:=0; updated_count int:=0; net numeric:=0;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('insert','update') or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>1000 then raise exception 'INVALID_IMPORT'; end if;
  insert into public.import_batches(id,family_id,file_name,source_row_count,error_count,status,created_by)
    values(batch_id,p_family_id,left(p_file_name,255),jsonb_array_length(p_rows)+jsonb_array_length(p_issues),jsonb_array_length(p_issues),'processing',auth.uid());
  for r in select value from jsonb_array_elements(p_rows) loop
    if p_mode='update' and nullif(r->>'id','') is null then raise exception 'UPDATE_REQUIRES_ID'; end if;
    if not exists(select 1 from public.purposes where id=(r->>'purposeId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_PURPOSE'; end if;
    if not exists(select 1 from public.expense_types where id=(r->>'expenseTypeId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_EXPENSE_TYPE'; end if;
    if not exists(select 1 from public.payment_methods where id=(r->>'paymentMethodId')::uuid and family_id=p_family_id and active) then raise exception 'INVALID_PAYMENT_METHOD'; end if;
    if nullif(r->>'id','') is not null then
      update public.transactions set transaction_date=(r->>'transactionDate')::date, transaction_type=(r->>'transactionType')::public.transaction_kind, status=(r->>'status')::public.transaction_status, description=trim(r->>'description'), amount=(r->>'amount')::numeric, purpose_id=(r->>'purposeId')::uuid, expense_type_id=(r->>'expenseTypeId')::uuid, payment_method_id=(r->>'paymentMethodId')::uuid, note=nullif(trim(coalesce(r->>'note','')),''), updated_by=auth.uid() where id=(r->>'id')::uuid and family_id=p_family_id and deleted_at is null;
      if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
      updated_count:=updated_count+1;
    else
      insert into public.transactions(family_id,transaction_date,transaction_type,status,description,amount,purpose_id,expense_type_id,payment_method_id,note,created_by,updated_by,source,source_reference,ai_generated)
      values(p_family_id,(r->>'transactionDate')::date,(r->>'transactionType')::public.transaction_kind,(r->>'status')::public.transaction_status,trim(r->>'description'),(r->>'amount')::numeric,(r->>'purposeId')::uuid,(r->>'expenseTypeId')::uuid,(r->>'paymentMethodId')::uuid,nullif(trim(coalesce(r->>'note','')),''),auth.uid(),auth.uid(),'excel_import','template:'||batch_id||':'||(r->>'rowNumber'),false);
      inserted_count:=inserted_count+1;
    end if;
  end loop;
  insert into public.import_issues(batch_id,family_id,source_row,severity,messages,source_values) select batch_id,p_family_id,(i->>'rowNumber')::int,'error',array(select jsonb_array_elements_text(i->'messages')),'{}'::jsonb from jsonb_array_elements(p_issues) i;
  update public.import_batches set imported_count=inserted_count+updated_count, skipped_count=0, status='completed', completed_at=now() where id=batch_id;
  return jsonb_build_object('batchId',batch_id,'inserted',inserted_count,'updated',updated_count,'imported',inserted_count+updated_count);
end $$;

revoke all on function public.import_template_transactions(uuid,text,jsonb,jsonb,text) from public;
grant execute on function public.import_template_transactions(uuid,text,jsonb,jsonb,text) to authenticated;
