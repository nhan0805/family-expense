-- Semantic search is no longer part of the product search flow.
-- Remove only the objects introduced for embeddings; the normal transaction
-- listing RPCs from the same migration remain in use.
drop function if exists public.search_family_transactions_semantic(
  uuid,
  extensions.vector,
  int,
  int,
  text,
  text,
  text,
  uuid[],
  uuid[],
  uuid[],
  int,
  int,
  date,
  date,
  text,
  numeric,
  numeric
);

drop function if exists public.get_transaction_embedding_batch(uuid, uuid[], int);
drop function if exists public.upsert_transaction_embedding(
  uuid,
  uuid,
  extensions.vector,
  text,
  text
);
drop table if exists public.transaction_embeddings;

-- The extension was introduced solely for the removed embedding objects.
drop extension if exists vector;

select pg_notify('pgrst', 'reload schema');
