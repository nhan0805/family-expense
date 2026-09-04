-- Keep embedding backfill independent from the schema where pgcrypto is installed.
-- md5(text) is provided by pg_catalog and returns the same text type used by source_hash.
create or replace function public.get_transaction_embedding_batch(
  p_family_id uuid,
  p_transaction_ids uuid[] default null,
  p_limit int default 20
) returns table(
  id uuid,
  family_id uuid,
  description text,
  note text,
  source_hash text
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'INVALID_PAGE'; end if;
  return query
    select t.id, t.family_id, t.description, t.note,
      md5(coalesce(t.description, '') || E'\n' || coalesce(t.note, ''))
    from public.transactions t
    left join public.transaction_embeddings e on e.transaction_id = t.id
    where t.family_id = p_family_id
      and t.deleted_at is null
      and (p_transaction_ids is null or t.id = any(p_transaction_ids))
      and (
        e.transaction_id is null
        or e.model <> 'gte-small'
        or e.source_hash <> md5(coalesce(t.description, '') || E'\n' || coalesce(t.note, ''))
      )
    order by t.updated_at desc, t.id
    limit p_limit;
end
$$;

revoke all on function public.get_transaction_embedding_batch(uuid,uuid[],int) from public;
grant execute on function public.get_transaction_embedding_batch(uuid,uuid[],int) to authenticated;

-- Make the new function signature visible to PostgREST immediately after migration.
select pg_notify('pgrst', 'reload schema');
