-- The legacy Hoàn tiền/Tạm ứng transaction kinds were removed and normalized
-- to Thu nhập/Chi tiêu in 202609010004. Restore the asset summary RPC so it
-- only compares values that exist in public.transaction_kind.
create or replace function public.get_asset_summary(p_family_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  gold_buyback_price numeric;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select f.gold_buyback_price_per_chi
  into gold_buyback_price
  from public.families f
  where f.id = p_family_id;

  select jsonb_build_object(
    'netCash', coalesce((select sum(case when t.transaction_type = 'Thu nhập' then t.amount when t.transaction_type = 'Chi tiêu' then -t.amount else 0 end) from public.transactions t where t.family_id = p_family_id and t.status = 'Thực tế' and t.deleted_at is null), 0),
    'savingsTotal', coalesce((select sum(sa.current_balance) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'), 0),
    'goldEstimatedTotal', coalesce((select sum(ga.remaining_quantity_chi * coalesce(gold_buyback_price, 0)) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldCost', coalesce((select sum(ga.remaining_quantity_chi * ga.purchase_price_per_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'goldQuantityChi', coalesce((select sum(ga.remaining_quantity_chi) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), 0),
    'savingsCount', (select count(*) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'),
    'goldCount', (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'),
    'goldMissingEstimateCount', case when gold_buyback_price is null then (select count(*) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active') else 0 end,
    'goldBuybackPricePerChi', gold_buyback_price,
    'savings', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sa.id, 'family_id', sa.family_id, 'bank_name', sa.bank_name, 'name', sa.name,
      'principal', sa.principal, 'current_balance', sa.current_balance,
      'annual_interest_rate', sa.annual_interest_rate, 'term_months', sa.term_months,
      'opened_on', sa.opened_on, 'maturity_on', sa.maturity_on,
      'interest_method', sa.interest_method, 'status', sa.status, 'note', sa.note,
      'created_by', sa.created_by, 'updated_by', sa.updated_by, 'created_at', sa.created_at,
      'updated_at', sa.updated_at, 'closed_at', sa.closed_at, 'archived_at', sa.archived_at
    ) order by sa.maturity_on) from public.savings_accounts sa where sa.family_id = p_family_id and sa.status <> 'archived'), '[]'::jsonb),
    'gold', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ga.id, 'family_id', ga.family_id, 'purchase_date', ga.purchase_date,
      'quantity_chi', ga.quantity_chi, 'remaining_quantity_chi', ga.remaining_quantity_chi,
      'purchase_price_per_chi', ga.purchase_price_per_chi, 'estimated_sell_price_per_chi', gold_buyback_price,
      'status', ga.status, 'transaction_id', ga.transaction_id, 'note', ga.note,
      'created_by', ga.created_by, 'created_at', ga.created_at, 'updated_at', ga.updated_at, 'archived_at', ga.archived_at
    ) order by ga.purchase_date desc) from public.gold_assets ga where ga.family_id = p_family_id and ga.status = 'active'), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_asset_summary(uuid) from public;
grant execute on function public.get_asset_summary(uuid) to authenticated;
