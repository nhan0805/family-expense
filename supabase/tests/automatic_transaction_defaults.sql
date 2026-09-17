-- Structural tests for family-level automatic transaction catalog defaults.
begin;
select plan(18);

select ok(
  exists(
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'automatic_transaction_defaults'
      and c.relrowsecurity
  ),
  'automatic transaction defaults have RLS'
);
select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'automatic_transaction_defaults'
      and column_name in ('family_id', 'automation_key', 'purpose_id', 'expense_type_id', 'payment_method_id')
    group by table_name
    having count(*) = 5
  ),
  'automatic defaults store family and all three catalog ids'
);
select ok(
  exists(select 1 from pg_constraint where conname = 'automatic_transaction_defaults_pkey'),
  'one mapping exists per family and automation key'
);
select ok(
  (select count(*) from pg_constraint where conname in (
    'automatic_transaction_defaults_family_id_purpose_id_fkey',
    'automatic_transaction_defaults_family_id_expense_type_id_fkey',
    'automatic_transaction_defaults_family_id_payment_method_id_fkey'
  )) = 3,
  'catalog references enforce the same family'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'automatic_transaction_defaults' and policyname = 'automatic_transaction_defaults_select' and qual ilike '%is_family_member%'),
  'family members can read automatic defaults'
);
select ok(
  not has_table_privilege('authenticated', 'public.automatic_transaction_defaults', 'INSERT')
  and not has_table_privilege('authenticated', 'public.automatic_transaction_defaults', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.automatic_transaction_defaults', 'DELETE'),
  'clients cannot write automatic defaults directly'
);
select ok(
  to_regprocedure('public.save_automatic_transaction_defaults(uuid,jsonb)') is not null,
  'automatic defaults save RPC exists'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.save_automatic_transaction_defaults(uuid,jsonb)'::regprocedure and prosecdef),
  'automatic defaults save RPC uses security definer'
);
select ok(
  pg_get_functiondef('public.save_automatic_transaction_defaults(uuid,jsonb)'::regprocedure) ilike '%public.is_family_owner%'
  and pg_get_functiondef('public.save_automatic_transaction_defaults(uuid,jsonb)'::regprocedure) ilike '%public.automatic_transaction_defaults%'
  and pg_get_functiondef('public.save_automatic_transaction_defaults(uuid,jsonb)'::regprocedure) ilike '%jsonb_array_length(p_defaults) <> 5%',
  'save RPC checks owner, writes the scoped table and accepts five active mappings'
);
select ok(
  coalesce((
    select pg_get_constraintdef(oid) not ilike '%savings_withdrawal%'
      and pg_get_constraintdef(oid) not ilike '%savings_fee%'
    from pg_constraint
    where conname = 'automatic_transaction_defaults_automation_key_check'
  ), false),
  'retired savings withdrawal and fee mappings are not valid defaults'
);
select ok(
  not exists(
    select 1 from public.automatic_transaction_defaults
    where automation_key in ('savings_withdrawal', 'savings_fee')
  ),
  'retired savings withdrawal and fee mappings are removed'
);
select ok(
  exists(select 1 from pg_trigger where tgname = 'transactions_apply_automatic_defaults'),
  'asset transactions have an automatic defaults trigger'
);
select ok(
  pg_get_functiondef('public.apply_automatic_transaction_defaults()'::regprocedure) ilike '%new.source%asset%'
  and pg_get_functiondef('public.automatic_transaction_default_key(text)'::regprocedure) ilike '%settlement-interest%'
  and pg_get_functiondef('public.apply_automatic_transaction_defaults()'::regprocedure) ilike '%new.purpose_id%'
  and pg_get_functiondef('public.apply_automatic_transaction_defaults()'::regprocedure) ilike '%new.expense_type_id%'
  and pg_get_functiondef('public.apply_automatic_transaction_defaults()'::regprocedure) ilike '%new.payment_method_id%',
  'trigger applies all configured catalog fields'
);
select ok(
  pg_get_functiondef('public.create_family(text)'::regprocedure) ilike '%seed_automatic_transaction_defaults%',
  'new families seed automatic transaction defaults'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.seed_automatic_transaction_defaults(uuid)'::regprocedure and prosecdef),
  'automatic default seeding is protected'
);
select ok(
  pg_get_functiondef('public.seed_automatic_transaction_defaults(uuid)'::regprocedure) ilike '%(''savings_interest'', ''Lãi tiền gửi'', ''Chuyển khoản'')%'
  and pg_get_functiondef('public.seed_automatic_transaction_defaults(uuid)'::regprocedure) ilike '%(''savings_settlement'', ''Tất toán tiết kiệm'', ''Chuyển khoản'')%'
  and pg_get_functiondef('public.seed_automatic_transaction_defaults(uuid)'::regprocedure) ilike '%(''gold_sale'', ''Đầu tư vàng'', ''Chuyển khoản'')%',
  'system automatic defaults use transfer for savings interest, settlement and gold sale'
);
select ok(
  pg_get_functiondef('public.guard_catalog_delete_in_use()'::regprocedure) ilike '%automatic_transaction_defaults%',
  'catalog deletion guard protects configured defaults'
);
select ok(
  not has_function_privilege('anon', 'public.save_automatic_transaction_defaults(uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot save automatic defaults'
);

select * from finish();
rollback;
