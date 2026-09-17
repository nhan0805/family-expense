# Family Expense — Development Handoff

> Cập nhật: **17/09/2026** (`Asia/Ho_Chi_Minh`)

## Current state

- Production frontend đang hoạt động tại <https://family-expense-8fo.pages.dev> trên Cloudflare Pages; deployment cho merge commit `33355e31d55ae6e9ef21d46f59bb7c8e06ad6297` đã pass qua [Cloudflare Pages](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/7402dc21-541f-4f31-88eb-de90d6aa0ec4), smoke HTTP 200 và kiểm tra bundle live đã được xác nhận.
- Code trên `main` mới nhất: PR [#181](https://github.com/nhan0805/family-expense/pull/181), merge commit `33355e31d55ae6e9ef21d46f59bb7c8e06ad6297`; lỗi tạo lô vàng khi catalog/mapping chưa sẵn sàng đã được sửa cùng migration `202609170006_gold_asset_save_recovery.sql`.
- CI main [run 35203445103](https://github.com/nhan0805/family-expense/actions/runs/35203445103) và Supabase Production Deploy [run 35203445107](https://github.com/nhan0805/family-expense/actions/runs/35203445107) đều pass với quality, E2E, db-security, performance budget và migration production.
- Nhánh workspace cho release/status: `codex/release-status-20260917-gold`, được tạo từ `origin/main` sau khi PR #181 merge; thay đổi CSS chưa commit của workspace được giữ riêng ngoài release commit.
- Release/status chỉ cập nhật tài liệu trạng thái/link sau deploy, không thay đổi artifact, schema hay dữ liệu.
- Đã cập nhật CI/preview cho `merge_group`, thu hẹp trigger Supabase và chuẩn hóa single-writer cho tài liệu release; chưa bật Merge Queue/branch protection trên GitHub.
- Bản đồ kiến trúc ổn định nằm trong [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md); quy tắc phân loại tài liệu nằm trong [`docs/AI_CONTEXT_GUIDE.md`](docs/AI_CONTEXT_GUIDE.md).

## Current system state

- Frontend React 19/TypeScript/Vite, React Router, Tailwind, TanStack Query, React Hook Form/Zod, Recharts và PWA.
- Supabase cung cấp Auth, PostgreSQL, RLS, RPC, pg_cron và Edge Functions.
- Dữ liệu nghiệp vụ được scope theo `family_id`; owner/member permissions phải được bảo vệ ở RLS/RPC.
- App có demo fallback khi Supabase chưa cấu hình.
- Module Tài sản theo dõi sổ tiết kiệm và từng dòng vàng, liên kết các thay đổi tiền mặt với `transactions` bằng source `asset`; các migration asset, bộ lọc cá nhân và cấu hình giao dịch tự động hiện đã có trên `main` qua các PR tương ứng.
- `/cai-dat/giao-dich` vẫn là route cài đặt bộ lọc mặc định cá nhân; mục này được ẩn khỏi menu bên cạnh để menu gọn hơn nhưng không xóa tính năng hoặc deep link.
- Production đã có bảng/cấu hình mặc định giao dịch tự động, migration `202609170002_savings_book_save_recovery.sql` và `202609170006_gold_asset_save_recovery.sql`; RPC lưu sổ/lô vàng chỉ yêu cầu catalog khi thực sự tạo hoặc cập nhật giao dịch liên kết.
- Giao dịch định kỳ được tạo bởi RPC/job database với idempotent run history. Các màn hình liên quan tự refetch dữ liệu server mỗi 30 giây và khi quay lại foreground.
- AI chạy phía Edge Function qua Gemini để đề xuất giao dịch, phân tích bộ lọc tìm kiếm và tóm tắt Dashboard. AI không tự lưu giao dịch.
- Email export của owner dùng Edge Function `email-transactions` và Brevo. Secret không nằm trong frontend.
- Semantic embedding/search production path đã bị loại bỏ; không đưa lại nếu chưa có quyết định kiến trúc mới.

## Recently completed

### Các thay đổi ngày 16/09/2026

- PR #153 đưa Nội dung lên trước Số tiền trong form giao dịch; merge commit `c5395ff`, CI main [run 35052905005](https://github.com/nhan0805/family-expense/actions/runs/35052905005) pass.
- PR #154 bổ sung quản lý sổ tiết kiệm/vàng, snapshot tài sản trên Dashboard, local fallback, migration `202609160001_asset_management.sql` và E2E flow; PR #155 sửa linked transaction trong migration `202609160002_fix_asset_transaction_writes.sql`.
- PR #156 đã merge/deploy tại commit `f99ef44`, gồm snapshot tài sản Dashboard, giá vàng dùng chung, trigger tính đáo hạn, quyền active member, label `Gold/mace`, mặc định thẻ tín dụng là `Dự kiến` và bộ lọc Giao dịch mặc định cho chi tiêu thực tế.
- Các follow-up asset đã lần lượt được đồng bộ vào `main`: backfill danh mục vàng, giới hạn input lãi suất, khôi phục giao dịch mua vàng và hiển thị lãi sổ đến hiện tại/toàn kỳ.
- Nhánh form giao dịch `codex/transaction-form-focus-defaults-20260916` có commit `c732c94` chuyển focus mặc định sang Nội dung và đặt `Trả góp` là `Dự kiến`; PR #159 đã merge commit này vào `main`, CI [run 35076403354](https://github.com/nhan0805/family-expense/actions/runs/35076403354) và CI main [run 35076825664](https://github.com/nhan0805/family-expense/actions/runs/35076825664) đều pass.
- Bộ lọc giao dịch mặc định cá nhân và phần lãi sổ/backfill vàng đã có trên `main`, với migration đã được đánh số theo thứ tự hiện hành (`202609160005`–`202609160008`).
- Thêm nút mở/thu gọn riêng cho danh sách sổ tiết kiệm và vàng trên Asset Snapshot của Dashboard; mặc định đóng để giảm chiều cao khi có nhiều dòng, có trạng thái `aria-expanded`/`aria-controls` và regression test.

### Khôi phục lưu sổ tiết kiệm với mặc định giao dịch tự động

- Hiển thị đúng lỗi Supabase dạng object khi lưu sổ tiết kiệm thất bại và không báo lỗi giả khi mutation đã thành công nhưng refetch liên quan thất bại.
- RPC lưu sổ dùng cấu hình `savings_opening` khi tạo giao dịch mở sổ; lưu sổ không kèm giao dịch không còn phụ thuộc vào catalog giao dịch đầy đủ.
- PR [#169](https://github.com/nhan0805/family-expense/pull/169) đã merge/deploy thành công; migration `202609170002_savings_book_save_recovery.sql`, CI main, Supabase Production Deploy, Cloudflare Pages production và smoke HTTP 200 đều pass.

### Giảm conflict trước auto-merge

- CI và Cloudflare preview có thể chạy trên GitHub Merge Queue qua event `merge_group`.
- Supabase workflow không còn bị kích hoạt bởi `supabase/functions/AGENTS.md` hoặc tài liệu tương tự; chỉ các thư mục function runtime, migration và config mới trigger production workflow.
- Feature branch không cần rewrite song song `HANDOFF.md`/`CHANGELOG.md`; release/status update đồng bộ với `main` là nơi cập nhật hai file canonical.

### Làm mới giao dịch định kỳ khi app đang mở

- Đã thêm refetch interval/focus cho danh sách giao dịch, giao dịch dự kiến tới hạn, thông báo ngân sách và Dashboard.
- Đã thêm regression coverage cho hằng số refresh dùng chung.
- PR #141 đã merge và production smoke test pass.

### Chuẩn hóa AI context và release documentation

- `AGENTS.md` được mở rộng thành rule ngắn gọn về context loading, architecture, security, testing, documentation impact và Git release.
- Thêm `docs/PROJECT_MAP.md`, `docs/AI_CONTEXT_GUIDE.md` và các workflow trong `.agent/skills/`.
- `HANDOFF.md` được rút gọn thành tài liệu trạng thái hiện tại; lịch sử giữ ở `CHANGELOG.md`.
- Các lệnh và tài liệu deploy đã được chuẩn hóa theo pnpm và Git/Cloudflare Pages integration.
- PR #143 đã merge; Supabase workflow cũng pass do thay đổi scoped rule trong `supabase/functions/AGENTS.md` khớp path trigger, dù không có migration/runtime code mới.

### Cải thiện UI/UX theo roadmap UI UX Pro Max

- Mobile bottom navigation tập trung vào Tổng quan, Giao dịch, Ngân sách, Định kỳ và gom mục phụ vào Thêm.
- Dashboard có thứ tự KPI → ngân sách → giao dịch gần đây → biểu đồ; thêm truy vấn 5 giao dịch mới nhất và fallback demo.
- Chuẩn hóa design token theo xanh tin cậy, success/warning/danger và dark navy; loại bỏ palette Dracula khỏi các vùng UI đã chỉnh.
- Donut chart có phần trăm trực tiếp và bảng dữ liệu thay thế; filter chip tự xuống dòng; mô tả giao dịch wrap; budget progress có semantics `progressbar`.
- Form ưu tiên số tiền với segmented Chi/Thu; auth có tab Login/Đăng ký và hiện/ẩn mật khẩu; AI action dùng secondary button.
- Không đổi schema, migration, RLS/RPC hoặc dữ liệu; PR #144 đã merge và Cloudflare Pages Git integration đã deploy thành công.

## Current work

PR #181 đã hoàn tất quality gate, merge vào `main` và deploy production thành công. Lỗi `CATALOG_NOT_READY` khi tạo lô vàng đã được xử lý ở cả migration và giao diện; lưu lô không kèm giao dịch không còn phụ thuộc catalog, còn giao dịch mua vẫn kiểm tra mapping/catalog trước khi ghi. Các dòng tài sản vẫn dùng action icon gọn, phần “Lịch sử sổ” không còn chiếm chỗ, vàng đặt action cùng hàng với hai ô giá, và menu bên cạnh không còn mục “Bộ lọc mặc định”. Không còn feature code đang chờ trong workspace; nếu cần chỉnh tiếp, bắt đầu từ `origin/main`.

## Pending tasks

- [x] Xác minh Cloudflare Pages production cho release #181, merge commit `33355e31`; smoke production HTTP 200 và bundle live chứa recovery copy của luồng tạo vàng.
- [ ] Chạy backup/restore và rollback drill trên staging bằng secrets riêng.
- [ ] Hoàn tất synthetic E2E trên staging bằng tài khoản test riêng (`E2E_EMAIL`/`E2E_PASSWORD`).
- [ ] Xác nhận monitoring/alert routing production và retention của telemetry trước khi mở rộng vận hành.
- [ ] Cân nhắc dọn file generated đã từng được track như `scripts/__pycache__/*.pyc` trong một cleanup commit riêng.
- [ ] Nếu tiếp tục phát triển, bắt đầu từ `origin/main` và chạy lại quality gate phù hợp.

## Known issues / limitations

- Build có cảnh báo chunk lớn liên quan XLSX/ExcelJS/charts; performance budget CI vẫn là kiểm soát bắt buộc.
- App không có offline mutation queue; không coi giao dịch là đã lưu nếu request chưa thành công.
- Cloudflare Pages build settings và Supabase production secrets nằm ngoài repo; chỉ xác minh được qua CI/deployment, không ghi giá trị vào tài liệu.
- Release #179 local đã pass Vitest 48 file/220 test, TypeScript, ESLint, Vite build, `git diff --check`; E2E local chạy theo harness nhưng 2 case được skip bởi guard môi trường Supabase, còn CI E2E và db-security đều pass.
- Backup/restore drill staging chưa có bằng chứng thực tế trong workspace.

## Important decisions

### Canonical context files

- **Decision:** Giữ `AGENTS.md`, `HANDOFF.md` và `CHANGELOG.md` ở root; không tạo bản sao dưới `docs/`.
- **Reason:** Đây là các đường dẫn đang được README/rule hiện tại sử dụng và tránh tạo hai nguồn sự thật.
- **Impact:** `docs/` chỉ giữ architecture guide, AI context guide, privacy và runbook.

### Production deployment

- **Decision:** Frontend production chỉ deploy qua Cloudflare Pages Git integration sau khi PR merge vào `main`.
- **Reason:** Giữ audit trail, required checks và preview/prod tách biệt.
- **Impact:** Không dùng `wrangler pages deploy` cho production; Supabase migration/function đi qua GitHub workflow khi path phù hợp.

### Release documentation

- **Decision:** Feature PR ghi tóm tắt trong PR body; `HANDOFF.md` và `CHANGELOG.md` được cập nhật một lần trong release/status PR đã đồng bộ với `main`.
- **Reason:** Tránh nhiều branch song song cùng sửa hai file canonical và làm PR mất khả năng auto-merge.
- **Impact:** Git vẫn chứa context của release, nhưng canonical documents không còn là điểm nóng conflict của mọi feature branch.

## Files recently changed

- `AGENTS.md` — permanent agent rules.
- `HANDOFF.md` — current handoff snapshot.
- `CHANGELOG.md` — release/documentation history.
- `supabase/functions/AGENTS.md` — shared Edge Function/AI/email rules.
- `docs/PROJECT_MAP.md` — stable architecture map.
- `docs/AI_CONTEXT_GUIDE.md` — document responsibility and context loading.
- `.agent/skills/` — feature, database-change and release-handoff workflows.
- `.github/workflows/ci.yml`, `.github/workflows/cloudflare-preview.yml`, `.github/workflows/supabase-deploy.yml` — merge queue checks và trigger backend chính xác hơn.
- `src/lib/assets.ts`, `src/lib/assetsApi.ts`, `src/pages/Assets.tsx` — validation, decimal input sanitization, lãi sổ đến hiện tại/toàn kỳ, local/API mapping, shared gold price, maturity calculation và member asset controls.
- `src/pages/Dashboard.tsx`, `src/lib/domain.ts`, `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx` — asset snapshot với danh sách có thể thu gọn, credit-card/installment planned status, transaction-list defaults và focus form.
- `supabase/migrations/202609160001_asset_management.sql`, `202609160002_fix_asset_transaction_writes.sql`, `202609160003_member_asset_controls.sql`, `202609160005_backfill_gold_expense_type.sql`, `supabase/tests/asset_management.sql` — asset schema, linked-write fix, member controls, category backfill và structural tests.
- `tests/e2e/assets-flow.spec.ts` cùng test domain/form/transaction/dashboard — regression coverage cho các thay đổi ngày 16/09, gồm focus field mới.
- `src/App.tsx`, `src/components/Layout.tsx`, `src/lib/transactionFilters.ts`, `src/lib/transactionFilterPreferencesApi.ts`, `src/pages/TransactionFilterSettings.tsx`, `src/pages/Transactions.tsx` — bộ lọc giao dịch mặc định cá nhân và route cài đặt.
- `supabase/migrations/202609160007_transaction_filter_preferences.sql`, `supabase/tests/transaction_filter_preferences.sql` — persistence/RLS test cho bộ lọc cá nhân.
- `.gitignore` — generated Python cache exclusions.
- `README.md`, `docs/AI_CONTEXT_GUIDE.md`, `docs/DEPLOY_RUNBOOK.md`, `docs/RELEASE_GOVERNANCE.md`, `HUONG-DAN-DEPLOY-THU-CONG.md` — auto-merge/release-document policy.
- `src/components/Layout.tsx`, `src/components/TransactionRow.tsx`, `src/context/ThemeContext.tsx`, `src/index.css` — mobile navigation, transaction cards và design tokens.
- `src/lib/assets.ts`, `src/lib/assetsApi.ts`, `src/pages/Assets.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Dashboard.test.tsx` — giá vàng dùng chung, quyền member, snapshot tài sản và toggle danh sách.
- `src/lib/domain.ts`, `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx` — mặc định trạng thái thẻ tín dụng và bộ lọc Giao dịch.
- `supabase/migrations/202609160002_fix_asset_transaction_writes.sql`, `supabase/migrations/202609160003_member_asset_controls.sql`, `supabase/tests/asset_management.sql` — sửa ghi giao dịch liên kết và cập nhật contract tài sản.
- `src/lib/transactionsApi.ts`, `src/lib/errorRecovery.ts`, `src/lib/supabase.ts`, `src/pages/Dashboard.tsx`, `src/pages/Budgets.tsx`, `src/pages/Transactions.tsx`, `src/pages/Members.tsx`, `src/pages/RecurringExpenses.tsx`, `src/pages/TransactionForm.tsx`, `src/components/BudgetNotifications.tsx` — dashboard hierarchy, lỗi/loading recovery, charts, budget semantics, transaction responsive UI và due-transaction notifications.
- `src/pages/TransactionForm.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/CreateFamily.tsx` — form/auth/onboarding UI.
- Các test liên quan đến Layout, Dashboard, Budgets, Transactions, TransactionRow, TransactionForm và Login.

## Database state

- Ordered migrations are in `supabase/migrations/`; `main` hiện có các migration asset/bộ lọc/cấu hình giao dịch tự động từ `202609160001` đến `202609170006` theo thứ tự repository. Bảng `transaction_filter_preferences` được scope theo `family_id`/`user_id` và có RLS.
- Current schema includes families/members, catalogs, transactions, budgets, recurring templates/runs, savings accounts/movements, gold assets/sales, import audit and minimal AI usage logs.
- RLS/owner-member policies and guarded RPCs are part of the migration contract. Do not infer authorization from frontend checks.
- Production migration/function deployment is handled by `.github/workflows/supabase-deploy.yml` after matching changes reach `main`.

## Environment and configuration notes

- Frontend public variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Supabase Edge secrets include `GEMINI_API_KEY`, `GEMINI_MODEL`, Brevo sender/API variables and the server-side Supabase credentials required by functions.
- Never read or print `.env` contents, tokens or secret values.
- Local commands use pnpm. Supabase local DB tests require the Supabase CLI/container runtime.
- Cloudflare Pages uses `dist` as the Vite build output and SPA fallback assets are in `public/`/Vite PWA configuration.

## Testing status

Latest confirmed validation:

- PR #181: local Vitest 48 file/221 test, TypeScript, ESLint, Vite build và `git diff --check` pass; CI main [run 35203445103](https://github.com/nhan0805/family-expense/actions/runs/35203445103) pass quality, E2E, db-security và performance budget; Supabase Production Deploy [run 35203445107](https://github.com/nhan0805/family-expense/actions/runs/35203445107) pass.
- Cloudflare Pages production [check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/7402dc21-541f-4f31-88eb-de90d6aa0ec4) pass; smoke `https://family-expense-8fo.pages.dev/` trả HTTP 200 và bundle live chứa chuỗi recovery của luồng tạo vàng.

- Release #179: Vitest 48 file/220 test, TypeScript, ESLint, Vite build và `git diff --check` pass local; CI main [run 35197596017](https://github.com/nhan0805/family-expense/actions/runs/35197596017) pass quality, E2E, db-security và performance budget.
- Cloudflare Pages production [check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/f065ea1d-4d3d-45a2-9df3-d848cf93bf6e) pass; smoke `https://family-expense-8fo.pages.dev/` trả HTTP 200.
- PR #159 commit `c732c94` có preview pass và CI [run 35076403354](https://github.com/nhan0805/family-expense/actions/runs/35076403354) pass với quality, E2E và db-security, sau đó đã merge vào `main` tại `9168ded`; Cloudflare production check/smoke cho commit này chưa được ghi.
- Trong session: E2E local theo harness skip do guard Supabase; CI E2E và db-security pass. Không có migration/backend code mới trong PR #179.

For a new change, rerun only the relevant focused tests during iteration, then the full release gate before deploy: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`, plus E2E/DB tests when applicable.

## Next recommended step

Nếu tiếp tục chỉnh giao diện, bắt đầu từ `origin/main`, giữ action icon có accessible name và chạy lại quality gate trước release tiếp theo.

## Session start instructions

1. Read `AGENTS.md`.
2. Read this file and the newest relevant `CHANGELOG.md` entry.
3. Read the relevant section of `docs/PROJECT_MAP.md`.
4. Load the matching `.agent/skills/*/SKILL.md`.
5. Inspect only the implementation files directly related to the request.
