-- Structural tests for atomic asset deletion and linked transaction cleanup.
begin;
select plan(12);

select has_function('public', 'delete_savings_account', array['uuid','uuid'], 'savings delete RPC exists');
select has_function('public', 'delete_gold_asset', array['uuid','uuid'], 'gold delete RPC exists');
select ok(
  (select count(*) from pg_proc where prosecdef and oid in (
    'public.delete_savings_account(uuid,uuid)'::regprocedure,
    'public.delete_gold_asset(uuid,uuid)'::regprocedure
  )) = 2,
  'asset delete RPCs use security definer'
);
select ok(
  pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure) ilike '%public.is_family_member%'
  and pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure) ilike '%delete from public.savings_movements%'
  and pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure) ilike '%delete from public.transactions%'
  and pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure) ilike '%delete from public.savings_accounts%',
  'savings delete RPC is family-scoped and removes dependent rows'
);
select ok(
  pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%public.is_family_member%'
  and pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%delete from public.gold_sales%'
  and pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%delete from public.transactions%'
  and pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%delete from public.gold_assets%',
  'gold delete RPC is family-scoped and removes dependent rows'
);
select ok(
  pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure) ilike '%source_reference like%asset:savings:%'
  and pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%source_reference like%asset:gold:%',
  'delete RPCs only target asset-generated transaction references'
);
select ok(
  not has_table_privilege('authenticated', 'public.savings_accounts', 'DELETE')
  and not has_table_privilege('authenticated', 'public.savings_movements', 'DELETE')
  and not has_table_privilege('authenticated', 'public.gold_assets', 'DELETE')
  and not has_table_privilege('authenticated', 'public.gold_sales', 'DELETE'),
  'authenticated clients cannot delete asset rows directly'
);
select ok(
  to_regprocedure('public.delete_savings_account(uuid,uuid)') is not null
  and to_regprocedure('public.delete_gold_asset(uuid,uuid)') is not null,
  'asset delete RPCs are exposed through named functions'
);
select ok(
  pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure) ilike '%set transaction_id = null%'
  and position('delete from public.transactions' in pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure)) > position('set transaction_id = null' in pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure)),
  'gold delete releases the parent transaction foreign key before deleting transactions'
);
select ok(
  position('delete from public.savings_movements' in pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure)) < position('delete from public.transactions' in pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure)),
  'savings delete removes movement foreign keys before transactions'
);
select ok(
  position('delete from public.gold_sales' in pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure)) < position('delete from public.transactions' in pg_get_functiondef('public.delete_gold_asset(uuid,uuid)'::regprocedure)),
  'gold delete removes sale foreign keys before transactions'
);
select ok(
  position('delete from public.transactions' in pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure)) < position('delete from public.savings_accounts' in pg_get_functiondef('public.delete_savings_account(uuid,uuid)'::regprocedure)),
  'savings delete removes transactions before the parent account'
);

select * from finish();
rollback;
