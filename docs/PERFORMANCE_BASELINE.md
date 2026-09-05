# Baseline hiệu năng Family Expense

Tài liệu này là mẫu đo chung cho từng đợt release. Số đo phải lấy trên staging với dữ liệu ẩn danh, cùng thiết bị và cùng tài khoản test để có thể so sánh trước/sau.

## Các luồng cần đo

| Luồng | Số đo | Mục tiêu sau tối ưu |
| --- | --- | --- |
| Mở Dashboard sau đăng nhập | FCP, LCP, CLS, thời gian phản hồi truy vấn dashboard | LCP ≤ 2,5 giây, CLS ≤ 0,1; không phát sinh nhiều request giống nhau |
| Dashboard với 1.000 / 10.000 giao dịch | thời gian tải dữ liệu, dung lượng response, thời gian render biểu đồ | Không tải các cột không dùng; thời gian render không tăng tuyến tính theo số danh mục |
| Mở Giao dịch và cuộn danh sách | thời gian tới nội dung đầu tiên, số request mỗi trang, FPS khi cuộn | Trang đầu ≤ 2 giây; mỗi lần cuộn chỉ tải một trang |
| Import 100 / 1.000 dòng | thời gian parse, thời gian ghi, bộ nhớ đỉnh, số dòng trùng | Từ chối file >10 MB hoặc >1.000 dòng; không có truy vấn kiểm tra trùng lặp theo từng dòng |
| Tạo giao dịch định kỳ đến hạn | thời gian RPC, số lần chạy lặp | Chạy lặp không tạo bản ghi trùng; kỳ đã bỏ qua không được tạo lại |

## Cách lấy số đo

1. Dùng tài khoản staging riêng và bật cache sạch cho lần đo cold load; đo thêm một lần warm load.
2. Ghi thời điểm commit, trình duyệt, thiết bị, số giao dịch và kết quả vào ticket release. Không ghi email, nội dung giao dịch hay token.
3. Với Dashboard và Import, lấy thêm kích thước response từ Network và thời gian main thread từ Performance panel.
4. So sánh với commit trước. Nếu một chỉ số tăng hơn 20%, dừng mở rộng tối ưu SQL/danh sách dài và điều tra trước.

## Chuẩn bị theo dõi lỗi

Frontend có `src/lib/telemetry.ts`. Khi đặt `VITE_ERROR_REPORTING_ENDPOINT` ở môi trường deploy, app chỉ gửi mã lỗi, route, trạng thái online và thời điểm; không gửi message, stack, email hay dữ liệu tài chính. Khi chưa đặt biến này, bộ theo dõi không gọi mạng.

Trước khi bật production, endpoint phải có rate limit, retention và alert ownership theo [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md). Smoke test cần tạo một lỗi có chủ đích trên staging để xác nhận alert đi tới đúng nơi.

## Baseline hiện tại

Các số đo thực tế của staging chưa được ghi trong workspace này. Việc cần làm đầu đợt 1 là chạy đủ bảng trên, lưu commit và fixture, sau đó cập nhật ticket/release; không dùng số đo suy đoán làm tiêu chí go/no-go.
