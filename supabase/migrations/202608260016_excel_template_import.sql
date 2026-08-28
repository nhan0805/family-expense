create or replace function public.import_template_transactions(p_family_id uuid,p_file_name text,p_rows jsonb,p_issues jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare batch_id uuid:=gen_random_uuid();r jsonb;imported int:=0;net numeric:=0;row_count int:=jsonb_array_length(p_rows);issue_count int:=jsonb_array_length(p_issues);
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN';end if;
  if row_count<1 or row_count>1000 then raise exception 'INVALID_ROW_COUNT';end if;
  insert into public.import_batches(id,family_id,file_name,source_row_count,error_count,status,created_by) values(batch_id,p_family_id,left(p_file_name,255),row_count+issue_count,issue_count,'processing',auth.uid());
  for r in select value from jsonb_array_elements(p_rows) loop
    if coalesce((r->>'amount')::numeric,0)<=0 or trim(coalesce(r->>'description',''))='' then raise exception 'INVALID_ROW';end if;
    if not exists(select 1 from public.purposes p where p.id=(r->>'purposeId')::uuid and p.family_id=p_family_id and p.active) then raise exception 'INVALID_PURPOSE';end if;
    if not exists(select 1 from public.expense_types e where e.id=(r->>'expenseTypeId')::uuid and e.family_id=p_family_id and e.active) then raise exception 'INVALID_EXPENSE_TYPE';end if;
    if not exists(select 1 from public.payment_methods pm where pm.id=(r->>'paymentMethodId')::uuid and pm.family_id=p_family_id and pm.active) then raise exception 'INVALID_PAYMENT_METHOD';end if;
    insert into public.transactions(family_id,transaction_date,transaction_type,status,description,amount,purpose_id,expense_type_id,payment_method_id,note,created_by,updated_by,source,source_reference,ai_generated)
    values(p_family_id,(r->>'transactionDate')::date,(r->>'transactionType')::public.transaction_kind,(r->>'status')::public.transaction_status,trim(r->>'description'),(r->>'amount')::numeric,(r->>'purposeId')::uuid,(r->>'expenseTypeId')::uuid,(r->>'paymentMethodId')::uuid,nullif(trim(coalesce(r->>'note','')),''),auth.uid(),auth.uid(),'excel_import','template:'||batch_id||':'||(r->>'rowNumber'),false);
    imported:=imported+1;net:=net+case when r->>'transactionType'='Chi tiêu' then (r->>'amount')::numeric when r->>'transactionType'='Hoàn tiền' then -(r->>'amount')::numeric else 0 end;
  end loop;
  insert into public.import_issues(batch_id,family_id,source_row,severity,messages,source_values)
    select batch_id,p_family_id,(i->>'rowNumber')::int,'error',array(select jsonb_array_elements_text(i->'messages')),'{}'::jsonb from jsonb_array_elements(p_issues) i;
  update public.import_batches set imported_count=imported,expected_net=net,imported_net=net,status='completed',completed_at=now() where id=batch_id;
  return jsonb_build_object('batchId',batch_id,'imported',imported);
end$$;
revoke all on function public.import_template_transactions(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_template_transactions(uuid,text,jsonb,jsonb) to authenticated;
