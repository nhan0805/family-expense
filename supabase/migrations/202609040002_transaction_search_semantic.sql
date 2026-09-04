create extension if not exists vector with schema extensions;

drop function if exists public.list_family_transactions(uuid,int,int,text,text,text,uuid,uuid,uuid,int,int,date,date,text,numeric,numeric);
drop function if exists public.list_family_transactions(uuid,int,int,text,text,text,uuid,uuid,uuid,int,int,date,date,text);
drop function if exists public.list_deleted_transactions(uuid,int,int,text,text,uuid,uuid,uuid,numeric,numeric,int,int,date,date);
drop function if exists public.list_deleted_transactions(uuid,int,int,text,text,uuid,uuid,uuid,int,int,date,date);

create function public.list_family_transactions(
  p_family_id uuid,
  p_limit int default 50,
  p_offset int default 0,
  p_query text default '',
  p_transaction_type text default '',
  p_status text default '',
  p_purpose_ids uuid[] default '{}'::uuid[],
  p_expense_type_ids uuid[] default '{}'::uuid[],
  p_payment_method_ids uuid[] default '{}'::uuid[],
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date-desc',
  p_amount_min numeric default null,
  p_amount_max numeric default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGE'; end if;
  if p_sort not in ('date-desc','date-asc','amount-desc','amount-asc','description-asc') then raise exception 'INVALID_SORT'; end if;
  if p_amount_min is not null and p_amount_min < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_max is not null and p_amount_max < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_min is not null and p_amount_max is not null and p_amount_min > p_amount_max then raise exception 'INVALID_AMOUNT_FILTER'; end if;

  with base as (
    select t.*
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is null
      and (
        trim(p_query) = ''
        or extensions.unaccent(lower(t.description)) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
        or extensions.unaccent(lower(coalesce(t.note, ''))) like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
      )
      and (p_transaction_type = '' or t.transaction_type::text = p_transaction_type)
      and (p_status = '' or t.status::text = p_status)
      and (cardinality(coalesce(p_purpose_ids, '{}'::uuid[])) = 0 or t.purpose_id = any(p_purpose_ids))
      and (cardinality(coalesce(p_expense_type_ids, '{}'::uuid[])) = 0 or t.expense_type_id = any(p_expense_type_ids))
      and (cardinality(coalesce(p_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id = any(p_payment_method_ids))
      and (p_amount_min is null or t.amount >= p_amount_min)
      and (p_amount_max is null or t.amount <= p_amount_max)
      and (p_month is null or extract(month from t.transaction_date)::int = p_month)
      and (p_year is null or extract(year from t.transaction_date)::int = p_year)
      and (p_date_from is null or t.transaction_date >= p_date_from)
      and (p_date_to is null or t.transaction_date <= p_date_to)
  ), filtered as (
    select * from base t
    order by
      case when p_sort = 'date-desc' then t.transaction_date end desc,
      case when p_sort = 'date-desc' then t.created_at end desc,
      case when p_sort = 'date-asc' then t.transaction_date end asc,
      case when p_sort = 'date-asc' then t.created_at end asc,
      case when p_sort = 'amount-desc' then t.amount end desc,
      case when p_sort = 'amount-asc' then t.amount end asc,
      case when p_sort = 'description-asc' then lower(t.description) end asc,
      t.id
    limit p_limit + 1 offset p_offset
  ), page as (
    select * from filtered limit p_limit
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from page p), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from filtered),
    'totalAmount', coalesce((
      select sum(case when b.transaction_type = 'Thu nhập' then -b.amount else b.amount end)
      from base b
    ), 0),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.list_family_transactions(uuid,int,int,text,text,text,uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) from public;
grant execute on function public.list_family_transactions(uuid,int,int,text,text,text,uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) to authenticated;

create function public.list_deleted_transactions(
  p_family_id uuid,
  p_limit int default 50,
  p_offset int default 0,
  p_query text default '',
  p_transaction_type text default '',
  p_purpose_ids uuid[] default '{}'::uuid[],
  p_expense_type_ids uuid[] default '{}'::uuid[],
  p_payment_method_ids uuid[] default '{}'::uuid[],
  p_amount_min numeric default null,
  p_amount_max numeric default null,
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGE'; end if;
  if p_amount_min is not null and p_amount_min < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_max is not null and p_amount_max < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_min is not null and p_amount_max is not null and p_amount_min > p_amount_max then raise exception 'INVALID_AMOUNT_FILTER'; end if;

  with base as (
    select t.*
    from public.transactions t
    where t.family_id = p_family_id
      and t.deleted_at is not null
      and (public.is_family_owner(p_family_id) or t.created_by = auth.uid())
      and (trim(p_query) = '' or extensions.unaccent(lower(t.description)) like '%' || extensions.unaccent(lower(trim(p_query))) || '%' or extensions.unaccent(lower(coalesce(t.note, ''))) like '%' || extensions.unaccent(lower(trim(p_query))) || '%')
      and (p_transaction_type = '' or t.transaction_type::text = p_transaction_type)
      and (cardinality(coalesce(p_purpose_ids, '{}'::uuid[])) = 0 or t.purpose_id = any(p_purpose_ids))
      and (cardinality(coalesce(p_expense_type_ids, '{}'::uuid[])) = 0 or t.expense_type_id = any(p_expense_type_ids))
      and (cardinality(coalesce(p_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id = any(p_payment_method_ids))
      and (p_amount_min is null or t.amount >= p_amount_min)
      and (p_amount_max is null or t.amount <= p_amount_max)
      and (p_month is null or extract(month from t.transaction_date)::int = p_month)
      and (p_year is null or extract(year from t.transaction_date)::int = p_year)
      and (p_date_from is null or t.transaction_date >= p_date_from)
      and (p_date_to is null or t.transaction_date <= p_date_to)
  ), filtered as (
    select * from base order by deleted_at desc, id limit p_limit + 1 offset p_offset
  ), page as (
    select * from filtered limit p_limit
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from page p), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from filtered),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.list_deleted_transactions(uuid,int,int,text,text,uuid[],uuid[],uuid[],numeric,numeric,int,int,date,date) from public;
grant execute on function public.list_deleted_transactions(uuid,int,int,text,text,uuid[],uuid[],uuid[],numeric,numeric,int,int,date,date) to authenticated;

create table if not exists public.transaction_embeddings(
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  embedding extensions.vector(384) not null,
  model text not null default 'gte-small',
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(family_id, transaction_id)
);

create index if not exists transaction_embeddings_family_idx
  on public.transaction_embeddings(family_id, transaction_id);

create index if not exists transaction_embeddings_embedding_hnsw_idx
  on public.transaction_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.transaction_embeddings enable row level security;
revoke all on public.transaction_embeddings from public;
revoke all on public.transaction_embeddings from authenticated;

drop policy if exists transaction_embeddings_select on public.transaction_embeddings;
drop policy if exists transaction_embeddings_insert on public.transaction_embeddings;
drop policy if exists transaction_embeddings_update on public.transaction_embeddings;
drop policy if exists transaction_embeddings_delete on public.transaction_embeddings;
create policy transaction_embeddings_select on public.transaction_embeddings
  for select to authenticated using (public.is_family_member(family_id));
create policy transaction_embeddings_insert on public.transaction_embeddings
  for insert to authenticated with check (public.is_family_member(family_id));
create policy transaction_embeddings_update on public.transaction_embeddings
  for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy transaction_embeddings_delete on public.transaction_embeddings
  for delete to authenticated using (public.is_family_member(family_id));

create or replace function public.upsert_transaction_embedding(
  p_family_id uuid,
  p_transaction_id uuid,
  p_embedding extensions.vector(384),
  p_model text,
  p_source_hash text
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1
    from public.transactions t
    where t.id = p_transaction_id
      and t.family_id = p_family_id
      and t.deleted_at is null
  ) then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  insert into public.transaction_embeddings(
    transaction_id, family_id, embedding, model, source_hash, updated_at
  ) values (
    p_transaction_id, p_family_id, p_embedding, p_model, p_source_hash, now()
  )
  on conflict (transaction_id) do update set
    family_id = excluded.family_id,
    embedding = excluded.embedding,
    model = excluded.model,
    source_hash = excluded.source_hash,
    updated_at = now();
end
$$;

revoke all on function public.upsert_transaction_embedding(uuid,uuid,extensions.vector,text,text) from public;
grant execute on function public.upsert_transaction_embedding(uuid,uuid,extensions.vector,text,text) to authenticated;

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
      encode(public.digest(coalesce(t.description, '') || E'\n' || coalesce(t.note, ''), 'sha256'), 'hex')
    from public.transactions t
    left join public.transaction_embeddings e on e.transaction_id = t.id
    where t.family_id = p_family_id
      and t.deleted_at is null
      and (p_transaction_ids is null or t.id = any(p_transaction_ids))
      and (
        e.transaction_id is null
        or e.model <> 'gte-small'
        or e.source_hash <> encode(public.digest(coalesce(t.description, '') || E'\n' || coalesce(t.note, ''), 'sha256'), 'hex')
      )
    order by t.updated_at desc, t.id
    limit p_limit;
end
$$;

revoke all on function public.get_transaction_embedding_batch(uuid,uuid[],int) from public;
grant execute on function public.get_transaction_embedding_batch(uuid,uuid[],int) to authenticated;

create or replace function public.search_family_transactions_semantic(
  p_family_id uuid,
  p_query_embedding extensions.vector(384),
  p_limit int default 50,
  p_offset int default 0,
  p_keyword text default '',
  p_transaction_type text default '',
  p_status text default '',
  p_purpose_ids uuid[] default '{}'::uuid[],
  p_expense_type_ids uuid[] default '{}'::uuid[],
  p_payment_method_ids uuid[] default '{}'::uuid[],
  p_month int default null,
  p_year int default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date-desc',
  p_amount_min numeric default null,
  p_amount_max numeric default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGE'; end if;
  if p_sort not in ('date-desc','date-asc','amount-desc','amount-asc','description-asc') then raise exception 'INVALID_SORT'; end if;
  if p_amount_min is not null and p_amount_min < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_max is not null and p_amount_max < 0 then raise exception 'INVALID_AMOUNT_FILTER'; end if;
  if p_amount_min is not null and p_amount_max is not null and p_amount_min > p_amount_max then raise exception 'INVALID_AMOUNT_FILTER'; end if;

  with base as (
    select
      t.*,
      1 - (e.embedding <=> p_query_embedding) + case
        when trim(p_keyword) <> '' and (
          extensions.unaccent(lower(t.description)) like '%' || extensions.unaccent(lower(trim(p_keyword))) || '%'
          or extensions.unaccent(lower(coalesce(t.note, ''))) like '%' || extensions.unaccent(lower(trim(p_keyword))) || '%'
        ) then 0.08
        else 0
      end as similarity
    from public.transactions t
    join public.transaction_embeddings e on e.transaction_id = t.id and e.family_id = t.family_id
    where t.family_id = p_family_id
      and t.deleted_at is null
      and (p_transaction_type = '' or t.transaction_type::text = p_transaction_type)
      and (p_status = '' or t.status::text = p_status)
      and (cardinality(coalesce(p_purpose_ids, '{}'::uuid[])) = 0 or t.purpose_id = any(p_purpose_ids))
      and (cardinality(coalesce(p_expense_type_ids, '{}'::uuid[])) = 0 or t.expense_type_id = any(p_expense_type_ids))
      and (cardinality(coalesce(p_payment_method_ids, '{}'::uuid[])) = 0 or t.payment_method_id = any(p_payment_method_ids))
      and (p_amount_min is null or t.amount >= p_amount_min)
      and (p_amount_max is null or t.amount <= p_amount_max)
      and (p_month is null or extract(month from t.transaction_date)::int = p_month)
      and (p_year is null or extract(year from t.transaction_date)::int = p_year)
      and (p_date_from is null or t.transaction_date >= p_date_from)
      and (p_date_to is null or t.transaction_date <= p_date_to)
  ), filtered as (
    select * from base t
    order by
      t.similarity desc,
      case when p_sort = 'date-desc' then t.transaction_date end desc,
      case when p_sort = 'date-desc' then t.created_at end desc,
      case when p_sort = 'date-asc' then t.transaction_date end asc,
      case when p_sort = 'date-asc' then t.created_at end asc,
      case when p_sort = 'amount-desc' then t.amount end desc,
      case when p_sort = 'amount-asc' then t.amount end asc,
      case when p_sort = 'description-asc' then lower(t.description) end asc,
      t.id
    limit p_limit + 1 offset p_offset
  ), page as (
    select * from filtered limit p_limit
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from page p), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from filtered),
    'totalAmount', coalesce((
      select sum(case when b.transaction_type = 'Thu nhập' then -b.amount else b.amount end)
      from base b
    ), 0),
    'totalCount', (select count(*) from base)
  ) into result;
  return result;
end
$$;

revoke all on function public.search_family_transactions_semantic(uuid,extensions.vector,int,int,text,text,text,uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) from public;
grant execute on function public.search_family_transactions_semantic(uuid,extensions.vector,int,int,text,text,text,uuid[],uuid[],uuid[],int,int,date,date,text,numeric,numeric) to authenticated;
