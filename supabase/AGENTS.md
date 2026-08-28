# Supabase rules

- Migration là file mới `supabase/migrations/YYYYMMDDHHMM_<name>.sql`; không sửa migration đã deploy.
- Mọi bảng dữ liệu gia đình phải có `family_id`, RLS và policy owner/member phù hợp; kiểm tra cả direct SQL lẫn RPC path.
- RPC đặc quyền dùng `security definer set search_path=''`, schema-qualify object, kiểm tra `auth.uid()`/membership/owner, rồi `REVOKE`/`GRANT` tối thiểu.
- Bảo vệ invariant bằng constraint/FK/trigger; thao tác nhiều bước phải nguyên tử. Không dùng cascade nếu có nguy cơ xóa giao dịch ngoài ý muốn.
- Soft-delete transaction là `deleted_at`; mọi query/guard phải chủ động quyết định có tính dòng đã xóa hay không.
- Trước `supabase db push`, review ảnh hưởng dữ liệu/RLS và xin phép; ghi tên migration + kết quả vào `CHANGELOG.md`.
