# Family Expense

> Trước khi thay đổi project, đọc `AGENTS.md` và mục mới nhất trong `CHANGELOG.md`. Mọi thay đổi phải được ghi vào changelog trong cùng lượt làm việc.

Web app quản lý chi tiêu gia đình bằng tiếng Việt, mobile-first, có PWA và luồng nhập giao dịch bằng Gemini. AI chỉ điền đề xuất vào form; người dùng luôn phải kiểm tra và bấm **Xác nhận và lưu**.

## Kiến trúc

- Frontend: React 19, TypeScript strict, Vite, React Router, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts và vite-plugin-pwa.
- Backend: Supabase Cloud (PostgreSQL, Auth, RLS, Edge Functions). Storage đã sẵn sàng để bổ sung chứng từ sau MVP nhưng hiện chưa dùng.
- AI: Supabase Edge Functions `parse-expense`, `summarize-dashboard` và `search-transactions` gọi Gemini GenerateContent qua HTTP, dùng JSON Schema structured output; gợi ý danh mục tham khảo lịch sử cùng family, Dashboard chỉ gửi số liệu tổng hợp, và tìm kiếm AI chỉ trả về bộ lọc để người dùng áp dụng. Tìm kiếm AI có thể trả về nhiều mục đích/danh mục/phương thức thanh toán cùng lúc và phần nội dung còn lại được chuyển sang semantic search.
- Search: bộ lọc danh mục trên trang Giao dịch hỗ trợ chọn nhiều giá trị theo phép OR trong cùng một nhóm; các nhóm khác vẫn kết hợp theo phép AND. Semantic search dùng `pgvector` trong Supabase Postgres và model embedding chạy sẵn `gte-small` trong Edge Functions, lưu vector 384 chiều ở `transaction_embeddings`; chỉ embedding `description` + `note`, còn ngày, số tiền, loại, trạng thái và catalog vẫn lọc bằng SQL. Không cần gọi Gemini để tạo embedding và không đặt vector/secret ở frontend.
- Hosting: frontend Cloudflare Pages; dữ liệu, auth và function trên Supabase.

Mặc định dùng VND, `Asia/Ho_Chi_Minh`, ngày `dd/MM/yyyy`; `amount` luôn dương và ý nghĩa ròng được xác định bằng `transaction_type`.

## Chuẩn bị môi trường

Cài Node.js 20+, Git và Supabase CLI:

```bash
node --version
git --version
npm install -g supabase
```

Clone/cài thư viện và cấu hình frontend:

```bash
git clone <repository-url> family-expense
cd family-expense
npm install
cp .env.example .env.local
```

Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong `.env.local`. Đây là public anon key được bảo vệ bằng RLS. Không đặt service-role key hoặc Gemini key trong frontend.

## Tạo và cấu hình Supabase

1. Tạo project tại Supabase Dashboard, ghi lại Project URL và anon key.
2. Đăng nhập CLI và liên kết project:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Migration tạo toàn bộ bảng, constraints, indexes, helper functions và RLS. Khi user tạo gia đình, gọi RPC `create_family`, sau đó gọi `seed_family_defaults` với UUID trả về. Seed dùng `ON CONFLICT DO NOTHING`, có thể chạy lại an toàn.

Auth hỗ trợ email/password và magic link. Trong Supabase Dashboard, cấu hình Site URL/Redirect URLs cho local (`http://localhost:5173`) và domain Cloudflare production.

## Gemini và Edge Function

Tạo API key trong Google AI Studio. Tại thời điểm triển khai, `.env.example` đề xuất stable `gemini-3.6-flash`, model có structured output và Free Tier; hãy kiểm tra lại trang pricing/model trước khi production vì quota và model có thể thay đổi.

Lưu secret ở Supabase, không lưu vào Git:

```bash
supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-3.1-flash-lite
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_ANON_KEY=<anon-key>
supabase functions deploy parse-expense
```

Function kiểm tra JWT, membership theo `family_id`, validate request/response bằng Zod, giới hạn 10 request/user/phút, không retry vô hạn khi 429 và không log token/API key. Log chỉ chứa metadata tối thiểu. Gemini Free Tier có quota/rate limit và dữ liệu có thể được dùng để cải thiện sản phẩm theo chính sách Google; xem pricing hiện hành trước khi đưa dữ liệu thật vào.

## Gửi danh sách giao dịch qua Brevo

