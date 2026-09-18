-- Structural regression coverage for family deletion with asset-linked
-- soft-deleted transactions.
begin;
select plan(8);

select has_function(
  'public',
  'delete_empty_family',
  array['uuid'],
  'family deletion RPC exists'
);
select ok(
  exists(
    select 1
    from pg_proc
    where oid = 'public.delete_empty_family(uuid)'::regprocedure
      and prosecdef
  ),
  'family deletion RPC uses security definer'
);
select ok(
  pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%public.is_family_owner%',
  'family deletion RPC checks owner access'
);
select ok(
  pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%family_has_active_transactions%',
  'family deletion RPC blocks active transactions'
);
select ok(
  pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%update public.savings_movements%'
    and pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%set transaction_id = null%',
  'family deletion clears savings transaction links first'
);
select ok(
  pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%update public.gold_assets%'
    and pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%update public.gold_sales%',
  'family deletion clears gold transaction links first'
);
select ok(
  pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%delete from public.transactions%'
    and pg_get_functiondef('public.delete_empty_family(uuid)'::regprocedure) ilike '%deleted_at is not null%',
  'family deletion only hard-deletes soft-deleted transactions'
);
select ok(
  not has_table_privilege('authenticated', 'public.families', 'DELETE'),
  'authenticated clients cannot delete families directly'
);

select * from finish();
rollback;
