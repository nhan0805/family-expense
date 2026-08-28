do $$
declare
  affected_rows bigint;
  min_date date;
  max_date date;
  updated_rows bigint;
begin
  select count(*), min(t.transaction_date), max(t.transaction_date)
  into affected_rows, min_date, max_date
  from public.transactions t
  where t.source = 'excel_import'
    and t.source_reference is not null
    and t.source_reference not like 'template:%';

  if affected_rows <> 2083
    or min_date <> date '2023-12-31'
    or max_date <> date '2027-02-28'
  then
    raise exception
      'LEGACY_IMPORT_SCOPE_CHANGED: expected 2083 rows from 2023-12-31 to 2027-02-28, got % rows from % to %',
      affected_rows,
      min_date,
      max_date;
  end if;

  update public.transactions t
  set transaction_date = t.transaction_date + 1
  where t.source = 'excel_import'
    and t.source_reference is not null
    and t.source_reference not like 'template:%';

  get diagnostics updated_rows = row_count;

  if updated_rows <> affected_rows then
    raise exception
      'LEGACY_IMPORT_UPDATE_INCOMPLETE: expected % rows, updated %',
      affected_rows,
      updated_rows;
  end if;

  raise notice 'SHIFTED_LEGACY_IMPORT_DATES: % rows', updated_rows;
end
$$;
