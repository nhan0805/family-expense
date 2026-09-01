-- Retain soft-deleted transactions for 30 days before permanent purge.
create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_deleted_transactions_after_30_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count integer;
begin
  -- The deleted_at predicate is intentional: active transactions must never be
  -- eligible for this maintenance job, regardless of their transaction date.
  delete from public.transactions
  where deleted_at is not null
    and deleted_at < (now() - interval '30 days');

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke all on function public.purge_deleted_transactions_after_30_days() from public;
revoke all on function public.purge_deleted_transactions_after_30_days() from anon;
revoke all on function public.purge_deleted_transactions_after_30_days() from authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'purge-deleted-transactions-after-30-days';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge-deleted-transactions-after-30-days',
    '15 19 * * *',
    'select public.purge_deleted_transactions_after_30_days();'
  );
end;
$$;
