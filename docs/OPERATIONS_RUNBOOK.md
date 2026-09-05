# Operations runbook

## Monitoring và PII

- Chỉ ghi mã lỗi, HTTP status, latency, model và request ID; không ghi email, nội dung giao dịch, prompt, token hoặc response Gemini.
- Alert ownership: đội vận hành nhận cảnh báo đầu tiên; đội phát triển nhận lỗi ứng dụng; owner dự án quyết định escalation P1.
- P1 (đăng nhập/ghi dữ liệu lỗi diện rộng): phản hồi 15 phút, cập nhật mỗi 30 phút. P2: phản hồi trong 4 giờ.
- Client runtime errors dùng `VITE_ERROR_REPORTING_ENDPOINT` tùy chọn; payload chỉ có mã lỗi, route, trạng thái online và thời điểm. Khi endpoint chưa cấu hình, app không gửi telemetry. Trước khi bật production, kiểm tra rate limit, retention và alert routing trên staging.

## Synthetic smoke test

Chạy `pnpm test:e2e` định kỳ với `E2E_EMAIL`/`E2E_PASSWORD` của tài khoản test riêng, kiểm tra đăng nhập, mở giao dịch và tải dữ liệu. Không dùng tài khoản thật hoặc dữ liệu tài chính thật.

## Backup/restore drill

Mỗi quý chạy drill trên dữ liệu staging đã ẩn danh, khôi phục vào một database/project tạm đã áp dụng cùng migrations, chạy kiểm tra DB/RLS và smoke test, rồi ghi RTO/RPO. Không thử nghiệm trên production và không restore vào target có dữ liệu cần giữ.

Script tự kiểm tra target khác source, yêu cầu xác nhận rõ ràng và không tự xóa schema/data target. Cần chuẩn bị `psql`, Supabase CLI, `STAGING_DB_URL`, `RESTORE_DB_URL` và quyền đọc source/ghi target:

```bash
CONFIRM_STAGING_RESTORE=YES \
STAGING_DB_URL='<staging-db-url>' \
RESTORE_DB_URL='<empty-restore-db-url>' \
BACKUP_DIR='./artifacts/backup-drill-YYYY-MM-DD' \
scripts/staging-backup-restore.sh
```

Nếu không đặt `BACKUP_DIR`, file dump chỉ tồn tại trong thư mục tạm và bị xóa sau khi xác minh. Script đối chiếu số dòng giao dịch chưa xóa, chạy lại pgTAP DB/RLS tests trên target và in RTO; RPO được ghi nhận tại thời điểm tạo dump. Sau đó chạy smoke test ứng dụng bằng tài khoản test riêng và lưu kết quả vào ticket/runbook. Không in URL chứa mật khẩu vào log.

Target phải là project/database tạm đã áp dụng migrations và có sẵn các auth fixture tương ứng với dữ liệu staging (các khóa ngoại public trỏ tới `auth.users`). Script sẽ dừng trước khi restore nếu target đã có family hoặc transaction.

## Retention

Giữ audit/AI usage logs tối đa 30 ngày; dữ liệu giao dịch giữ theo chính sách chủ sở hữu gia đình. Định kỳ xoá log hết hạn bằng job được review và ghi nhận kết quả.

## PWA iOS/offline

Trên Safari iOS: Share → Add to Home Screen, mở app từ icon, đăng nhập, bật/tắt mạng và xác nhận shell hiển thị trạng thái offline. Không coi giao dịch là đã lưu nếu request chưa nhận phản hồi thành công; không cache dữ liệu tài chính.
