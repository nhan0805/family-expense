# Edge Function rules

- Runtime là Deno/Supabase Edge; import package bằng `npm:<package>@<version>`, không dùng API Node-only.
- `parse-expense` chỉ nhận `POST`/`OPTIONS`; giữ CORS, `verify_jwt=true`, Zod request/response schema và giới hạn input.
- Forward bearer token vào Supabase client; lấy context qua RPC có kiểm tra membership/rate limit trước khi gọi Gemini.
- Gemini phải dùng structured JSON, validate lại ID theo catalog; AI chỉ đề xuất, không trực tiếp ghi giao dịch.
- Secret chỉ đọc bằng `Deno.env.get`; log metadata tối thiểu, không log prompt, response, auth header, API key hay dữ liệu tài chính.
- Giữ error code/status ổn định (`401/403/422/429/500`); tác vụ log nền dùng `EdgeRuntime.waitUntil` và không làm hỏng response chính.
