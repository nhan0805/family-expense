-- Structural tests for savings-book and gold asset management.
begin;
select plan(35);

select ok(
  exists(
    select 1
    from pg_type
    where typname = 'transaction_source'
      and 'asset' = any(enum_range(null::public.transaction_source)::text[])
  ),
  'transaction_source includes asset'
);
select ok(
  exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'savings_accounts' and c.relrowsecurity),
  'savings accounts has RLS'
);
select ok(
  exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'savings_movements' and c.relrowsecurity),
  'savings movements has RLS'
);
select ok(
  exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'gold_assets' and c.relrowsecurity),
  'gold assets has RLS'
);
select ok(
  exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'gold_sales' and c.relrowsecurity),
  'gold sales has RLS'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'savings_accounts' and policyname = 'savings_accounts_select'),
  'savings accounts has family-scoped select policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'gold_assets' and policyname = 'gold_assets_select'),
  'gold assets has family-scoped select policy'
);
select ok(
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'families'
      and column_name = 'gold_buyback_price_per_chi'
  ),
  'families stores one shared gold buy-back price'
);
select ok(
  (select count(*)
   from pg_policies
   where schemaname = 'public'
     and ((tablename = 'savings_accounts' and policyname = 'savings_accounts_select')
       or (tablename = 'gold_assets' and policyname = 'gold_assets_select'))
     and qual ilike '%is_family_member%'
     and qual not ilike '%is_family_owner%') = 2,
  'asset rows are visible to all active family members'
);
select has_function('public', 'set_gold_buyback_price', array['uuid','numeric'], 'shared gold price RPC exists');
select ok(
  exists(select 1 from pg_trigger where tgname = 'savings_accounts_calculate_maturity'),
  'savings maturity is calculated by a database trigger'
);
select ok(
  (select count(*) from pg_proc where oid in (
    'public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure,
    'public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure,
    'public.settle_savings_account(uuid,uuid,numeric,date,uuid,text)'::regprocedure,
    'public.archive_savings_account(uuid,uuid)'::regprocedure,
    'public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure,
    'public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure,
    'public.archive_gold_asset(uuid,uuid)'::regprocedure
  )
  and pg_get_functiondef(oid) ilike '%public.is_family_member(%'
  and pg_get_functiondef(oid) not ilike '%public.is_family_owner(%') = 7,
  'asset mutation RPCs allow all active family members'
);

