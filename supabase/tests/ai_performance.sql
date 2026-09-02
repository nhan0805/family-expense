begin;
select plan(6);

select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ai_request_context_cache' and c.relrowsecurity
  ),
  'AI context cache bật RLS'
);
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ai_summary_cache' and c.relrowsecurity
  ),
  'AI summary cache bật RLS'
);
select has_function(
  'public', 'get_ai_dashboard_facts', array['uuid', 'date', 'date'],
  'Dashboard AI facts dùng aggregate RPC'
);
select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname = 'ai_context_cache_purpose_invalidate'
  ),
  'Catalog thay đổi sẽ invalidates AI context cache'
);
select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname = 'ai_summary_cache_transaction_invalidate'
  ),
  'Transaction thay đổi sẽ invalidates AI summary cache'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_ai_request_context' and p.prosecdef
  ),
  'AI context RPC chạy với security definer'
);

select * from finish();
rollback;
