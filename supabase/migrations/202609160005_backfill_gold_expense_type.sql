-- The asset migration backfilled savings categories for existing families but
-- assumed that the older default seed had already created the gold category.
-- Ensure every family has an active category for linked gold transactions.

update public.expense_types
set active = true,
    name_en = coalesce(name_en, 'Gold investments'),
    icon = coalesce(icon, 'coins')
where name = 'Đầu tư vàng'
  and not active;

insert into public.expense_types(
  family_id, name, name_en, code, icon, sort_order, active
)
select
  f.id, 'Đầu tư vàng', 'Gold investments', 'asset-gold-investment', 'coins', 25, true
from public.families f
where not exists (
  select 1
  from public.expense_types e
  where e.family_id = f.id
    and e.name = 'Đầu tư vàng'
    and e.active
)
on conflict (family_id, code) do nothing;
