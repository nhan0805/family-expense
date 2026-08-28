-- Bảo đảm mọi tham chiếu danh mục trong giao dịch/budget cùng family_id.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purposes_family_id_id_key') then alter table public.purposes add constraint purposes_family_id_id_key unique (family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'expense_types_family_id_id_key') then alter table public.expense_types add constraint expense_types_family_id_id_key unique (family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_methods_family_id_id_key') then alter table public.payment_methods add constraint payment_methods_family_id_id_key unique (family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'events_family_id_id_key') then alter table public.events add constraint events_family_id_id_key unique (family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'beneficiaries_family_id_id_key') then alter table public.beneficiaries add constraint beneficiaries_family_id_id_key unique (family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_family_id_id_key') then alter table public.accounts add constraint accounts_family_id_id_key unique (family_id, id); end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_purpose_same_family_fkey') then alter table public.transactions add constraint transactions_purpose_same_family_fkey foreign key (family_id, purpose_id) references public.purposes(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_expense_type_same_family_fkey') then alter table public.transactions add constraint transactions_expense_type_same_family_fkey foreign key (family_id, expense_type_id) references public.expense_types(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_payment_method_same_family_fkey') then alter table public.transactions add constraint transactions_payment_method_same_family_fkey foreign key (family_id, payment_method_id) references public.payment_methods(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_event_same_family_fkey') then alter table public.transactions add constraint transactions_event_same_family_fkey foreign key (family_id, event_id) references public.events(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_beneficiary_same_family_fkey') then alter table public.transactions add constraint transactions_beneficiary_same_family_fkey foreign key (family_id, beneficiary_id) references public.beneficiaries(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_account_same_family_fkey') then alter table public.transactions add constraint transactions_account_same_family_fkey foreign key (family_id, account_id) references public.accounts(family_id, id); end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_purpose_same_family_fkey') then alter table public.budgets add constraint budgets_purpose_same_family_fkey foreign key (family_id, purpose_id) references public.purposes(family_id, id); end if;
end $$;
