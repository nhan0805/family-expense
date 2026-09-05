-- Structural tests for automatic recurring-expense generation.
begin;
select plan(26);

select ok(
  exists(select 1 from pg_type where typname = 'transaction_source' and 'recurring' = any(enum_range(null::public.transaction_source)::text[])),
  'transaction_source includes recurring'
);
select ok(
  exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'recurring_transaction_runs' and c.relrowsecurity),
  'recurring runs has RLS'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.recurring_transaction_runs'::regclass and contype = 'u' and pg_get_constraintdef(oid) ilike '%recurring_transaction_id%occurrence_date%'),
  'recurring runs is unique per occurrence'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'transactions' and column_name = 'recurring_transaction_id'),
  'transactions link to recurring templates'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recurring_transactions' and column_name = 'deleted_at'),
  'recurring templates support soft delete'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recurring_transactions' and column_name = 'deleted_active_before'),
  'recurring templates remember active state before deletion'
);
select has_function('public', 'recurring_next_date', array['date','text','integer','integer'], 'recurring date helper exists');
select has_function('public', 'upsert_recurring_transaction', array['uuid','uuid','text','jsonb','text','date','date'], 'recurring upsert is available');
select has_function('public', 'set_recurring_transaction_active', array['uuid','uuid','boolean'], 'recurring pause function is available');
select has_function('public', 'delete_recurring_transaction', array['uuid','uuid'], 'recurring delete function is available');
select has_function('public', 'restore_recurring_transaction', array['uuid','uuid'], 'recurring restore function is available');
select has_function('public', 'permanently_delete_recurring_transaction', array['uuid','uuid'], 'recurring permanent delete function is available');
select has_function('public', 'skip_recurring_occurrence', array['uuid','uuid'], 'recurring skip function is available');
select has_function('public', 'generate_due_recurring_transactions', array['uuid','date'], 'recurring generation function is available');
select ok(
  exists(select 1 from pg_proc where oid = 'public.generate_due_recurring_transactions(uuid,date)'::regprocedure and prosecdef),
  'recurring generation is security definer'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.delete_recurring_transaction(uuid,uuid)'::regprocedure and prosecdef),
  'recurring delete is security definer'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.restore_recurring_transaction(uuid,uuid)'::regprocedure and prosecdef),
  'recurring restore is security definer'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.permanently_delete_recurring_transaction(uuid,uuid)'::regprocedure and prosecdef),
  'recurring permanent delete is security definer'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_transactions' and policyname = 'recurring_transactions_select'),
  'recurring templates keep member read access'
);
select ok(
  (select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'recurring_transactions_select' and polrelid = 'public.recurring_transactions'::regclass) ilike '%deleted_at IS NULL%',
  'recurring select policy hides soft-deleted templates'
);
select ok(
  (select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'recurring_transactions_select' and polrelid = 'public.recurring_transactions'::regclass) ilike '%is_family_owner%',
  'recurring select policy lets the owner view the template trash'
);
select ok(
  pg_get_functiondef('public.permanently_delete_recurring_transaction(uuid,uuid)'::regprocedure) ilike '%deleted_at IS NOT NULL%',
  'recurring permanent delete only accepts soft-deleted templates'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_transaction_runs' and policyname = 'recurring_transaction_runs_select'),
  'recurring runs keep family-scoped read access'
);
select ok(
  exists(select 1 from cron.job where jobname = 'generate-due-recurring-transactions' and schedule = '5 17 * * *'),
  'daily recurring generation job is scheduled at 00:05 Vietnam time'
);
select ok(
  pg_get_functiondef('public.generate_due_recurring_transactions(uuid,date)'::regprocedure) ilike '%r.status = ''skipped''%',
  'skipped occurrences are checked before generation'
);
select ok(
  pg_get_functiondef('public.upsert_recurring_transaction(uuid,uuid,text,jsonb,text,date,date)'::regprocedure) ilike '%previous_next_run_date is distinct from p_next_run_date%',
  'editing template content preserves the existing calendar anchor'
);

select * from finish();
rollback;
