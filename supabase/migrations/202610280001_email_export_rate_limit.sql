-- Bound email exports per user so a valid family member cannot exhaust the
-- provider quota by repeatedly sending the same family export.
create table if not exists public.email_export_usage_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists email_export_usage_rate_idx
  on public.email_export_usage_logs(user_id, created_at desc);

alter table public.email_export_usage_logs enable row level security;
revoke all on table public.email_export_usage_logs from public, anon, authenticated;

create or replace function public.consume_email_export_slot(p_family_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':email-export', 0));

  delete from public.email_export_usage_logs
  where user_id = auth.uid()
    and created_at < now() - interval '30 days';

  if (
    select count(*)
    from public.email_export_usage_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 hour'
  ) >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.email_export_usage_logs(family_id, user_id)
  values (p_family_id, auth.uid());
  return true;
end;
$$;

revoke all on function public.consume_email_export_slot(uuid) from public, anon;
grant execute on function public.consume_email_export_slot(uuid) to authenticated;
