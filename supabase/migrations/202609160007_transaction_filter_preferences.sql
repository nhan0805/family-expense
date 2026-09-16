-- Store one personal default transaction-filter preset per family member.
create table public.transaction_filter_preferences(
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filters jsonb not null check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(family_id, user_id)
);

create index transaction_filter_preferences_user_idx
  on public.transaction_filter_preferences(user_id, family_id);

create trigger transaction_filter_preferences_touch
before update on public.transaction_filter_preferences
for each row execute function public.touch_updated_at();

alter table public.transaction_filter_preferences enable row level security;

revoke all on table public.transaction_filter_preferences from anon, public;

create policy transaction_filter_preferences_select
  on public.transaction_filter_preferences for select to authenticated
  using (public.is_family_member(family_id) and user_id = auth.uid());

create policy transaction_filter_preferences_insert
  on public.transaction_filter_preferences for insert to authenticated
  with check (public.is_family_member(family_id) and user_id = auth.uid());

create policy transaction_filter_preferences_update
  on public.transaction_filter_preferences for update to authenticated
  using (public.is_family_member(family_id) and user_id = auth.uid())
  with check (public.is_family_member(family_id) and user_id = auth.uid());

create policy transaction_filter_preferences_delete
  on public.transaction_filter_preferences for delete to authenticated
  using (public.is_family_member(family_id) and user_id = auth.uid());

grant select, insert, update, delete
on table public.transaction_filter_preferences to authenticated;
