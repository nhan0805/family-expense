-- The active catalog setup is now a system migration concern, not a user-facing
-- action. Promote the most complete existing family once so new-family
-- onboarding uses the catalog set already configured in production.
do $$
declare
  source_family_id uuid;
  source_owner_id uuid;
begin
  if not exists (
    select 1 from public.system_catalog_template_items limit 1
  ) then
    select ranked.id, ranked.created_by
    into source_family_id, source_owner_id
    from (
      select
        f.id,
        f.created_by,
        f.created_at,
        count(distinct p.id) filter (where p.active) as purpose_count,
        count(distinct e.id) filter (where e.active) as expense_type_count,
        count(distinct pm.id) filter (where pm.active) as payment_method_count
      from public.families f
      left join public.purposes p on p.family_id = f.id
      left join public.expense_types e on e.family_id = f.id
      left join public.payment_methods pm on pm.family_id = f.id
      group by f.id, f.created_by, f.created_at
    ) ranked
    where ranked.purpose_count > 0
      and ranked.expense_type_count > 0
      and ranked.payment_method_count > 0
    order by
      ranked.purpose_count + ranked.expense_type_count + ranked.payment_method_count desc,
      ranked.created_at desc,
      ranked.id
    limit 1;

    if source_family_id is not null then
      insert into public.system_catalog_template_items(
        kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
      )
      select
        'purpose', p.code, p.name, p.name_en, p.color, p.icon,
        coalesce(p.budget_enabled, true), p.sort_order
      from public.purposes p
      where p.family_id = source_family_id and p.active
      on conflict (kind, catalog_key) do nothing;

      insert into public.system_catalog_template_items(
        kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
      )
      select
        'expense_type', e.code, e.name, e.name_en, null, e.icon, true, e.sort_order
      from public.expense_types e
      where e.family_id = source_family_id and e.active
      on conflict (kind, catalog_key) do nothing;

      insert into public.system_catalog_template_items(
        kind, catalog_key, name, name_en, color, icon, budget_enabled, sort_order
      )
      select
        'payment_method', 'payment-' || md5(pm.name), pm.name, pm.name_en,
        null, pm.icon, true, pm.sort_order
      from public.payment_methods pm
      where pm.family_id = source_family_id and pm.active
      on conflict (kind, catalog_key) do nothing;

      insert into public.system_catalog_template_meta(
        singleton, source_family_id, updated_by, updated_at
      ) values (true, source_family_id, source_owner_id, now())
      on conflict (singleton) do update
      set source_family_id = excluded.source_family_id,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
    end if;
  end if;
end;
$$;

-- No browser action should be able to replace the system template anymore.
-- The tables remain internal inputs for seed_family_defaults.
revoke all on function public.save_system_catalog_template(uuid) from anon, authenticated, public;
drop function if exists public.save_system_catalog_template(uuid);

select pg_notify('pgrst', 'reload schema');
