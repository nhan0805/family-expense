# Family Expense — Development Handoff

> Cập nhật: **17/09/2026** (`Asia/Ho_Chi_Minh`)

## Current state

- Production frontend đang hoạt động tại <https://family-expense-8fo.pages.dev> trên Cloudflare Pages; deployment production cho merge commit `3748633` đã pass và smoke test trả HTTP 200.
- Code production gần nhất: PR [#166](https://github.com/nhan0805/family-expense/pull/166), merge commit `37486333c09b7cc7f57c0443c6dfc1db8719c44b`.
- CI main [run 35134311249](https://github.com/nhan0805/family-expense/actions/runs/35134311249) pass với quality, E2E, db-security và performance budget.
- PR #166 đã merge vào `main`, đưa nút thu gọn riêng cho danh sách sổ tiết kiệm và vàng lên production; đây là thay đổi frontend-only nên không có Supabase Production Deploy mới.
- Supabase Production Deploy gần nhất [run 35081191930](https://github.com/nhan0805/family-expense/actions/runs/35081191930) pass cho các thay đổi backend trước đó.
- Đã cập nhật CI/preview cho `merge_group`, thu hẹp trigger Supabase và chuẩn hóa single-writer cho tài liệu release; chưa bật Merge Queue/branch protection trên GitHub.
- Bản đồ kiến trúc ổn định nằm trong [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md); quy tắc phân loại tài liệu nằm trong [`docs/AI_CONTEXT_GUIDE.md`](docs/AI_CONTEXT_GUIDE.md).

## Current system state

- Frontend React 19/TypeScript/Vite, React Router, Tailwind, TanStack Query, React Hook Form/Zod, Recharts và PWA.
- Supabase cung cấp Auth, PostgreSQL, RLS, RPC, pg_cron và Edge Functions.
- Dữ liệu nghiệp vụ được scope theo `family_id`; owner/member permissions phải được bảo vệ ở RLS/RPC.
- App có demo fallback khi Supabase chưa cấu hình.
- Asset Snapshot trên Dashboard có nút mở/thu gọn riêng cho danh sách sổ tiết kiệm và vàng; bản thay đổi UI này không đổi schema/API/dữ liệu.
- Giao dịch định kỳ được tạo bởi RPC/job database với idempotent run history. Các màn hình liên quan tự refetch dữ liệu server mỗi 30 giây và khi quay lại foreground.
- AI chạy phía Edge Function qua Gemini để đề xuất giao dịch, phân tích bộ lọc tìm kiếm và tóm tắt Dashboard. AI không tự lưu giao dịch.
- Email export của owner dùng Edge Function `email-transactions` và Brevo. Secret không nằm trong frontend.
- Semantic embedding/search production path đã bị loại bỏ; không đưa lại nếu chưa có quyết định kiến trúc mới.

## Recently completed

### Thu gọn danh sách tài sản trên Dashboard

- Thêm nút `Xem danh sách`/`Thu gọn` riêng cho danh sách sổ tiết kiệm và vàng; mặc định đóng để tránh Dashboard bị kéo dài khi có nhiều dòng.
- Nút có `aria-expanded`/`aria-controls`, vùng chạm tối thiểu 44px và regression coverage trong `src/pages/Dashboard.test.tsx`.
- Không đổi schema, migration, API hoặc dữ liệu.

### Triển khai nhãn tài sản và mặc định giao dịch

- Giao diện song ngữ dùng tên tài sản `Gold`/`vàng` và đơn vị `mace`/`chỉ`; không còn nhãn giao diện theo lô/thỏi vàng.
- Giá tiệm mua vào được lưu dùng chung cho gia đình; kỳ hạn sổ tiết kiệm được tính bằng trigger database; active member có thể quản lý tài sản qua RLS/RPC.
- Giao dịch mới thanh toán bằng thẻ tín dụng mặc định là `Dự kiến`. Tab Giao dịch mặc định là `Chi tiêu` thực tế trong tháng hiện tại và loại trừ mục đích `Đầu tư`.
- PR [#156](https://github.com/nhan0805/family-expense/pull/156) đã merge và deploy production thành công.

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

Release PR [#166](https://github.com/nhan0805/family-expense/pull/166) đã merge vào `main` với commit `37486333c09b7cc7f57c0443c6dfc1db8719c44b`; CI main, Cloudflare Pages production và HTTP smoke test đều pass. Thay đổi đã hoàn tất triển khai, không có migration/API/backend runtime cần deploy thêm.

## Pending tasks

- [ ] Chạy backup/restore và rollback drill trên staging bằng secrets riêng.
- [ ] Hoàn tất synthetic E2E trên staging bằng tài khoản test riêng (`E2E_EMAIL`/`E2E_PASSWORD`).
- [ ] Xác nhận monitoring/alert routing production và retention của telemetry trước khi mở rộng vận hành.
- [ ] Cân nhắc dọn file generated đã từng được track như `scripts/__pycache__/*.pyc` trong một cleanup commit riêng.

## Known issues / limitations

- Build có cảnh báo chunk lớn liên quan XLSX/ExcelJS/charts; performance budget CI vẫn là kiểm soát bắt buộc.
- App không có offline mutation queue; không coi giao dịch là đã lưu nếu request chưa thành công.
- Cloudflare Pages build settings và Supabase production secrets nằm ngoài repo; chỉ xác minh được qua CI/deployment, không ghi giá trị vào tài liệu.
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

- Ordered migrations are in `supabase/migrations/`; production `main` đã có asset/filter migrations `202609160001`–`202609160007`, với các Supabase Production Deploy run cho PR #160, #162, #163 và #164 đều pass. Thay đổi Dashboard hiện tại không có migration.
- Current schema includes families/members, catalogs, transactions, budgets, recurring templates/runs, import audit and minimal AI usage logs.
- RLS/owner-member policies and guarded RPCs are part of the migration contract. Do not infer authorization from frontend checks.
- Production migration/function deployment is handled by `.github/workflows/supabase-deploy.yml` after matching changes reach `main`.

## Environment and configuration notes

- Frontend public variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Supabase Edge secrets include `GEMINI_API_KEY`, `GEMINI_MODEL`, Brevo sender/API variables and the server-side Supabase credentials required by functions.
- Never read or print `.env` contents, tokens or secret values.
- Local commands use pnpm. Supabase local DB tests require the Supabase CLI/container runtime.
- Cloudflare Pages uses `dist` as the Vite build output and SPA fallback assets are in `public/`/Vite PWA configuration.

## Testing status

Latest application/release validation:

- Merge commit `37486333c09b7cc7f57c0443c6dfc1db8719c44b` của PR [#166](https://github.com/nhan0805/family-expense/pull/166): CI main [run 35134311249](https://github.com/nhan0805/family-expense/actions/runs/35134311249) pass quality, E2E, db-security và performance budget.
- Local release validation: full Vitest 43 file/201 test, TypeScript, ESLint, production build và `git diff --check` pass; Playwright E2E local 4 pass/2 skip vì chưa cấu hình tài khoản test.
- Cloudflare Pages production [check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/e5e0a156-8878-416e-ad98-c29c6f90cb82) pass; smoke `https://family-expense-8fo.pages.dev/` trả HTTP 200.
- Không chạy Supabase Production Deploy mới cho PR #166 vì không có thay đổi schema, migration, Edge Function hoặc backend runtime; run gần nhất [35081191930](https://github.com/nhan0805/family-expense/actions/runs/35081191930) vẫn pass.

For a new change, rerun only the relevant focused tests during iteration, then the full release gate before deploy: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`, plus E2E/DB tests when applicable.

## Next recommended step

Tiếp theo có thể chạy backup/restore và rollback drill trên staging với secrets riêng; không dùng production làm môi trường rehearsal.

## Session start instructions

1. Read `AGENTS.md`.
2. Read this file and the newest relevant `CHANGELOG.md` entry.
3. Read the relevant section of `docs/PROJECT_MAP.md`.
4. Load the matching `.agent/skills/*/SKILL.md`.
5. Inspect only the implementation files directly related to the request.
