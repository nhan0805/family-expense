# Quy trình deploy Family Expense

Khi người dùng yêu cầu deploy:

1. Đọc mục mới nhất trong `CHANGELOG.md` và kiểm tra thay đổi đang chờ.
2. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build`.
3. Với thay đổi database, tạo migration mới và rehearsal trên staging trước; không tự ý chạy production migration khi chưa được xác nhận.
4. Commit thay đổi, push branch tính năng và mở Pull Request vào `main`.
5. Chờ CI `quality` xanh; không yêu cầu approval thủ công nếu repository policy không bật yêu cầu này.
6. Merge Pull Request vào `main` sau khi người dùng xác nhận merge.
7. Xác nhận Cloudflare Pages tự deploy production từ `main`; không dùng `cloudflare/pages-action` nếu Pages đã kết nối GitHub.
8. Kiểm tra URL production: đăng nhập, tải giao dịch, tạo giao dịch thử an toàn và các màn hình bị ảnh hưởng.
9. Báo cáo commit, CI, deployment URL và mọi bước còn cần người dùng thao tác.

Không đưa secret vào commit, không chạy migration production hoặc thao tác dữ liệu hàng loạt nếu chưa có xác nhận rõ ràng.
