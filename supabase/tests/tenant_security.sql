-- Negative tests chạy trong Supabase local có pgTAP.
begin;
select plan(5);
select has_constraint('public','transactions','transactions_purpose_same_family_fkey','purpose FK cùng family');
select has_constraint('public','transactions','transactions_expense_type_same_family_fkey','expense type FK cùng family');
select has_constraint('public','transactions','transactions_payment_method_same_family_fkey','payment method FK cùng family');
select has_constraint('public','transactions','transactions_event_same_family_fkey','event FK cùng family');
select has_function('public','bulk_update_transactions',ARRAY['uuid','uuid[]','jsonb'],'bulk update RPC có authorization');
select * from finish();
rollback;
