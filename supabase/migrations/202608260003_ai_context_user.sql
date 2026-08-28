create or replace function public.get_ai_request_context(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  if (
    select count(*)
    from public.ai_usage_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 minute'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  select jsonb_build_object(
    'userId', auth.uid(),
    'purposes', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
      from public.purposes
      where family_id = p_family_id and active = true
    ), '[]'::jsonb),
    'expenseTypes', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
      from public.expense_types
      where family_id = p_family_id and active = true
    ), '[]'::jsonb),
    'paymentMethods', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
      from public.payment_methods
      where family_id = p_family_id and active = true
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_ai_request_context(uuid) from public;
grant execute on function public.get_ai_request_context(uuid) to authenticated, service_role;
