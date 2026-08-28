-- Lớp bảo vệ bất biến ở khóa ngoại: tuyệt đối không cascade giao dịch khi xóa family.
alter table public.transactions
  drop constraint if exists transactions_family_id_fkey;

alter table public.transactions
  add constraint transactions_family_id_fkey
  foreign key (family_id) references public.families(id) on delete restrict;
