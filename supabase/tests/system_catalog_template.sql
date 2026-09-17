-- Structural tests for promoting one family's active catalogs to new-family defaults.
begin;
select plan(15);

select ok(
  exists(
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'system_catalog_template_items'
      and c.relrowsecurity
  ),
  'catalog template items have RLS'
);
select ok(
  exists(
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'system_catalog_template_meta'
      and c.relrowsecurity
  ),
  'catalog template metadata has RLS'
);
select ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public'
     and table_name = 'system_catalog_template_items'
     and column_name in ('kind','catalog_key','name','name_en','color','icon','budget_enabled','sort_order')) = 8,
  'template items preserve catalog labels and display settings'
);
select ok(
  not has_table_privilege('authenticated', 'public.system_catalog_template_items', 'SELECT')
  and not has_table_privilege('authenticated', 'public.system_catalog_template_items', 'INSERT')
  and not has_table_privilege('authenticated', 'public.system_catalog_template_items', 'DELETE'),
  'clients cannot access template rows directly'
);
select ok(
  to_regprocedure('public.save_system_catalog_template(uuid)') is not null,
  'catalog template save RPC exists'
);
select ok(
  exists(select 1 from pg_proc where oid = 'public.save_system_catalog_template(uuid)'::regprocedure and prosecdef),
  'catalog template save RPC uses security definer'
);
select ok(
  pg_get_functiondef('public.save_system_catalog_template(uuid)'::regprocedure) ilike '%public.is_family_owner%'
  and pg_get_functiondef('public.save_system_catalog_template(uuid)'::regprocedure) ilike '%public.system_catalog_template_items%'
  and pg_get_functiondef('public.save_system_catalog_template(uuid)'::regprocedure) ilike '%active%',
  'save RPC checks owner and snapshots active catalogs'
);
select ok(
  not has_function_privilege('anon', 'public.save_system_catalog_template(uuid)', 'EXECUTE'),
  'anonymous clients cannot promote a catalog template'
);
select ok(
  pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%system_catalog_template_items%'
  and pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%has_template%',
  'family seeding reads the promoted catalog template'
);
select ok(
  pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%asset-savings-deposit%'
  and pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%expense-25%',
  'family seeding keeps stable asset catalog codes'
);
select ok(
  pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%Chuyển khoản%'
  and pg_get_functiondef('public.seed_family_defaults(uuid)'::regprocedure) ilike '%payment_method%',
  'family seeding keeps a payment method fallback'
);
select ok(
  pg_get_functiondef('public.seed_automatic_transaction_defaults(uuid)'::regprocedure) ilike '%expense_type_code%'
  and pg_get_functiondef('public.seed_automatic_transaction_defaults(uuid)'::regprocedure) ilike '%asset-savings-interest%',
  'automatic defaults resolve copied categories by stable code'
);
select ok(
  pg_get_functiondef('public.create_family(text)'::regprocedure) ilike '%seed_family_defaults%'
  and pg_get_functiondef('public.create_family(text)'::regprocedure) ilike '%seed_automatic_transaction_defaults%',
  'new families use catalogs before automatic mappings'
);
select ok(
  exists(select 1 from pg_constraint where conname = 'system_catalog_template_items_pkey')
  and exists(select 1 from pg_constraint where conname = 'system_catalog_template_meta_pkey'),
  'template configuration has singleton-safe keys'
);
select ok(
  not has_table_privilege('anon', 'public.system_catalog_template_meta', 'SELECT'),
  'anonymous clients cannot read template metadata directly'
);

select * from finish();
rollback;
