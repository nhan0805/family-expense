# Quy trình deploy Family Expense

Khi người dùng yêu cầu deploy:

1. Đọc mục mới nhất trong `CHANGELOG.md` và kiểm tra thay đổi đang chờ.
2. Kiểm tra working tree và xác định phạm vi code, migration, Edge Function và tài liệu bị ảnh hưởng.
3. Chạy `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` và `git diff --check`; thêm E2E/DB tests khi phạm vi yêu cầu.
4. Ghi tóm tắt release trong PR. Cập nhật `CHANGELOG.md` và `HANDOFF.md` trong một release/status PR đã đồng bộ với `main`; không để bản tài liệu latest chỉ ở local và không để nhiều feature branch cùng sửa hai file này.
5. Với thay đổi database, tạo migration mới và rehearsal trên staging trước; không tự ý chạy production migration khi chưa được xác nhận.
6. Commit thay đổi, push branch tính năng và mở Pull Request vào `main`.
7. Trước khi bật auto-merge, chạy `git fetch origin` và đồng bộ branch với `origin/main`. Nếu repository bật Merge Queue, để queue kiểm tra PR trên base mới nhất; CI phải lắng nghe event `merge_group`.
8. Sau khi merge, xác nhận Supabase workflow áp dụng migration/function nếu có và Cloudflare Pages tự deploy production từ merge commit; không dùng `cloudflare/pages-action` hoặc Wrangler khi Pages đã kết nối GitHub.
9. Kiểm tra URL production: smoke test, đăng nhập bằng tài khoản test phù hợp, tải giao dịch và các màn hình bị ảnh hưởng. Không tạo mutation thử trên production nếu không có kế hoạch an toàn.
10. Cập nhật trạng thái hậu triển khai và báo cáo commit, PR, CI, deployment URL cùng mọi bước còn cần người dùng thao tác.

Không đưa secret vào commit, không chạy migration production hoặc thao tác dữ liệu hàng loạt nếu chưa có xác nhận rõ ràng.
