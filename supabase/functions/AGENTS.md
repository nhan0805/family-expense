# Edge Function rules

- Runtime là Deno/Supabase Edge; import package bằng `npm:<package>@<version>`, không dùng API Node-only.
- Các function phải giữ CORS, allowlist method (`POST`/`OPTIONS` khi phù hợp), `verify_jwt=true`, schema Zod và giới hạn input.
- Forward bearer token vào Supabase client; lấy context qua RPC có kiểm tra membership/rate limit trước khi gọi Gemini hoặc truy vấn dữ liệu.
- `parse-expense` dùng structured JSON để đề xuất một giao dịch; `search-transactions` trả bộ lọc giao dịch; `summarize-dashboard` nhận facts tổng hợp. AI chỉ đề xuất/kết luận, không trực tiếp ghi giao dịch.
- `email-transactions` chỉ cho owner gửi export được query theo user/family và gọi Brevo server-side; không để provider credential ở frontend.
- Secret chỉ đọc bằng `Deno.env.get`; log metadata tối thiểu, không log prompt, response, auth header, API key hay dữ liệu tài chính.
- Giữ error code/status ổn định (`401/403/422/429/500`); tác vụ log nền dùng `EdgeRuntime.waitUntil` và không làm hỏng response chính.
