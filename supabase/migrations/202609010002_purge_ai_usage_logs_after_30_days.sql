-- Retain AI audit metadata for 30 days, then purge it with the existing job.
create or replace function public.purge_ai_usage_logs_after_30_days()
returns integer language plpgsql security definer set search_path = public as $$
declare purged_count integer;
begin
  delete from public.ai_usage_logs
  where created_at < (now() - interval '30 days');
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke all on function public.purge_ai_usage_logs_after_30_days() from public, anon, authenticated;

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job
    where jobname = 'purge-deleted-transactions-after-30-days';
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
  perform cron.schedule(
    'purge-deleted-transactions-after-30-days', '15 19 * * *',
    'select public.purge_deleted_transactions_after_30_days(); select public.purge_ai_usage_logs_after_30_days();'
  );
end;
$$;
