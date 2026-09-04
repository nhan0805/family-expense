# SYSTEM TEST REPORT

## 1. Phạm vi và môi trường

- Dự án: Family Expense — React/TypeScript/Vite, Supabase PostgreSQL/Auth/RLS/RPC/Edge Functions, PWA.
- Thời điểm: 04/09/2026, `Asia/Ho_Chi_Minh`.
- Phạm vi: authentication, fallback demo, routing/layout, giao dịch, ngân sách, danh mục, thành viên, import/export, AI boundary, tính toán VND, timezone, static security và regression.
- An toàn dữ liệu: chỉ dùng máy chủ local và cấu hình placeholder không chứa secret để smoke test fallback; không đăng nhập bằng tài khoản thật, không mutation production, không chạy migration production.

## 2. Kết quả tổng quan

| Hạng mục | Kết quả | Ghi chú |
|---|---:|---|
| Vitest + RTL | PASS | 27/27 test files, 110/110 tests |
| Lint | PASS | `pnpm lint`, `--max-warnings=0` |
| TypeScript | PASS | `pnpm typecheck` |
| Production build | PASS | `pnpm build` |
| Diff hygiene | PASS | `git diff --check` |
| Coverage | RECORDED | Statements 63.22%, branches 59.63%, functions 54.15%, lines 63.22%; repository chưa khai báo threshold |
| Local UI smoke | PASS | Fallback mở Dashboard → Giao dịch → form, lưu giao dịch, truy cập Ngân sách/Danh mục |
| Playwright E2E | BLOCKED | 2 test không launch được Chromium/WebKit vì thiếu browser binaries; chưa chạy tới assertion |
| Supabase local/pgTAP | BLOCKED | Docker socket bị từ chối và Supabase CLI không ghi được telemetry; chưa chạy database test |

## 3. Lỗi phát hiện và xử lý

### M1 — Fallback demo bị chuyển sai sang onboarding — ĐÃ SỬA

- Nguyên nhân: khi Supabase chưa cấu hình, `familyId` vẫn rỗng; `Layout` coi đây là tài khoản đã xác thực nhưng chưa có gia đình và chuyển tới `/tao-gia-dinh`. Các thao tác danh mục/import vẫn gọi client Supabase placeholder.
- Sửa: fallback có `local-family`, user demo, CRUD danh mục cục bộ, import Excel cục bộ, thao tác thành viên demo và đăng xuất cục bộ; form giao dịch/ngân sách tiếp tục dùng nhánh local hiện có.
- Regression: `src/context/AppContext.ui.test.tsx`; smoke UI với placeholder config xác nhận `/` không còn redirect onboarding và lưu giao dịch thành công.

### M1 — Auth lộ lỗi provider và có thể kẹt trạng thái busy — ĐÃ SỬA

- Nguyên nhân: `Login`/`ResetPassword` dùng trực tiếp `error.message`, không có `try/catch/finally` cho promise reject.
- Sửa: validate biên, dịch lỗi auth phổ biến VI/EN, dùng thông báo generic cho lỗi không nhận diện và luôn reset busy trong `finally`.
- Regression: `src/pages/Login.test.tsx`, `src/lib/errorRecovery.test.ts`.

### M2 — Hiển thị ngày giao dịch phụ thuộc timezone thiết bị — ĐÃ SỬA

- Nguyên nhân: date-only `YYYY-MM-DD` được chuyển qua `new Date(...T00:00:00)` rồi format theo timezone môi trường.
- Sửa: `formatDateOnlyVi` format trực tiếp chuỗi lịch, dùng chung cho transaction row và filter chips.
- Regression: `src/lib/domain.test.ts`.

### M2 — Hàm `SECURITY DEFINER` bảo trì dùng `search_path=public` — ĐÃ HARDEN, CHỜ DEPLOY

- Phạm vi: `permanently_delete_transactions`, `purge_deleted_transactions_after_30_days`, `purge_ai_usage_logs_after_30_days`.
- Sửa: thêm `supabase/migrations/202609040001_harden_maintenance_search_paths.sql`, đặt `search_path=''`, schema-qualify các bảng/hàm và giữ nguyên grant/revoke.
- Trạng thái: chưa apply vào Supabase; phải được kiểm tra bởi `db-security`/pgTAP trong pipeline trước khi merge.

## 4. Ma trận kiểm thử theo module