Tính năng **Dữ liệu → Gửi danh sách giao dịch** gọi Edge Function `email-transactions`. Function chỉ cho owner gửi danh sách giao dịch chưa bị xóa tới email tài khoản hiện tại, tự query theo `family_id` và gửi file CSV qua Brevo. Không đặt API key Brevo ở frontend.

Tạo API key có quyền gửi trong Brevo, xác minh sender email, rồi lưu secret ở Supabase:

```bash
supabase secrets set BREVO_API_KEY=<key> BREVO_SENDER_EMAIL=<sender-email> BREVO_SENDER_NAME="Family Expense"
```

Production deploy `email-transactions` chạy qua workflow Supabase sau khi thay đổi được merge vào `main`. Gói Brevo Free có giới hạn gửi hằng ngày; kiểm tra quota và lỗi provider trước khi dùng dữ liệu thật.

## Chạy local

```bash
npm run dev
```

Nếu chưa cấu hình Supabase, app vẫn mở với dữ liệu demo để kiểm tra UI; đăng nhập, lưu cloud và AI cần project Supabase thật.

Khi người dùng bấm **Gợi ý AI** trên trang **Giao dịch**, `search-transactions` trước hết tách câu tự nhiên thành các bộ lọc có cấu trúc. Nếu còn khái niệm về nội dung giao dịch, response có `semanticQuery`; frontend gọi `process-transaction-embeddings` để bổ sung dần vector còn thiếu/cũ rồi gọi `search-transactions-semantic` để xếp hạng theo cosine similarity. Các giao dịch cũ được backfill theo từng batch khi semantic search được dùng; giao dịch mới hoặc giao dịch đổi nội dung cũng sẽ được xử lý lại khi batch kế tiếp chạy. Vì embedding dùng model built-in của Supabase, luồng này không phát sinh request tới Gemini; vẫn cần theo dõi dung lượng database và quota Edge Functions của project Free.

## Import Excel

Tại **Dữ liệu**, tải template động theo danh mục của gia đình. Sheet `Giao dịch` chỉ gồm Ngày, Số tiền, Loại giao dịch, Trạng thái, Nội dung, Phương thức thanh toán, Mục đích chi, Loại chi phí và Ghi chú; dropdown/validation được thiết lập cho tối đa 1.000 dòng. Khi chọn file, app kiểm tra tiêu đề, kiểu dữ liệu, mapping danh mục và giao dịch có thể trùng trước khi cho xác nhận. Mặc định dòng có thể trùng bị bỏ qua. RPC `import_template_transactions` kiểm tra lại membership/danh mục và ghi toàn bộ các dòng được xác nhận trong một transaction, đồng thời tạo `import_batches` audit.

Vào **Dữ liệu → Import Excel**, chọn file `Expense Management - Chuan hoa.xlsx`. App chỉ đọc sheet `Giao dịch chuẩn hóa`, hiển thị preview/kết quả lỗi trước khi xác nhận và không thay đổi file nguồn. Mapping:

- Mã giao dịch → `source_reference`
- Ngày, loại giao dịch, trạng thái, nội dung, số tiền → các trường tương ứng
- Mục đích chi, loại chi phí, sự kiện, người hưởng lợi, phương thức, tài khoản → lookup danh mục
- Source → `excel_import`

Duplicate import được chặn bằng unique `(family_id, source, source_reference)`; với dữ liệu không có mã, dùng kiểm tra ngày + số tiền + nội dung gần giống và yêu cầu người dùng quyết định. Workbook nguồn đã được đối chiếu: **2.090 giao dịch**, tổng ròng **1.696.313.649 VND**. Các dòng thiếu dữ liệu phải nằm trong danh sách cần kiểm tra và không làm hỏng cả batch.

### Migration dữ liệu nguồn bằng CLI

Sau khi chạy migration database mới nhất, kiểm tra workbook mà chưa ghi dữ liệu:

```bash
node scripts/import-excel.mjs "/đường/dẫn/Expense Management - Chuan hoa.xlsx"
```

Dry-run phải báo 2.090 dòng nguồn, tổng ròng 1.696.313.649 VND, 2.083 dòng đủ điều kiện ghi và 7 dòng lỗi cần bổ sung. Dòng thiếu loại chi phí nhưng còn đủ dữ liệu bắt buộc được map sang `Khác` và lưu warning.

