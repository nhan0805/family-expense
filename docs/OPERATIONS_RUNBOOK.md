# Operations runbook

## Monitoring và PII

- Chỉ ghi mã lỗi, HTTP status, latency, model và request ID; không ghi email, nội dung giao dịch, prompt, token hoặc response Gemini.
- Alert ownership: đội vận hành nhận cảnh báo đầu tiên; đội phát triển nhận lỗi ứng dụng; owner dự án quyết định escalation P1.
- P1 (đăng nhập/ghi dữ liệu lỗi diện rộng): phản hồi 15 phút, cập nhật mỗi 30 phút. P2: phản hồi trong 4 giờ.

## Synthetic smoke test

Chạy `pnpm test:e2e` định kỳ với `E2E_EMAIL`/`E2E_PASSWORD` của tài khoản test riêng, kiểm tra đăng nhập, mở giao dịch và tải dữ liệu. Không dùng tài khoản thật hoặc dữ liệu tài chính thật.

## Backup/restore drill

Mỗi quý tạo backup Supabase staging, khôi phục vào project tạm, chạy migration và smoke test, rồi ghi thời gian khôi phục (RTO) và mức mất dữ liệu (RPO). Không thử nghiệm trên production.

## Retention

Giữ audit/AI usage logs tối đa 90 ngày; dữ liệu giao dịch giữ theo chính sách chủ sở hữu gia đình. Định kỳ xoá log hết hạn bằng job được review và ghi nhận kết quả.

## PWA iOS/offline

Trên Safari iOS: Share → Add to Home Screen, mở app từ icon, đăng nhập, bật/tắt mạng và xác nhận shell hiển thị trạng thái offline. Không coi giao dịch là đã lưu nếu request chưa nhận phản hồi thành công; không cache dữ liệu tài chính.
