-- Structural tenant-security tests chạy trong Supabase local/staging có pgTAP.
-- Fixture-level cross-family negative tests nên dùng dữ liệu test riêng của môi trường.
begin;
select plan(26);
select ok(exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace and conrelid = 'public.transactions'::regclass and conname = 'transactions_purpose_same_family_fkey' and contype = 'f'),'transactions có purpose FK cùng family');
select ok(exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace and conrelid = 'public.transactions'::regclass and conname = 'transactions_expense_type_same_family_fkey' and contype = 'f'),'transactions có expense type FK cùng family');
select ok(exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace and conrelid = 'public.transactions'::regclass and conname = 'transactions_payment_method_same_family_fkey' and contype = 'f'),'transactions có payment method FK cùng family');
select ok(exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace and conrelid = 'public.transactions'::regclass and conname = 'transactions_event_same_family_fkey' and contype = 'f'),'transactions có event FK cùng family');
select has_function('public','bulk_update_transactions',ARRAY['uuid','uuid[]','jsonb'],'bulk update RPC có authorization');

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'families' and c.relrowsecurity
  ),
  'families bật RLS'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'family_members' and c.relrowsecurity
  ),
  'family_members bật RLS'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'transactions' and c.relrowsecurity
  ),
  'transactions bật RLS'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ai_usage_logs' and c.relrowsecurity
  ),
  'ai_usage_logs bật RLS'
);

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'families' and policyname = 'families_select'), 'families có policy select');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'members_select'), 'family_members có policy select');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'members_manage'), 'family_members có policy quản trị');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'members_bootstrap'), 'family_members có policy bootstrap');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_select'), 'transactions có policy select');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert'), 'transactions có policy insert');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_update'), 'transactions có policy update');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage_logs' and policyname = 'ai_logs_insert'), 'ai_usage_logs có policy insert');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage_logs' and policyname = 'ai_logs_select'), 'ai_usage_logs có policy select');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'import_batches' and policyname = 'import_batches_select'), 'import_batches có policy select');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'import_issues' and policyname = 'import_issues_select'), 'import_issues có policy select');
select ok(exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'budgets' and c.relrowsecurity), 'budgets bật RLS');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purposes' and column_name = 'budget_enabled' and is_nullable = 'NO' and column_default like '%true%'), 'purposes có budget_enabled mặc định true');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'purposes' and policyname = 'purposes_owner'), 'purposes có policy owner để quản lý cài đặt');
select has_function('public','get_budget_summary',ARRAY['uuid','integer','integer'],'budget summary RPC có authorization');
select has_function('public','upsert_budget',ARRAY['uuid','integer','integer','uuid','numeric','numeric'],'upsert budget RPC có authorization');
select has_function('public','copy_budgets_from_month',ARRAY['uuid','integer','integer','integer','integer'],'copy budgets RPC có authorization');
select * from finish();
rollback;
