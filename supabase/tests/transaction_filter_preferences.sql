-- Structural tests for personal transaction-filter preferences.
begin;
select plan(10);

select ok(
  exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'transaction_filter_preferences'
      and c.relrowsecurity
  ),
  'transaction filter preferences has RLS'
);
select ok(
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transaction_filter_preferences'
      and column_name in ('family_id', 'user_id', 'filters')
    group by table_name
    having count(*) = 3
  ),
  'transaction filter preferences is scoped by family and user'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'transaction_filter_preferences_family_id_user_id_key'
  ),
  'one preference exists per family member'
);
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_filter_preferences'
      and policyname = 'transaction_filter_preferences_select'
      and qual ilike '%is_family_member%'
      and qual ilike '%auth.uid%'
  ),
  'preference select is family and user scoped'
);
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_filter_preferences'
      and policyname = 'transaction_filter_preferences_insert'
      and with_check ilike '%is_family_member%'
      and with_check ilike '%auth.uid%'
  ),
  'preference insert is family and user scoped'
);
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_filter_preferences'
      and policyname = 'transaction_filter_preferences_update'
      and qual ilike '%is_family_member%'
      and with_check ilike '%auth.uid%'
  ),
  'preference update is family and user scoped'
);
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_filter_preferences'
      and policyname = 'transaction_filter_preferences_delete'
      and qual ilike '%is_family_member%'
      and qual ilike '%auth.uid%'
  ),
  'preference delete is family and user scoped'
);
select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'transaction_filter_preferences_user_idx'
  ),
  'preference lookup has a user index'
);
select ok(
  not has_table_privilege('anon', 'public.transaction_filter_preferences', 'SELECT'),
  'anonymous clients cannot read preferences'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transaction_filter_preferences'::regclass),
  'preference table keeps row-level security enabled'
);

select * from finish();
rollback;
