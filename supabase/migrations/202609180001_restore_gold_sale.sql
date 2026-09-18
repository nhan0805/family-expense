-- Restore a mistaken gold sale as one atomic, family-scoped action. Aggregate
-- sales may have several gold_sales rows because the database preserves FIFO
-- lot history, but the user-facing action restores the whole income event.

create or replace function public.restore_gold_sale(
  p_family_id uuid,
  p_sale_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_transaction_id uuid;
  sale_row public.gold_sales%rowtype;
  restored_quantity numeric := 0;
  restored_rows integer := 0;
  deleted_transactions integer := 0;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  select gs.transaction_id
  into target_transaction_id
  from public.gold_sales as gs
  where gs.family_id = p_family_id
    and gs.id = p_sale_id
  for update;
  if not found then
    raise exception 'GOLD_SALE_NOT_FOUND';
  end if;

  for sale_row in
    select gs.*
    from public.gold_sales as gs
    where gs.family_id = p_family_id
      and (
        (target_transaction_id is not null and gs.transaction_id = target_transaction_id)
        or (target_transaction_id is null and gs.id = p_sale_id)
      )
    order by gs.gold_asset_id, gs.id
    for update
  loop
    update public.gold_assets as ga
    set remaining_quantity_chi = round(least(ga.quantity_chi, ga.remaining_quantity_chi + sale_row.quantity_chi), 3),
        status = 'active',
        archived_at = null,
        updated_at = now()
    where ga.family_id = p_family_id
      and ga.id = sale_row.gold_asset_id;
    if not found then
      raise exception 'GOLD_ASSET_NOT_FOUND';
    end if;
    restored_quantity := restored_quantity + sale_row.quantity_chi;
    restored_rows := restored_rows + 1;
  end loop;

  delete from public.gold_sales as gs
  where gs.family_id = p_family_id
    and (
      (target_transaction_id is not null and gs.transaction_id = target_transaction_id)
      or (target_transaction_id is null and gs.id = p_sale_id)
    );

  if target_transaction_id is not null then
    delete from public.transactions as t
    where t.family_id = p_family_id
      and t.id = target_transaction_id
      and t.source = 'asset';
    get diagnostics deleted_transactions = row_count;
  end if;

  return jsonb_build_object(
    'restored', restored_rows > 0,
    'quantityChi', restored_quantity,
    'transactionsDeleted', deleted_transactions
  );
end;
$$;

revoke all on function public.restore_gold_sale(uuid, uuid) from public;
grant execute on function public.restore_gold_sale(uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
