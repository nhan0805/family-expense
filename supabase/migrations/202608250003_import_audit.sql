create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  file_name text not null,
  source_row_count integer not null check (source_row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  expected_net numeric(15,0),
  imported_net numeric(15,0),
  status text not null check (status in ('processing','completed','failed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.import_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  source_row integer not null,
  source_reference text,
  severity text not null check (severity in ('warning','error')),
  messages text[] not null,
  source_values jsonb not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index import_batches_family_idx on public.import_batches(family_id, created_at desc);
create index import_issues_batch_idx on public.import_issues(batch_id, source_row);
create unique index if not exists accounts_family_name_uidx on public.accounts(family_id, name);
create unique index if not exists events_family_name_uidx on public.events(family_id, name);
alter table public.import_batches enable row level security;
alter table public.import_issues enable row level security;

create policy import_batches_select on public.import_batches for select to authenticated
using (public.is_family_member(family_id));
create policy import_batches_insert on public.import_batches for insert to authenticated
with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy import_batches_update on public.import_batches for update to authenticated
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));
create policy import_issues_select on public.import_issues for select to authenticated
using (public.is_family_member(family_id));
create policy import_issues_insert on public.import_issues for insert to authenticated
with check (public.is_family_member(family_id));
create policy import_issues_update on public.import_issues for update to authenticated
using (public.is_family_owner(family_id))
with check (public.is_family_owner(family_id));
