-- Structural tests for multi-select filters and semantic transaction search.
begin;
select plan(9);

select ok(
  exists (
    select 1
    from pg_extension
    where extname = 'vector'
  ),
  'pgvector is enabled'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'transaction_embeddings'
      and c.relkind = 'r'
      and c.relrowsecurity
  ),
  'transaction_embeddings has RLS'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transaction_embeddings'
      and indexname = 'transaction_embeddings_embedding_hnsw_idx'
      and indexdef ilike '%using hnsw%vector_cosine_ops%'
  ),
  'transaction_embeddings has a cosine HNSW index'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_family_transactions'
      and p.proargtypes[6] = 'uuid[]'::regtype
      and p.proargtypes[7] = 'uuid[]'::regtype
      and p.proargtypes[8] = 'uuid[]'::regtype
  ),
  'list_family_transactions accepts array catalog filters'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_deleted_transactions'
      and p.proargtypes[5] = 'uuid[]'::regtype
      and p.proargtypes[6] = 'uuid[]'::regtype
      and p.proargtypes[7] = 'uuid[]'::regtype
  ),
  'list_deleted_transactions accepts array catalog filters'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'search_family_transactions_semantic'
      and p.prosecdef
      and p.proargtypes[1] = 'extensions.vector'::regtype
  ),
  'semantic search RPC is security definer and accepts a vector'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_transaction_embedding'
      and p.prosecdef
      and p.proargtypes[2] = 'extensions.vector'::regtype
  ),
  'embedding writes go through a security definer RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.transaction_embeddings', 'insert'),
  'authenticated clients cannot insert embeddings directly'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_embeddings'
      and policyname = 'transaction_embeddings_select'
  ),
  'transaction_embeddings keeps a family-scoped select policy'
);

select * from finish();
rollback;
