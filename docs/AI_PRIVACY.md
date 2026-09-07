# Quyền riêng tư của tính năng AI

Family Expense chỉ gửi dữ liệu cần thiết để tạo gợi ý hoặc tóm tắt; AI không tự ghi giao dịch vào database.

## Dữ liệu được gửi

- `parse-expense`: câu người dùng đang nhập và tối đa 20 mô tả giao dịch đã xác nhận gần đây, kèm tên mục đích, danh mục và phương thức thanh toán để gợi ý nhất quán. Không gửi số tiền của lịch sử.
- `search-transactions`: câu tìm kiếm và danh mục ID/tên của family để ánh xạ bộ lọc.
- `summarize-dashboard`: các số tổng hợp theo kỳ, không gửi từng giao dịch.

Mỗi Edge Function xác thực JWT, kiểm tra membership, giới hạn tần suất và kiểm tra schema trả về bằng Zod. Dữ liệu từ Gemini chỉ điền form hoặc hiển thị tóm tắt; người dùng phải xác nhận trước khi lưu giao dịch.

## Lưu trữ và log

- Gemini API key chỉ tồn tại trong Supabase Edge Function secrets.
- Log AI chỉ chứa family/user ID, model, trạng thái, latency, độ dài input và mã lỗi; không ghi prompt, email, số tiền hay nội dung giao dịch.
- Cache tóm tắt Dashboard là dữ liệu nội bộ của Edge Function; client không có quyền ghi trực tiếp.
- `ai_usage_logs` cần được retention tối đa 30 ngày theo [Operations Runbook](./OPERATIONS_RUNBOOK.md).

Nếu family không muốn gửi dữ liệu ra dịch vụ AI bên ngoài, có thể không dùng các nút AI; các luồng giao dịch thủ công, import và Dashboard cơ bản vẫn hoạt động.