select has_function('public', 'upsert_savings_account', array['uuid','uuid','text','text','numeric','numeric','integer','date','date','text','uuid','text','boolean'], 'savings upsert RPC exists');
select has_function('public', 'record_savings_movement', array['uuid','uuid','text','numeric','date','uuid','text','boolean'], 'savings movement RPC exists');
select has_function('public', 'settle_savings_account', array['uuid','uuid','numeric','date','uuid','text'], 'savings settlement RPC exists');
select has_function('public', 'auto_settle_due_savings_accounts', array['date'], 'automatic savings settlement job function exists');
select has_function('public', 'archive_savings_account', array['uuid','uuid'], 'savings archive RPC exists');
select has_function('public', 'upsert_gold_asset', array['uuid','uuid','date','numeric','numeric','numeric','uuid','text','boolean'], 'gold upsert RPC exists');
select has_function('public', 'record_gold_sale', array['uuid','uuid','date','numeric','numeric','uuid','text'], 'gold sale RPC exists');
select has_function('public', 'archive_gold_asset', array['uuid','uuid'], 'gold archive RPC exists');
select has_function('public', 'get_asset_summary', array['uuid'], 'asset summary RPC exists');
select ok(
  (select count(*) from pg_proc where prosecdef and oid in (
    'public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure,
    'public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure,
    'public.settle_savings_account(uuid,uuid,numeric,date,uuid,text)'::regprocedure,
    'public.archive_savings_account(uuid,uuid)'::regprocedure,
    'public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure,
    'public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure,
    'public.archive_gold_asset(uuid,uuid)'::regprocedure,
    'public.get_asset_summary(uuid)'::regprocedure
  )) = 8,
  'asset RPCs use security definer'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.auto_settle_due_savings_accounts(date)'::regprocedure and prosecdef)
  and exists(select 1 from cron.job where jobname = 'auto-settle-due-savings-accounts' and schedule = '15 17 * * *'),
  'savings maturity settlement is protected and scheduled at 00:15 Vietnam time'
);
select ok(
  pg_get_functiondef('public.settle_savings_account(uuid,uuid,numeric,date,uuid,text)'::regprocedure) ilike '%settle_savings_account_internal%'
  and pg_get_functiondef('public.auto_settle_due_savings_accounts(date)'::regprocedure) ilike '%FOR UPDATE SKIP LOCKED%',
  'manual and automatic savings settlement share an idempotent locked path'
);
select ok(
  not has_table_privilege('authenticated', 'public.savings_accounts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.savings_movements', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gold_assets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gold_sales', 'INSERT'),
  'authenticated clients cannot insert asset rows directly'
);
select ok(
  exists(select 1 from pg_constraint where conname = 'savings_movements_account_same_family_fkey' and contype = 'f'),
  'savings movements enforce same-family account ownership'
);
select ok(
  exists(select 1 from pg_constraint where conname = 'gold_sales_asset_same_family_fkey' and contype = 'f'),
  'gold sales enforce same-family asset ownership'
);
select ok(
  pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%asset-savings-deposit%',
  'new families receive savings transaction categories'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.seed_family_defaults(uuid)'::regprocedure and prosecdef),
  'family defaults keep security definer behavior'
);
select ok(
  pg_get_functiondef('public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure) ilike '%::public.transaction_status%'
  and pg_get_functiondef('public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure) ilike '%::public.transaction_status%'
  and pg_get_functiondef('public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure) ilike '%::public.transaction_status%'
  and pg_get_functiondef('public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure) ilike '%::public.transaction_status%',
  'asset transaction RPCs cast enum statuses explicitly'
);
select ok(
  pg_get_functiondef('public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure) ilike '%purpose_id, expense_type_id, payment_method_id, note%'
  and pg_get_functiondef('public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure) not ilike '%purpose_id, expense_type_id, resolved_payment_method_id, note%',
  'gold purchase transaction uses the payment_method_id column'
);
select ok(
  pg_get_functiondef('public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure) ilike '%p.code = ''purpose-8''%'
  and pg_get_functiondef('public.record_savings_movement(uuid,uuid,text,numeric,date,uuid,text,boolean)'::regprocedure) ilike '%p.code = ''purpose-8''%'
  and pg_get_functiondef('public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure) ilike '%p.code = ''purpose-8''%'
  and pg_get_functiondef('public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure) ilike '%p.code = ''purpose-8''%',
  'asset RPCs resolve the stable investment purpose code'
);
select ok(
  pg_get_functiondef('public.upsert_gold_asset(uuid,uuid,date,numeric,numeric,numeric,uuid,text,boolean)'::regprocedure) ilike '%e.code = ''expense-25''%'
  and pg_get_functiondef('public.record_gold_sale(uuid,uuid,date,numeric,numeric,uuid,text)'::regprocedure) ilike '%e.code = ''expense-25''%',
  'gold RPCs resolve the stable gold category code'
);
select ok(
  pg_get_functiondef('public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure) ilike '%if p_create_transaction then%public.automatic_transaction_defaults%'
  and pg_get_functiondef('public.upsert_savings_account(uuid,uuid,text,text,numeric,numeric,integer,date,date,text,uuid,text,boolean)'::regprocedure) ilike '%catalog_not_ready%'
  ,
  'savings opening honors automatic transaction settings and keeps book-only save available'
);
select ok(
  not exists(
    select 1
    from public.families f
    where not exists(
      select 1
      from public.expense_types e
      where e.family_id = f.id
        and e.name = 'Đầu tư vàng'
        and e.active
    )
  ),
  'every family has an active gold investment expense category'
);

select * from finish();
rollback;
