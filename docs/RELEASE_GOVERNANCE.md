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

Các secret/variable Supabase staging/production được quản lý ở GitHub Environments; tuyệt đối không commit giá trị thật. Cloudflare production hiện dùng Pages Git integration nên không cần đưa Cloudflare API token/account ID vào workflow của repository. Nếu sau này đổi sang Cloudflare API deployment, phải cập nhật runbook và thiết kế secret riêng trước khi triển khai.