- Authentication: render login, validate thiếu input, provider reject, thông báo không lộ raw detail; chưa kiểm tra đăng nhập thành công vì không có test account an toàn.
- Family/onboarding: kiểm tra routing fallback, cập nhật tên gia đình local, reset state khi session/membership cloud không hợp lệ qua code review; chưa chạy DB/RLS.
- Transactions: validation schema, VND, loại `Chi tiêu`/`Thu nhập`, duplicate, status theo ngày, filter, sort, soft-delete/restore/bulk UI và due confirmation đều có regression pass; cloud persistence/RLS chưa được thực thi.
- Dashboard/budget: công thức chi tiêu/thu nhập, budget status, budget visibility, owner/member UI và link filter pass trong Vitest/RTL; RPC thật chưa chạy.
- Catalogs: owner CRUD, duplicate names, icon mapping/search, local fallback CRUD pass; composite tenant FK/RLS chỉ được static review.
- Members: owner/member UI, local demo add/rename/remove và error fallback được rà soát; cloud RPC chưa chạy.
- Import/export: template parser, bilingual catalog lookup, duplicate detection, validation và cloud RPC contract có test; local import branch mới được triển khai nhưng chưa có test fixture UI đầy đủ.
- AI/voice: schema, timeout/retry/error mapping, description normalization, voice input UI và nguyên tắc suggest-only pass; không gọi Gemini/Edge Function thật.
- Responsive/accessibility: RTL assertions cho mobile navigation, filter panel, transaction card, labels, accessible names, status/alert và action controls pass; Playwright mobile browser bị chặn nên chưa có screenshot/device matrix đầy đủ.

## 5. Kiểm tra bảo mật và chất lượng tĩnh

- Không tìm thấy `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `@ts-ignore` hoặc `@ts-nocheck` trong `src`, `supabase`, `tests`.
- Không có file `.env`/secret/credential được track bởi Git; nội dung env thật không được đọc.
- Frontend chỉ tham chiếu Supabase public anon configuration; secret server-side/Gemini/Brevo không được đưa vào bundle theo static review.
- Migration/RLS hiện có composite tenant foreign keys và các guard owner/member; kết luận runtime vẫn để `NOT TESTED` vì không có PostgreSQL local.

## 6. Hiệu năng và build

- Build thành công với 2.402 modules.
- Cảnh báo chunk lớn còn tồn tại: `exceljs` khoảng 937 kB, `xlsx` khoảng 429 kB, charts vendor khoảng 415 kB sau minify. Đây là cảnh báo tối ưu, không làm build fail.
- PWA precache hiện khoảng 1,342 KiB; ExcelJS/XLSX vẫn được tách khỏi precache theo cấu hình hiện tại.
- Chưa chạy Lighthouse/Core Web Vitals/load test vì thiếu browser runtime và không có môi trường benchmark riêng.

## 7. Blocker và rủi ro còn lại

1. `pnpm test:e2e` chưa thể chạy assertion cho Chromium/WebKit vì thiếu browser binaries; không tự cài thêm binary trong phiên này.
2. Supabase local/pgTAP chưa chạy do Docker daemon/socket và quyền ghi telemetry; cần pipeline `db-security` hoặc project test riêng để xác minh migration, RLS, RPC, trigger, constraint và tenant isolation.
3. Authenticated cloud business flows, persistence sau reload và cross-user owner/member cần test account/test project an toàn trước release.
4. Migration hardening mới chưa deploy; các file migration lịch sử vẫn chứa định nghĩa cũ, nhưng định nghĩa hiệu lực sẽ được thay bởi migration timestamp mới khi pipeline apply đầy đủ theo thứ tự.
5. Fallback demo hiện là session-memory cho catalog/transaction; budget dùng local storage theo thiết kế hiện có, không được xem là cloud persistence.

## 8. Kết luận

**FAIL — chưa đủ bằng chứng để xác nhận toàn bộ hệ thống đạt release quality.**

Không còn lỗi Critical được tái hiện trong phạm vi local đã chạy; các lỗi M1/M2 nêu trên đã được sửa và regression pass. Tuy nhiên, không thể kết luận PASS khi Playwright E2E, PostgreSQL/RLS/pgTAP và authenticated cloud business flows chưa thực thi được. Trước khi merge/deploy, cần chạy lại E2E với browser binaries, `supabase test db --local`/pipeline `db-security`, sau đó xác minh persistence và quyền owner/member trên test project.
