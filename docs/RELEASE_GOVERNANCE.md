# Release governance

## Môi trường

- `dev`: local Supabase hoặc project cá nhân.
- `staging`: Supabase project riêng, dùng `.env.staging` và dữ liệu test đã ẩn danh.
- `production`: Supabase/Cloudflare hiện hành; chỉ deploy từ `main` sau CI và approval.

## Migration rehearsal

1. Tạo backup/điểm khôi phục staging.
2. Chạy `scripts/migration-rehearsal.sh` theo từng bước trên staging.
3. Kiểm tra RLS, RPC, composite FK, dữ liệu mẫu và smoke flow đăng nhập/giao dịch.
4. Ghi kết quả vào pull request; ít nhất một reviewer phê duyệt.
5. Production: backup trước, chạy migration, kiểm tra health và rollback theo migration ngược/bản backup nếu thất bại.

## Secrets bắt buộc trong GitHub

`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, cùng các biến Supabase staging/production được quản lý ở Environment secrets; tuyệt đối không commit giá trị thật.
