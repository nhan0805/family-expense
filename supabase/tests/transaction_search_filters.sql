-- Structural tests for multi-select transaction filters and semantic cleanup.
begin;
select plan(6);

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
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'transaction_embeddings'
  ),
  'transaction_embeddings has been removed'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'search_family_transactions_semantic'
  ),
  'semantic search RPC has been removed'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_transaction_embedding_batch',
        'upsert_transaction_embedding'
      )
  ),
  'embedding RPCs have been removed'
);
select ok(
  not exists (
    select 1
    from pg_extension
    where extname = 'vector'
  ),
  'pgvector extension has been removed'
);

select * from finish();
rollback;