Để ghi dữ liệu, đăng nhập app, lấy access token Supabase của chính owner, rồi chạy trong một terminal riêng. Không lưu token vào `.env` hoặc Git:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon-key> \
SUPABASE_ACCESS_TOKEN=<owner-jwt-ngắn-hạn> \
FAMILY_ID=<family-uuid> \
node scripts/import-excel.mjs "/đường/dẫn/Expense Management - Chuan hoa.xlsx" --commit
```

Script thực hiện theo batch 200 dòng, chỉ cho owner chạy, tái sử dụng danh mục hiện có, tạo danh mục còn thiếu, chống trùng bằng source reference và lưu audit vào `import_batches`/`import_issues`. Có thể chạy lại an toàn: giao dịch đã có sẽ được bỏ qua.

## Thành viên gia đình

Owner vào **Thành viên**, nhập email của người cần thêm và tên hiển thị tùy chọn. Email đó phải đăng ký tài khoản Family Expense trước. Sau khi được thêm, member đăng nhập lại sẽ thấy cùng Dashboard, giao dịch và dữ liệu của gia đình; member không có quyền thêm người khác. Mỗi người có thể đổi tên hiển thị của chính mình; owner có thể đổi tên gia đình, đổi tên mọi thành viên và xóa member. Các thao tác sửa tên dùng icon bút chì có tooltip. Xóa member chỉ thu hồi quyền truy cập, không xóa giao dịch cũ. Phiên bản hiện tại chỉ hỗ trợ một tài khoản thuộc một gia đình đang hoạt động.

Tài khoản mới chưa thuộc gia đình nào sẽ tự chuyển đến màn hình **Tạo gia đình mới**. Sau khi nhập tên, hệ thống tạo gia đình, gán tài khoản làm owner và seed toàn bộ danh mục mặc định trong cùng một RPC transaction. Tài khoản đã thuộc gia đình không thể tạo thêm gia đình khác.

Owner có thể xóa gia đình tại cuối màn hình **Thành viên**, nhưng chỉ khi gia đình chưa từng có bất kỳ giao dịch nào. Kiểm tra được thực hiện tại database và tính cả giao dịch đã xóa mềm. Xóa gia đình không xóa tài khoản đăng nhập; owner được đưa về onboarding để tạo gia đình mới.

## Kiểm thử và chất lượng

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run preview
```

Vitest kiểm tra định dạng VND, giá trị ròng, validation, duplicate, import và schema Gemini. React Testing Library kiểm tra dashboard. Playwright có flow thêm giao dịch trên desktop và mobile. Test RLS đầy đủ nên chạy với Supabase local (`supabase start`, `supabase db reset`) hoặc một project test riêng.

## PWA và offline

Manifest, icon, service worker, app-shell caching và trang offline được cấu hình sẵn. Dữ liệu API tài chính không nằm trong runtime cache. App báo mất kết nối và không xác nhận giao dịch đã lưu nếu request chưa tới database. MVP không bật offline mutation queue để tránh đồng bộ trùng.

## Build và Cloudflare Pages

Kết nối repository trong Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20+
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Thêm route fallback SPA về `index.html` nếu cấu hình Pages yêu cầu. Thêm domain production vào Supabase Auth Redirect URLs. Không cấu hình `GEMINI_API_KEY` trên Cloudflare Pages: key đó chỉ tồn tại trong Supabase Secrets.

## Giả định và giới hạn MVP

- Một câu AI chỉ tạo một đề xuất giao dịch; không OCR, ảnh hoặc giọng nói.
- Owner quản lý thành viên/danh mục; member xem và nhập/sửa giao dịch theo RLS. Mời thành viên nâng cao và UI recurring transaction để sau MVP.
- Accounts chỉ lưu tên, tổ chức và bốn số cuối, không lưu toàn bộ số tài khoản/thẻ.
- Storage chưa dùng; vector semantic search nằm trong database, không dùng Supabase Storage. Semantic search hiện chỉ xét `description` và `note`; các thuộc tính có cấu trúc như ngày, số tiền, loại, trạng thái và catalog cần được AI tách thành bộ lọc SQL. Dark mode nền tảng CSS đã chuẩn bị nhưng chưa có nút chuyển theme.
- CI chạy pgTAP kiểm tra schema/RLS trên Supabase local; drill backup/restore staging theo [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) trước mỗi thay đổi database lớn.

## Bảo mật

Không commit `.env`; không dùng service-role key ở browser; không đặt Gemini key trong biến `VITE_*`; không log access token, API key hay nội dung nhạy cảm. RLS bật trên mọi bảng dữ liệu gia đình và Edge Function xác minh JWT + membership trước khi đọc danh mục/gọi Gemini.
