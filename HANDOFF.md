# Family Expense — Development Handoff

> Cập nhật: **17/09/2026** (`Asia/Ho_Chi_Minh`)

## Current state

- Production frontend đang hoạt động tại <https://family-expense-8fo.pages.dev> trên Cloudflare Pages; deployment production cho merge commit `63ef3fd64059dfb2542e33df51c76363e151d3c6` đã pass qua [Cloudflare Pages](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/2727b094-d0d9-4807-9623-6c621df0d702), smoke HTTP 200 đã được xác nhận.
- Code trên `main` mới nhất: PR [#169](https://github.com/nhan0805/family-expense/pull/169), merge commit `63ef3fd64059dfb2542e33df51c76363e151d3c6`; bản sửa lưu sổ tiết kiệm đã lên production.
- CI main [run 35172065376](https://github.com/nhan0805/family-expense/actions/runs/35172065376) pass với quality, E2E, db-security và performance budget. Supabase Production Deploy [run 35172065327](https://github.com/nhan0805/family-expense/actions/runs/35172065327) pass và đã áp migration `202609170002_savings_book_save_recovery.sql`.
- Nhánh workspace hiện tại: `codex/asset-controls-copy-20260916`, HEAD `624319d`; local đang ahead remote 2 commit và behind remote 2 commit. Hai commit local `4120a94` (bộ lọc giao dịch mặc định cá nhân) và `624319d` (khôi phục giao dịch mua vàng, backfill danh mục và hiển thị lãi sổ) chưa push/CI production.
- PR #156, PR #159 và PR #169 đã merge vào `main`; commits `23cfe3a` và `c395041` vẫn là follow-up trên asset branch, chưa có trong `main`/production.
- Worktree còn thay đổi unstaged tương đương phần `autoFocus`/mặc định `Trả góp` đã nằm trong PR #159 và nút thu gọn hai danh sách tài sản trên Dashboard; không còn thay đổi staged. Bản cập nhật canonical này cũng chưa push.
- Release/status mới nhất được ghi nhận trong workspace cho PR [#169](https://github.com/nhan0805/family-expense/pull/169); phần cập nhật này chỉ ghi trạng thái/link sau deploy và không tạo production deploy lần hai.
- Đã cập nhật CI/preview cho `merge_group`, thu hẹp trigger Supabase và chuẩn hóa single-writer cho tài liệu release; chưa bật Merge Queue/branch protection trên GitHub.
- Bản đồ kiến trúc ổn định nằm trong [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md); quy tắc phân loại tài liệu nằm trong [`docs/AI_CONTEXT_GUIDE.md`](docs/AI_CONTEXT_GUIDE.md).

## Current system state

- Frontend React 19/TypeScript/Vite, React Router, Tailwind, TanStack Query, React Hook Form/Zod, Recharts và PWA.
- Supabase cung cấp Auth, PostgreSQL, RLS, RPC, pg_cron và Edge Functions.
- Dữ liệu nghiệp vụ được scope theo `family_id`; owner/member permissions phải được bảo vệ ở RLS/RPC.
- App có demo fallback khi Supabase chưa cấu hình.
- Module Tài sản theo dõi sổ tiết kiệm và từng dòng vàng, liên kết các thay đổi tiền mặt với `transactions` bằng source `asset`. Production `main` đã có migrations `202609160001`–`202609160003`; commit local `624319d` đã renumber backfill danh mục vàng thành migration `202609160005_backfill_gold_expense_type.sql` và bổ sung hiển thị lãi đến hiện tại/toàn kỳ trên Dashboard và Tài sản, nhưng chưa deploy.
- Commit local `4120a94` đã thêm bộ lọc giao dịch mặc định cá nhân tại `/cai-dat/giao-dich` với local/Supabase persistence, migration `202609160006_transaction_filter_preferences.sql` và RLS tests; chưa push/CI/deploy.
- Production đã có bảng/cấu hình mặc định giao dịch tự động và migration `202609170002_savings_book_save_recovery.sql`; RPC lưu sổ chỉ yêu cầu catalog mục đích/chi phí khi thực sự tạo giao dịch mở sổ.
- Giao dịch định kỳ được tạo bởi RPC/job database với idempotent run history. Các màn hình liên quan tự refetch dữ liệu server mỗi 30 giây và khi quay lại foreground.
- AI chạy phía Edge Function qua Gemini để đề xuất giao dịch, phân tích bộ lọc tìm kiếm và tóm tắt Dashboard. AI không tự lưu giao dịch.
- Email export của owner dùng Edge Function `email-transactions` và Brevo. Secret không nằm trong frontend.
- Semantic embedding/search production path đã bị loại bỏ; không đưa lại nếu chưa có quyết định kiến trúc mới.

## Recently completed

### Các thay đổi ngày 16/09/2026

- PR #153 đưa Nội dung lên trước Số tiền trong form giao dịch; merge commit `c5395ff`, CI main [run 35052905005](https://github.com/nhan0805/family-expense/actions/runs/35052905005) pass.
- PR #154 bổ sung quản lý sổ tiết kiệm/vàng, snapshot tài sản trên Dashboard, local fallback, migration `202609160001_asset_management.sql` và E2E flow; PR #155 sửa linked transaction trong migration `202609160002_fix_asset_transaction_writes.sql`.
- PR #156 đã merge/deploy tại commit `f99ef44`, gồm snapshot tài sản Dashboard, giá vàng dùng chung, trigger tính đáo hạn, quyền active member, label `Gold/mace`, mặc định thẻ tín dụng là `Dự kiến` và bộ lọc Giao dịch mặc định cho chi tiêu thực tế.
- Commit `23cfe3a` thêm migration `202609160004_backfill_gold_expense_type.sql` và contract test; commit `c395041` giới hạn input lãi suất và căn chỉnh form giá vàng. Asset follow-ups chưa deploy; commit local `624319d` đã đưa backfill vào version `202609160005_backfill_gold_expense_type.sql` để tránh trùng version với migration bộ lọc cá nhân.
- Nhánh form giao dịch `codex/transaction-form-focus-defaults-20260916` có commit `c732c94` chuyển focus mặc định sang Nội dung và đặt `Trả góp` là `Dự kiến`; PR #159 đã merge commit này vào `main`, CI [run 35076403354](https://github.com/nhan0805/family-expense/actions/runs/35076403354) và CI main [run 35076825664](https://github.com/nhan0805/family-expense/actions/runs/35076825664) đều pass.
- Commit `4120a94` thêm bộ lọc giao dịch mặc định cá nhân và test tương ứng; local đã commit nhưng chưa push/CI.
- Commit `624319d` khôi phục các giao dịch mua vàng, thêm tính lãi sổ tiết kiệm đến hiện tại/toàn kỳ, migration backfill `005` và structural/regression tests; local đã commit nhưng chưa push/CI/deploy.
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

PR #169 đã hoàn tất quality gate, merge vào `main` và deploy production thành công. Bản sửa lưu sổ dùng cấu hình mặc định giao dịch tự động khi cần tạo giao dịch mở sổ và vẫn cho phép lưu sổ riêng. Local HEAD `624319d` cùng các thay đổi chưa commit trong workspace vẫn là nhánh công việc riêng, không được đưa vào release #169; các commit `4120a94`/`624319d` và follow-up `c395041` cần PR riêng nếu tiếp tục triển khai.

## Pending tasks

- [ ] Push/review hai commit local `4120a94` và `624319d` cùng migrations `006`/`005`, chạy CI/db-security và chỉ deploy sau khi check pass.
- [ ] Đưa follow-up input/form từ commit `c395041` vào PR phù hợp; không áp dụng lại backfill `23cfe3a` nếu đã dùng bản renumber `005` trong `624319d`.
- [ ] Đồng bộ/chốt thay đổi form và toggle danh sách tài sản còn trong worktree với PR #159 đã merge, rồi chạy focused test/quality gate.
- [x] Xác minh Cloudflare Pages production cho release #169, merge commit `63ef3fd`; smoke production HTTP 200.
- [ ] Chạy lại local Vitest/typecheck/lint/build khi workspace có dependency; chạy `supabase test db --local` sau khi local Supabase/Docker sẵn sàng.
- [ ] Chạy backup/restore và rollback drill trên staging bằng secrets riêng.
- [ ] Hoàn tất synthetic E2E trên staging bằng tài khoản test riêng (`E2E_EMAIL`/`E2E_PASSWORD`).
- [ ] Xác nhận monitoring/alert routing production và retention của telemetry trước khi mở rộng vận hành.
- [ ] Cân nhắc dọn file generated đã từng được track như `scripts/__pycache__/*.pyc` trong một cleanup commit riêng.

## Known issues / limitations

- Build có cảnh báo chunk lớn liên quan XLSX/ExcelJS/charts; performance budget CI vẫn là kiểm soát bắt buộc.
- App không có offline mutation queue; không coi giao dịch là đã lưu nếu request chưa thành công.
- Cloudflare Pages build settings và Supabase production secrets nằm ngoài repo; chỉ xác minh được qua CI/deployment, không ghi giá trị vào tài liệu.
- Release #169 đã pass full local quality gate bằng binary sẵn có: Vitest 48 file/213 test, TypeScript, ESLint, Vite build; Playwright Chromium 2 pass/1 skip. Local `supabase test db --local` trả ECONNREFUSED tại `127.0.0.1:54322` vì Supabase chưa chạy, còn CI db-security đã pass.
- Asset follow-up `23cfe3a`/`c395041` chưa có CI/pgTAP evidence trong workspace; backfill `005` và phần lãi đã nằm trong local commit `624319d`, chưa deploy production.
- Commit local `4120a94`/`624319d` cùng migrations `006`/`005` có test mới nhưng chưa push/CI; không xem các thay đổi local là production-ready.
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
- `src/App.tsx`, `src/components/Layout.tsx`, `src/lib/transactionFilters.ts`, `src/lib/transactionFilterPreferencesApi.ts`, `src/pages/TransactionFilterSettings.tsx`, `src/pages/Transactions.tsx` — bộ lọc giao dịch mặc định cá nhân và route cài đặt trong commit local `4120a94`.
- `supabase/migrations/202609160006_transaction_filter_preferences.sql`, `supabase/tests/transaction_filter_preferences.sql` — persistence/RLS test cho bộ lọc cá nhân trong commit local `4120a94`, chưa deploy.
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

- Ordered migrations are in `supabase/migrations/`; production `main` đã có `202609160001_asset_management.sql`–`202609160003_member_asset_controls.sql`, `202609170001_automatic_transaction_defaults.sql` và `202609170002_savings_book_save_recovery.sql`. Commit `23cfe3a` lịch sử dùng `004`, còn local HEAD `624319d` chứa backfill ở `202609160005_backfill_gold_expense_type.sql` và migration `202609160006_transaction_filter_preferences.sql`; hai migration local này chưa deploy production.
- Bảng `transaction_filter_preferences` được scope theo `family_id`/`user_id` và có RLS trong migration `006`; đây là thay đổi local chưa push/CI.
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

- Release #169: Vitest 48 file/213 test, TypeScript, ESLint, Vite build và Playwright Chromium 2 pass/1 skip đều pass local; CI main [run 35172065376](https://github.com/nhan0805/family-expense/actions/runs/35172065376) pass quality, E2E, db-security và performance budget.
- Supabase Production Deploy [run 35172065327](https://github.com/nhan0805/family-expense/actions/runs/35172065327) và Cloudflare Pages production [check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/2727b094-d0d9-4807-9623-6c621df0d702) pass; smoke `https://family-expense-8fo.pages.dev/` trả HTTP 200.
- Asset branch commits `23cfe3a` và `c395041` đã bổ sung category backfill, decimal input sanitization và căn chỉnh form; chưa có CI/pgTAP evidence trong workspace. Local commit `624319d` đã giữ backfill ở migration `005` và thêm lãi sổ đến hiện tại/toàn kỳ, chưa deploy.
- PR #159 commit `c732c94` có preview pass và CI [run 35076403354](https://github.com/nhan0805/family-expense/actions/runs/35076403354) pass với quality, E2E và db-security, sau đó đã merge vào `main` tại `9168ded`; Cloudflare production check/smoke cho commit này chưa được ghi.
- Commit local `4120a94`/`624319d` và migrations `006`/`005` có test mới nhưng chưa push/CI; phần lãi sổ tiết kiệm đến hiện tại/toàn kỳ chưa có bằng chứng CI.
- Trong session: `git diff --check` pass; local DB test bị block vì Supabase chưa khởi động, nhưng CI db-security và Supabase Production Deploy đã pass.

For a new change, rerun only the relevant focused tests during iteration, then the full release gate before deploy: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`, plus E2E/DB tests when applicable.

## Next recommended step

Tiếp theo, nếu cần đưa các thay đổi local `4120a94`/`624319d`, follow-up `c395041` hoặc migrations `005`/`006` lên production, hãy tách chúng thành PR riêng và chạy lại đầy đủ quality/DB/deploy checks.

## Session start instructions

1. Read `AGENTS.md`.
2. Read this file and the newest relevant `CHANGELOG.md` entry.
3. Read the relevant section of `docs/PROJECT_MAP.md`.
4. Load the matching `.agent/skills/*/SKILL.md`.
5. Inspect only the implementation files directly related to the request.
