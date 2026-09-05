# Nhật ký thay đổi Family Expense

## 2026-09-05

### Bổ sung xóa mềm mẫu chi phí định kỳ

- Trước thay đổi: Trang Chi phí định kỳ chưa có thao tác xóa; mẫu không thể được dừng vĩnh viễn khỏi danh sách bằng một luồng có xác nhận.
- Sau thay đổi: Owner có nút `Xóa` với hộp thoại xác nhận. Mẫu được xóa mềm, ẩn khỏi danh sách và không tạo giao dịch mới; các giao dịch đã tạo và lịch sử kỳ chạy vẫn được giữ nguyên. Member không thấy thao tác thay đổi.
- Kỹ thuật: thêm `deleted_at`/`deleted_by`, RPC owner-only `delete_recurring_transaction`, chặn resume mẫu đã xóa, lọc mẫu đã xóa ở API/localStorage và cập nhật test pgTAP/Vitest.
- Files/DB object: `src/pages/RecurringExpenses.tsx`, `src/lib/recurringExpense.ts`, `src/lib/recurringExpensesApi.ts`, `src/lib/recurringExpense.test.ts`, `src/pages/RecurringExpenses.test.tsx`, `supabase/migrations/202609050004_recurring_delete.sql`, `supabase/tests/recurring_expenses.sql`.
- Kiểm thử: Vitest đạt 34/34 file, 143/143 test; `tsc -b`, ESLint, production build và `git diff --check` pass. E2E smoke Chromium chạy được nhưng skip 2 test cloud vì thiếu `E2E_EMAIL/E2E_PASSWORD` trong local. Build còn cảnh báo chunk ExcelJS lớn hiện hữu. `supabase test db --local` chưa chạy được vì PostgreSQL local tại `127.0.0.1:54322` chưa hoạt động.
- Trạng thái triển khai thực tế: Chưa deploy production; đã sẵn sàng commit/push, tạo PR và chờ required checks cùng Supabase/Cloudflare Git integration.

### Triển khai các đợt Phase 0–4: ổn định, UI, hiệu năng và vận hành

- Trước thay đổi: một số mutation vẫn invalidates sai key Dashboard; lỗi tải Dashboard có thể hiển thị KPI bằng 0; draft chỉnh sửa dùng chung với draft tạo mới; giao dịch định kỳ chưa có lịch sử xem lại và kỳ đã bỏ qua cần hardening chống tạo lại. Import kiểm tra trùng theo từng dòng, danh sách file chưa có giới hạn rõ ràng, biểu đồ `Khác` chưa drill-down được bằng bàn phím.
- Sau thay đổi: thống nhất key `dashboard-data`, hiển thị retry và giữ dữ liệu cũ khi tải lại lỗi, draft theo từng giao dịch có cảnh báo rời trang, badge `Dự kiến/Thực tế` trên mobile/desktop, drill-down nhóm `Khác`, URL filter được giữ khi quay lại danh sách, import giới hạn 10 MB/1.000 dòng và kiểm tra trùng bằng Set. Trang định kỳ có dự báo các kỳ sắp tới và lịch sử kỳ chạy; migration hardening giữ anchor khi sửa mẫu và không tái tạo occurrence đã bỏ qua.
- Hiệu năng/vận hành: Dashboard chỉ lấy các cột cần thiết và gom dữ liệu theo một lượt; thêm tài liệu đo baseline `docs/PERFORMANCE_BASELINE.md`, telemetry tùy chọn qua `VITE_ERROR_REPORTING_ENDPOINT` không gửi nội dung nhạy cảm, E2E demo luôn chạy trong CI, cùng hai assertion pgTAP cho recurring hardening. Runbook cập nhật retention log tối đa 30 ngày.
- Files/DB objects: `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`, `src/pages/TransactionForm.tsx`, `src/pages/RecurringExpenses.tsx`, `src/lib/transactionsApi.ts`, `src/lib/templateImport.ts`, `src/lib/templateImport.test.ts`, `src/lib/transactionDraft.ts`, `src/lib/recurringExpense.ts`, `src/lib/recurringExpensesApi.ts`, `src/lib/telemetry.ts`, `src/lib/telemetry.test.ts`, `src/components/Feedback.tsx`, `src/components/Layout.tsx`, `src/components/TransactionRow.tsx`, `src/main.tsx`, `.github/workflows/ci.yml`, `supabase/migrations/202609050003_recurring_hardening.sql`, `supabase/migrations/202609050004_recurring_delete.sql`, `supabase/tests/recurring_expenses.sql`, `docs/PERFORMANCE_BASELINE.md`, `docs/OPERATIONS_RUNBOOK.md`.
- Kiểm thử: Vitest đạt 34/34 file, 143/143 test; typecheck, lint, production build và `git diff --check` pass. E2E Chromium khởi động được nhưng skip 2 test cloud vì local không có `E2E_EMAIL/E2E_PASSWORD`; pgTAP local chưa chạy vì PostgreSQL tại `127.0.0.1:54322` chưa hoạt động. Build còn cảnh báo chunk ExcelJS lớn hiện hữu.
- Trạng thái triển khai dự kiến: Đã sẵn sàng commit/push, mở PR vào `main`, bật auto-merge và chờ required checks cùng Supabase/Cloudflare Git integration; chưa deploy production hoặc chạy migration production.

### Hỗ trợ AI tìm kiếm giao dịch theo điều kiện loại trừ

- Trước thay đổi: AI search chỉ biểu diễn được các điều kiện bao gồm; câu như “tất cả chi tiêu trừ khoản đầu tư” không có bộ lọc `NOT IN` nên có thể trả sai hoặc không trả kết quả.
- Sau thay đổi: AI nhận diện các từ “trừ”, “ngoại trừ”, “không gồm”, “bỏ qua”, “không tính” và trả về bộ lọc loại trừ theo mục đích, danh mục hoặc phương thức thanh toán. Mảng bao gồm rỗng tiếp tục có nghĩa là lấy tất cả.
- Kỹ thuật: mở rộng `src/lib/ai.ts`, `src/lib/quickTransactionSearch.ts`, Edge Function `search-transactions`, state/UI trang `Transactions`; thêm `list_family_transactions_v2` và `list_deleted_transactions_v2` trong migration `supabase/migrations/202609050002_transaction_search_exclusions.sql`. RPC cũ được giữ nguyên để tương thích.
- Kiểm thử: full Vitest 33/33 file, 137/137 test; typecheck, lint, production build, `git diff --check` và CI `db-security` pass. Supabase Production Deploy [run 33962996428](https://github.com/nhan0805/family-expense/actions/runs/33962996428) pass; Cloudflare Pages [check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/67960011-9d47-4090-86f6-e47a9eec2eb4) pass; production smoke test HTTP 200.
- Trạng thái triển khai thực tế: PR [#128](https://github.com/nhan0805/family-expense/pull/128) đã merge vào `main` với merge commit `af1cc76ac4eb70df5500b65c4d978f908569e031`; migration và Edge Function đã deploy production qua Git integration. Không dùng Wrangler deploy trực tiếp.

### Tự động tạo giao dịch chi phí định kỳ khi đến hạn

- Trước thay đổi: `recurring_transactions` mới chỉ là bảng nền; chưa có form quản lý, lịch sử kỳ chạy, cơ chế tự tạo giao dịch hoặc chống trùng.
- Sau thay đổi: Owner có thể tạo/sửa/tạm dừng/tiếp tục/bỏ qua mẫu chi định kỳ theo tuần, tháng hoặc năm. Supabase Cron chạy lúc 00:05 `Asia/Ho_Chi_Minh`, tự tạo các giao dịch `Dự kiến` đến hạn, catch-up các kỳ bị bỏ lỡ và chỉ chuyển thành `Thực tế` sau khi người dùng xác nhận.
- Kỹ thuật: thêm migration `supabase/migrations/202609050001_recurring_expenses.sql` với `transaction_source=recurring`, liên kết `transactions.recurring_transaction_id`, bảng `recurring_transaction_runs`, RPC validation/RLS/idempotency và job `pg_cron`; thêm `src/lib/recurringExpense.ts`, `src/lib/recurringExpensesApi.ts`, `src/pages/RecurringExpenses.tsx`, route/navigation, badge giao dịch định kỳ và bản dịch VI/EN.
- Fallback demo lưu mẫu ở localStorage và tự tạo giao dịch dự kiến khi mở màn hình; không thêm dependency và không tự động ghi dữ liệu cloud khi chưa có migration.
- Kiểm thử: `tsc -b`, ESLint, full Vitest đạt 33/33 file, 134/134 test, production build và `git diff --check` pass. `supabase test db --local` chưa chạy được vì PostgreSQL local tại `127.0.0.1:54322` chưa hoạt động.
- Trạng thái triển khai thực tế: PR [#125](https://github.com/nhan0805/family-expense/pull/125) đã merge với commit `827626d752285dd52b8a27c2fe4a628b61fded52`; migration recurring đã apply production. PR [#126](https://github.com/nhan0805/family-expense/pull/126) đã merge với commit `8165d040062a40cf40c4303576eb7e13825c9aa1` để làm cleanup idempotent. Supabase Production Deploy [run 33942519577](https://github.com/nhan0805/family-expense/actions/runs/33942519577) và Cloudflare Pages [deployment check](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/69d94d69-b1cd-419d-bdf3-2ddd4a50e4e8) đều pass; smoke test production trả HTTP 200 lúc `05/09/2026 10:43` (`Asia/Ho_Chi_Minh`). Không dùng Wrangler deploy trực tiếp.

### Làm idempotent bước dọn Edge Function khi deploy

- Trước thay đổi: Supabase Production Deploy dừng nếu một Edge Function semantic đã được xóa từ trước, dù migration và các bước deploy khác đã thành công.
- Sau thay đổi: Workflow chỉ bỏ qua đúng lỗi “function không tồn tại”, nhưng vẫn fail với các lỗi xóa khác để lần chạy sau có thể hoàn tất an toàn.
- Files: `.github/workflows/supabase-deploy.yml`; không đổi schema hoặc dữ liệu ứng dụng.
- Kiểm thử: kiểm tra YAML/script bằng CI; cần rerun `db-security`, Supabase Production Deploy và Cloudflare Pages sau khi merge.
- Trạng thái triển khai thực tế: PR [#126](https://github.com/nhan0805/family-expense/pull/126) đã merge; Supabase Production Deploy [run 33942519577](https://github.com/nhan0805/family-expense/actions/runs/33942519577) pass sau khi rerun, gồm cleanup hai Edge Function semantic cũ.

## 2026-09-04

### Tăng tốc AI search

- Trước thay đổi: Mỗi lần bấm **Gợi ý AI** đều gọi Edge Function/Gemini, kể cả khi người dùng lặp lại cùng câu; khi bộ lọc mới tải, danh sách có thể trống tạm thời.
- Sau thay đổi: Các câu chỉ gồm bộ lọc cấu trúc rõ ràng (ví dụ danh mục, mục đích, phương thức, loại, trạng thái, tháng/năm) được xử lý nhanh ngay trên client; các câu còn lại dùng cache 5 phút, chống gọi trùng và giữ kết quả cũ trong lúc tải bộ lọc mới.
- Files: `src/lib/quickTransactionSearch.ts`, `src/lib/quickTransactionSearch.test.ts`, `src/lib/aiClient.ts`, `src/lib/aiClient.test.ts`, `src/pages/Transactions.tsx`. Không đổi schema hoặc dữ liệu giao dịch.
- Kiểm thử: Chạy full test, typecheck, lint, build và `git diff --check` trước khi merge.
- Trạng thái triển khai dự kiến: Tạo PR vào `main`, bật auto-merge và chờ Cloudflare Pages Git deployment.

### Loại bỏ semantic search và dữ liệu embedding

- Trước thay đổi: AI search phụ thuộc vào backfill `gte-small` và bảng `transaction_embeddings`, khiến việc phân tích AI thành công nhưng tải danh sách vẫn có thể lỗi trên Supabase Free.
- Sau thay đổi: AI search chỉ áp dụng bộ lọc cấu trúc (loại, trạng thái, mục đích, danh mục, phương thức, số tiền, thời gian) và dùng keyword RPC ổn định; semantic search không còn được gọi từ giao diện. Multi-select vẫn giữ nguyên. Migration mới xoá bảng `transaction_embeddings`, các RPC embedding/semantic và extension `vector`; hai Edge Function semantic cùng helper cũng được gỡ khỏi source và workflow deploy.
- Files: `src/pages/Transactions.tsx`, `src/lib/transactionsApi.ts`, `src/lib/ai.ts`, `src/lib/transactionsApi.test.ts`, `src/lib/ai.test.ts`, `supabase/functions/search-transactions/index.ts`, `supabase/config.toml`, `.github/workflows/supabase-deploy.yml`, `supabase/migrations/202609040005_remove_semantic_search.sql`, `supabase/tests/transaction_search_filters.sql`, `README.md`. Không xoá dữ liệu giao dịch.
- Kiểm thử: full test, typecheck, lint, build và `git diff --check` sẽ chạy lại trước khi merge; pgTAP kiểm tra các object semantic đã được xoá.
- Trạng thái triển khai dự kiến: Cập nhật PR vào `main`, bật auto-merge và chờ migration Supabase production cùng Cloudflare Pages Git deployment.

### Loại bỏ account và event khỏi luồng ứng dụng

- Trước thay đổi: Giao diện đã ẩn các trường Tài khoản/Thẻ và Sự kiện/Kế hoạch, nhưng schema, bản nháp, payload tạo/sao chép giao dịch, parser Excel cũ và truy vấn export vẫn còn giữ các trường legacy.
- Sau thay đổi: Loại bỏ hai trường khỏi model giao dịch phía frontend, bản nháp, import/parser, payload ghi giao dịch và quan hệ truy vấn export; template Excel hiện hành và dữ liệu giao dịch mới không còn phụ thuộc account/event.
- Kỹ thuật: Cập nhật `src/lib/domain.ts`, `src/lib/transactionDraft.ts`, `src/lib/transactionsApi.ts`, `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx`, `src/pages/ImportExport.tsx`, `src/lib/importExcel.ts` và regression test tương ứng. Không thêm migration, không xóa dữ liệu hoặc bảng/cột legacy trong database để bảo toàn dữ liệu cũ.
- Kiểm thử: Full suite đạt 30/30 file, 124/124 test; typecheck, lint, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Trạng thái triển khai thực tế: PR [#122](https://github.com/nhan0805/family-expense/pull/122) đã merge vào `main` với merge commit `10b400b2cffb8bd5e514039fd84dde481df758b8`. CI main [run 33881057378](https://github.com/nhan0805/family-expense/actions/runs/33881057378) pass với `quality` và `db-security`; check [Cloudflare Pages](https://github.com/nhan0805/family-expense/runs/101049819883) báo deploy thành công. Production [family-expense-8fo.pages.dev](https://family-expense-8fo.pages.dev/) smoke test trả HTTP 200 lúc `04/09/2026 21:01` (`Asia/Ho_Chi_Minh`). Không có migration/function thay đổi nên không chạy Supabase Production Deploy; cập nhật tài liệu sau deploy chỉ ở local để tránh tạo deploy lần hai.

### Giữ kết quả AI search khi backfill embedding lỗi

- Trước thay đổi: AI có thể phân tích đúng câu tìm kiếm nhưng luồng tải kết quả bị dừng nếu batch backfill embedding gặp giới hạn CPU; các giao dịch chưa có vector cũng bị loại khỏi semantic RPC.
- Sau thay đổi: Backfill embedding là best-effort với batch 5; semantic search vẫn chạy và dùng bộ lọc cấu trúc/từ khóa khi backfill chưa hoàn tất. RPC semantic dùng `left join` để không làm mất giao dịch chưa có embedding và ưu tiên từ khóa gốc của câu hỏi.
- Files/DB object: `src/lib/transactionsApi.ts`, `src/lib/transactionsApi.test.ts`, `supabase/migrations/202609040004_semantic_search_missing_embeddings.sql`. Không tự động ghi dữ liệu ngoài luồng tìm kiếm của user.
- Kiểm thử: `pnpm test` đạt 30/30 file, 123/123 test; typecheck, lint, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Trạng thái triển khai dự kiến: Tạo PR vào `main`, bật auto-merge và chờ Supabase Production Deploy cùng Cloudflare Pages Git deployment.

### Giảm lỗi CPU khi AI search khởi tạo embedding

- Trước thay đổi: Manual search vẫn trả kết quả nhưng AI search có thể báo không tải được danh sách. Log production ghi nhận `process-transaction-embeddings` bị `546 WORKER_RESOURCE_LIMIT` và `CPU Time exceeded` trước khi semantic search được gọi.
- Sau thay đổi: Dùng lại một session `gte-small` trong suốt vòng đời Edge Function isolate để không khởi tạo model lặp lại cho từng dòng; giữ batch tối đa 20 như thiết kế để semantic search vẫn bao phủ dữ liệu cần thiết.
- Files: `supabase/functions/_shared/transactionEmbedding.ts`, `src/lib/transactionsApi.test.ts`. Không tự động backfill toàn bộ dữ liệu production.
- Kiểm thử: `pnpm test` đạt 30/30 file, 122/122 test; typecheck, lint, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Trạng thái triển khai dự kiến: Tạo PR vào `main`, bật auto-merge và chờ Supabase Production Deploy cùng Cloudflare Pages Git deployment.

### Khắc phục AI search không tải được danh sách giao dịch

- Trước thay đổi: Bảng `transaction_embeddings` có thể vẫn trống vì backfill được thiết kế lazy; khi AI đi vào semantic path, payload vector/RPC runtime có thể khiến bước tạo embedding hoặc truy vấn thất bại và UI chỉ hiện lỗi tải danh sách.
- Sau thay đổi: Vector được gửi tới RPC dưới dạng pgvector literal; hash nội dung backfill dùng `md5` built-in, không phụ thuộc schema cài `pgcrypto`; migration gửi yêu cầu reload schema cho PostgREST. Bảng embedding vẫn chỉ tăng dữ liệu khi có semantic search, không tự sinh hàng loạt ngay lúc migrate.
- Kỹ thuật: cập nhật `supabase/functions/_shared/transactionEmbedding.ts`, `process-transaction-embeddings`, `search-transactions-semantic` và thêm migration `supabase/migrations/202609040003_fix_transaction_embedding_runtime.sql`. Không đọc hoặc ghi trực tiếp dữ liệu tài chính ngoài luồng tìm kiếm của user.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; typecheck, lint, build và `git diff --check` pass. Playwright đã khởi động được sau khi cài browser nhưng 2 test cloud bị bỏ qua vì chưa có `E2E_EMAIL`/`E2E_PASSWORD`.
- Trạng thái triển khai: Chưa deploy production; thay đổi đang được kiểm tra cùng PR UI.

### Căn mũi tên cùng hàng cho bộ lọc multi-select

- Trước thay đổi: Trigger Mục đích, Danh mục và Phương thức thanh toán bị áp `display: block` từ class `.field`, khiến mũi tên rơi xuống dòng dưới và ô cao hơn các select còn lại.
- Sau thay đổi: Trigger multi-select có `display: flex`, căn nội dung và mũi tên cùng hàng, giữ chiều cao đồng nhất với các box lọc khác.
- Kỹ thuật: thêm class CSS scoped `multi-select-trigger` trong `src/components/MultiSelectField.tsx` và `src/index.css`; bổ sung regression assertion trong `src/pages/Transactions.ui.test.tsx`. Đồng thời chuẩn hóa vector gửi vào RPC semantic thành pgvector literal và dùng `md5` ổn định cho backfill qua migration `supabase/migrations/202609040003_fix_transaction_embedding_runtime.sql`. Không đổi API nghiệp vụ hoặc dữ liệu giao dịch.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; typecheck, lint, build và `git diff --check` pass. Playwright đã khởi động được sau khi cài browser nhưng 2 test cloud bị bỏ qua vì chưa có `E2E_EMAIL`/`E2E_PASSWORD`.
- Trạng thái triển khai: Chưa deploy production; thay đổi đang ở workspace.

### Highlight user hiện tại trong Thành viên

- Trước thay đổi: Danh sách thành viên chưa có dấu hiệu trực quan để phân biệt tài khoản đang đăng nhập với các thành viên khác.
- Sau thay đổi: Dòng của user hiện tại được nhấn bằng nền/viền màu accent và badge `Bạn`; nhãn accessible cũng nêu rõ đây là tài khoản đang đăng nhập.
- Kỹ thuật: cập nhật `src/pages/Members.tsx`, style trong `src/index.css`, thêm key `you`/`currentAccount` cho VI/EN trong `src/context/LanguageContext.tsx` và regression test `src/pages/Members.test.tsx`. Màu dùng biến theme sáng/tối hiện có; không đổi API, schema, RLS/RPC hoặc dữ liệu.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass.
- Trạng thái triển khai: Đang chuẩn bị deploy production qua PR và Git integration của Cloudflare Pages.

### Hiển thị tên người dùng và liên kết Thành viên

- Trước thay đổi: Header hiển thị email của tài khoản đang đăng nhập; tên chưa dẫn trực tiếp tới màn hình Thành viên.
- Sau thay đổi: Header ưu tiên `display_name` của thành viên hiện tại, fallback lần lượt về tên trong metadata tài khoản hoặc email. Tên người dùng trên desktop và mobile đều là liên kết tới `/thanh-vien`.
- Kỹ thuật: mở rộng `AppContext` với `currentUserDisplayName`, đọc `family_members.display_name` theo đúng user/family đang hoạt động và cập nhật regression test cho context/layout. Không thêm migration, không đổi API/RLS/RPC hay dữ liệu.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass.
- Trạng thái triển khai: Đang chuẩn bị deploy production qua PR và Git integration của Cloudflare Pages.
### Hoàn thiện theme Dracula cho dark mode

- Trước thay đổi: Chữ phụ ở Dữ liệu, Thành viên, Giao dịch, form và auth còn dùng màu `text-gray-500` thiếu dark variant; một số lỗi còn nền `bg-red-50`; nút thao tác hàng loạt và biểu đồ xu hướng chưa đổi đúng theo dark mode.
- Sau thay đổi: Dùng màu muted/error theo Dracula cho các route và state liên quan; nút thao tác hàng loạt dùng accent dark; biểu đồ có palette, grid, trục, legend và tooltip theo biến light/dark; nút chọn file và dòng lỗi import có viền/màu dark phù hợp.
- Kỹ thuật: Cập nhật `src/index.css`, các UI page/component liên quan và thêm assertion hồi quy trong `src/pages/ImportExport.test.tsx`, `src/pages/TransactionForm.test.tsx`. Không có migration mới, không đổi API, schema, RLS/RPC hoặc dữ liệu.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build còn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Trạng thái triển khai dự kiến: Push nhánh `codex/transaction-filter-ui-20260904`, tạo PR vào `main`, bật auto-merge và chờ Cloudflare Pages production deploy qua Git integration.

### Khắc phục AI search không tải được danh sách giao dịch

- Trước thay đổi: Bảng `transaction_embeddings` có thể vẫn trống vì backfill được thiết kế lazy; khi AI đi vào semantic path, payload vector/RPC runtime có thể khiến bước tạo embedding hoặc truy vấn thất bại và UI chỉ hiện lỗi tải danh sách.
- Sau thay đổi: Vector được gửi tới RPC dưới dạng pgvector literal; hash nội dung backfill dùng `md5` built-in, không phụ thuộc schema cài `pgcrypto`; migration gửi yêu cầu reload schema cho PostgREST. Bảng embedding vẫn chỉ tăng dữ liệu khi có semantic search, không tự sinh hàng loạt ngay lúc migrate.
- Kỹ thuật: cập nhật `supabase/functions/_shared/transactionEmbedding.ts`, `process-transaction-embeddings`, `search-transactions-semantic` và thêm migration `supabase/migrations/202609040003_fix_transaction_embedding_runtime.sql`. Không đọc hoặc ghi trực tiếp dữ liệu tài chính ngoài luồng tìm kiếm của user.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; typecheck, lint, build và `git diff --check` pass. Playwright đã khởi động được sau khi cài browser nhưng 2 test cloud bị bỏ qua vì chưa có `E2E_EMAIL`/`E2E_PASSWORD`.
- Trạng thái triển khai: Chưa deploy production; thay đổi đang được kiểm tra cùng PR UI.

### Căn mũi tên cùng hàng cho bộ lọc multi-select

- Trước thay đổi: Trigger Mục đích, Danh mục và Phương thức thanh toán bị áp `display: block` từ class `.field`, khiến mũi tên rơi xuống dòng dưới và ô cao hơn các select còn lại.
- Sau thay đổi: Trigger multi-select có `display: flex`, căn nội dung và mũi tên cùng hàng, giữ chiều cao đồng nhất với các box lọc khác.
- Kỹ thuật: thêm class CSS scoped `multi-select-trigger` trong `src/components/MultiSelectField.tsx` và `src/index.css`; bổ sung regression assertion trong `src/pages/Transactions.ui.test.tsx`. Đồng thời chuẩn hóa vector gửi vào RPC semantic thành pgvector literal và dùng `md5` ổn định cho backfill qua migration `supabase/migrations/202609040003_fix_transaction_embedding_runtime.sql`. Không đổi API nghiệp vụ hoặc dữ liệu giao dịch.
- Kiểm thử: `pnpm test` đạt 29/29 file, 121/121 test; typecheck, lint, build và `git diff --check` pass. Playwright đã khởi động được sau khi cài browser nhưng 2 test cloud bị bỏ qua vì chưa có `E2E_EMAIL`/`E2E_PASSWORD`.
- Trạng thái triển khai: Chưa deploy production; thay đổi đang ở workspace.

### Multi-select manual/AI và semantic search cho giao dịch

- Trước thay đổi: Bộ lọc Mục đích, Danh mục và Phương thức thanh toán chỉ nhận một giá trị; AI search cũng chỉ trả về một ID và tìm kiếm nội dung bằng substring.
- Sau thay đổi: Ba bộ lọc catalog hỗ trợ chọn nhiều giá trị theo phép OR, các nhóm lọc khác vẫn kết hợp theo AND. AI search trả về đầy đủ các catalog ID được nhắc trong câu và phần nội dung còn lại có thể tìm theo semantic similarity.
- Kỹ thuật: thêm `src/components/MultiSelectField.tsx`; cập nhật `src/pages/Transactions.tsx`, `src/lib/transactionsApi.ts`, `src/lib/ai.ts`, `supabase/functions/search-transactions/index.ts`; thêm `supabase/migrations/202609040002_transaction_search_semantic.sql`, hai Edge Function embedding/semantic search, shared `gte-small` embedding helper và pgTAP test. Migration bật `pgvector`, bảng `transaction_embeddings`, HNSW cosine index, RLS và các RPC family-scoped; workflow/config deploy thêm hai function. Không gọi Gemini để tạo embedding.
- Kiểm thử: Vitest đạt 29/29 file, 121/121 test; typecheck, lint, coverage, build và `git diff --check` pass ở local. pgTAP local không chạy được vì máy không có database local/Docker (`127.0.0.1:54322` từ chối kết nối), nhưng CI đã chạy migration/RLS test pass ở PR và CI `main`; Playwright local chưa chạy assertion vì thiếu browser binaries.
- Trạng thái triển khai: PR [#117](https://github.com/nhan0805/family-expense/pull/117) đã merge vào `main` với merge commit `516eb83aeb5de14f18c32572312ee8d7ca366dab`. CI main [run 33862005988](https://github.com/nhan0805/family-expense/actions/runs/33862005988) pass với `quality` và `db-security`; Supabase Production Deploy [run 33862006229](https://github.com/nhan0805/family-expense/actions/runs/33862006229) pass, đã áp migration và deploy hai Edge Function. Cloudflare Pages production `https://family-expense-8fo.pages.dev/` trả HTTP 200 và bundle live có `process-transaction-embeddings`/`search-transactions-semantic` lúc `04/09/2026 17:18` (`Asia/Ho_Chi_Minh`). Không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Chuyển Danh mục sang tab để bỏ thanh cuộn ngang

- Trước thay đổi: Ba card Danh mục hiển thị cạnh nhau trên desktop, cần card tối thiểu 440px nên màn hình hẹp phải dùng thanh cuộn ngang.
- Sau thay đổi: Hiển thị ba tab `Mục đích`, `Danh mục` và `Phương thức thanh toán`; mỗi lần chỉ hiển thị một nhóm, giữ toàn bộ tên dài mà không cần thanh cuộn. Tab có trạng thái đang chọn và hỗ trợ bàn phím qua cấu trúc ARIA `tablist`/`tab`/`tabpanel`.
- Kỹ thuật: cập nhật `src/pages/Catalogs.tsx` và style tab trong `src/index.css`; bổ sung regression test chuyển tab trong `src/pages/Catalogs.test.tsx`. Không thay đổi API, schema, migration, dữ liệu hoặc quy tắc nghiệp vụ.
- Kiểm thử: `vitest run` đạt 29/29 file, 119/119 test; test Catalogs 6/6; lint, typecheck, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#116](https://github.com/nhan0805/family-expense/pull/116) đã merge vào `main` với merge commit `65b9ca3887cd5829cf8c78167babc544b48040ca`. CI main [run 33859027524](https://github.com/nhan0805/family-expense/actions/runs/33859027524) và Cloudflare Pages Preview [run 33858579028](https://github.com/nhan0805/family-expense/actions/runs/33858579028) pass; production `https://family-expense-8fo.pages.dev/` trả HTTP 200 và chunk Danh mục chứa `catalog-tabs`, `tablist`, `tabpanel` lúc `04/09/2026 16:38` (`Asia/Ho_Chi_Minh`). Không có migration mới nên không cần Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Đóng panel thông báo khi bấm ra ngoài

- Trước thay đổi: Panel Thông báo chỉ đóng khi bấm lại icon chuông hoặc chọn một liên kết trong panel.
- Sau thay đổi: Bấm vào bất kỳ vùng nào bên ngoài vùng chuông/panel sẽ đóng panel; bấm bên trong vẫn không bị ảnh hưởng và phím `Escape` cũng đóng panel.
- Kỹ thuật: thêm listener `pointerdown` ngoài vùng chứa và listener `Escape` trong `src/components/BudgetNotifications.tsx`; bổ sung regression test trong `src/components/BudgetNotifications.test.tsx`. Không thay đổi API, schema, migration, dữ liệu hoặc quy tắc nghiệp vụ.
- Kiểm thử: Test `BudgetNotifications` đạt 5/5, lint component pass và build frontend pass. Full test hiện 27/29 file, 114/120 test pass; 6 test lỗi do các thay đổi chưa được track sẵn ở `src/lib/ai.ts`, `src/lib/transactionsApi.ts`, `src/pages/Transactions.tsx` và `src/pages/Transactions.test.ts` đang lệch giữa `purposeId`/`purposeIds` và schema bộ lọc AI, không liên quan đến panel thông báo. Typecheck cũng gặp cùng lỗi ở `Transactions.test.ts`.
- Trạng thái triển khai: Chưa deploy production; chờ xử lý các thay đổi semantic search đang có trong workspace.

### Trung tâm thông báo: xác nhận giao dịch dự kiến và xóa cảnh báo đã đọc

- Sau thay đổi: Nút chuông hiển thị cả cảnh báo ngân sách và giao dịch dự kiến đã tới hạn; người dùng có thể xác nhận từng giao dịch hoặc tất cả ngay trong panel. Khối xác nhận giao dịch dự kiến được bỏ khỏi Tổng quan để giảm chiều dài trang.
- Bổ sung nút `Xóa đã đọc` để dọn các cảnh báo ngân sách đã đọc; cảnh báo chưa đọc và dữ liệu giao dịch không bị ảnh hưởng. Badge chuông tính cả mục chưa đọc và giao dịch cần xác nhận.
- Kỹ thuật: cập nhật `src/components/BudgetNotifications.tsx`, `src/lib/budgetNotifications.ts`, `src/pages/Dashboard.tsx` và test tương ứng. Không thêm migration, schema, API hoặc thay đổi RLS/RPC.
- Kiểm thử: Test tập trung 14/14 pass; full `pnpm test` đạt 29/29 file, 118/118 test; lint, typecheck và build pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Trạng thái triển khai: Đã merge PR [#115](https://github.com/nhan0805/family-expense/pull/115) vào `main` với squash merge commit `5357ba915d873bb4fb1ffcd331eed27e9c6887a7`. CI main [run 33856554881](https://github.com/nhan0805/family-expense/actions/runs/33856554881) pass với `quality` và `db-security`; Cloudflare Pages production check pass trên merge commit. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `04/09/2026 16:10` (`Asia/Ho_Chi_Minh`). Không có migration mới nên không chạy Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Hiển thị đầy đủ tên dài trong Danh mục

- Trước thay đổi: Tên mục đích/danh mục dài vẫn bị `truncate` thành dấu `...`, khiến người dùng không xem được toàn bộ nội dung dù badge `Ẩn ngân sách` đã được tách xuống dòng.
- Sau thay đổi: Ba card Danh mục trên desktop có chiều rộng tối thiểu 440px và cuộn ngang khi màn hình hẹp; tên dài giữ một dòng, không còn `...`. Trên mobile, tên vẫn có thể xuống dòng để không làm vỡ màn hình; icon, badge và nút sửa/xóa giữ bố cục ổn định.
- Kỹ thuật: cập nhật grid Danh mục và layout item trong `src/pages/Catalogs.tsx`, cho danh sách cuộn ngang trong `src/index.css`, và cập nhật regression assertion trong `src/pages/Catalogs.test.tsx`. Không thay đổi API, schema, migration, dữ liệu hoặc quy tắc ngân sách.
- Kiểm thử: Bổ sung assertion tên dùng `lg:whitespace-nowrap`, không còn `truncate`, card dùng grid tối thiểu 440px; `vitest run` đạt 29/29 file, 115/115 test; lint, typecheck, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#114](https://github.com/nhan0805/family-expense/pull/114) đã merge vào `main` với merge commit `20f0cabf24d01dd3ad267f9205791f28aa514f9c`. PR checks gồm quality, db-security và Cloudflare Preview đều pass; CI main [run 33855827219](https://github.com/nhan0805/family-expense/actions/runs/33855827219) pass với quality và db-security. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200 và bundle live có layout `minmax(440px)`, `overflow-x-auto`, `lg:whitespace-nowrap` lúc `04/09/2026 16:02` (`Asia/Ho_Chi_Minh`). Không có migration mới nên không cần Supabase Production Deploy, không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Sửa badge Ẩn ngân sách che tên mục đích

- Trước thay đổi: Trong card Danh mục dạng 3 cột, badge `Ẩn ngân sách` và các nút thao tác chiếm chỗ của tên mục đích; tên dài có thể bị co xuống chỉ còn một vài ký tự và nhìn như bị badge che.
- Sau thay đổi: Tên mục đích có vùng nội dung riêng; badge `Ẩn ngân sách` nằm ở dòng bên dưới, không còn che hoặc ép tên co quá mức trên desktop hẹp và mobile.
- Kỹ thuật: cập nhật layout item trong `src/pages/Catalogs.tsx` và regression assertion trong `src/pages/Catalogs.test.tsx`. Không thay đổi API, schema, migration, dữ liệu hoặc quy tắc ngân sách.
- Kiểm thử: Đã bổ sung assertion bảo đảm tên dùng `truncate`, badge nằm cùng vùng nội dung nhưng ở dòng riêng; `vitest run` đạt 29/29 file, 115/115 test; lint, typecheck, build và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#113](https://github.com/nhan0805/family-expense/pull/113) đã merge vào `main` với squash merge commit `4534675f54c1d3629a7192de23c6b7ffd4d889c2`. CI main [run 33838912432](https://github.com/nhan0805/family-expense/actions/runs/33838912432) pass gồm `quality` và `db-security`; Cloudflare Pages production check pass. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200; lazy chunk Danh mục chứa layout badge ở dòng riêng lúc `04/09/2026 15:23` (`Asia/Ho_Chi_Minh`). Không có migration mới nên không chạy Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Cảnh báo ngân sách trong app — Phase 8

- Trước thay đổi: Khi chi tiêu chạm ngưỡng cảnh báo hoặc vượt ngân sách, người dùng chỉ thấy trạng thái trên trang Ngân sách; chưa có toast tức thời và trung tâm thông báo chung.
- Sau thay đổi: Header có chuông thông báo responsive với số chưa đọc; app hiển thị toast khi đạt ngưỡng cấu hình (mặc định 80%) và khi vượt ngân sách, có danh sách cảnh báo, đánh dấu từng mục/tất cả đã đọc và link về giao dịch đã lọc. Cảnh báo được chống lặp theo `family_id + tháng + mục đích`; chỉ nâng mức từ gần hạn mức lên vượt mới tạo toast mới.
- UX hỗ trợ đầy đủ Việt/Anh và Dracula dark mode; dữ liệu cảnh báo được suy ra từ `get_budget_summary` cho cloud hoặc local fallback cho demo. Trạng thái đọc/toast lưu trên thiết bị, không thêm dữ liệu tài chính hoặc secret mới; mục đích đã ẩn khỏi ngân sách tiếp tục không tạo cảnh báo.
- Kỹ thuật: thêm `src/components/BudgetNotifications.tsx`, `src/lib/budgetNotifications.ts` và test; tích hợp vào `src/components/Layout.tsx`, thêm bản dịch trong `src/context/LanguageContext.tsx`; invalidate cache ngân sách sau các mutation giao dịch ở Dashboard/Transactions/TransactionForm. Không thêm migration, bảng DB, API hoặc thay đổi RLS/RPC.
- Kiểm thử: `vitest run` đạt 29/29 file, 115/115 test; `eslint . --max-warnings=0`, `tsc -b --pretty false`, `vite build` và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: Đã deploy production cùng PR [#113](https://github.com/nhan0805/family-expense/pull/113), merge commit `4534675f54c1d3629a7192de23c6b7ffd4d889c2`; Cloudflare Pages production check và smoke test HTTP 200 đều pass.

### Kiểm thử hệ thống và hardening fallback/auth/maintenance

- Trước thay đổi: Khi Supabase chưa cấu hình, AppContext không có `familyId` nên Layout chuyển demo sang trang tạo gia đình; CRUD danh mục, import Excel, thao tác thành viên và đăng xuất vẫn có thể gọi Supabase placeholder. Form xác thực còn lộ nguyên văn lỗi provider và có thể giữ trạng thái bận khi promise bị reject; ngày giao dịch dạng `YYYY-MM-DD` được format qua timezone của thiết bị.
- Sau thay đổi: Demo fallback có family/user cục bộ và CRUD danh mục/import/thành viên/đăng xuất không gọi backend; lỗi auth được dịch theo VI/EN, có validate biên và `try/catch/finally`; ngày-only hiển thị ổn định theo lịch Việt Nam. Thêm migration harden `search_path` cho ba hàm `SECURITY DEFINER` bảo trì/xóa dữ liệu.
- Kỹ thuật: cập nhật `src/context/AppContext.tsx`, `src/components/Layout.tsx`, `src/pages/CreateFamily.tsx`, `src/pages/Members.tsx`, `src/pages/ImportExport.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/lib/errorRecovery.ts`, `src/lib/domain.ts`, `src/components/TransactionRow.tsx`, `src/pages/Transactions.tsx`; thêm regression tests và `supabase/migrations/202609040001_harden_maintenance_search_paths.sql`. Không chạy migration production, không sửa migration đã áp dụng và không thay đổi dữ liệu production.
- Kiểm thử: `pnpm test` đạt 27/27 file, 110/110 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Smoke UI cục bộ với cấu hình placeholder xác nhận mở Dashboard → Giao dịch → form, lưu giao dịch và truy cập Ngân sách/Danh mục. Playwright E2E chưa thực thi assertion vì thiếu browser binaries; Supabase/pgTAP local chưa chạy do Docker socket/CLI telemetry bị chặn.
- Trạng thái triển khai: Đã merge PR [#112](https://github.com/nhan0805/family-expense/pull/112) vào `main` với squash merge commit `e83a96aa3ea44a23852421bf6f7311dde9d8033e`. CI main [run 33829203375](https://github.com/nhan0805/family-expense/actions/runs/33829203375) pass gồm `quality` và `db-security`; Supabase Production Deploy [run 33829203393](https://github.com/nhan0805/family-expense/actions/runs/33829203393) pass và đã áp migration/deploy Edge Functions; Cloudflare Pages production check pass trên merge commit. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200. Không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

## 2026-09-03

### Mở rộng icon danh mục và căn chỉnh giao diện desktop

- Trước thay đổi: Picker icon chỉ có khoảng 39 lựa chọn; chưa có `Venus` (kết quả tìm `women` trên Lucide), `CircleDollarSign` và `BanknoteArrowDown`. Trên desktop, tên Mục đích/Danh mục bị co quá mức và cụm nút Sao chép/Xóa không nằm trong vùng cột cố định.
- Sau thay đổi: Picker có thêm 61 icon phổ biến từ Lucide, đạt tổng cộng 100 lựa chọn và tìm được theo tên hoặc từ khóa tiếng Việt; bảng giao dịch desktop có cột phân loại rộng hơn, tên dài truncate đúng và cụm thao tác được cố định thành hai ô đều nhau. Lỗi badge `Ẩn ngân sách` che tên ở màn hình Danh mục vẫn được giữ bản sửa `flex-1`/`overflow-hidden`; icon và tên phân loại trên card giao dịch mobile có khoảng cách 6px dễ đọc hơn.
- Kỹ thuật: nâng `lucide-react` từ `0.468.0` lên `0.485.0`; cập nhật `src/lib/catalogIcons.ts`, `src/components/TransactionRow.tsx`, `src/pages/Transactions.tsx` và regression tests tương ứng. Không thay đổi API, schema, migration, dữ liệu hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 25/25 file, 104/104 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#110](https://github.com/nhan0805/family-expense/pull/110) đã merge phần mở rộng icon/layout vào `main`; bản sửa spacing mobile được merge tiếp qua PR [#111](https://github.com/nhan0805/family-expense/pull/111) với merge commit `cd5129081424ef44358b9e9bd6a39f6ca7508a2d`. CI main [run 33735783477](https://github.com/nhan0805/family-expense/actions/runs/33735783477) pass gồm `quality` và `db-security`; Cloudflare Pages production check pass. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200 và artifact mới chứa spacing mobile lúc `03/09/2026 15:56` (`Asia/Ho_Chi_Minh`). Không có migration nên không chạy Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Đưa Thành viên vào mục Thêm trên taskbar mobile

- Trước thay đổi: Taskbar mobile hiển thị trực tiếp `Thành viên`, làm giảm không gian cho các khu vực chính.
- Sau thay đổi: Taskbar mobile hiển thị `Tổng quan`, `Giao dịch`, `Ngân sách`, `Danh mục` và `Thêm`; `Thành viên` vẫn truy cập được trong menu `Thêm`. Điều hướng desktop không thay đổi.
- Kỹ thuật: cập nhật danh sách `mobilePrimaryLinks` trong `src/components/Layout.tsx`; bổ sung regression test `src/components/Layout.test.tsx`.
- Kiểm thử: `pnpm test` đạt 25/25 file, 103/103 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#109](https://github.com/nhan0805/family-expense/pull/109) đã merge vào `main` với merge commit `b86cf67e4da5508123a21206315aaf0fa9b90196`. CI main [run 33717890896](https://github.com/nhan0805/family-expense/actions/runs/33717890896) và Cloudflare Pages production đều pass; production `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `03/09/2026 12:14` (`Asia/Ho_Chi_Minh`). Không có migration nên không chạy Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Đặt bộ lọc mặc định giao dịch theo tháng hiện tại và giao dịch thực tế

- Trước thay đổi: Màn hình Giao dịch đã mặc định theo tháng/năm hiện tại nhưng trạng thái để trống nên vẫn hiển thị cả giao dịch dự kiến; tháng hiện tại còn phụ thuộc múi giờ của thiết bị.
- Sau thay đổi: Khi mở màn hình không có kỳ hoặc trạng thái trên URL, danh sách lọc theo tháng hiện tại của `Asia/Ho_Chi_Minh` và chỉ hiển thị giao dịch `Thực tế`. Người dùng vẫn có thể chọn `Dự kiến` hoặc xóa bộ lọc.
- Kỹ thuật: Cập nhật `getInitialTransactionPeriod` và thêm `getInitialTransactionStatus` trong `src/pages/Transactions.tsx`; bổ sung regression test trong `src/pages/Transactions.test.ts` và `src/pages/Transactions.ui.test.tsx`. Không thay đổi API, schema, database, RLS/RPC hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 24/24 file, 102/102 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#106](https://github.com/nhan0805/family-expense/pull/106) đã merge vào `main`; bản sửa version migration được merge qua PR [#108](https://github.com/nhan0805/family-expense/pull/108) với merge commit `c4f829d2fa07817418772510aa3d82c985a7e2f6`. Supabase Production Deploy [run 33715285787](https://github.com/nhan0805/family-expense/actions/runs/33715285787) pass; Cloudflare Pages production trả HTTP 200 và lazy chunk Catalogs trả HTTP 200 ngày `03/09/2026 11:44` (`Asia/Ho_Chi_Minh`). Không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Thêm icon cho danh mục và danh sách giao dịch

- Trước thay đổi: Danh mục chỉ hiển thị tên; dữ liệu chỉ có nền tảng icon cũ ở `purposes`, còn danh mục chi phí/phương thức thanh toán và dòng giao dịch chưa có icon.
- Sau thay đổi: Owner có thể tìm kiếm và chọn icon trực quan trong form Danh mục; toàn bộ danh mục mặc định hiện có được map sẵn; icon hiển thị ở danh sách danh mục và dòng giao dịch mobile/desktop. Icon chỉ lưu dưới dạng key Lucide được allow-list; key lạ hoặc thiếu fallback về `Tag`.
- Kỹ thuật: Thêm `src/lib/catalogIcons.ts`, test mapping/search; mở rộng `CatalogItem`/AppContext; cập nhật `src/pages/Catalogs.tsx`, `src/components/TransactionRow.tsx`, `src/pages/Transactions.tsx`; thêm migration `supabase/migrations/202609030003_catalog_icons.sql` cho ba bảng catalog và seed mặc định. Không thay đổi ID giao dịch, format import/export, AI hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 24/24 file, 102/102 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#106](https://github.com/nhan0805/family-expense/pull/106) và PR sửa migration [#108](https://github.com/nhan0805/family-expense/pull/108) đã merge; Supabase Production Deploy [run 33715285787](https://github.com/nhan0805/family-expense/actions/runs/33715285787) pass với migration `202609030003_catalog_icons.sql`. Cloudflare Pages production trả HTTP 200, lazy chunk Catalogs trả HTTP 200 ngày `03/09/2026 11:44` (`Asia/Ho_Chi_Minh`). Không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Ẩn mục đích khỏi quản lý ngân sách — Phase 7

- Trước thay đổi: Trang Ngân sách hiển thị mọi mục đích đang hoạt động, kể cả các mục như `Thu nhập` không cần theo dõi ngân sách.
- Sau thay đổi: Owner có thể bật/tắt `Theo dõi trong ngân sách` tại Danh mục. Mục bị tắt vẫn dùng được cho giao dịch nhưng không xuất hiện trong ngân sách, tổng hợp, cảnh báo hoặc số tiền chưa có ngân sách; ngân sách cũ được giữ để có thể bật lại.
- Kỹ thuật: thêm `purposes.budget_enabled` với mặc định `true` trong `supabase/migrations/202609030002_budget_visibility.sql`; cập nhật `get_budget_summary`, `upsert_budget`, `copy_budgets_from_month`, local fallback và mapping catalog. UI toggle, trạng thái `Ẩn ngân sách`, VI/EN, Dracula dark mode và owner/member được giữ nhất quán.
- Kiểm thử: Vitest (`vitest run`, tương đương script `pnpm test`) đạt 23/23 file, 96/96 test; typecheck, lint, build và `git diff --check` pass. `supabase test db --local` chưa chạy được vì PostgreSQL local tại `127.0.0.1:54322` chưa hoạt động; required `db-security` sẽ kiểm tra migration/RLS trên PR.
- Trạng thái triển khai dự kiến: commit/push branch, tạo PR vào `main`, bật auto-merge; Supabase migration và Cloudflare Pages frontend sẽ deploy qua workflow Git sau khi PR merge.

### Căn đều tiêu đề và khung trường trong form giao dịch

- Trước thay đổi: Rule `.label` chung ghi đè `display: flex`, khiến badge `AI đề xuất` của `Phương thức thanh toán` bị xuống dòng và các khung trong hàng phân loại không thẳng hàng.
- Sau thay đổi: Các tiêu đề có badge AI luôn căn cùng một hàng, badge giữ nguyên kích thước và không xuống dòng; chiều cao các trường trong cùng hàng nhất quán trên màn hình form giao dịch.
- Kỹ thuật: Cập nhật `.label.flex` trong `src/index.css`, badge trong `src/pages/TransactionForm.tsx` và regression assertion trong `src/pages/TransactionForm.test.tsx`. Không thay đổi API, schema, database, RLS/RPC hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 23/23 file, 93/93 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn chỉ cảnh báo chunk ExcelJS lớn đã có từ trước.
- Triển khai: PR [#104](https://github.com/nhan0805/family-expense/pull/104) đã merge vào `main` với merge commit `3fb16e36fa1b1c64de0f6906bdedaa6a968e90f8`; CI main [run 33661370044](https://github.com/nhan0805/family-expense/actions/runs/33661370044) pass với `quality` và `db-security`, Preview và Cloudflare Pages Preview pass. Production `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `03/09/2026 00:31` (`Asia/Ho_Chi_Minh`); CSS production chứa `.label.flex` và lazy chunk TransactionForm chứa `shrink-0`/`whitespace-nowrap`. Không có migration nên không chạy Supabase Production Deploy; không dùng Wrangler deploy trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Tối ưu hiệu năng AI: aggregate facts, cache và timeout

- Trước thay đổi: Dashboard summary tải và tự tính nhiều dòng giao dịch ở Edge Function; mỗi lần gọi AI đều đọc lại catalog/facts và không có cache summary hoặc trạng thái retry nhất quán.
- Sau thay đổi: Dashboard dùng RPC `get_ai_dashboard_facts` để aggregate một lần; summary cache 5 phút theo `familyId + dateFrom + dateTo + periodLabel + language`; catalog/context cache 60 giây và tự invalidates khi catalog/giao dịch đổi; client/server Gemini có timeout 25 giây; AI search cập nhật `debouncedQuery` ngay sau khi nhận kết quả và các luồng AI có nút thử lại rõ ràng.
- Kỹ thuật: thêm `src/lib/aiClient.ts`, test timeout; cập nhật Dashboard, Transactions, TransactionForm và ba Edge Function AI; thêm migration `supabase/migrations/202609030001_ai_performance.sql` với `ai_request_context_cache`, `ai_summary_cache`, aggregate RPC và trigger invalidation; thêm `supabase/tests/ai_performance.sql`.
- Kiểm thử: local `pnpm test` đạt 23/23 file, 93/93 test; `pnpm lint`, `pnpm typecheck`, `pnpm build`, Prettier và `git diff --check` pass. Required `db-security` trên CI cũng pass sau một lần rerun do GitHub API rate limit; local Supabase không chạy được vì Docker daemon chưa hoạt động.
- Triển khai: PR [#103](https://github.com/nhan0805/family-expense/pull/103) đã merge vào `main` với merge commit `7ceac2a9f10af32c2dec887db7f04c08556e2967`; CI main [run 33660556965](https://github.com/nhan0805/family-expense/actions/runs/33660556965) và Supabase Production Deploy [run 33660556944](https://github.com/nhan0805/family-expense/actions/runs/33660556944) đều pass. Cloudflare Pages production `https://family-expense-8fo.pages.dev/` trả HTTP 200; lazy assets Dashboard/Transactions/TransactionForm của build mới đều HTTP 200 lúc `03/09/2026 00:24` (`Asia/Ho_Chi_Minh`). Không dùng `wrangler pages deploy` trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

## 2026-09-02

### Triển khai quản lý ngân sách V1 — Phase 0 đến Phase 6

- Trước thay đổi: `budgets` đã có trong schema nền nhưng chưa có luồng quản lý hoàn chỉnh trên UI; Dashboard chưa hiển thị tiến độ ngân sách và menu mobile chưa có điểm vào riêng.
- Sau thay đổi: V1 quản lý ngân sách theo `mục đích/tháng`, chỉ tính giao dịch `Chi tiêu` trạng thái `Thực tế`, hiển thị đã chi/còn lại/cảnh báo/vượt hạn mức và phần chi chưa có ngân sách. Owner được thêm/sửa/xóa/sao chép ngân sách tháng trước; member chỉ xem. Dashboard có snapshot và link lọc giao dịch theo mục đích.
- Phạm vi Phase 0–6: chốt nghiệp vụ VND + `Asia/Ho_Chi_Minh` và quyền owner/member; thêm schema validation/local fallback; thêm RPC có kiểm tra membership/owner, RLS và index tổng hợp; xây route `/ngan-sach` responsive mobile-first; tích hợp Dashboard/navigation; đồng bộ VI/EN và Dracula dark mode; bổ sung unit/UI/security assertions và quality gates. Recurring transaction và ngân sách theo sự kiện vẫn ngoài V1.
- Kỹ thuật: thêm `supabase/migrations/202609020001_budget_management.sql` với `get_budget_summary`, `upsert_budget`, `delete_budget`, `copy_budgets_from_month`; thêm `src/lib/budget.ts`, `src/lib/budgetsApi.ts`, `src/pages/Budgets.tsx`, test tương ứng; cập nhật `src/App.tsx`, `src/components/Layout.tsx`, `src/pages/Dashboard.tsx`, `src/context/LanguageContext.tsx`, `supabase/tests/tenant_security.sql`.
- Kiểm thử local: `pnpm test` đạt 22/22 file, 90/90 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Supabase security test local chưa chạy được vì Docker daemon chưa hoạt động; migration sẽ được kiểm tra lại bởi required `db-security` trước merge.
- Triển khai: PR [#102](https://github.com/nhan0805/family-expense/pull/102) đã merge vào `main` với merge commit `decbea25178e7aaca8a9ddbc8e1cb6c9ca1a9384`; required checks `quality`, `db-security`, Preview và Cloudflare Pages đều pass. Supabase Production Deploy [run 33658603552](https://github.com/nhan0805/family-expense/actions/runs/33658603552) đã áp migration; CI main [run 33658603477](https://github.com/nhan0805/family-expense/actions/runs/33658603477) pass. Cloudflare Pages production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 và lazy asset `Budgets-BsvYXatX.js` trả HTTP 200 lúc `03/09/2026 00:05` (`Asia/Ho_Chi_Minh`). Không dùng `wrangler pages deploy` trực tiếp và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Chuẩn hóa nội dung giao dịch do AI đề xuất

- Trước thay đổi: Khi phân tích câu như `ăn tiệm 190k bằng thẻ`, AI có thể giữ nguyên cả số tiền và phương thức thanh toán trong trường `Nội dung`.
- Sau thay đổi: Prompt yêu cầu AI viết tiêu đề ngắn chỉ giữ hoạt động/đối tượng cốt lõi, ví dụ `ăn tiệm 190k bằng thẻ` → `Ăn tiệm`; Edge Function chuẩn hóa thêm số tiền và cụm phương thức thanh toán phổ biến trước khi trả gợi ý.
- Kỹ thuật: Cập nhật `supabase/functions/parse-expense/index.ts`; thêm helper `supabase/functions/parse-expense/description.ts` và test; bổ sung assertion trong `src/pages/TransactionForm.test.tsx`. Không thay đổi schema, migration, API lưu giao dịch, RLS/RPC hoặc quy tắc AI chỉ đề xuất.
- Kiểm thử: `pnpm test` đạt 20/20 file, 86/86 test; `pnpm typecheck`, `pnpm build` và `git diff --check` pass. `pnpm lint` còn bị chặn bởi warning có sẵn tại `src/pages/Budgets.tsx:120` trong thay đổi ngân sách hiện hữu của working tree.
- Triển khai: Chưa deploy production; chờ lint sạch rồi commit/push branch, tạo PR vào `main` và deploy Edge Function/frontend qua Git integration theo quy trình.

### Bổ sung micro-interactions cho UI

- Trước thay đổi: Menu mobile, modal sửa hàng loạt và backdrop dialog mở/đóng tức thời; toast biến mất ngay; Dashboard chưa có nhịp xuất hiện nhẹ cho KPI và nhóm biểu đồ.
- Sau thay đổi: Thêm drawer slide-in/out và scrim fade cho menu mobile; dialog/modal slide-up + scale với backdrop fade; toast fade-out; stagger tối đa 6 phần tử cho KPI và pie chart Dashboard. Tất cả chỉ dùng `opacity`/`transform` trong 180–220ms và tôn trọng `prefers-reduced-motion`.
- Kỹ thuật: Cập nhật `src/index.css`, `src/components/Layout.tsx`, `src/components/Feedback.tsx`, `src/pages/Transactions.tsx`, `src/pages/Dashboard.tsx`. Không thay đổi API, schema, database, RLS/RPC hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file và 83/83 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass.
- Triển khai: PR [#100](https://github.com/nhan0805/family-expense/pull/100) đã merge vào `main` với merge commit `36629daffb9cc7de9cd2f85ad2cb39fb87d907a9`; required checks quality/db-security/preview và Cloudflare Preview pass, [CI main](https://github.com/nhan0805/family-expense/actions/runs/33648961650) thành công. Cloudflare Pages production đang phục vụ artifact mới: smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `02/09/2026 22:32` (`Asia/Ho_Chi_Minh`), HTML trỏ tới `assets/index-BDxheO8t.js` và `assets/index-C098Wj4E.css`; CSS production có các animation drawer/dialog/overlay/toast/stagger. Không có migration nên không cần Supabase Production Deploy; không dùng deploy thủ công và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Tối ưu bundle PWA và cache static assets

- Trước thay đổi: `registerSW.js` render-blocking; pattern PWA không khớp file sinh thực tế `exceljs.min-*.js` nên ExcelJS gần `937 kB` vẫn nằm trong precache; `ImportExport` kéo parser Excel vào chunk route; asset hash trên Cloudflare Pages phải revalidate do `Cache-Control: max-age=0`.
- Sau thay đổi: Dùng `script-defer` cho Service Worker registration; loại `exceljs*.js`/`xlsx*.js` khỏi precache; tách `inferImportMode` cùng type Excel sang `src/lib/templateTypes.ts` để `templateImport` và parser chỉ tải khi thao tác import/template; thêm cache dài hạn immutable cho `/assets/*`, giữ HTML/manifest/Service Worker không cache dài hạn.
- Kỹ thuật: Cập nhật `vite.config.ts`, `src/pages/ImportExport.tsx`, `src/lib/templateImport.ts`; thêm `src/lib/templateTypes.ts` và `public/_headers`. Không thay đổi API, schema, database, RLS/RPC hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file và 83/83 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build xác nhận `ImportExport` giảm còn `21.42 kB`, `xlsx` thành chunk riêng `429.19 kB`, precache giảm còn `1260.00 KiB`, `exceljs` không còn trong precache và script registration có `defer`.
- Triển khai: PR [#99](https://github.com/nhan0805/family-expense/pull/99) đã merge vào `main` với merge commit `6ad791e93e8009de83ff2d91dc8049cc847cd99b`; [CI main](https://github.com/nhan0805/family-expense/actions/runs/33633488044) thành công, required checks quality/db-security/preview và Cloudflare Preview pass. Cloudflare Pages production đang phục vụ artifact mới: smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `02/09/2026 20:06` (`Asia/Ho_Chi_Minh`), HTML trỏ tới `assets/index-gl7fZAQh.js` và `assets/index-C6TDvkQo.css`; asset hash cache `max-age=31536000, immutable`, Service Worker registration `defer`, `registerSW.js` `no-cache`, và `exceljs/xlsx` không nằm trong precache. Không có migration nên không cần Supabase Production Deploy; không dùng deploy thủ công và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Đồng bộ khu vực xóa với Dracula dark mode

- Trước thay đổi: Nút xóa thành viên/giao dịch và khối `Xóa gia đình` dùng nền đỏ tím tùy biến, màu chữ chưa khớp accent Dracula và thiếu focus state rõ ràng.
- Sau thay đổi: Dùng Dracula Red `#FF5555` cho thao tác destructive; nền dark mode chỉ còn tint đỏ nhẹ `#FF55550D`, hover dùng `#FF55551F`, border giữ độ tương phản vừa đủ và focus ring dùng Purple `#BD93F9`.
- Kỹ thuật: Cập nhật style dùng chung `.danger-button`, `.danger-zone` trong `src/index.css`; cập nhật title trong `src/pages/Members.tsx`; thêm regression assertion trong `src/pages/Members.test.tsx`. Không thay đổi API, schema, database, quyền hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file, 83/83 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build chỉ còn các cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: PR [#98](https://github.com/nhan0805/family-expense/pull/98) đã merge vào `main` với merge commit `072d4f5cbbfb8afd8e4f8a6945aaa68ba3ea307a`. Required checks quality/db-security/preview và Cloudflare Preview pass; [CI main](https://github.com/nhan0805/family-expense/actions/runs/33538050283) thành công. Cloudflare Pages production đang phục vụ bundle mới `assets/index-BCErojJQ.js` và `assets/index-C6TDvkQo.css`; smoke test GET HTML/CSS đều HTTP 200 lúc `02/09/2026 00:31` (`Asia/Ho_Chi_Minh`). Không có migration nên không cần Supabase Production Deploy; không dùng deploy thủ công và không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Loại bỏ Hoàn tiền và Tạm ứng khỏi hệ thống giao dịch

- Trước thay đổi: Database enum và một số logic legacy vẫn chấp nhận/đọc hai loại `Hoàn tiền` và `Tạm ứng`, dù form mới đã chỉ hiển thị Tiền ra/Tiền vào.
- Sau thay đổi: Chỉ còn `Chi tiêu` và `Thu nhập` trong schema, validation, Dashboard, danh sách, import/export và Edge Function; dữ liệu legacy còn sót trong quá trình reset được chuẩn hóa thành `Thu nhập`/`Chi tiêu` tương ứng. Dark mode đồng bộ Pink `#FF79C6`, Green `#50FA7B`, Purple `#BD93F9` và Cyan `#8BE9FD` cho dòng giao dịch, KPI, icon/title và nút chọn kỳ.
- Kỹ thuật: Thêm migration `supabase/migrations/202609010004_remove_legacy_transaction_kinds.sql`; cập nhật domain, tone giao dịch, Dashboard, Data tools, test, Edge Function và tài liệu hướng dẫn. Không sửa migration đã áp dụng.
- Sau kiểm tra CI preview: loại bỏ các nhánh so sánh legacy còn sót trong Dashboard và danh sách giao dịch để TypeScript/build remote đồng nhất với enum mới.
- Kiểm thử: `pnpm test` đạt 19/19 file, 83/83 test; `pnpm lint`, `pnpm typecheck`, `pnpm build`, Prettier cho Edge Function và `git diff --check` pass. E2E local bị chặn vì thiếu Playwright browser binaries; Supabase local chưa chạy vì thiếu container `supabase_db_family-expense`.
- Triển khai: PR [#97](https://github.com/nhan0805/family-expense/pull/97) đã merge vào `main` với merge commit `4c25e05a72e031e36a325f1c86a900ab3009c4dc`. Required checks preview/quality/db-security pass; [CI main](https://github.com/nhan0805/family-expense/actions/runs/33535859191) và [Supabase Production Deploy](https://github.com/nhan0805/family-expense/actions/runs/33535859149) đều thành công. Cloudflare Pages production đang phục vụ build có asset `assets/index-CDFnrdjO.css`; smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `02/09/2026 00:09` (`Asia/Ho_Chi_Minh`). Không tạo deploy lần hai chỉ để cập nhật tài liệu.

## 2026-09-01

### Đồng bộ accent Dracula cho giao dịch, KPI và công cụ dữ liệu

- Trước thay đổi: Một số nền/icon/title trên Dashboard và Data chưa theo đúng accent Dracula, nổi bật là xanh lá/xanh dương cũ trên nền tối.
- Sau thay đổi: Chi tiêu dùng Dracula Pink `#FF79C6`, Thu nhập dùng Dracula Green `#50FA7B`; kicker dùng Purple `#BD93F9`, icon dùng Green/Cyan, KPI dùng đúng accent theo ngữ nghĩa và nút chọn kỳ dùng Purple trong dark mode.
- Kỹ thuật: Cập nhật `src/components/TransactionRow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/ImportExport.tsx`; bổ sung assertion trong `src/pages/Transactions.test.ts`, `src/pages/Dashboard.test.tsx`, `src/pages/ImportExport.test.tsx`. Hoàn tiền và Tạm ứng không thay đổi.
- Kiểm thử: Đang chạy quality suite sau thay đổi.
- Triển khai dự kiến: Chưa deploy production; sẽ đi qua PR vào `main`, Supabase Production Deploy nếu migration đi kèm và Cloudflare Pages Git integration.

### Loại bỏ Hoàn tiền và Tạm ứng khỏi hệ thống giao dịch

- Trước thay đổi: Database enum và một số logic legacy vẫn chấp nhận/đọc hai loại `Hoàn tiền` và `Tạm ứng`, dù form mới đã chỉ hiển thị Tiền ra/Tiền vào.
- Sau thay đổi: Chỉ còn `Chi tiêu` và `Thu nhập` trong schema, validation, Dashboard, danh sách, import/export và Edge Function; dữ liệu legacy còn sót trong quá trình reset sẽ được chuẩn hóa lần cuối thành `Thu nhập`/`Chi tiêu` tương ứng.
- Kỹ thuật: Thêm migration `supabase/migrations/202609010004_remove_legacy_transaction_kinds.sql`; cập nhật `src/lib/domain.ts`, `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`, `src/components/TransactionRow.tsx`, `src/lib/importExcel.ts`, `src/lib/templateImport.ts`, `supabase/functions/summarize-dashboard/index.ts` và script tài liệu/import. Không sửa migration đã áp dụng.
- Kiểm thử: `pnpm test` đạt 19/19 file, 83/83 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. E2E local bị chặn vì thiếu Playwright browser binaries; Supabase local không chạy vì không có container `supabase_db_family-expense`.
- Triển khai dự kiến: Commit/push branch, tạo PR vào `main`, bật auto-merge; migration sẽ chạy qua Supabase Production Deploy và frontend qua Cloudflare Pages Git integration sau khi PR merge.

### Hỗ trợ tên danh mục tiếng Anh theo ngôn ngữ giao diện

- Trước thay đổi: Khi chuyển giao diện sang English, tên danh mục/mục đích/phương thức thanh toán vẫn chỉ có tiếng Việt; danh mục tự tạo không có nơi nhập tên tiếng Anh.
- Sau thay đổi: Lưu thêm tên tiếng Anh tùy chọn cho từng danh mục; danh mục mặc định được backfill bản dịch, English ưu tiên tên tiếng Anh và fallback về tiếng Việt khi chưa có bản dịch. ID danh mục và giao dịch hiện có không đổi.
- Kỹ thuật: Thêm `name_en` cho `purposes`, `expense_types`, `payment_methods` trong migration `supabase/migrations/202609010003_bilingual_catalog_names.sql`; cập nhật seed mặc định và Dashboard RPC; cập nhật `src/lib/domain.ts`, `src/context/AppContext.tsx`, `src/pages/Catalogs.tsx`, `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx`, `src/pages/Dashboard.tsx`, `src/pages/ImportExport.tsx`, `src/lib/templateImport.ts`, `src/lib/transactionsApi.ts`.
- Kiểm thử: `pnpm test` đạt 19/19 file và 82/82 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build vẫn có cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai dự kiến: Commit và push branch, tạo PR vào `main`, bật auto-merge; Supabase migration sẽ được áp dụng qua workflow production và frontend sẽ được Cloudflare Pages Git integration deploy sau khi PR merge.

### Giảm độ gắt màu giao dịch trong Dracula dark mode

- Trước thay đổi: Nền dòng Chi tiêu/Thu nhập dùng gradient đỏ/xanh có độ bão hòa cao, phủ nhiều diện tích và lệch với bảng màu Dracula.
- Sau thay đổi: Chi tiêu dùng Dracula Pink `#FF79C6`, Thu nhập dùng Dracula Green `#50FA7B`; nền dòng chỉ dùng tint nhẹ, còn số tiền và badge giữ accent rõ. Hoàn tiền và Tạm ứng không thay đổi.
- Kỹ thuật: Cập nhật tone hiển thị trong `src/components/TransactionRow.tsx` và `src/pages/Transactions.tsx`; bổ sung assertion màu trong `src/pages/Transactions.test.ts`. Không thay đổi API, schema, database hoặc quy tắc nghiệp vụ.
- Kiểm thử: Đang chạy quality suite sau thay đổi.
- Triển khai: Chưa deploy production.

### Thử nghiệm bảng màu Dracula Official cho dark mode

- Trước thay đổi: Dark mode dùng nền xanh đậm và các điểm nhấn xanh lá.
- Sau thay đổi: Dark mode dùng nền `#282A36`, surface `#343746`/`#44475A`, chữ `#F8F8F2`, cùng điểm nhấn tím `#BD93F9`, hồng `#FF79C6`, cyan `#8BE9FD`; giữ màu đỏ/vàng cho trạng thái cảnh báo và lỗi.
- Kỹ thuật: Cập nhật `src/index.css`, `src/context/ThemeContext.tsx`, `src/components/ThemeSelect.tsx`, `src/components/AsyncStates.tsx`, `src/components/Feedback.tsx`, `src/components/TransactionRow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`, `src/pages/ImportExport.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/CreateFamily.tsx`; không thay đổi API, schema, database hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file và 80/80 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Build vẫn có cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #96 vào `main` với merge commit `4c9ae945a12d2d33c0796a45a5854d6a08fe9116`; CI main [33531570638](https://github.com/nhan0805/family-expense/actions/runs/33531570638), quality/db-security và Cloudflare Preview đều pass. Cloudflare Pages production đang phục vụ đúng asset CSS của build Dracula (`assets/index-CkRfJRC_.css`); production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 23:26` (`Asia/Ho_Chi_Minh`). Không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Tăng tương phản avatar chữ cái trong danh sách thành viên

- Trước thay đổi: Avatar chữ cái cạnh tên thành viên trong dark mode dùng màu chữ xanh đậm trên nền xanh, nên nhìn hơi mờ.
- Sau thay đổi: Tăng độ sáng chữ cái, nền và viền riêng cho dark mode để avatar nổi bật hơn mà vẫn giữ phong cách màu xanh của ứng dụng.
- Kỹ thuật: Cập nhật `.dark .member-avatar` trong `src/index.css`; bổ sung regression test trong `src/pages/Members.test.tsx`. Không thay đổi API, schema, database, quyền hoặc dữ liệu thành viên.
- Kiểm thử: `pnpm test` đạt 19/19 file và 80/80 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. `pnpm test:e2e` bị chặn trong sandbox do không được bind `127.0.0.1:5173`; không cài thêm dependency. Build còn các cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #95 vào `main` với merge commit `ec0c1427f1e6d9ee33d02666433149b1927731ba`; CI main quality/db-security pass. Cloudflare Pages production qua Git integration đã phục vụ build mới, production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 23:08` (`Asia/Ho_Chi_Minh`). Không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Đưa nút sao chép/xóa của từng dòng giao dịch lại gần số tiền

- Trước thay đổi: Bảng giao dịch desktop tách riêng cột thao tác ở ngoài cùng và dùng chiều rộng intrinsic `w-max`, khiến nút sao chép/xóa có thể nằm ngoài vùng nhìn thấy và phải cuộn ngang để thao tác.
- Sau thay đổi: Gộp vùng thao tác vào cùng cột với số tiền, đặt nút sao chép/xóa ngay cạnh số tiền; bảng dùng `w-full`, giới hạn tối thiểu còn `940px`, và các ô chữ dài được phép co/truncate để không đẩy nút ra ngoài.
- Kỹ thuật: Cập nhật `src/components/TransactionRow.tsx`, `src/pages/Transactions.tsx`; bổ sung regression test trong `src/components/TransactionRow.test.tsx`. Không thay đổi API, schema, database hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file và 79/79 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. `pnpm test:e2e` bị chặn trong sandbox do không được bind `127.0.0.1:5173`; không cài thêm dependency. Build còn các cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #95 vào `main` với merge commit `ec0c1427f1e6d9ee33d02666433149b1927731ba`; CI main quality/db-security pass. Cloudflare Pages production qua Git integration đã phục vụ build mới, production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 23:08` (`Asia/Ho_Chi_Minh`). Không tạo deploy lần hai chỉ để cập nhật tài liệu.

### Cải thiện UI đợt 1 — visual polish Dashboard, Layout và giao dịch

- Trước thay đổi: Visual system còn rời rạc giữa header/sidebar, Dashboard và danh sách giao dịch; card, button, input, focus state và khoảng cách chưa dùng chung một hệ quy chiếu rõ ràng.
- Sau thay đổi: Chuẩn hóa token màu/bề mặt/border/shadow/radius, tăng độ rõ typography và trạng thái tương tác; làm mới app shell, mobile menu/bottom navigation/FAB, hierarchy Dashboard và transaction list mà không đổi nghiệp vụ.
- Kỹ thuật: Cập nhật `src/index.css`, `src/components/Layout.tsx`, `src/components/TransactionRow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`; bổ sung visual regression assertions trong `src/pages/Dashboard.test.tsx` và `src/pages/Transactions.ui.test.tsx`; không đổi API, schema hoặc database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 78/78 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. `pnpm test:e2e` đã thử nhưng bị chặn vì môi trường chưa có Playwright browser binaries; không tự tải dependency mới. Build chỉ còn cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #92 vào `main` với merge commit `d827acb17aa29c68e623f1480ea7b628e0cf78e7`; CI main [33519998011](https://github.com/nhan0805/family-expense/actions/runs/33519998011), Cloudflare Pages và các kiểm tra liên quan đều pass. Production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 21:32` (`Asia/Ho_Chi_Minh`).

### Cải thiện UI đợt 2 — form giao dịch, danh mục, thành viên và dữ liệu

- Trước thay đổi: Form giao dịch, màn hình quản lý danh mục/thành viên và nhập/xuất dữ liệu còn dùng nhiều lớp trình bày rời rạc; các nhóm nội dung, trạng thái an toàn và thao tác mobile chưa có nhịp thị giác thống nhất.
- Sau thay đổi: Chuẩn hóa hierarchy heading và section, panel form, trạng thái cảnh báo/lỗi, vùng mở rộng, nút nguy hiểm, danh sách danh mục, avatar thành viên, vùng chọn file kéo-thả và bảng preview; tăng vùng chạm/focus và giữ layout gọn trên mobile.
- Kỹ thuật: Cập nhật `src/index.css`, `src/pages/TransactionForm.tsx`, `src/pages/Catalogs.tsx`, `src/pages/Members.tsx`, `src/pages/ImportExport.tsx`; bổ sung regression assertions trong `src/pages/TransactionForm.test.tsx`, `src/pages/Catalogs.test.tsx`, `src/pages/Members.test.tsx`, `src/pages/ImportExport.test.tsx`. Không thay đổi API, schema, migration, RLS/RPC, dữ liệu hoặc quy tắc nghiệp vụ.
- Kiểm thử: `pnpm test` đạt 19/19 file và 78/78 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. E2E local vẫn chưa chạy được vì môi trường thiếu Playwright browser binaries; không cài thêm dependency trong phiên này. Build còn cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #93 vào `main` với merge commit `f8dbd2e55580c7530b7413126c6eef8a972971dd`; CI main [33521789893](https://github.com/nhan0805/family-expense/actions/runs/33521789893) và Cloudflare Pages production deployment [d44453ef-9379-4bd6-8b9c-a6e5efa69298](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/d44453ef-9379-4bd6-8b9c-a6e5efa69298) đều pass. Production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 21:50` (`Asia/Ho_Chi_Minh`). Không có migration/database change trong release này.

### Sửa tương phản dark mode và cân đối card dữ liệu

- Trước thay đổi: Một số chữ phụ, icon tìm kiếm và chip bộ lọc trong dark mode có màu gần nền nên khó đọc; ba card công cụ dữ liệu có chiều cao và vị trí nút khác nhau.
- Sau thay đổi: Tăng độ sáng cho text/muted text, border, placeholder, focus state và filter chip trong dark mode; căn ba card dữ liệu cùng chiều cao với nhóm nút thẳng hàng ở đáy.
- Kỹ thuật: Cập nhật `src/index.css`, `src/pages/Transactions.tsx`, `src/pages/ImportExport.tsx`; bổ sung assertion layout trong `src/pages/ImportExport.test.tsx`. Không thay đổi API, schema, database hoặc logic lọc/import.
- Kiểm thử: `pnpm test` đạt 19/19 file và 78/78 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass. Build còn cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #94 vào `main` với merge commit `76bd413e6a033eef10d1590d4ba7254ad2338066`; CI main [33525304734](https://github.com/nhan0805/family-expense/actions/runs/33525304734) và Cloudflare Pages production deployment [c7f06a12-adfb-48db-9246-501425f2a543](https://dash.cloudflare.com/?to=/07ec67956cee45221fb1e3c98510c65a/pages/view/family-expense/c7f06a12-adfb-48db-9246-501425f2a543) đều pass. Production smoke test `https://family-expense-8fo.pages.dev/` trả HTTP 200 lúc `01/09/2026 22:23` (`Asia/Ho_Chi_Minh`). Không có migration/database change trong release này.

### Chốt và tự động purge `ai_usage_logs` sau 30 ngày

- Trước thay đổi: Retention của `ai_usage_logs` chưa được chốt; Cron chỉ xử lý giao dịch trong thùng rác.
- Sau thay đổi: `ai_usage_logs` được giữ 30 ngày từ `created_at`, sau đó purge cùng lịch Cron hằng ngày lúc 02:15 giờ Việt Nam.
- Kỹ thuật: Thêm migration `supabase/migrations/202609010002_purge_ai_usage_logs_after_30_days.sql`; chỉ xóa log quá hạn trong `ai_usage_logs`, không xóa giao dịch hoặc bảng khác.
- Kiểm thử: Đã rà soát điều kiện bảng/cột, quyền RPC và chạy `git diff --check`; quality, db-security và preview đều pass.
- Triển khai: Đã merge PR #91 với merge commit `c9bde54f044489bb456746b472ef8c0e4a914726`; Supabase production workflow [33515888401](https://github.com/nhan0805/family-expense/actions/runs/33515888401) đã áp dụng migration thành công ngày `01/09/2026 20:51` (`Asia/Ho_Chi_Minh`). Cron purge giao dịch và `ai_usage_logs` đã được cấu hình trên production.

### Tự động purge giao dịch trong thùng rác sau 30 ngày

- Trước thay đổi: Giao dịch soft-delete có chính sách giữ 30 ngày nhưng chưa có job tự động thực thi.
- Sau thay đổi: Thêm Supabase Cron chạy hằng ngày lúc 02:15 để xóa vĩnh viễn giao dịch có `deleted_at` quá 30 ngày.
- Kỹ thuật: Thêm migration `supabase/migrations/202609010001_purge_deleted_transactions_after_30_days.sql`; hàm chỉ `DELETE` khi `deleted_at IS NOT NULL` và không tác động `ai_usage_logs` hoặc giao dịch đang hoạt động.
- Kiểm thử: Đã rà soát điều kiện purge, quyền thực thi và chạy `git diff --check`; quality, db-security và preview đều pass.
- Triển khai: Đã merge PR #90 với merge commit `b4580710188ba86f2e26dd690c88fe37bf5b9037`; Supabase production workflow [33510763918](https://github.com/nhan0805/family-expense/actions/runs/33510763918) đã áp dụng migration thành công ngày `01/09/2026 20:00` (`Asia/Ho_Chi_Minh`). Cron purge đã được cấu hình trên production.

### Chốt retention giao dịch trong thùng rác

- Trước thay đổi: Retention cho giao dịch soft-delete chưa được quyết định.
- Sau thay đổi: Giao dịch trong thùng rác được giữ 30 ngày kể từ `deleted_at`, sau đó mới được xóa vĩnh viễn.
- Kỹ thuật: Cập nhật `HANDOFF.md`; job purge được triển khai bằng migration riêng và chưa thực hiện purge ngay tại thời điểm deploy.
- Kiểm thử: Đã kiểm tra lại cơ chế soft-delete/purge hiện có và `git diff --check`.
- Triển khai: Chính sách và job purge đã được triển khai production qua PR #90; retention `ai_usage_logs` được nối vào cùng Cron qua PR #91.

### Xác minh migration Dashboard 6 tháng đã deploy production

- Trước thay đổi: `HANDOFF.md` vẫn ghi migration `202608310001_dashboard_summary_six_months.sql` đang chờ deploy production.
- Sau thay đổi: Đối chiếu GitHub Actions run [33348318894](https://github.com/nhan0805/family-expense/actions/runs/33348318894), thành công ngày `31/08/2026 08:41` (`Asia/Ho_Chi_Minh`); log xác nhận `supabase db push` đã áp dụng migration và hoàn tất.
- Kỹ thuật: Chỉ cập nhật `HANDOFF.md` và `CHANGELOG.md`; không chạy lại migration, không thay đổi schema/database.
- Kiểm thử: Đã kiểm tra log workflow, trạng thái Git và `git diff --check`.
- Triển khai: Migration đã có trên Supabase production; các tồn đọng backup/monitoring không bị thay đổi.

### Ẩn ID kỹ thuật trong thông báo bộ lọc AI

- Trước thay đổi: Thông báo sau khi AI áp dụng bộ lọc có thể hiển thị UUID của danh mục, gây khó đọc và không có ích cho người dùng.
- Sau thay đổi: Loại bỏ UUID khỏi nội dung thông báo trên giao diện; ID nội bộ vẫn được giữ nguyên để áp dụng bộ lọc.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và regression test trong `src/pages/Transactions.ui.test.tsx`; không đổi API/database.
- Kiểm thử: Đã thêm assertion kiểm tra UUID không xuất hiện trong giải thích bộ lọc AI; chưa chạy toàn bộ quality suite.
- Triển khai: Đã merge PR #89 vào `main` với merge commit `7bbcd87fc7dc4f42828de14f07d0a7186bc15134`; quality, db-security, Preview và Cloudflare Pages đều pass. Production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/) lúc `01/09/2026 08:52` (`Asia/Ho_Chi_Minh`).

### Cân đối bộ lọc chi tiết trên web

- Trước thay đổi: 12 trường lọc dùng 5 cột trên màn hình lớn nên hàng cuối chỉ còn một vài ô, tạo khoảng trống và bố cục lệch.
- Sau thay đổi: Bộ lọc dùng 4 cột trên desktop và 3 cột trên tablet, chia đều thành các hàng; khoảng cách giữa các trường được thống nhất, mobile vẫn xếp một cột.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và regression assertion trong `src/pages/Transactions.ui.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 77/77 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Build chỉ còn các cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #88 vào `main` với merge commit `d24572ad52e98961ba0f374771d2d39213a2af0c`; các workflow `quality`, `db-security`, Supabase Preview và Cloudflare Pages đều pass. Production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/) lúc `01/09/2026 08:18` (`Asia/Ho_Chi_Minh`).

### Sửa lỗi nút Hủy không xóa bản nháp giao dịch

- Trước thay đổi: Nút `Hủy` chỉ rời màn hình, bản nháp vẫn còn trong `localStorage` và được khôi phục khi mở lại form thêm giao dịch.
- Sau thay đổi: Khi hủy luồng thêm giao dịch, bản nháp theo `family_id` được xóa trước khi điều hướng; luồng sửa giao dịch hiện có không bị ảnh hưởng.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx` và bổ sung regression test trong `src/pages/TransactionForm.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 77/77 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Build chỉ còn các cảnh báo chunk lớn/dynamic import ExcelJS đã có từ trước.
- Triển khai: Đã merge PR #87 vào `main` với merge commit `980bfe7ce4c999043d96ecdefe55f15c52e61d82`; `quality`, `db-security`, Preview và Cloudflare Pages đều pass. Production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).
- Thời điểm xác minh: `01/09/2026 01:07` theo múi giờ `Asia/Ho_Chi_Minh`.

### Sửa lỗi iPhone tự zoom khi nhập số tiền

- Trước thay đổi: Input số tiền có class `text-base` nhưng bị rule của lưới bộ lọc ép lại thành `text-sm`, nên Safari vẫn phóng to khi focus.
- Sau thay đổi: Hai input số tiền dùng override `!text-base` với `font-size: 16px`, giữ bàn phím số và không thay đổi giá trị lọc/API.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và regression assertion trong `src/pages/Transactions.ui.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 76/76 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass.
- Triển khai: Đã deploy production cùng PR #87 qua GitHub và Cloudflare Pages Git integration; production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).

### Đưa cập nhật handoff lên trước deploy

- Trước thay đổi: Handoff được yêu cầu cập nhật ngay sau production deploy, có thể khiến phải tạo thêm commit và deploy lần hai.
- Sau thay đổi: Handoff/changelog phải được cập nhật đầy đủ trước commit, merge và deploy; sau deploy chỉ xác minh hoặc ghi nhận trạng thái không ảnh hưởng artifact đã deploy.
- Kỹ thuật: Cập nhật `AGENTS.md`; không đổi code, API hoặc database.
- Kiểm thử: Đã kiểm tra nội dung hướng dẫn và `git diff --check`.
- Triển khai: Chưa deploy production; đây là cập nhật quy trình làm việc.

### Tinh gọn bộ lọc và input số tiền trên mobile

- Trước thay đổi: Bộ lọc chi tiết có khoảng cách và chiều cao ô nhập lớn; input số tiền có placeholder dài, chưa có phân cách hàng nghìn và có thể làm Safari zoom khi focus.
- Sau thay đổi: Giảm khoảng cách giữa các trường, bỏ placeholder ở `Từ số tiền`/`Đến số tiền`, hiển thị số tiền VND dạng `1.234.567`, chỉ nhận chữ số và giữ input cỡ 16px để tránh zoom trên mobile.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/Transactions.test.ts`, `src/pages/Transactions.ui.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass; tổng cộng 19/19 file và 76/76 test.
- Triển khai: Đã merge PR #85 vào `main` với merge commit `84f6021a8b6bd607324a8501a5aadbf452aa5223`; CI #196 và Cloudflare Pages Preview #114 pass. Cloudflare Pages production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).
- Thời điểm xác minh: `01/09/2026 00:40` theo múi giờ `Asia/Ho_Chi_Minh`.

### Sửa lỗi lệch lớp KPI trên mobile

- Trước thay đổi: KPI `Giá trị ròng` bị mất nền/border đầy đủ và lệch nội dung trên mobile vì link KPI nằm trong wrapper grid nhưng vẫn hiển thị dạng inline.
- Sau thay đổi: Link KPI được hiển thị dạng block, chiếm đủ chiều cao ô grid; bố cục KPI một tháng và nhiều tháng giữ đúng card, icon, số tiền và nội dung phụ.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; bổ sung regression assertion trong `src/pages/Dashboard.test.tsx`; ổn định fixture tháng trong `src/pages/Transactions.ui.test.tsx` để test không phụ thuộc thời điểm chạy; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 76/76 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` pass.
- Triển khai: Đã deploy production cùng PR #85 qua GitHub merge và Cloudflare Pages Git integration; production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).

### Bắt buộc cập nhật handoff sau deploy

- Trước thay đổi: Quy trình deploy chưa ghi rõ bước cập nhật handoff sau khi Cloudflare Pages production deploy thành công.
- Sau thay đổi: Bổ sung quy định luôn cập nhật handoff ngay sau deploy, gồm commit merge, URL deployment, thời điểm deploy và trạng thái xác minh.
- Kỹ thuật: Cập nhật `AGENTS.md`; không đổi code, API hoặc database.
- Kiểm thử: Đã kiểm tra nội dung hướng dẫn và `git diff --check`.
- Triển khai: Chưa deploy production; đây là cập nhật quy trình làm việc.

### Cập nhật handoff sau deploy tìm kiếm giao dịch

- Trước thay đổi: Handoff chưa ghi nhận trạng thái production của tìm kiếm giao dịch theo số tiền và bằng giọng nói.
- Sau thay đổi: Đã xác nhận PR #82 merge vào `main` với commit `abaedd9d893c9482753e925189e7be5fe105c76d`; CI #189, Preview Build #110 và `Supabase Production Deploy` #13 đều pass. Cloudflare Pages production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).
- Phạm vi handoff: Bao gồm bộ lọc số tiền, nút tìm kiếm bằng giọng nói và thay đổi bố cục KPI mobile đã được merge trong cùng release.
- Thời điểm xác minh: `01/09/2026 00:05` theo múi giờ `Asia/Ho_Chi_Minh`.
- Kiểm thử: Đã hoàn tất `pnpm test` 19/19 file và 75/75 test, `pnpm lint`, `pnpm typecheck`, `pnpm build`, Prettier cho Edge Functions và `git diff --check` trước khi merge.
- Triển khai: Hoàn tất qua GitHub merge và Cloudflare Pages Git integration; migration/RPC Supabase đã được workflow production áp dụng thành công.

## 2026-08-31

### Bổ sung lọc số tiền cho tìm kiếm AI

- Trước thay đổi: Tìm kiếm bằng AI chưa trả về hoặc áp dụng được điều kiện theo số tiền; nút AI chưa có feedback trực quan giống nút `Gợi ý AI` trong form giao dịch.
- Sau thay đổi: Hỗ trợ lọc theo `Từ số tiền`/`Đến số tiền`, bao gồm các câu như `trên 500 nghìn`, `dưới 2 triệu` và `từ 500 nghìn đến 2 triệu`; nút AI có màu gradient, trạng thái đang phân tích và trạng thái `Đã lọc` sau khi áp dụng.
- Kỹ thuật: Cập nhật `src/lib/ai.ts`, `src/pages/Transactions.tsx`, `src/lib/transactionsApi.ts`, `supabase/functions/search-transactions/index.ts`; thêm migration `supabase/migrations/202608310005_transaction_amount_filters.sql` cho RPC danh sách giao dịch và thùng rác; không đổi bảng dữ liệu.
- Kiểm thử: `pnpm test` đạt 19/19 file và 75/75 test; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm exec prettier --check` cho Edge Functions và `git diff --check` đều pass. Migration sẽ được kiểm tra thêm trong workflow database khi deploy.
- Triển khai: Đã merge PR #82 vào `main` với commit `abaedd9d893c9482753e925189e7be5fe105c76d`; CI #189 và `Supabase Production Deploy` #13 pass. Cloudflare Pages production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).

### Cân đối bố cục ba KPI theo tháng

- Trước thay đổi: Khi xem một tháng, KPI `Giá trị ròng` đứng một mình ở hàng thứ hai trên mobile.
- Sau thay đổi: `Giá trị ròng` chiếm toàn hàng trên màn hình hẹp và trở lại một cột ở màn hình lớn; kỳ nhiều tháng giữ bố cục sáu KPI.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 75/75 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass.
- Triển khai: Đã merge PR #82 vào `main` với commit `abaedd9d893c9482753e925189e7be5fe105c76d`; CI #189 pass. Cloudflare Pages production phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/).

### Thêm ba tính năng AI có kiểm soát cho giao dịch và Dashboard

- Trước thay đổi: AI nhập giao dịch chưa tham khảo cách phân loại thực tế của gia đình; Dashboard chỉ có insight tĩnh; ô tìm kiếm giao dịch chỉ nhận từ khóa thông thường.
- Sau thay đổi: `parse-expense` tham khảo tối đa 20 mẫu giao dịch thực tế cùng family nhưng không gửi số tiền cũ; Dashboard có nút `Tóm tắt bằng AI` theo kỳ đang xem; trang Giao dịch có nút `AI` để chuyển câu tự nhiên thành bộ lọc và áp dụng vào danh sách.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`, `src/lib/ai.ts`; thêm `supabase/functions/summarize-dashboard/index.ts` và `supabase/functions/search-transactions/index.ts`; cập nhật `supabase/functions/parse-expense/index.ts`, `supabase/config.toml`, `.github/workflows/supabase-deploy.yml`, `README.md`. Không đổi schema/database; không có system prompt tùy chỉnh trên frontend.
- An toàn dữ liệu: Dashboard tự tổng hợp facts từ giao dịch trong family sau khi kiểm tra membership; Gemini chỉ nhận số liệu tổng hợp. Tìm kiếm AI chỉ trả về structured filters; mọi ID danh mục được kiểm tra lại và không AI function nào tự ghi giao dịch.
- Kiểm thử: `pnpm test` đạt 19/19 file và 72/72 test; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm exec prettier --check` cho Edge Functions và `git diff --check` đều pass. Build còn warning chunk lớn/dynamic import ExcelJS-xlsx đã có từ trước.
- Triển khai: Đã merge PR #79 vào `main` với merge commit `ec86da3b31aa330575c35354279cd58ea542a9f8`; Cloudflare Pages production đã phản hồi HTTP 200 tại [production](https://family-expense-8fo.pages.dev/) và asset hash khớp build của merge commit. Workflow `Supabase Production Deploy` #12 và `CI` #185 đều pass; các Edge Function mới đã được triển khai qua workflow Supabase.

### Rút gọn meta KPI trên màn hình hẹp

- Trước thay đổi: Meta như `12 tháng trong kỳ xem` bị cắt bằng dấu `…` trong card KPI hẹp.
- Sau thay đổi: Rút gọn meta thành `12 tháng`/`12 mo.` và giữ trên một dòng, tránh bố cục xấu do xuống dòng.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 68/68 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Chưa deploy production.

### Rút gọn hiển thị so sánh KPI

- Trước thay đổi: Dòng so sánh KPI dài bị cắt trên mobile.
- Sau thay đổi: Thay chữ Tăng/Giảm bằng icon xu hướng và phần trăm; nội dung đầy đủ vẫn có qua accessible label/tooltip.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 68/68 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass.

### Tối ưu bộ lọc Dashboard và trang Dữ liệu trên mobile

- Trước thay đổi: Bộ lọc `Tháng/6 tháng/12 tháng/Năm/Tùy chỉnh` có thể xuống dòng trên màn hình hẹp; tab còn dài và các card dữ liệu có nhiều khoảng trống.
- Sau thay đổi: Bộ lọc giữ một hàng và cuộn ngang trên mobile; đổi nhãn tab/trang thành `Dữ liệu`; card `Tải template`, `Xuất dữ liệu` và `Gửi qua email` dùng chiều cao theo nội dung. Import tự nhận diện: dòng có ID cập nhật, dòng không có ID thêm mới; dòng có ID không bị đánh dấu trùng.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, `src/context/LanguageContext.tsx`, `src/pages/ImportExport.tsx`, `src/lib/templateImport.ts`, `README.md`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 68/68 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass; chưa deploy production.

### Đổi vị trí KPI Tổng thu và Tổng chi

- Sau thay đổi: KPI `Tổng thu` được hiển thị trước `Tổng chi` trong hàng tổng quan Dashboard; dữ liệu, liên kết và công thức không thay đổi.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, bổ sung assertion thứ tự trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · PR #76, merge commit `1166f91`.

### Cập nhật hướng dẫn xem chi tiết trên mobile

- Trước thay đổi: Hướng dẫn danh mục gộp chỉ nói “di chuột”, không phù hợp với thiết bị cảm ứng.
- Sau thay đổi: Dùng hướng dẫn “nhấn hoặc bấm” để người dùng mobile hiểu cách xem chi tiết.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://170cd4ed.family-expense-8fo.pages.dev/).

### Gộp danh mục nhỏ trên biểu đồ pie

- Trước thay đổi: Pie chart hiển thị quá nhiều lát và legend khi có nhiều danh mục nhỏ.
- Sau thay đổi: Giữ tối đa 5 danh mục lớn, gộp phần còn lại vào `Khác` và hiển thị chi tiết trong tooltip; vẫn giữ lọc giao dịch cho từng danh mục lớn.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://c62c88ce.family-expense-8fo.pages.dev/).

### Sửa insight khi lọc Dashboard theo một tháng

- Trước thay đổi: Khi chọn một tháng, khu vực `Điểm đáng chú ý` vẫn hiển thị tháng cao nhất/thấp nhất lấy từ trend sáu tháng của biểu đồ.
- Sau thay đổi: Insight tháng cao nhất/thấp nhất và xu hướng liên tiếp chỉ được tạo cho kỳ xem nhiều tháng; bộ lọc một tháng không còn hiển thị nhận xét ngoài kỳ.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, bổ sung regression test trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production cùng release qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://c62c88ce.family-expense-8fo.pages.dev/).

### Giảm chồng lấp label biểu đồ pie

- Trước thay đổi: Label và leader line được render cho mọi lát pie, khiến các lát rất nhỏ dồn chữ và chồng lên nhau.
- Sau thay đổi: Chỉ hiển thị số tiền trực tiếp cho lát chiếm từ 5% trở lên và tắt leader line; lát nhỏ vẫn giữ trong pie, legend, tooltip và accessibility label.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, bổ sung regression test trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://ddba3028.family-expense-8fo.pages.dev/).

### Chuyển biểu đồ danh mục sang pie chart

- Sau thay đổi: `Chi tiêu theo danh mục` và `Thu nhập theo danh mục` dùng pie chart giống các biểu đồ phân bổ khác; vẫn giữ tooltip, legend và click để mở giao dịch đã lọc.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://ddba3028.family-expense-8fo.pages.dev/).

### Khôi phục xác nhận giao dịch dự kiến tới hạn

- Trước thay đổi: Giao dịch `Dự kiến` tới hạn không có khu vực xác nhận riêng.
- Sau thay đổi: Tab Giao dịch hiển thị các giao dịch dự kiến đến hạn, cho phép xác nhận từng dòng hoặc xác nhận tất cả; trạng thái được chuyển sang `Thực tế` sau khi lưu thành công.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/Transactions.ui.test.tsx`; không đổi database/API.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; lint, typecheck, build và `git diff --check` đều pass. Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://cc619d3b.family-expense-8fo.pages.dev/).

### Ẩn bubble không có giá trị hiển thị

- Trước thay đổi: Biểu đồ bubble vẫn vẽ các vòng tròn nhỏ nhưng không đủ chỗ hiển thị tên và số tiền, khiến chúng trông như không có giá trị.
- Sau thay đổi: Chỉ giữ các bubble đủ kích thước để hiển thị đồng thời tên danh mục và giá trị rút gọn; bubble có giá trị bằng 0 vẫn không được vẽ.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, bổ sung regression test trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 67/67 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Regression test xác nhận bubble không có nhãn giá trị bị loại khỏi SVG; Browser local chưa dựng được Dashboard có dữ liệu vì thiếu Supabase/family.
- Triển khai: Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://cc619d3b.family-expense-8fo.pages.dev/).

### Sửa tràn KPI và bỏ nút Trước/Nay

- Trước thay đổi: Số tiền KPI dài như `1.295,1M ₫` bị tràn khỏi card 6 cột; header còn có hai nút `Trước` và `Nay` không cần thiết.
- Sau thay đổi: Đưa số tiền KPI xuống dòng riêng dưới nhãn/icon, cho phép ngắt dòng an toàn và giảm cỡ chữ nhẹ; loại bỏ hai nút `Trước` và `Nay`.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, bổ sung assertion UI trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: Đã chạy cùng bộ quality gates: `pnpm test` đạt 19/19 file và 67/67 test; lint, typecheck, build và `git diff --check` đều pass.
- Triển khai: Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://cc619d3b.family-expense-8fo.pages.dev/).

### Tinh gọn bố cục bộ lọc giao dịch

- Sau thay đổi: Bộ lọc chi tiết dùng bố cục 5 cột trên màn hình lớn, 4 cột tablet, 2 cột mobile; giảm khoảng cách và chiều cao ô nhập để giao diện gọn hơn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic, database hoặc API.
- Kiểm thử: Đang chạy test, lint, typecheck và build.

### Sửa click-through KPI theo kỳ nhiều tháng

- Trước thay đổi: KPI Dashboard tạo link `dateFrom/dateTo` cho kỳ nhiều tháng nhưng trang Giao dịch bỏ qua hai query này và giữ filter tháng/năm mặc định, nên danh sách mở ra không đúng kỳ.
- Sau thay đổi: Trang Giao dịch nhận khoảng ngày từ URL, tự bỏ filter tháng/năm mặc định khi có khoảng ngày và hiển thị đúng các giao dịch trong kỳ KPI đã chọn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; bổ sung regression test cho click-through trong `src/pages/Dashboard.test.tsx` và `src/pages/Transactions.ui.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 65/65 test; `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Browser đã kiểm tra route có query khoảng ngày; môi trường local chưa có Supabase/family nên route chuyển tới màn hình tạo gia đình, không có log error/warning. E2E chưa chạy được vì máy thiếu browser binary Playwright.
- Triển khai: PR #67 đã merge vào `main` với merge commit `a8d9f405`; Cloudflare Pages check báo deploy thành công cho commit này. Production `https://family-expense-8fo.pages.dev/` và deployment URL `https://c34c0d4a.family-expense-8fo.pages.dev/` đều trả HTTP 200.

### Thêm bộ lọc trạng thái giao dịch

- Trước thay đổi: Bộ lọc chi tiết chưa cho phép lọc riêng giao dịch `Thực tế` và `Dự kiến`.
- Sau thay đổi: Thêm bộ lọc `Trạng thái` với lựa chọn `Tất cả trạng thái`, `Thực tế`, `Dự kiến`; áp dụng đồng nhất cho dữ liệu local, Supabase, thùng rác và filter chip.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/Transactions.ui.test.tsx`; không thay đổi database/API.
- Kiểm thử: Đang chạy test, lint, typecheck và build.

### Cải thiện khả năng đọc số tiền trên KPI Dashboard

- Trước thay đổi: KPI dùng số tiền VND đầy đủ trong ô 6 cột nên dễ bị cắt bằng dấu `…`, đồng thời một số tiêu đề bị truncate.
- Sau thay đổi: KPI hiển thị số tiền dạng rút gọn `K/M` với chữ lớn hơn; vẫn giữ số tiền VND đầy đủ qua tooltip và accessible label, tiêu đề KPI được phép xuống dòng ngắn. Các KPI `Trung bình / tháng`, `Tháng cao nhất` và `Tháng thấp nhất` chỉ hiển thị khi filter bao phủ nhiều tháng.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, tái sử dụng `formatCompactVnd`; cập nhật assertion hiển thị trong `src/pages/Dashboard.test.tsx`; không đổi API/database.
- Kiểm thử: `pnpm test` đạt 19/19 file và 64/64 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Browser local tải app shell không có log error/warning; route Dashboard cần Supabase local nên không dựng được dữ liệu tương tác trong môi trường kiểm tra này.
- Triển khai: Đã deploy production qua Git/Cloudflare Pages: [production](https://family-expense-8fo.pages.dev/) · [deployment](https://cc619d3b.family-expense-8fo.pages.dev/).

### Import Excel cập nhật giao dịch theo ID

- Trước thay đổi: Import Excel chỉ thêm giao dịch mới hoặc bỏ qua dòng nghi trùng; không cập nhật được giao dịch hiện có.
- Sau thay đổi: File export/template có cột `ID giao dịch`; chế độ cập nhật dùng ID và kiểm tra `family_id`, còn dòng không có ID được xử lý theo chế độ thêm mới.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`, `src/lib/templateImport.ts`, thêm migration `supabase/migrations/202608310004_import_update_by_id.sql`; RPC trả số lượng thêm mới/cập nhật và giữ kiểm tra RLS/membership.
- Kiểm thử: `pnpm test` đạt 64/64; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Chưa deploy production; migration cần qua PR và Supabase workflow.

### Cải tiến Dashboard không có ngân sách

- Trước thay đổi: Dashboard chủ yếu hiển thị một tháng và xu hướng cố định 6 tháng; local fallback chưa gom đúng Tạm ứng/Hoàn tiền trong breakdown.
- Sau thay đổi: Thêm preset `Tháng/6 tháng/12 tháng/Năm/Tùy chỉnh`, 6 KPI gồm tổng chi/thu, thu ròng, trung bình, tháng cao nhất/thấp nhất, chart thu–chi theo tháng, top danh mục kèm micro-trend, insight dẫn xuất từ dữ liệu và giữ click-through sang Giao dịch.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, `src/pages/Dashboard.test.tsx`, `src/lib/transactionsApi.ts`; truy vấn giao dịch thực tế theo `family_id`, loại bỏ soft-deleted/dự kiến, phân trang 1.000 dòng; không thêm budget, dependency, migration hoặc thay đổi schema.
- Kiểm thử: Dashboard test bổ sung kiểm tra Tạm ứng, Hoàn tiền, preset 6 tháng và kỳ tùy chỉnh theo ngày; `pnpm test` đạt 19/19 file và 63/63 test, `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đều pass. Browser đã kiểm tra desktop/mobile, kỳ 6 tháng, kỳ tùy chỉnh, khoảng ngày không hợp lệ và không tràn ngang ở mobile.
- Triển khai: Chưa deploy; chưa yêu cầu deploy production. Build chỉ phát cảnh báo chunk ExcelJS lớn đã tồn tại.

### Đề xuất cải tiến Dashboard theo dashboard tham khảo

- Trước đề xuất: Dashboard chủ yếu xem theo một tháng/năm, có KPI tổng thu/chi, breakdown theo mục đích/danh mục và xu hướng 6 tháng.
- Đề xuất sau: Bổ sung preset kỳ xem `6 tháng/12 tháng/Năm/Tùy chỉnh`; hàng KPI có so sánh kỳ trước/năm trước; biểu đồ thực tế–ngân sách và vùng vượt ngân sách; breakdown theo thời gian; top danh mục/micro-trend; heatmap và insight có kiểm chứng theo các pha.
- Phạm vi kỹ thuật dự kiến: Ưu tiên tái sử dụng `src/pages/Dashboard.tsx`, `src/lib/transactionsApi.ts`, Recharts và local fallback; chỉ thêm migration mới nếu cần tích hợp `budgets`, không sửa migration đã áp dụng.
- Kiểm thử dự kiến: Test kỳ biên, empty/error từng query, ngân sách thiếu, click lọc giao dịch, local fallback; sau triển khai code chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` và E2E staging.
- Trạng thái: Chưa triển khai; đã ghi backlog và tiêu chí chấp nhận trong `HANDOFF.md`. Hai ảnh tham khảo chỉ định hướng UI/UX, không phải nguồn dữ liệu hay yêu cầu nghiệp vụ.

### Tăng kích thước bubble và ẩn danh mục không có dữ liệu

- Sau thay đổi: Packed Bubble chỉ render danh mục có giá trị dương; bubble lớn hơn để dễ đọc tên và số tiền.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Thử Packed Bubble Chart cho Thu/Chi theo danh mục

- Sau thay đổi: Hai chart Thu nhập/Chi tiêu theo danh mục hiển thị dạng bubble; kích thước theo giá trị, click bubble mở giao dịch đã lọc và tooltip native hiển thị chi tiết.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không thêm dependency, không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Tránh chồng lấn nhãn số tiền trên chart Thu ròng

- Sau thay đổi: Nhãn đầu/cuối được chừa mép, nhãn âm/dương đặt theo hướng phù hợp để không đè trục hoặc đường biểu đồ.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Sửa dữ liệu hai chart Chi tiêu theo mục đích và danh mục

- Sau thay đổi: Hai chart Chi tiêu chỉ lấy Chi tiêu/Tạm ứng và trừ Hoàn tiền; không còn hiển thị Thu nhập.
- Kỹ thuật: Thêm migration `supabase/migrations/202608310003_fix_dashboard_expense_breakdowns.sql`; giữ chart Thu ròng theo công thức Thu nhập − Chi tiêu.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Tăng tương phản chữ VI/EN trong dark mode

- Sau thay đổi: Chữ VI/EN trên switch ngôn ngữ có màu xanh đậm cố định trên nền trắng; track bật/tắt có màu tương phản rõ hơn trong dark mode.
- Kỹ thuật: Cập nhật `src/components/ThemeSelect.tsx`; không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Sửa công thức chart Thu ròng thành Thu nhập trừ Chi tiêu

- Sau thay đổi: Chart Thu ròng hiển thị đúng `Thu nhập − Chi tiêu`; cả dữ liệu local fallback và RPC Supabase được đồng bộ chiều dấu.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, thêm migration `supabase/migrations/202608310002_dashboard_net_income_sign.sql`; không sửa migration đã áp dụng.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Đổi tên chart thành Thu ròng

- Sau thay đổi: Chart cuối Dashboard hiển thị “Thu ròng”/“Net income”, giữ nguyên công thức Thu nhập − Chi tiêu và dữ liệu hiện có.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Hiển thị icon theme và chữ VI/EN trên switch

- Sau thay đổi: Switch giao diện hiển thị mặt trời/mặt trăng; switch ngôn ngữ hiển thị VI/EN ngay trên nút và vẫn giữ căn thẳng hai dòng.
- Kỹ thuật: Cập nhật `src/components/ThemeSelect.tsx`; không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Căn thẳng switch giao diện và ngôn ngữ

- Sau thay đổi: Hai switch dùng layout 3 cột cố định, luôn thẳng hàng dù nhãn VI/EN khác độ dài.
- Kỹ thuật: Cập nhật `src/components/ThemeSelect.tsx`; không thay đổi API/database.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chờ PR production.

### Sửa biểu đồ xu hướng chi tiêu thành 6 tháng

- Sau thay đổi: RPC Dashboard trả về đủ 6 tháng gần nhất, đồng bộ với phần hiển thị trên frontend.
- Kỹ thuật: Thêm migration `supabase/migrations/202608310001_dashboard_summary_six_months.sql`; đổi khoảng sinh tháng từ 5 thành 6, không đổi schema hay quy tắc nghiệp vụ.
- Kiểm thử: Local 61/61 tests, lint, typecheck và build pass; CI/db-security sẽ chạy qua PR. Triển khai: Chờ merge và Supabase production workflow.

### Cập nhật handoff sau deploy UI và chuẩn bị migration Dashboard

- Sau thay đổi: Đồng bộ `HANDOFF.md` với PR #58/merge commit `55d4fdab`; xác nhận UI switch, accessibility Dashboard và migration RPC 6 tháng là các thay đổi mới nhất.
- Triển khai: Frontend PR #58 đã deploy production; migration `202608310001_dashboard_summary_six_months.sql` được đưa vào PR tiếp theo để deploy qua Supabase workflow.

## 2026-08-30

### Đổi bộ chọn giao diện và ngôn ngữ sang switch

- Sau thay đổi: Giao diện chỉ còn Sáng/Tối bằng nút switch; ngôn ngữ VI/EN cũng chuyển đổi bằng switch, không còn lựa chọn Theo thiết bị.
- Kỹ thuật: Cập nhật `src/context/ThemeContext.tsx`, `src/components/ThemeSelect.tsx` và test tương ứng; lựa chọn `system` cũ được đọc thành Sáng để tương thích.
- Kiểm thử: Đang chạy test, lint, typecheck và build.
- Triển khai: Chưa deploy.

### Cải thiện accessibility và khả năng phục hồi Dashboard

- Sau thay đổi: Dashboard thông báo lỗi nếu bất kỳ query summary/trends/years thất bại; các lát/cột biểu đồ có thể điều hướng bằng bàn phím và có accessible name.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx` và mở rộng translation keys trong `src/context/LanguageContext.tsx`; không thay đổi database/API.
- Kiểm thử: Đang chạy lint, typecheck, test và build.
- Triển khai: Chờ quality gates và quy trình PR vào `main`.

### Cập nhật handoff sau release Dashboard và đa ngôn ngữ

- Cập nhật `HANDOFF.md` theo trạng thái production sau PR #55, #56 và #57: localization EN, selector đồng độ rộng, thứ tự chart và điều hướng click chart.
- Kiểm thử/triển khai: CI `main` pass quality và `db-security`; Cloudflare Pages production merge commit `54983d914f83c7ff8ccb5cfed2c3d22020cdfcaf` thành công.

### Cho phép nhấn cột xu hướng để mở giao dịch

- Nhấn cột Thu nhập/Chi tiêu theo tháng sẽ mở màn hình Giao dịch với bộ lọc tương ứng.
- Cập nhật `src/pages/Dashboard.tsx`; kiểm thử và triển khai đang thực hiện.

### Mở giao dịch khi nhấn chart xu hướng

### Hoàn thiện bản dịch giao diện Dashboard, Giao dịch và bộ chọn ngôn ngữ

- Sau thay đổi: Dashboard và màn hình Giao dịch có nhãn, trạng thái và bộ lọc tiếng Anh khi chọn EN; bổ sung icon địa cầu và label Ngôn ngữ cho bộ chọn VI/EN, giữ responsive mobile.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx`, `src/components/ThemeSelect.tsx`; không thay đổi database, enum nghiệp vụ hoặc cột Excel.
- Kiểm thử: TypeScript pass; lint/test bị giới hạn do worktree mới không tải được dependency từ npm registry.
- Triển khai: Chưa deploy.

### Sửa db-security bỏ qua migration dịch chuyển dữ liệu Excel legacy

- Nhấn cột Thu nhập hoặc Chi tiêu theo từng tháng sẽ mở màn hình Giao dịch với bộ lọc loại giao dịch, tháng và năm tương ứng.
- Cập nhật `src/pages/Dashboard.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử và triển khai: Đang thực hiện.

### Kết nối dữ liệu RPC cho chart xu hướng

- Sửa lỗi hai chart Thu nhập/Chi tiêu 6 tháng hiển thị toàn số 0 do chưa gọi `fetchDashboardTrends`.
- Cập nhật `src/pages/Dashboard.tsx`; chart nay lấy đúng dữ liệu từ RPC khi dùng Supabase.
- Kiểm thử: 61/61 tests, typecheck và lint đạt. Triển khai: Đang thực hiện.

### Đổi chart xu hướng 6 tháng sang dạng cột

- Hai chart Thu nhập và Chi tiêu 6 tháng hiển thị dạng cột bo góc, giữ màu xanh/cam và nhãn giá trị.
- Sửa CI để kiểm thử DB không bị chặn bởi migration dữ liệu Excel phụ thuộc Auth user.
- Kiểm thử: Đã đạt local test/typecheck; chờ CI chạy lại. Triển khai: Đang thực hiện.

### Đổi chart thu nhập và chi tiêu 6 tháng sang dạng cột

- Đổi hai chart xu hướng Thu nhập và Chi tiêu 6 tháng sang cột bo góc, giữ màu xanh/cam và nhãn giá trị trên đầu cột.
- Cập nhật `src/pages/Dashboard.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử và triển khai: Đang thực hiện.

### Bổ sung nền tảng chuyển ngôn ngữ VI/EN

- Sau thay đổi: Thêm toggle VI/EN, lưu lựa chọn trên thiết bị và đồng bộ `lang` của document; các nhãn giao diện dùng chung/theme đổi theo ngôn ngữ. Template Excel vẫn giữ tiếng Việt để tương thích file cũ.
- Kỹ thuật: Thêm `src/context/LanguageContext.tsx`; cập nhật `src/components/Layout.tsx`, `src/components/ThemeSelect.tsx`, `src/main.tsx`, `src/pages/ImportExport.tsx`; không đổi database/API.
- Kiểm thử: `pnpm test` đạt 61/61; `pnpm lint`, `pnpm typecheck`, `pnpm build` và `git diff --check` đạt. Build còn cảnh báo chunk ExcelJS lớn hiện hữu.
- Triển khai: Chưa deploy.

### Sửa chiều tính chart Chi ròng thực tế

- Chart xu hướng tính theo công thức “Thu nhập − Chi tiêu”; thu nhập hiển thị dương và chi tiêu làm giảm giá trị ròng.
- Cập nhật `src/pages/Dashboard.tsx` và `src/lib/transactionsApi.ts`; không thay đổi schema/database.
- Kiểm thử và triển khai: Đang thực hiện.

### Đổi tên chart xu hướng thành Chi ròng thực tế

- Giữ dữ liệu 6 tháng gần nhất và đổi tiêu đề chart cuối thành “Chi ròng thực tế” để đồng bộ với nội dung số liệu.
- Cập nhật `src/pages/Dashboard.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử và triển khai: Đang thực hiện.

### Tránh cắt nhãn giá trị trên biểu đồ tròn

- Tăng vùng hiển thị và khoảng đệm phía trên cho chart tròn để nhãn giá trị lớn như 19,2M không bị che ở mép trên.
- Cập nhật `src/pages/Dashboard.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử và triển khai: Đang thực hiện.

### Bổ sung xu hướng thu nhập và chi tiêu 6 tháng

- Thêm hai chart riêng “Thu nhập 6 tháng gần nhất” và “Chi tiêu 6 tháng gần nhất” phía trên chart chi ròng; chart chi ròng cũng hiển thị 6 tháng.
- Cập nhật `src/pages/Dashboard.tsx`; không thay đổi database/API.
- Kiểm thử: 61/61 tests, lint, typecheck và build đạt. Triển khai: Đang thực hiện.

### Đồng bộ tên bốn biểu đồ Dashboard

- Đổi tiêu đề thành: “Thu nhập theo mục đích”, “Chi tiêu theo mục đích”, “Chi tiêu theo danh mục” và “Thu nhập theo danh mục”.
- Cập nhật `src/pages/Dashboard.tsx` và assertion tương ứng trong `src/pages/Dashboard.test.tsx`; không thay đổi dữ liệu/API.
- Kiểm thử và triển khai: Đang thực hiện.

### Thêm toggle ngôn ngữ Việt/English

- Sau thay đổi: Thêm bộ chọn VI/EN cạnh lựa chọn giao diện, lưu lựa chọn trên thiết bị.
- Kỹ thuật: Thêm `src/context/LanguageContext.tsx`; cập nhật `src/main.tsx`, `src/components/ThemeSelect.tsx`; không đổi database/API.
- Kiểm thử: `pnpm test` đạt 61/61; `pnpm lint`, `pnpm typecheck` và `pnpm build` đạt. Build vẫn có cảnh báo chunk ExcelJS lớn hiện hữu.
- Triển khai: Chưa deploy.

### Bổ sung biểu đồ thu nhập theo mục đích và danh mục

- Trước thay đổi: Dashboard chỉ có các biểu đồ phân tích chi tiêu.
- Sau thay đổi: Thêm biểu đồ “Thu nhập theo mục đích” và “Thu nhập theo danh mục”; nhấn từng lát/cột sẽ mở màn hình Giao dịch với bộ lọc thu nhập tương ứng.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`, `src/lib/transactionsApi.ts`, `src/pages/Dashboard.test.tsx` và thêm migration `supabase/migrations/202608300001_dashboard_income_breakdowns.sql`.
- Kiểm thử: Vitest đạt 61/61; lint, typecheck và build đạt.
- Triển khai: Chưa deploy.

### Lọc giao dịch từ từng mục trên biểu đồ Tổng quan

- Sau thay đổi: Nhấn vào lát biểu đồ Mục đích hoặc cột Loại chi phí sẽ mở Giao dịch với bộ lọc tương ứng và giữ nguyên tháng/năm đang xem.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx` và `src/pages/Transactions.tsx`; không thay đổi database/API.
- Kiểm thử: Sẽ chạy test, lint, typecheck và build.
- Triển khai: Chưa deploy.

### Cập nhật handoff sau release UI ngày 30/08/2026

- Sau thay đổi: Đồng bộ `HANDOFF.md` với production merge commit `4682364870797aeb6b5b29e4bbe3bd61f2e97e09` và ghi nhận các cập nhật UI KPI, Import/Export, Tổng quan và thùng rác mobile đã deploy.
- Kiểm thử: CI quality và `db-security` đạt; local 61/61 tests, lint, typecheck và build đạt.
- Triển khai: Cloudflare Pages production deployment thành công; không có migration production mới.

### Bổ sung nút khôi phục giao dịch trong thùng rác mobile

- Trước thay đổi: Trên mobile, mỗi giao dịch trong thùng rác chỉ có nút xóa vĩnh viễn; nút khôi phục chỉ xuất hiện ở chế độ desktop.
- Sau thay đổi: Mỗi giao dịch trong thùng rác mobile có nút “Khôi phục” riêng, dùng cùng luồng xác nhận và persistence hiện có.
- Kỹ thuật: Cập nhật `src/components/TransactionRow.tsx`; không thay đổi database/API.
- Kiểm thử: Đã rà soát bằng test/lint/typecheck/build trước đó; cần chạy lại sau thay đổi.
- Triển khai: Chưa deploy.

### Đồng bộ bộ lọc loại giao dịch từ KPI

- Sau thay đổi: Trang Giao dịch đọc `transactionType` từ URL, giúp KPI Tổng chi chỉ mở Tiền ra và KPI Tổng thu chỉ mở Tiền vào theo tháng/năm đã chọn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và `src/pages/Transactions.test.ts`; không thay đổi database/API.
- Kiểm thử: Sẽ chạy test, lint, typecheck và build.
- Triển khai: Chưa deploy.

### Sửa assertion pgTAP cho kiểm thử foreign key

- Trước thay đổi: `db-security` dừng trước khi chạy test vì gọi hàm `has_constraint()` không có trong pgTAP của Supabase CLI.
- Sau thay đổi: Kiểm tra bốn composite foreign key tenant bằng `pg_constraint` và `ok()` của pgTAP.
- Kỹ thuật: Cập nhật `supabase/tests/tenant_security.sql`.
- Kiểm thử: Chờ chạy lại `db-security` trên GitHub Actions.
- Triển khai: Chờ required checks và Cloudflare Pages production deployment sau khi merge.

### Sửa CI cho kiểm thử DB/RLS không phụ thuộc dữ liệu Excel

- Trước thay đổi: Job `db-security` vẫn áp dụng migration dịch chuyển ngày dữ liệu Excel, khiến structural test thất bại trên database rỗng vì migration yêu cầu 2.083 dòng dữ liệu lịch sử.
- Sau thay đổi: CI loại cả migration seed Excel và migration dịch chuyển dữ liệu phụ thuộc user trước khi khởi động Supabase local; migration production không bị sửa.
- Kỹ thuật: Cập nhật `.github/workflows/ci.yml`.
- Kiểm thử: Đã xác nhận nguyên nhân qua log job GitHub; chờ chạy lại `db-security` sau khi push.
- Triển khai: Chờ required checks và Cloudflare Pages production deployment sau khi merge.

### Gửi danh sách giao dịch qua email bằng Brevo

- Trước thay đổi: Trang Quản lý dữ liệu chỉ cho tải file Excel về thiết bị, chưa có luồng gửi danh sách giao dịch qua email.
- Sau thay đổi: Owner có thể gửi toàn bộ giao dịch đang hoạt động tới email tài khoản hiện tại dưới dạng file CSV; Edge Function tự kiểm tra JWT, membership/owner và query lại theo `family_id` trước khi gọi Brevo.
- Kỹ thuật: Thêm `supabase/functions/email-transactions/index.ts`, cấu hình JWT trong `supabase/config.toml`, cập nhật `.github/workflows/supabase-deploy.yml`, `src/pages/ImportExport.tsx` và `README.md`; dùng secret `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, không thay đổi database/schema.
- Kiểm thử: `pnpm test` đạt 60/60 test; `pnpm typecheck`, `pnpm lint` và `pnpm build` đạt; E2E local bị chặn do máy chưa có browser Playwright, CI không chạy E2E; chưa kiểm thử gửi thật trên Supabase staging sau khi cấu hình Brevo.
- Triển khai: Đã deploy `email-transactions` lên Supabase staging project `gkvhztqoaslarykxxelt` bằng CLI; đã deploy production qua workflow Git sau khi merge vào `main`.

### Bổ sung offline/error recovery và kiểm thử DB/RLS trong CI

- Trước thay đổi: Trạng thái online chỉ hiển thị cục bộ ở layout, lỗi tải dữ liệu còn phụ thuộc message kỹ thuật, form giao dịch không có cơ chế khôi phục bản nháp; pgTAP mới kiểm tra constraint/RPC và chưa chạy trong CI; backup/restore staging còn là hướng dẫn thủ công.
- Sau thay đổi: App có trạng thái online phản ứng theo sự kiện mạng, retry có giới hạn cho query, thông báo lỗi tiếng Việt và nút tải lại; form giao dịch mới tự lưu/khôi phục bản nháp trên thiết bị, không coi mutation offline là thành công. CI có job Supabase local chạy pgTAP kiểm tra RLS/policy/constraint; thêm script drill staging có xác nhận target tách biệt, target trống và đối chiếu số dòng sau restore.
- Kỹ thuật: Cập nhật `src/context/AppContext.tsx`, `src/components/Layout.tsx`, `src/main.tsx`, `src/pages/TransactionForm.tsx`; thêm `src/lib/errorRecovery.ts`, `src/lib/transactionDraft.ts`; cập nhật `supabase/tests/tenant_security.sql`, `.github/workflows/ci.yml`, `scripts/staging-backup-restore.sh`, `docs/OPERATIONS_RUNBOOK.md`, `HANDOFF.md` và `README.md`. Không thay đổi migration/schema/database production.
- Kiểm thử: `pnpm test` đạt 60/60 test, `pnpm test:coverage` đạt 60/60 với 56% statements, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`, `bash -n scripts/staging-backup-restore.sh` và CI YAML parse đạt. Supabase pgTAP local chưa chạy vì Docker daemon không khả dụng; backup/restore drill thực tế chưa chạy vì workspace chưa có `STAGING_DB_URL` và `RESTORE_DB_URL`; không đọc `.env.staging` và không dùng production.
- Triển khai: Chưa deploy; cần chạy drill với staging source và restore target riêng theo runbook, sau đó mới ghi RTO/RPO thực tế.

### Đồng bộ màu icon giá trị ròng theo bộ lọc

- Trước thay đổi: Icon của thẻ “Giá trị ròng theo bộ lọc” luôn màu xanh, không đồng bộ với trạng thái giá trị đang hiển thị.
- Sau thay đổi: Icon dùng màu đỏ khi chi nhiều hơn, màu xanh khi thu nhiều hơn và màu trung tính khi cân bằng, đồng bộ với màu số tiền và nền thẻ.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi database/API.
- Kiểm thử: `pnpm test` đạt 60/60 test; `pnpm lint`, `pnpm typecheck`, `pnpm build` đạt. Build vẫn có cảnh báo chunk lớn hiện hữu cho ExcelJS.
- Kiểm thử CI: Điều chỉnh job `db-security` để không chạy migration seed Excel phụ thuộc Auth user khi kiểm tra schema/RLS; không sửa migration production.
- Triển khai: Chưa deploy; chờ CI/CD qua Git và Cloudflare Pages.

### Refactor component, bổ sung coverage và tối ưu bundle

- Trước thay đổi: `Transactions.tsx` chứa cả phần render từng dòng giao dịch; test chưa có lệnh coverage; `ImportExport` tải tĩnh thư viện Excel và build tạo chunk dùng chung lớn.
- Sau thay đổi: Tách `TransactionRow`, thêm 3 regression tests và `pnpm test:coverage`; parser/template/export Excel được tải theo thao tác; cấu hình manual chunks cho vendor dependencies.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, thêm `src/components/TransactionRow.tsx` và test, cập nhật `src/pages/ImportExport.tsx`, `src/test/setup.ts`, `vite.config.ts`, `package.json`, `pnpm-lock.yaml`, `.gitignore`. Không thay đổi database/API.
- Kiểm thử: 16 test files / 53 tests đạt; coverage `src` đạt 52.24% statements, 65.99% branches; lint, typecheck và build đạt. Build còn cảnh báo riêng cho chunk ExcelJS deferred khoảng 937 KB.
- Triển khai: PR #26 đã squash-merge vào `main` với merge commit `fee08bb848768d588273f2a9dc686768b98bb42d`; CI production và Cloudflare Pages check đều thành công. Production [family-expense-8fo.pages.dev](https://family-expense-8fo.pages.dev) trả HTTP 200 khi smoke check.

## 2026-08-29

### Cập nhật handoff sau khi kiểm tra workflow Supabase

- Trước thay đổi: Handoff còn mô tả Supabase/production deployment chưa đồng bộ với workflow Git mới và chưa ghi kết quả dry-run.
- Sau thay đổi: Cập nhật quy trình Git-based, điều kiện `dry_run`, PR #24, merge commit `b6cb590` và workflow run `33259320637`.
- Kỹ thuật: Cập nhật `HANDOFF.md`; không thay đổi database, dữ liệu hoặc API.
- Kiểm thử: Đã xác nhận workflow Supabase dry-run thành công; migration và Edge Function không được deploy.
- Triển khai: Chỉ cập nhật tài liệu; không có production mutation.

### Bổ sung chế độ kiểm tra an toàn cho workflow Supabase

- Trước thay đổi: Chạy workflow thủ công luôn áp dụng migration production và deploy Edge Function.
- Sau thay đổi: Thêm input `dry_run`; khi bật, workflow vẫn kiểm tra secret, project link và danh sách migration nhưng không thay đổi database hoặc deploy function. Thay đổi file workflow không tự kích hoạt deploy production.
- Kỹ thuật: Cập nhật `.github/workflows/supabase-deploy.yml`; không thay đổi schema, dữ liệu hoặc API.
- Kiểm thử: CI pass; sau khi merge, chạy `workflow_dispatch` với `dry_run=true` trên GitHub Actions và workflow run `33259320637` pass.
- Triển khai: PR #24 đã merge vào `main` với commit `b6cb590`; dry-run không áp dụng migration và không deploy Edge Function.

### Chuẩn hóa handoff deploy tự động qua Git

- Sau thay đổi: Ghi rõ quy trình bắt buộc từ kiểm thử, commit/push, tạo PR, cập nhật branch, auto-merge, required checks đến Cloudflare Pages production deploy.
- Kỹ thuật: Cập nhật `AGENTS.md`; không thay đổi database/API.
- Kiểm thử: Không áp dụng vì chỉ cập nhật quy tắc vận hành.
- Triển khai: Rule được commit và push cùng PR hiện tại; production chỉ deploy sau khi merge vào `main`.

### Đổi màu KPI giá trị ròng theo thu chi

- Trước thay đổi: KPI “Giá trị ròng” luôn dùng màu xanh dương.
- Sau thay đổi: Dương (thu nhiều hơn chi) dùng màu xanh; âm (chi nhiều hơn thu) dùng màu đỏ; bằng 0 giữ màu trung tính.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx` và `src/pages/Dashboard.test.tsx`; không thay đổi database/API.
- Kiểm thử: Bổ sung kiểm tra màu KPI khi giá trị ròng âm; chờ chạy test, lint, typecheck và build.
- Triển khai: Chờ CI/CD qua Git và Cloudflare Pages production deploy.

### Chỉ hiển thị kết quả kiểm tra sau khi chọn file

- Trước thay đổi: Khối “Kết quả kiểm tra file” luôn hiển thị dù người dùng chưa chọn file.
- Sau thay đổi: Khối kết quả chỉ xuất hiện khi đã chọn file, đang kiểm tra hoặc có lỗi từ thao tác chọn file.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database/API.
- Kiểm thử: Chạy typecheck, lint, test và build trước khi deploy.
- Triển khai: Chờ CI và Cloudflare Pages production deploy.

### Handoff mới nhất cho PR #21

- Đã resolve conflict `CHANGELOG.md` và push commit `6a67eb9` lên branch `chore/protect-env`.
- PR #21 đã được auto-merge vào `main` với merge commit `1cbbac0`.
- CI và Cloudflare Pages Preview của commit `6a67eb9` đều thành công; CI production cho merge commit đang chạy.
- Production đã từng được deploy thủ công từ artifact tương ứng; cần xác nhận deployment Git của merge commit `1cbbac0` hoàn tất trước khi kết luận handoff.

### Sửa môi trường test localStorage và deploy bản build mới

- Trước thay đổi: Test `ThemeContext` thất bại vì jsdom không cung cấp `window.localStorage` trong môi trường hiện tại.
- Sau thay đổi: Cấu hình URL jsdom và bổ sung localStorage fallback dùng riêng cho test; không thay đổi logic production.
- Kỹ thuật: Cập nhật `vite.config.ts` và `src/test/setup.ts`; không thay đổi database/API.
- Kiểm thử: 50/50 test, typecheck, lint và build đều đạt.
- Triển khai: Đã deploy Cloudflare Pages production từ artifact hiện tại.

### Làm gọn thông báo kết quả kiểm tra Excel

- Trước thay đổi: Kết quả kiểm tra hiển thị số dòng chung và thêm một khối riêng chỉ để lặp lại tên file, trong khi các thẻ thống kê phía dưới đã có số liệu chi tiết.
- Sau thay đổi: Thông báo gộp tên file, số giao dịch hợp lệ, dòng có thể trùng và dòng lỗi trong một câu; trạng thái thành công nói rõ file đã sẵn sàng để import. Loại bỏ khối tên file bị lặp.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; thêm formatter và test tại `src/lib/importSummary.ts`, `src/lib/importSummary.test.ts`. Không thay đổi database hoặc API.
- Kiểm thử: Bổ sung test cho trường hợp 64 dòng hợp lệ và trường hợp có cả trùng/lỗi; chờ test, lint, typecheck và build.
- Triển khai: Chờ CI, auto-merge PR và Cloudflare production deploy.

### Sửa nguyên nhân gốc làm mất file Excel sau khi đóng Finder

- Trước thay đổi: Khi cửa sổ chọn file đóng, Chrome lấy lại focus và gọi làm mới phiên Supabase. Sự kiện `TOKEN_REFRESHED` sau đó tải lại toàn bộ `AppProvider`, bật trạng thái loading và tháo trang `ImportExport` khỏi giao diện; file vừa chọn, trạng thái kiểm tra và kết quả parse vì vậy bị xóa ngay.
- Sau thay đổi: Sự kiện chỉ làm mới token không còn tải lại dữ liệu ứng dụng hoặc tháo trang hiện tại. File Excel và bảng kết quả được giữ nguyên trong lúc parser chạy; các sự kiện đăng nhập, đăng xuất và cập nhật tài khoản vẫn đồng bộ lại dữ liệu.
- Kỹ thuật: Cập nhật `src/context/AppContext.tsx`; thêm regression test `src/context/AppContext.test.ts`. Không thay đổi database, RPC hoặc dữ liệu production.
- Kiểm thử: Bổ sung kiểm tra `TOKEN_REFRESHED` không kích hoạt reload và các sự kiện auth thực sự vẫn reload; chờ chạy toàn bộ test, lint, typecheck và build.
- Triển khai: Chờ CI, auto-merge PR và Cloudflare production deploy.

### Bổ sung kéo-thả file Excel từ Finder

- Triệu chứng: Sau khi file picker đóng, macOS chuyển focus sang Excel và trang vẫn báo chưa chọn file, cho thấy file có thể bị mở bằng Excel thay vì được trả cho Chrome.
- Sau thay đổi: Vùng import nhận file `.xlsx` bằng drag-and-drop trực tiếp từ Finder và dùng chung `processImportFile`, không phụ thuộc file picker.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Chờ CI chạy typecheck/lint/test/build; cần smoke test kéo-thả trên production sau deploy.
- Triển khai: Chờ CI, merge PR và Cloudflare production deploy.

### Thay parser import Excel để xử lý ổn định trong trình duyệt

- Trước thay đổi: Sau khi Finder trả file, UI bắt đầu kiểm tra rồi mất kết quả; parser dùng dynamic import `exceljs`. File xuất rút gọn cũng không còn được nhận diện vì logic cũ phụ thuộc cột `ID giao dịch` đã bị loại bỏ.
- Sau thay đổi: `parseTemplate` dùng thư viện `xlsx` đã có sẵn trong bundle, đọc sheet thành mảng dữ liệu, hỗ trợ ngày serial và nhận diện template/file xuất theo tên các cột bắt buộc.
- Kỹ thuật: Cập nhật `src/lib/templateImport.ts` và `src/lib/templateImport.test.ts`; không thay đổi database hoặc API.
- Kiểm thử: Bổ sung test file xuất rút gọn có ngày serial `45316`, số tiền và ánh xạ `Tiền vào`; chờ CI chạy test/typecheck/lint/build.
- Triển khai: Chờ CI, merge PR và Cloudflare production deploy.

### Ghi chú điều tra lỗi import Excel chưa nhận file

- Triệu chứng thực tế: Trên production `/du-lieu`, người dùng bấm chọn file `.xlsx`; Finder mở và đóng bình thường, UI hiện `Đang kiểm tra file…` trong chốc lát rồi quay về `Chưa chọn file Excel.`. File name không xuất hiện và không có kết quả parse để người dùng xem.
- Triệu chứng liên quan: Nút `Xuất dữ liệu` từng báo `Could not embed because more than one relationship was found for 'transactions' and 'purposes'`; lỗi này đã được sửa bằng cách chỉ định composite FK trong truy vấn Supabase.
- Các thay đổi đã thực hiện:
  - Hỗ trợ ngày Excel serial trong `src/lib/templateImport.ts`.
  - Hiển thị input native rồi đổi sang nút riêng điều khiển input ẩn trong `src/pages/ImportExport.tsx`.
  - Tách thông báo import/export và giữ bảng kết quả luôn hiển thị.
  - Giữ tên file khi parser lỗi thay vì xóa về trạng thái chưa chọn.
  - Dùng `showOpenFilePicker` trên Chrome và fallback input cho trình duyệt khác; xử lý file qua `processImportFile`.
  - Rút gọn cột Excel xuất và chỉ định các quan hệ `transactions_*_same_family_fkey`.
- Đã merge/deploy: Các PR liên quan #8–#17 đều đã được CI kiểm tra; PR #17 đã merge với commit `928774c5` và Cloudflare production đã nhận các bản trước đó. Cần xác nhận lại deployment sau commit #17 trên Cloudflare trước khi kết luận bản mới đang chạy.
- Cần model tiếp theo kiểm tra: Nếu production đã chạy commit #17 mà vẫn quay về `Chưa chọn file Excel`, kiểm tra runtime console/network và xem component có bị remount hay lỗi JavaScript trong `showOpenFilePicker`/`processImportFile`; không giả định tiếp tục là lỗi cache hay parser.
- Phạm vi: Chưa có thay đổi database hay dữ liệu production cho các bản sửa UI/import này.

### Dùng bộ chọn file trực tiếp trên Chrome

- Sau thay đổi: Dùng `showOpenFilePicker` trên Chrome để nhận trực tiếp file sau khi Finder đóng; vẫn giữ fallback input cho trình duyệt không hỗ trợ API này.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát chọn file, hủy Finder, file sai định dạng và fallback input.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Giữ tên file khi Excel kiểm tra thất bại

- Sau thay đổi: Khi parser gặp lỗi, tên file vẫn được giữ và bảng kết quả hiển thị lỗi chi tiết, không quay về trạng thái `Chưa chọn file Excel`.
- Kỹ thuật: Cập nhật nhánh lỗi trong `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát file hợp lệ, sai template và file hỏng/không đọc được.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Sửa nút chọn file Excel trên Chrome macOS

- Sau thay đổi: Dùng nút chọn file riêng kết hợp input ẩn được kích hoạt bằng `ref`, tránh trạng thái trình duyệt vẫn hiển thị `No file chosen` dù người dùng đã chọn file.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát click nút, chọn lại cùng file và chuỗi trạng thái kiểm tra.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Giữ bảng kết quả kiểm tra file Excel luôn hiển thị

- Sau thay đổi: Bổ sung bảng trạng thái cố định dưới vùng chọn file, luôn hiển thị đang kiểm tra, kết quả, lỗi chi tiết hoặc trạng thái chưa chọn file.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát các trạng thái chưa chọn, đang kiểm tra, thành công và lỗi đọc file.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Rút gọn cột trong file Excel xuất

- Sau thay đổi: Loại bỏ các cột ID/mã kỹ thuật, sự kiện/kế hoạch, người hưởng lợi, tài khoản/thẻ và các cột AI/audit khỏi file xuất; giữ lại thông tin giao dịch chính và nguồn.
- Kỹ thuật: Cập nhật mapping Excel trong `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát mapping dữ liệu cloud/fallback và tự động điều chỉnh độ rộng cột theo header.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Sửa lỗi xuất Excel do quan hệ Supabase bị mơ hồ

- Sau thay đổi: Chỉ định rõ các khóa liên kết cùng `family_id` khi tải dữ liệu xuất Excel, tránh lỗi `more than one relationship was found`.
- Kỹ thuật: Cập nhật truy vấn trong `src/pages/ImportExport.tsx`, dùng các FK `transactions_*_same_family_fkey`; không thay đổi schema hoặc dữ liệu.
- Kiểm thử: Đã đối chiếu tên FK với migration `202608290001_composite_tenant_foreign_keys.sql`; chờ CI và kiểm tra xuất Excel trên production.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Tách thông báo import và xuất Excel

- Sau thay đổi: Kết quả kiểm tra/import không còn bị thao tác xuất dữ liệu ghi đè; lỗi xuất Excel hiển thị nguyên nhân chi tiết hơn khi Supabase trả lỗi.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát trạng thái độc lập của import/export và các dạng lỗi `Error`/PostgREST.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Cập nhật Supabase CLI action lên Node.js mới

- Sau thay đổi: Cập nhật `supabase/setup-cli` từ `v1` lên `v2` để loại bỏ cảnh báo action dùng Node.js 20 đã deprecated trên GitHub Actions.
- Kỹ thuật: Cập nhật `.github/workflows/supabase-deploy.yml`; không thay đổi migration, dữ liệu hoặc runtime.
- Kiểm thử: Chờ CI và lần chạy Supabase workflow kế tiếp xác nhận action mới hoạt động.
- Triển khai: Chờ merge PR.

### Tự động deploy Supabase từ GitHub

- Sau thay đổi: Thêm workflow tự động chạy migration production và deploy Edge Function `parse-expense` sau khi thay đổi Supabase được merge vào `main`; hỗ trợ chạy thủ công từ GitHub Actions.
- Kỹ thuật: Thêm `.github/workflows/supabase-deploy.yml`; không thay đổi schema hoặc dữ liệu production.
- Cấu hình cần có: GitHub Environment `production` với Secret `SUPABASE_ACCESS_TOKEN` và Variable `SUPABASE_PROJECT_REF`.
- Kiểm thử: Đã rà soát trigger, concurrency, kiểm tra thiếu cấu hình và thứ tự migration/function deploy; chờ GitHub Actions chạy lần đầu.
- Triển khai: Workflow đã đưa vào repository; migration/function production chỉ chạy khi workflow được kích hoạt với đủ secret/variable.

### Giữ thông báo khi kiểm tra Excel gặp lỗi

- Sau thay đổi: Giữ trạng thái và thông báo lỗi rõ ràng sau khi chọn file, kể cả khi trình duyệt hoàn tất sự kiện chọn file trước khi thao tác đọc Excel kết thúc.
- Kỹ thuật: Ổn định tham chiếu input file trong `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát luồng chọn file hợp lệ, file sai template và lỗi đọc file.
- Triển khai: Chờ CI, merge PR và Cloudflare deploy production.

### Hiển thị input chọn file Excel trực tiếp

- Sau thay đổi: Hiển thị input file native thay vì input trong suốt phủ vùng upload, giúp Chrome nhận thao tác chọn file rõ ràng và hiển thị tên file sau khi chọn.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát sự kiện chọn file và trạng thái tên file/kết quả kiểm tra.
- Triển khai: Chờ merge PR và Cloudflare deploy production.

### Đổi nhãn tab Dữ liệu thành Quản lý dữ liệu

- Sau thay đổi: Đổi nhãn điều hướng và tiêu đề trang `/du-lieu` thành `Quản lý dữ liệu` để kiểm tra trực quan bản deploy mới.
- Kỹ thuật: Cập nhật `src/components/Layout.tsx` và `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát nhãn trên navigation và tiêu đề trang.
- Triển khai: Chờ merge PR và Cloudflare deploy production.

### Sửa vùng chọn file Excel không phản hồi

- Sau thay đổi: Input file phủ toàn bộ vùng upload, có accessible name rõ ràng và vẫn cho phép chọn lại cùng file; thao tác chọn file sẽ kích hoạt kiểm tra ổn định hơn trên Chrome, Safari và PWA.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát sự kiện click/change và trạng thái phản hồi sau khi chọn file.
- Triển khai: Chưa deploy production.

### Giữ kết quả kiểm tra file Excel hiển thị ổn định

- Sau thay đổi: Trạng thái đang kiểm tra được quản lý riêng; sau khi xử lý xong app vẫn hiển thị kết quả hoặc thông báo rõ khi sheet `Giao dịch` không có dòng dữ liệu, không để vùng upload tự trống.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát luồng file hợp lệ, file không có dữ liệu và lỗi parse.
- Triển khai: Chưa deploy production.

### Hiển thị lỗi cụ thể khi upload Excel

- Sau thay đổi: Trạng thái kiểm tra được hiển thị ngay dưới vùng chọn file; lỗi đọc file, sheet/header hoặc validation được hiển thị rõ thay vì chỉ im lặng quay về trạng thái trống.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Rà soát các nhánh thành công, file sai định dạng và lỗi parse trong handler upload.
- Triển khai: Chưa deploy production.

### Sửa import file Excel có ngày dạng serial

- Sau thay đổi: File Excel có dữ liệu ngày được lưu theo số serial của Excel (ví dụ `45316`) được chuyển đúng sang ngày ISO trước khi validate, thay vì bị loại toàn bộ dòng.
- Kỹ thuật: Cập nhật `src/lib/templateImport.ts`; không thay đổi database hoặc API.
- Kiểm thử: Đã xác nhận file `family-expense-template-2026-08-29.xlsx` có 64 dòng dữ liệu và tái hiện nguyên nhân từ giá trị ngày dạng số.
- Triển khai: Chưa deploy production.

### Sửa luồng chọn lại file import Excel

- Sau thay đổi: Input file được reset trước mỗi lần mở hộp chọn, nên chọn lại cùng một file vẫn kích hoạt kiểm tra import.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Cần chạy lại typecheck, lint, test và build.
- Triển khai: Chưa deploy production.

### Cập nhật technical debt sau khi hoàn tất delivery pipeline

- Sau thay đổi: Xóa mô tả lỗi thời về việc thiếu Git/CI/CD/staging trong `HANDOFF.md`; ghi nhận pipeline đã chuẩn hóa và chỉ còn cần duy trì.
- Kỹ thuật: Cập nhật `HANDOFF.md`, không thay đổi runtime, database hoặc API.
- Kiểm thử: Rà soát lại các mục Known Issues và Outstanding Tasks.
- Triển khai: Thay đổi tài liệu; không cần deploy ứng dụng.

### Đồng bộ handoff và kiểm tra migration production

- Sau thay đổi: Xóa các mục Team & Contacts/TBD, cập nhật repository, staging và URL production mới trong `HANDOFF.md`.
- Kỹ thuật: Không thay đổi runtime hoặc database; kiểm tra migration production bị giới hạn vì Supabase CLI local chưa có `SUPABASE_ACCESS_TOKEN`.
- Kiểm thử: Đã đối chiếu trạng thái Git, Cloudflare deployment và cấu hình staging; chưa xác nhận được migration production từ CLI.
- Triển khai: Thay đổi tài liệu; không deploy ứng dụng.

### Thiết lập dữ liệu giả lập cho Supabase staging

- Sau thay đổi: Xác nhận Supabase staging hoạt động, schema `transactions` có sẵn và thêm 3 giao dịch giả lập bằng tài khoản test staging; không tác động production.
- Kỹ thuật: Cập nhật trạng thái staging trong `HANDOFF.md`; dữ liệu được ghi qua RPC import hiện hành.
- Kiểm thử: Đăng nhập staging thành công, RPC import trả HTTP 200, xác nhận dữ liệu staging sau seed.
- Triển khai: Đã hoàn tất trên Supabase staging; không deploy production.

### Sửa lỗi typecheck ở export Excel

- Sau thay đổi: Giá trị loại giao dịch từ dữ liệu Supabase được chuẩn hóa về chuỗi trước khi ánh xạ nhãn `Tiền ra/Tiền vào`, giúp CI build không còn lỗi TypeScript.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx`; không thay đổi database hoặc API.
- Kiểm thử: Đã sửa lỗi theo log CI; cần chạy lại typecheck, lint, test và build.
- Triển khai: Chưa deploy production.

### Rút gọn tài liệu handoff cho dự án cá nhân

- Sau thay đổi: Giữ lại `HANDOFF.md` làm ngữ cảnh kỹ thuật cho các phiên làm việc tiếp theo; loại bỏ nội dung contact, bàn giao quyền và sign-off dành cho đội khác.
- Kỹ thuật: Xóa `docs/Handoff_Document_Family_Expense.docx` và `scripts/build_handoff_document.py`; cập nhật `HANDOFF.md`, không thay đổi runtime, database hay API.
- Kiểm thử: Rà soát tham chiếu tài liệu trong repository; không cần chạy quality gate vì chỉ thay đổi tài liệu.
- Triển khai: Không cần deploy ứng dụng.

### Đồng bộ Handoff với trạng thái delivery thực tế

- Sau thay đổi: Handoff đánh dấu GitHub, protected `main`, CI, Cloudflare Git deployment và Supabase staging đã hoàn thành; tách riêng các hạng mục vận hành còn thiếu.
- Kỹ thuật: Cập nhật `HANDOFF.md`, không thay đổi runtime hay database.
- Kiểm thử: Rà soát đối chiếu với repository, workflow và trạng thái staging đã triển khai.
- Triển khai: Thay đổi tài liệu; chưa cần deploy ứng dụng.

### Bổ sung runbook deploy dùng lại

- Sau thay đổi: Chuẩn hóa quy trình deploy gồm quality gates, Pull Request, CI, Cloudflare Git deployment và kiểm tra sau deploy.
- Kỹ thuật: Thêm `docs/DEPLOY_RUNBOOK.md`; không thay đổi runtime.
- Kiểm thử: Rà soát nội dung theo workflow GitHub/Cloudflare hiện tại.
- Triển khai: Áp dụng từ lần release tiếp theo.

### Cho phép import lại file Excel xuất đầy đủ

- Sau thay đổi: Màn hình Import nhận cả template chuẩn và file Excel xuất đầy đủ có sheet `Giao dịch`; nhãn `Tiền ra/Tiền vào` được ánh xạ về enum nội bộ khi ghi dữ liệu.
- Kỹ thuật: Cập nhật `src/lib/templateImport.ts` để nhận diện header đầy đủ và đọc cột theo tên.
- Kiểm thử: Cần chạy test, typecheck, lint và build trước khi deploy.
- Triển khai: Chưa deploy production.

### Đồng bộ nhãn loại giao dịch trong file Excel xuất

- Sau thay đổi: Cột `Loại giao dịch` trong file Excel xuất hiển thị `Tiền ra` và `Tiền vào` thay vì enum nội bộ `Chi tiêu` và `Thu nhập`.
- Kỹ thuật: Cập nhật `src/pages/ImportExport.tsx` dùng `transactionTypeLabel`; không thay đổi dữ liệu database hoặc logic import tương thích legacy.
- Kiểm thử: Cần chạy lint, typecheck, test và build trước khi deploy.
- Triển khai: Chưa deploy production.

### Sửa workflow preview Cloudflare thiếu API token

- Sau thay đổi: Workflow Pull Request chỉ kiểm tra build; Cloudflare Pages tiếp tục tự triển khai preview qua kết nối GitHub, không còn gọi `cloudflare/pages-action@v1`.
- Kỹ thuật: Cập nhật `.github/workflows/cloudflare-preview.yml`, loại bỏ yêu cầu `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`.
- Kiểm thử: Kiểm tra cấu hình workflow và build output `dist/index.html`.
- Triển khai: Cần push commit lên GitHub; không cần cấu hình thêm secret Cloudflare.

### Cập nhật GitHub Actions lên Node.js 24

- Sau thay đổi: `checkout` và `setup-node` dùng major version mới tương thích Node.js 24, loại bỏ cảnh báo deprecation Node.js 20 trên GitHub Actions.
- Kỹ thuật: Cập nhật `.github/workflows/ci.yml` và `.github/workflows/cloudflare-preview.yml` dùng `checkout@v5`, `setup-node@v5` và `pnpm/action-setup@v6`, tương thích runtime Node.js 24.
- Triển khai: Áp dụng tự động ở lần chạy workflow tiếp theo.

### Bổ sung vận hành, PWA kiểm thử và phân trang Thùng rác

- Sau thay đổi: Thêm RPC `list_deleted_transactions` phân trang/lọc phía server; bổ sung runbook monitoring không PII, synthetic smoke, alert escalation, backup/restore drill, retention và kiểm thử cài/offline iOS.
- Kỹ thuật: `supabase/migrations/202608290002_trash_pagination.sql`, `src/lib/transactionsApi.ts`, `src/pages/Transactions.tsx`, `docs/OPERATIONS_RUNBOOK.md`.
- Triển khai: Chưa deploy production; cần apply migration trước khi bật Thùng rác server-side.

### Chuẩn bị Git, CI, Cloudflare preview và staging governance

- Sau thay đổi: Thêm workflow CI cho pull request/main, workflow Cloudflare Pages preview theo PR, hướng dẫn branch protection, mẫu biến môi trường staging và runbook migration rehearsal/production approval.
- Kỹ thuật: `.github/workflows/ci.yml`, `.github/workflows/cloudflare-preview.yml`, `.github/branch-protection.md`, `.env.staging.example`, `scripts/migration-rehearsal.sh`, `docs/RELEASE_GOVERNANCE.md`.
- Lưu ý: Không thể ghi metadata `.git` trong sandbox hiện tại; cần chạy `git init -b main` một lần trên máy người dùng hoặc CI runner.
- Triển khai: Chưa cấu hình GitHub secrets/Cloudflare project/Supabase staging thật.

### Bổ sung tenant foreign keys và negative security tests

- Sau thay đổi: Thêm composite foreign keys `(family_id, id)` cho các danh mục được giao dịch/budget tham chiếu, ngăn dữ liệu chéo gia đình ở tầng PostgreSQL; bổ sung bộ kiểm tra pgTAP cho FK/RPC authorization.
- Kỹ thuật: `supabase/migrations/202608290001_composite_tenant_foreign_keys.sql`, `supabase/tests/tenant_security.sql`. AI đã giữ contract chỉ `Chi tiêu`/`Thu nhập` từ thay đổi trước.
- Kiểm thử: Kiểm tra cú pháp/đọc migration; test pgTAP cần chạy trong Supabase local có extension pgTAP.
- Triển khai: Chưa áp dụng migration lên production.

## 2026-08-28

### Hoàn tất quality gates và cập nhật E2E

- Sau thay đổi: Đồng bộ kiểu `aiTone`, test labels theo UI hiện tại, sửa cảnh báo dependency của `useMemo`, cập nhật template-import test và E2E flow đăng nhập/mở form giao dịch.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx`, `src/pages/Catalogs.test.tsx`, `src/lib/templateImport.test.ts`, `src/pages/Transactions.tsx`, `tests/e2e/main-flow.spec.ts`.
- Kiểm thử: Typecheck đạt; ESLint đạt với `--max-warnings=0`; Vitest đạt 43/43; Vite production build đạt.
- Triển khai: Chưa deploy production.

### Siết quyền cập nhật giao dịch và đồng bộ loại giao dịch hiện hành

- Sau thay đổi: Member chỉ sửa được giao dịch do mình tạo; owner vẫn sửa được toàn bộ. Dashboard chỉ tính `Chi tiêu`/`Thu nhập`, loại legacy `Hoàn tiền`/`Tạm ứng` không còn ảnh hưởng KPI, biểu đồ hoặc giao dịch gần đây. AI chỉ trả về hai loại này và không ghi raw response lỗi Gemini vào log.
- Kỹ thuật: Thêm migration `supabase/migrations/202608280001_member_update_and_dashboard_legacy.sql`; cập nhật `src/lib/ai.ts`, `supabase/functions/parse-expense/index.ts`.
- Kiểm thử: Đã chạy typecheck; cần chạy tiếp lint, Vitest và build sau khi hoàn thiện bộ kiểm thử liên quan.
- Triển khai: Chưa deploy production; migration và Edge Function cần được áp dụng cùng lúc.

### Bổ sung Handoff Markdown mới nhất

- Sau thay đổi: Có `HANDOFF.md` tại thư mục gốc để đội tiếp nhận tra cứu nhanh trạng thái, kiến trúc, môi trường, deploy, secret, dữ liệu, runbook, technical debt và checklist ký nhận.
- Kỹ thuật: Nội dung đồng bộ với SAD/Handoff bản Word và trạng thái dự án ngày 28/08/2026; các thông tin chưa có được đánh dấu `TBD`, không chứa secret thật.
- Kiểm thử: Rà soát liên kết tương đối, cấu trúc heading, bảng và checklist Markdown.
- Triển khai: Không cần deploy ứng dụng; đây là thay đổi tài liệu.

### Bổ sung bộ tài liệu kiến trúc và bàn giao

- Sau thay đổi: Có SAD tiếng Việt phản ánh kiến trúc hiện tại/mục tiêu và Handoff Document dạng checklist để đội tiếp nhận vận hành, xử lý sự cố, quản lý secret và ký nhận.
- Kỹ thuật: Tạo `docs/Solution_Architecture_Document_Family_Expense.docx`, `docs/Handoff_Document_Family_Expense.docx` cùng hai script tái lập trong `scripts/`; không thay đổi ứng dụng, database hay API.
- Kiểm thử: Render DOCX sang PNG và kiểm tra trực quan toàn bộ trang trước bàn giao.
- Triển khai: Không cần deploy ứng dụng; đây là thay đổi tài liệu.

### Tự làm mới phiên đăng nhập khi PWA quay lại

- Sau thay đổi: Khi app được mở lại hoặc quay lại foreground, Supabase session được refresh để giảm lỗi JWT issued at future sau thời gian chạy nền.
- Kỹ thuật: Cập nhật `src/context/AppContext.tsx`; không đổi dữ liệu hay API.
- Kiểm thử: TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://4dbaf0ff.family-expense-8fo.pages.dev`.

Tài liệu này là nguồn thông tin nối tiếp giữa các code assistant. Mục mới nhất nằm trên cùng trong từng ngày. Ngày được ghi theo múi giờ `Asia/Ho_Chi_Minh`.

## 2026-08-27

### Rút gọn loại giao dịch còn Tiền ra và Tiền vào

- Sau thay đổi: Ẩn Hoàn tiền và Tạm ứng khỏi form/bộ lọc; Excel template chỉ tạo lựa chọn Tiền ra/Tiền vào và tự ánh xạ về giá trị dữ liệu cũ khi import. File Excel xuất dùng nhãn mới cho các cột giao diện.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx`, `src/lib/templateImport.ts`, `src/pages/ImportExport.tsx`; không đổi enum database để bảo toàn dữ liệu cũ.
- Kiểm thử: TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://907ee433.family-expense-8fo.pages.dev`.

### Đổi nhãn phân loại giao dịch thành Tiền ra/Tiền vào

- Sau thay đổi: Nhãn hiển thị `Chi tiêu` thành `Tiền ra` và `Thu nhập` thành `Tiền vào` trên form, bộ lọc, card/bảng giao dịch và biểu đồ; giá trị nghiệp vụ cũ vẫn giữ để tương thích dữ liệu.
- Kỹ thuật: Cập nhật `src/lib/domain.ts`, `src/pages/TransactionForm.tsx`, `src/pages/Transactions.tsx`, `src/pages/Dashboard.tsx`.
- Kiểm thử: TypeScript strict và Vite production build/PWA sẽ chạy trước deploy.

### Ngăn nút Tháng trước xuống dòng

- Sau thay đổi: Nút `Tháng trước` và `Tháng này` giữ nội dung trên một dòng, tránh làm vỡ cụm chọn kỳ trên dashboard.
- Kỹ thuật: Cập nhật `src/pages/Dashboard.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://ebccc93b.family-expense-8fo.pages.dev`.

### Đổi tên Mục đích và Danh mục trên toàn ứng dụng

- Sau thay đổi: `Mục đích chi` đổi thành `Mục đích`; `Loại chi phí` đổi thành `Danh mục` trên màn hình giao dịch, form, danh mục, file Excel xuất và template.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/TransactionForm.tsx`, `src/pages/Catalogs.tsx`, `src/pages/ImportExport.tsx`, `src/lib/templateImport.ts` và test liên quan. Giữ nguyên tên cột database/import Excel cũ để tương thích dữ liệu nguồn.
- Kiểm thử: TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://fd2ea270.family-expense-8fo.pages.dev`.

### Đổi thẻ Chi ròng thành Giá trị ròng theo bộ lọc

- Sau thay đổi: Dùng gradient đỏ khi giá trị dương, gradient xanh khi giá trị âm, gradient trung tính khi cân bằng; số hiển thị tuyệt đối kèm nhãn Chi nhiều hơn/Thu nhiều hơn/Cân bằng.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi công thức dữ liệu.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://c6b40836.family-expense-8fo.pages.dev`.

### Cân bằng cỡ chữ nội dung các cột

- Sau thay đổi: Cột Nội dung và Số tiền dùng cùng cỡ chữ với các cột phân loại; số tiền vẫn được in đậm.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu.
- Kiểm thử: Chưa deploy.

### Tăng nhẹ và đồng bộ cỡ chữ header bảng

- Sau thay đổi: Tiêu đề cột dùng cỡ chữ `text-sm` đồng nhất và khoảng đệm lớn hơn nhẹ để dễ đọc.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu.
- Kiểm thử: Chưa deploy.

### Rút gọn tên cột Phương thức

- Sau thay đổi: Tiêu đề cột `Phương thức thanh toán` trong bảng giao dịch được rút gọn thành `Phương thức`.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu hay validation.
- Kiểm thử: Chưa deploy.

### Thu gọn cột bảng giao dịch

- Sau thay đổi: Giảm chiều rộng tối thiểu, khoảng cách và kích thước các cột desktop để hiển thị nhiều thông tin hơn mà ít phải cuộn ngang.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu.
- Kiểm thử: TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://6b3f1212.family-expense-8fo.pages.dev`.

### Sửa overlay modal phủ toàn màn hình

- Sau thay đổi: Nền làm mờ phủ cả sidebar và toàn bộ viewport; chỉ modal được dịch nhẹ sang tâm vùng nội dung trên desktop.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://a1698d31.family-expense-8fo.pages.dev`.

### Căn modal sửa hàng loạt theo vùng nội dung

- Sau thay đổi: Trên desktop, modal được căn giữa vùng nội dung Giao dịch sau sidebar; trên mobile vẫn dùng toàn bộ màn hình.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://fb2e897f.family-expense-8fo.pages.dev`.

### Refactor toolbar chọn nhiều của màn hình Giao dịch

- Sau thay đổi: Thanh chọn nhiều được đặt trực tiếp trước lưới giao dịch trong DOM, thu gọn chiều cao, đồng bộ nền và kích thước icon; không còn phụ thuộc vào vị trí cuối trang.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; giữ nguyên nghiệp vụ và database.
- Kiểm thử: TypeScript strict đạt; Vitest đạt 43/43; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://41aead46.family-expense-8fo.pages.dev`.

### Cải thiện UI form sửa hàng loạt

- Sau thay đổi: Modal gọn hơn, nền overlay nhẹ hơn, khoảng cách field cân bằng và dòng xem trước ngắn gọn; tối ưu hiển thị desktop/mobile.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://d3901e1c.family-expense-8fo.pages.dev`.

### Đặt form sửa hàng loạt bên dưới thanh chọn

- Sau thay đổi: Form sửa 4 trường bắt buộc chừa khoảng phía trên để không che thanh “Đã chọn…”, đặc biệt trên mobile.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://aa94e092.family-expense-8fo.pages.dev`.

### Đưa form sửa hàng loạt lên phía trên

- Sau thay đổi: Hộp thoại sửa 4 trường bắt buộc bắt đầu gần phía trên màn hình, dễ thao tác hơn trên mobile.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Chưa deploy.

### Căn giữa form sửa hàng loạt

- Sau thay đổi: Form chỉnh 4 trường bắt buộc mở giữa màn hình trên cả mobile và desktop, không còn dạng bottom sheet ở cuối viewport.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic cập nhật.
- Kiểm thử: Chưa deploy.

### Sắp xếp lại cụm danh sách giao dịch

- Sau thay đổi: Thứ tự hiển thị là Bộ lọc → Chi ròng → Danh sách giao dịch với Chọn tất cả/Xóa → danh sách → Tải thêm ở cuối.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://d161e730.family-expense-8fo.pages.dev`.

### Đưa thanh thao tác chọn nhiều lên trước danh sách

- Sau thay đổi: Thanh Chọn tất cả và các nút sửa/xóa/khôi phục được đưa lên trước lưới giao dịch, không còn nằm cuối trang trên mobile.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://82c7f66d.family-expense-8fo.pages.dev`.

### Đưa Bộ lọc lên trước Chi ròng

- Sau thay đổi: Cụm Tìm kiếm/Bộ lọc hiển thị trước; thẻ Chi ròng nằm ngay phía trên danh sách giao dịch.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Chưa deploy.

### Tách Chi ròng và Bộ lọc thành hai hàng

- Sau thay đổi: Khôi phục bố cục ổn định với thẻ Chi ròng ở hàng riêng và cụm Tìm kiếm/Bộ lọc ở hàng bên dưới.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic dữ liệu.
- Kiểm thử: Chưa deploy.

### Sửa bố cục thẻ Chi ròng

- Sau thay đổi: Tăng chiều rộng tối thiểu của cột Chi ròng trên desktop và chống xuống dòng tiêu đề/số tiền, tránh chồng lấn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic dữ liệu.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://33347b70.family-expense-8fo.pages.dev`.

### Thu gọn cụm Chi ròng và bộ lọc

- Sau thay đổi: Cụm Chi ròng và Tìm kiếm/Bộ lọc nằm cùng hàng trên màn hình lớn; mobile vẫn responsive. Bỏ dòng chú thích công thức dưới Chi ròng.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic dữ liệu.
- Kiểm thử: TypeScript strict và Vite production build/PWA đạt.
- Triển khai: Đã deploy Cloudflare Pages tại `https://35f0c988.family-expense-8fo.pages.dev`.

### Đồng bộ tiêu đề và khoảng cách icon danh sách giao dịch

- Sau thay đổi: Cỡ chữ tiêu đề được đồng bộ; các icon Chọn nhiều và Đã xóa đặt sát nhau hơn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Chưa deploy.

### Căn đồng đều tiêu đề và nội dung bảng giao dịch

- Sau thay đổi: Header thêm cùng khoảng cách cột như phần nội dung, giúp các tiêu đề thẳng hàng với dữ liệu bên dưới.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://0b001077.family-expense-8fo.pages.dev`.

### Thêm nút xóa tất cả trong Thùng rác

- Sau thay đổi: Khi mở Thùng rác, thanh thao tác có icon xóa vĩnh viễn các giao dịch đang hiển thị; luôn yêu cầu xác nhận.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; dùng RPC xóa vĩnh viễn.
- Kiểm thử: Chưa deploy.

### Đồng bộ chiều rộng header và thân bảng giao dịch

- Sau thay đổi: Header và các dòng giao dịch dùng cùng chiều rộng lưới 1150px, phủ đủ cột thao tác và giữ thẳng hàng.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://ea44da79.family-expense-8fo.pages.dev`.

### Đổi nút mở Thùng rác thành Đã xóa

- Sau thay đổi: Dùng icon lưu trữ/khôi phục và nhãn `Đã xóa` trên màn hình lớn, tránh nhầm với thao tác xóa dữ liệu.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi database.
- Kiểm thử: TypeScript strict và Vite production build/PWA đạt.
- Triển khai: Đã deploy Cloudflare Pages tại `https://a46443c8.family-expense-8fo.pages.dev`.

### Đưa thanh thao tác chọn nhiều lên đầu danh sách

- Sau thay đổi: Thanh `Chọn tất cả`, sửa và xóa được đặt sticky ngay dưới tiêu đề danh sách, thuận tiện trên mobile và desktop.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic chọn hoặc mutation.
- Kiểm thử: Chưa deploy.

### Kéo dài nền header phủ đủ cột thao tác

- Sau thay đổi: Nền hàng tiêu đề danh sách giao dịch tự giãn theo toàn bộ lưới, bao gồm cột Sao chép và Thùng rác.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi dữ liệu.
- Kiểm thử: Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://3a2655fd.family-expense-8fo.pages.dev`; kiểm tra HTTP 200.

### Tinh gọn header danh sách giao dịch

- Sau thay đổi: Bỏ nền màu quanh icon Thùng rác trong header; trạng thái vẫn thể hiện bằng màu icon, tooltip và `aria-pressed`.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic giao dịch.
- Kiểm thử: Chưa deploy.

### Căn lại icon Khôi phục trong Thùng rác

- Sau thay đổi: Icon Khôi phục được căn sát cạnh số tiền thay vì dạt về mép phải của bảng.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thay đổi logic.
- Kiểm thử: Chưa deploy.

### Hiển thị nút xóa vĩnh viễn trực tiếp trong Thùng rác

- Sau thay đổi: Mỗi giao dịch trong Thùng rác có icon Khôi phục và icon Xóa vĩnh viễn ngay trên card/bảng, không cần bật Chọn nhiều.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; dùng RPC xóa vĩnh viễn đã triển khai.
- Kiểm thử: TypeScript strict đạt. Chưa deploy.

### Bộ lọc và xóa vĩnh viễn trong Thùng rác

- Sau thay đổi: Bộ lọc tìm kiếm, phân loại, tháng/năm, khoảng ngày và sắp xếp áp dụng cho cả Thùng rác; thêm RPC xóa vĩnh viễn giao dịch đã xóa mềm.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; thêm migration `202608270003_permanently_delete_transactions.sql`.
- Kiểm thử: TypeScript strict và Vite production build/PWA đạt.
- Triển khai: Đã áp dụng migration production và deploy Cloudflare Pages tại `https://21e847c2.family-expense-8fo.pages.dev`.

### Tinh gọn nút xóa thành viên

- Sau thay đổi: Nút xóa thành viên chỉ hiển thị icon thùng rác; vẫn giữ tooltip và accessible name để người dùng nhận biết thao tác.
- Kỹ thuật: Cập nhật `src/pages/Members.tsx`; không thay đổi logic phân quyền hoặc database.
- Kiểm thử: Test thành viên đạt 2/2; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://da84379e.family-expense-8fo.pages.dev`; kiểm tra HTTP 200.

### Hoàn thiện Thùng rác giao dịch

- Sau thay đổi: Màn hình giao dịch có thể chuyển sang Thùng rác để xem các giao dịch đã soft-delete; hỗ trợ chọn nhiều và khôi phục, không xóa vĩnh viễn.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không thêm migration vì dùng cột `deleted_at` hiện có.
- Kiểm thử: TypeScript strict đạt; Vitest đạt 43/43; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://0839d034.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` tiếp tục được giữ nguyên.

### Đổi nút sửa hàng loạt thành icon

- Yêu cầu: Đổi nút `Sửa` trong thanh chọn nhiều thành icon gọn hơn.
- Sau thay đổi: Nút sửa dùng icon bút chì đặt cạnh nút thùng rác, có kích thước chạm 44 px, trạng thái disabled, tooltip và accessible name `Sửa các giao dịch đã chọn`.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và `src/pages/Transactions.ui.test.tsx`; không thay đổi logic bulk update hoặc database.
- Kiểm thử: Test giao dịch đạt 11/11; ESLint đạt 0 warning; TypeScript strict đạt.
- Triển khai: Chưa deploy; cần xác nhận trước khi đưa bản UI mới lên Cloudflare Pages.

### Đổi Chọn nhiều thành icon và thêm xóa hàng loạt

- Yêu cầu: Đưa thao tác chọn nhiều sát lưới danh sách dưới dạng icon đẹp hơn và cho phép chọn nhiều giao dịch để xóa.
- Sau thay đổi: Thêm toolbar `Danh sách giao dịch` ngay trên lưới với icon `ListChecks`, trạng thái active, tooltip và accessible name. Thanh chọn nhiều giữ chọn tối đa 100 dòng, thêm nút thùng rác màu đỏ; xóa là soft delete, luôn có xác nhận và chỉ bật khi toàn bộ giao dịch được chọn thuộc quyền xóa của user. Dialog sửa hàng loạt vẫn chỉ gồm bốn trường bắt buộc.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và `src/pages/Transactions.ui.test.tsx`; không thay đổi migration/database mới ngoài RPC bulk update đã áp dụng trước đó.
- Kiểm thử: Vitest đạt 43/43; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://84498d9a.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200.

### Sửa hàng loạt bốn trường bắt buộc của giao dịch

- Yêu cầu: Cho phép chọn và sửa nhiều giao dịch cùng lúc; sau khi tinh gọn phạm vi, chỉ giữ bốn trường bắt buộc gồm `Mục đích chi`, `Loại chi phí`, `Phương thức thanh toán` và `Trạng thái`, bỏ ba trường tùy chọn.
- Sau thay đổi: Thêm chế độ `Chọn nhiều`, checkbox trên card mobile và bảng desktop, chọn tất cả các dòng đang tải, giới hạn 100 giao dịch/lần và thanh thao tác responsive. Dialog sửa hàng loạt dùng `Không thay đổi` làm mặc định cho từng field, hiển thị xem trước số giao dịch/số trường bị ảnh hưởng và chỉ bật xác nhận khi có ít nhất một thay đổi. Không field bắt buộc nào có lựa chọn xóa/rỗng.
- Bảo mật: Thêm migration `202608270002_bulk_update_transactions.sql` với RPC `bulk_update_transactions`. RPC kiểm tra membership, family, danh sách ID không trùng, giới hạn 1–100, đúng bốn key cho phép, danh mục đang active thuộc đúng gia đình và toàn bộ giao dịch còn tồn tại trước khi update nguyên tử; chỉ grant execute cho `authenticated`.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/Transactions.ui.test.tsx` và migration mới; demo/local vẫn cập nhật state sau khi xác nhận, production chỉ cập nhật cache sau khi RPC thành công.
- Kiểm thử: Vitest đạt 42/42; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã áp dụng migration `202608270002_bulk_update_transactions.sql` lên Supabase production và deploy frontend tại `https://7d5dadb8.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200.

### Thay đường kẻ giao dịch bằng card tách lớp trên mobile

- Yêu cầu: Thay đường kẻ ngang cứng giữa các giao dịch bằng thiết kế mềm và hiện đại hơn.
- Sau thay đổi: Mobile bỏ hoàn toàn đường kẻ giữa các giao dịch; mỗi giao dịch là card độc lập bo 16 px, cách nhau 8 px, có viền/shadow nhẹ và hover nâng rất nhỏ. Gradient tiếp tục nằm riêng trong từng card. Desktop giữ bảng gọn nhưng separator đổi thành hairline `black/5`/`white/5` và có hover brightness nhẹ.
- Kỹ thuật: Cập nhật responsive container/card trong `src/pages/Transactions.tsx` và regression test accessibility/bố cục trong `src/pages/Transactions.ui.test.tsx`; không thay đổi dữ liệu, lọc, sort hoặc database.
- Kiểm thử: Vitest đạt 41/41; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://15046396.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không cần migration database.

### Tinh gọn màu card giao dịch và tăng tương phản tag

- Yêu cầu: Bỏ dải màu đậm bên trái danh sách giao dịch và làm tag trong card nổi rõ hơn trên nền gradient.
- Trước thay đổi: Mỗi loại giao dịch có viền trái 4 px khá nặng; tag phân loại dùng nền surface trong suốt và chữ muted nên bị chìm vào nền màu của card.
- Sau thay đổi: Bỏ toàn bộ `border-left` theo loại giao dịch nhưng giữ gradient nhẹ và màu số tiền. Badge loại giao dịch có viền, nền đậm hơn và shadow; các tag mục đích chi, loại chi phí và phương thức thanh toán dùng nền trắng gần đặc, chữ đậm, viền/shadow rõ ràng cùng dark variant tương phản cao.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/index.css` và regression test `src/pages/Transactions.test.ts`; không thay đổi dữ liệu, truy vấn hoặc database.
- Kiểm thử: Vitest đạt 41/41; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://8da0cae4.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không cần migration database.

### Ngăn icon micro đè lên nội dung nhập

- Yêu cầu: Sửa icon micro đang chồng lên chữ trong ô `Nội dung` trên mobile.
- Nguyên nhân: Utility padding phải của Tailwind bị khai báo `.field` dùng padding shorthand ghi đè, nên Safari/iOS không chừa đủ vùng cho nút tuyệt đối.
- Sau thay đổi: Thêm class `field-with-trailing-action` có `padding-inline-end: 3.5rem` với độ ưu tiên rõ ràng; nội dung luôn dừng trước vùng icon micro và hỗ trợ cả hướng chữ theo inline axis.
- Kỹ thuật: Cập nhật `src/index.css`, `src/pages/TransactionForm.tsx` và regression test `src/pages/TransactionForm.test.tsx`; không thay đổi nhận dạng giọng nói, AI hoặc database.
- Kiểm thử: Vitest đạt 41/41; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://b7e020b6.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không cần migration database.

### Bỏ placeholder ở Nội dung và Số tiền

- Yêu cầu: Bỏ nội dung gợi ý nằm trong hai ô `Nội dung` và `Số tiền` của form giao dịch.
- Sau thay đổi: Hai input không còn placeholder; label bắt buộc, hướng dẫn nhập tay/micro/AI và validation tiếng Việt vẫn được giữ nguyên.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx` và regression test `src/pages/TransactionForm.test.tsx`; không thay đổi logic lưu, AI, giọng nói hoặc database.
- Kiểm thử: Vitest đạt 41/41; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://4f826500.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không cần migration database.

### Nhập nội dung giao dịch bằng giọng nói

- Yêu cầu: Thêm icon micro trong ô `Nội dung`, dùng phương án không phát sinh phí API và deploy cùng các cải tiến phản hồi AI.
- Sau thay đổi: Trên trình duyệt hỗ trợ Web Speech API, ô Nội dung hiển thị nút micro để nhận dạng tiếng Việt `vi-VN`. Khi nghe, nút chuyển đỏ và pulse; nhấn lại để dừng. Transcript được nối vào nội dung hiện có, có toast yêu cầu kiểm tra, không tự gọi Gemini và không tự lưu giao dịch. App không lưu audio. Nút tự ẩn trên trình duyệt không hỗ trợ; lỗi quyền micro/nhận dạng được thông báo bằng tiếng Việt.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx` và test trong `src/pages/TransactionForm.test.tsx`; không thêm dependency, API key, backend, Edge Function hoặc database.
- Kiểm thử: Vitest đạt 41/41; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công. Web Speech API vẫn phụ thuộc mức hỗ trợ và dịch vụ nhận dạng của trình duyệt/hệ điều hành.
- Triển khai: Đã deploy Cloudflare Pages tại `https://1a8af870.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không cần migration database.

### Làm rõ phản hồi và các trường do AI đề xuất

- Yêu cầu: Tạo màu nhận diện cho nút AI, thông báo khi phân tích hoàn tất, chỉ rõ field đã được AI điền và bổ sung khối tóm tắt kết quả có thể ẩn.
- Trước thay đổi: Nút AI dùng kiểu nút phụ trung tính; sau khi Gemini trả kết quả chỉ có một dòng ghi chú chung nên người dùng khó biết tác vụ đã xong và những trường nào đã thay đổi.
- Sau thay đổi: Nút `Gợi ý AI` dùng gradient tím–xanh, spinner khi xử lý và trạng thái dấu tích `Đã điền` sau thành công. Toast phân biệt thành công, thiếu dữ liệu, lỗi thường và rate limit 429. Chỉ các field thực sự được Gemini điền mới có badge `AI đề xuất`, viền/nền nhận diện; confidence dưới 90% dùng màu vàng. Khối tóm tắt liệt kê số lượng, tên field, confidence và warnings, đồng thời cho phép ẩn toàn bộ tóm tắt/đánh dấu. AI vẫn không tự lưu giao dịch.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx` và regression test `src/pages/TransactionForm.test.tsx`; không thay đổi Edge Function, JSON schema, database hoặc RLS.
- Kiểm thử: Vitest đạt 40/40; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công. Kiểm tra trình duyệt local bị dừng tại màn hình đăng nhập vì không sử dụng thông tin đăng nhập của người dùng.
- Triển khai: Đã deploy cùng bản nhập giọng nói tại `https://1a8af870.family-expense-8fo.pages.dev`; domain chính trả HTTP 200. Không cần migration database.

### Cập nhật hướng dẫn sử dụng và tài liệu bàn giao v1.1

- Yêu cầu: Đồng bộ tài liệu người dùng và tài liệu handoff với phiên bản ứng dụng production hiện tại.
- Trước thay đổi: Hướng dẫn Word còn mô tả hai tab nhập thủ công/AI và chưa phản ánh bộ lọc thu gọn, tìm kiếm không dấu, bố cục Dashboard mobile cùng các cải tiến UI mới; handoff chỉ có baseline `v1.0`.
- Sau thay đổi: Cập nhật `Huong-dan-su-dung-Family-Expense.docx` lên phiên bản 1.1, mô tả form giao dịch hợp nhất với nút `Gợi ý AI`, bộ lọc chi tiết, tìm kiếm không dấu, trạng thái nâng cao và điều khiển Dashboard responsive. Thêm `HANDOFF-v1.1.md` với trạng thái release, kiến trúc, migration production, quality gate, deploy/rollback, biến môi trường, rủi ro và ưu tiên tiếp theo; giữ nguyên `HANDOFF-v1.0.md` làm baseline bất biến.
- Kỹ thuật: Cập nhật nguồn tạo tài liệu `docs-assets/build_user_guide.py`, bổ sung header metadata cho bảng để trình đọc màn hình nhận diện đúng và render bộ kiểm tra tại `docs-assets/rendered-v1.1`.
- Kiểm tra: DOCX render thành công 13 trang và đã kiểm tra trực quan toàn bộ; accessibility audit đạt 0 lỗi high/medium/low. Nội dung handoff đã đối chiếu với `CHANGELOG.md`, migration và trạng thái triển khai gần nhất.
- Triển khai: Chỉ thay đổi tài liệu; không deploy frontend, không chạy migration và không thay đổi dữ liệu production.

### Hợp nhất nhập thủ công và nhập bằng AI

- Yêu cầu: Bỏ hai màn hình/tab nhập riêng; người dùng nhập nội dung trong form và nhấn nút icon AI để nhận gợi ý.
- Trước thay đổi: Form có hai tab `Nhập thông thường` và `Nhập bằng AI`; câu tiếng Việt nằm trong textarea riêng, sau phân tích mới chuyển lại tab thủ công.
- Sau thay đổi: Chỉ còn một form. Ô `Nội dung` nằm đầu phần thông tin chính, dùng cho cả nhập tay và câu tiếng Việt tự nhiên; nút `Gợi ý AI` có icon nằm ngay bên cạnh, chỉ bật khi có nội dung. Gemini điền đề xuất vào chính form, hiển thị cảnh báo/confidence hiện tại và không tự lưu; người dùng vẫn chỉnh sửa rồi nhấn xác nhận. Mobile chỉ hiện icon để tiết kiệm chiều ngang, accessible name vẫn đầy đủ.
- Kỹ thuật: Cập nhật `src/pages/TransactionForm.tsx`, gỡ state/tab/textarea AI riêng và thêm `src/pages/TransactionForm.test.tsx`. Không thay đổi Edge Function, schema response hoặc database.
- Kiểm thử: Vitest đạt 39/39; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages tại `https://756a9b75.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200.

### Căn bộ chọn kỳ Dashboard trên một hàng mobile

- Yêu cầu: Nút chọn tháng/năm bị xuống hàng so với `Tháng trước/Tháng này` trên điện thoại.
- Sau thay đổi: Cụm điều khiển dùng lưới ba phần trên mobile gồm `Trước/Nay`, `Tháng`, `Năm`; tất cả căn đáy và nằm cùng một hàng. Nhãn nút rút gọn trên mobile, desktop vẫn hiển thị đầy đủ và accessible name không đổi.
- Kỹ thuật: Cập nhật responsive layout trong `src/pages/Dashboard.tsx`; không thay đổi truy vấn hoặc số liệu.
- Kiểm thử: Nằm trong quality gate 39/39 test, ESLint/TypeScript/build đều đạt.
- Triển khai: Đã deploy Cloudflare Pages tại `https://756a9b75.family-expense-8fo.pages.dev`; domain chính trả HTTP 200.

### Tận dụng chiều ngang của form tạo giao dịch

- Yêu cầu: Form tạo mới bị dài và chưa tận dụng khoảng trống trên màn hình rộng.
- Trước thay đổi: Form chỉ có hai cột từ tablet/desktop; nhóm phân loại có ba trường nên trường cuối chiếm một hàng riêng, trong khi các tiêu đề và nội dung chưa trải theo nhịp lưới tối ưu.
- Sau thay đổi: Form dùng lưới ba cột từ breakpoint tablet/desktop: `Ngày`, `Số tiền`, `Loại giao dịch` cùng một hàng; `Phương thức thanh toán`, `Mục đích chi`, `Loại chi phí` cùng một hàng. Nội dung, tiêu đề nhóm, cảnh báo, tùy chọn nâng cao và thanh nút trải toàn chiều rộng. Mobile vẫn một cột để thao tác bằng một tay.
- Kỹ thuật: Cập nhật responsive grid trong `src/pages/TransactionForm.tsx`; không thay đổi validation, lưu dữ liệu hoặc database.
- Kiểm thử: Vitest đạt 38/38; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy cùng release Cloudflare Pages tại `https://07d03e95.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200.

### Thu gọn bộ lọc chi tiết bằng nút mở rộng nhanh

- Yêu cầu: Bộ lọc hiển thị trực tiếp quá dài trên mobile; cần nút mở rộng dễ dùng nhưng không tái diễn độ trễ của bottom sheet.
- Trước thay đổi: Tìm kiếm, sắp xếp và tám điều kiện lọc luôn hiển thị, đẩy danh sách giao dịch xuống rất xa trên màn hình dọc.
- Sau thay đổi: Giữ `Tìm kiếm` và `Sắp xếp` luôn hiện. Các điều kiện còn lại nằm trong vùng native `details/summary` với nút `Bộ lọc chi tiết`, mũi tên xoay và số điều kiện đang chọn. Vùng mở tại chỗ, không overlay, không sticky và không dùng React state nên không render lại danh sách khi đóng/mở. Chip điều kiện đã chọn vẫn hiển thị để xóa nhanh.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và regression test trong `src/pages/Transactions.ui.test.tsx`; không thay đổi truy vấn hoặc database.
- Kiểm thử: Vitest đạt 38/38; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy cùng release Cloudflare Pages tại `https://07d03e95.family-expense-8fo.pages.dev`; domain chính trả HTTP 200. Migration tìm kiếm không dấu cũng đã chạy production.

### Ngăn bộ lọc phủ lên danh sách trên màn hình điện thoại dọc

- Yêu cầu: Khối bộ lọc đang đè lên danh sách giao dịch khi xem điện thoại theo chiều dọc.
- Nguyên nhân: Card tìm kiếm/bộ lọc vẫn dùng `position: sticky` và `z-index` trên mobile; sau khi đưa toàn bộ trường lọc ra ngoài, chiều cao card lớn khiến nó phủ lên nội dung khi cuộn.
- Sau thay đổi: Bỏ hoàn toàn sticky/z-index khỏi card bộ lọc trên mọi kích thước. Bộ lọc nằm trong luồng trang bình thường và danh sách luôn bắt đầu sau card; bổ sung accessible name cho vùng tìm kiếm/bộ lọc.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx` và regression test trong `src/pages/Transactions.ui.test.tsx`; không thay đổi dữ liệu, truy vấn hoặc database.
- Kiểm thử: Vitest đạt 38/38; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy cùng release Cloudflare Pages tại `https://07d03e95.family-expense-8fo.pages.dev`; domain chính trả HTTP 200.

### Tìm giao dịch tiếng Việt bằng từ khóa không dấu

- Yêu cầu: Gõ từ khóa không dấu vẫn tìm được nội dung giao dịch có dấu, ví dụ `dien nuoc da nang` tìm `Điện nước Đà Nẵng`.
- Trước thay đổi: Demo/local đã bỏ phần lớn dấu Unicode nhưng xử lý sai `Đ` viết hoa; production RPC dùng `ILIKE` trực tiếp nên từ khóa không dấu không khớp dữ liệu có dấu.
- Sau thay đổi: Chuẩn hóa frontend chuyển chữ thường trước khi đổi `đ` thành `d`. Production RPC chuẩn hóa cả từ khóa, mô tả và ghi chú bằng extension PostgreSQL `unaccent`, giữ tìm kiếm không phân biệt hoa/thường, bộ lọc, phân trang và tổng tiền hiện tại.
- Kỹ thuật: Cập nhật `src/lib/domain.ts`, test domain/giao dịch và thêm migration mới `supabase/migrations/202608270001_accent_insensitive_transaction_search.sql`. RPC vẫn là `security definer set search_path=''`, kiểm tra membership, schema-qualify function/object và chỉ grant cho `authenticated`.
- Kiểm thử: Vitest đạt 38/38, gồm `Đ` viết hoa và tìm chuỗi không dấu; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công. `supabase db push` xác nhận migration được áp dụng thành công.
- Triển khai: Đã áp dụng migration `202608270001_accent_insensitive_transaction_search.sql` lên Supabase production và deploy frontend tại `https://07d03e95.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev` trả HTTP 200. Không thay đổi dữ liệu giao dịch.

### Đưa bộ lọc giao dịch trở lại giao diện trực tiếp

- Yêu cầu: Bottom sheet bộ lọc trên điện thoại vẫn mở chậm; đưa các trường lọc ra ngoài như phiên bản cũ.
- Trước thay đổi: Mobile cần nhấn nút `Bộ lọc` để dựng và mở panel phủ phía dưới, tạo cảm giác chờ trên thiết bị có danh sách lớn.
- Sau thay đổi: Bỏ hoàn toàn nút mở, overlay và bottom sheet. Tìm kiếm, sắp xếp và toàn bộ trường lọc luôn hiển thị trực tiếp trong card; `Trạng thái` vẫn được ẩn theo quyết định trước đó. Desktop và mobile dùng cùng một cấu trúc responsive, không còn thao tác mở panel.
- Kỹ thuật: Gỡ component/state/ref dành cho mobile filter khỏi `src/pages/Transactions.tsx`, đơn giản hóa CSS bundle và cập nhật `src/pages/Transactions.ui.test.tsx`. Không thay đổi truy vấn, API hoặc database.
- Kiểm thử: Vitest đạt 36/36; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công. Chunk trang Giao dịch giảm từ khoảng 23,5 kB xuống 20,6 kB trước gzip.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://056cd60b.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev`. Cả hai URL trả HTTP 200 sau triển khai. Không cần migration database.

### Tinh gọn trạng thái giao dịch khỏi giao diện chính

- Yêu cầu: Giảm thông tin trạng thái vì ngày giao dịch đã giúp nhận biết phần lớn giao dịch quá khứ/tương lai.
- Trước thay đổi: `Trạng thái` xuất hiện trong bottom sheet bộ lọc, card giao dịch mobile và khu vực thông tin chính của form, làm giao diện dày hơn dù app đã tự chọn trạng thái theo ngày khi tạo mới.
- Sau thay đổi: Ẩn trạng thái khỏi danh sách và bỏ bộ lọc trạng thái. Form vẫn tự đặt ngày hiện tại/quá khứ là `Thực tế`, ngày tương lai là `Dự kiến`; trường trạng thái được chuyển vào `Tùy chọn nâng cao` để xử lý ngoại lệ như thanh toán trước hoặc giao dịch quá hạn chưa phát sinh. Khi sửa giao dịch có trạng thái khác quy tắc ngày, phần nâng cao tự mở. Dashboard và bước xác nhận giao dịch dự kiến không thay đổi.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`, `src/pages/TransactionForm.tsx` và test UI giao dịch; giữ nguyên cột `status`, API, import/AI, database và RLS.
- Kiểm thử: Vitest đạt 36/36; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Chưa deploy; chờ xác nhận triển khai Cloudflare Pages. Không cần migration database.

### Tăng tốc mở bộ lọc giao dịch trên điện thoại

- Yêu cầu: Nút `Bộ lọc` trên điện thoại phản hồi chậm sau khi danh sách có nhiều giao dịch.
- Nguyên nhân: Trạng thái mở/đóng bottom sheet nằm trong component trang, nên mỗi lần nhấn nút làm toàn bộ danh sách card và bảng giao dịch render lại. Lớp `backdrop-blur` trên overlay cũng làm tăng chi phí dựng hình trên Safari mobile.
- Sau thay đổi: Tách trạng thái mở/đóng vào component `MobileFilterPanel` độc lập; nhấn nút chỉ cập nhật panel và tái sử dụng cây danh sách hiện tại. Nút `Bộ lọc` vẫn nằm cùng hàng với `Sắp xếp`, có label, chiều rộng và chiều cao field đồng đều. Overlay dùng nền mờ màu đơn, không chạy bộ lọc blur GPU. Hành vi lọc, sắp xếp và dữ liệu không thay đổi.
- Kỹ thuật: Cập nhật `src/pages/Transactions.tsx`; không đổi API, database hoặc RLS.
- Kiểm thử: Vitest đạt 36/36; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://8e82601e.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev`. Cả hai URL trả HTTP 200 sau triển khai. Không cần migration database.

### Đồng bộ và nâng cấp trải nghiệm UI toàn ứng dụng

- Yêu cầu: Thực hiện toàn bộ nhóm cải tiến UI đã đề xuất cho danh sách/form giao dịch, Dashboard, phản hồi hệ thống, điều hướng mobile và chuyển động.
- Trước thay đổi: Bộ lọc giao dịch chiếm nhiều chiều cao trên điện thoại; danh sách dùng bảng rộng; các thao tác xác nhận còn dựa vào hộp thoại trình duyệt; form dài và thiếu phân nhóm; KPI, điều hướng và trạng thái tương tác chưa có một ngôn ngữ thị giác thống nhất.
- Sau thay đổi: Bộ lọc mobile mở dạng bottom sheet, có chip điều kiện đang chọn và thanh tìm kiếm/sắp xếp sticky; giao dịch mobile hiển thị thành card gradient với menu ba chấm, trong khi desktop giữ bảng đầy đủ. Form được chia thành `Thông tin chính`, `Phân loại` và phần thông tin bổ sung có thể thu gọn. Dashboard có nút chuyển nhanh kỳ, KPI kèm icon/màu ngữ nghĩa và liên kết xem giao dịch từ biểu đồ. Điều hướng dưới dùng active pill, màn hình có chuyển động nhẹ và tự tắt animation theo `prefers-reduced-motion`.
- Phản hồi và thiết kế: Thêm `FeedbackProvider` dùng chung cho toast và hộp xác nhận accessible, thay xác nhận trình duyệt ở các thao tác giao dịch chính. Bổ sung design token CSS, chip dùng chung, focus/loading/hover và dark mode đồng bộ hơn.
- Kỹ thuật: Thêm `src/components/Feedback.tsx`, `src/components/Feedback.test.tsx`, `src/pages/Transactions.ui.test.tsx`; cập nhật `src/main.tsx`, `src/index.css`, `src/components/Layout.tsx`, `src/pages/Transactions.tsx`, `src/pages/TransactionForm.tsx` và `src/pages/Dashboard.tsx`. Không thay đổi schema, dữ liệu hay Supabase API.
- Kiểm thử: Vitest đạt 36/36; ESLint đạt 0 warning; TypeScript strict đạt; Vite production build/PWA thành công. Build còn cảnh báo kích thước một số chunk lớn hơn 500 kB vốn cần tối ưu riêng, không làm thất bại build.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://225ca711.family-expense-8fo.pages.dev`; domain chính `https://family-expense-8fo.pages.dev`. Cả hai URL trả HTTP 200 sau triển khai. Không cần migration database.

### Làm đẹp màu giao dịch bằng gradient

- Yêu cầu: Thay nền màu phẳng của bốn loại giao dịch bằng gradient nhẹ, vẫn dễ đọc trên mobile và dark mode.
- Sau thay đổi: `Chi tiêu` dùng rose, `Tạm ứng` dùng amber, `Thu nhập` dùng emerald và `Hoàn tiền` dùng sky; mỗi dòng có viền màu 4 px bên trái, nền đậm nhẹ ở phía nội dung rồi mờ dần sang phải. Badge và màu số tiền hiện tại được giữ để không phụ thuộc riêng vào màu nền.
- Kỹ thuật: Cập nhật helper `getTransactionListTone` trong `src/pages/Transactions.tsx`; không thay đổi dữ liệu hoặc cách tính giao dịch.
- Kiểm thử: Cập nhật unit test để bắt buộc đủ gradient, viền trái và dark variant cho cả bốn loại. Vitest đạt 34/34; ESLint đạt 0 warning; TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://b1bdbf60.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration database.

### Sửa chiều rộng ô ngày trên iPhone và tinh gọn header

- Yêu cầu: Hai ô `Từ ngày`/`Đến ngày` ở bộ lọc và ô `Ngày` trong form giao dịch bị dài hơn các field khác trên iPhone; bỏ bộ chọn dark mode khỏi header.
- Trước thay đổi: Date input dùng kích thước nội tại của Safari iOS nên có thể tràn khỏi card dù `.field` đặt `width: 100%`; desktop header luôn chiếm chỗ cho bộ chọn theme.
- Sau thay đổi: Mọi `.field` bị giới hạn theo inline size/container và date input dùng appearance nhất quán trên iOS; wrapper field trong form và hai label lọc ngày cho phép co trong grid. Header không còn bộ chọn theme, nhưng mục `Giao diện` vẫn có trong menu bên để giữ chức năng Sáng/Tối/Theo thiết bị.
- Kỹ thuật: Cập nhật `src/index.css`, `src/pages/Transactions.tsx`, `src/pages/TransactionForm.tsx` và `src/components/Layout.tsx`; không thay đổi dữ liệu hoặc Supabase.
- Kiểm thử: Vitest đạt 34/34; ESLint đạt 0 warning; TypeScript strict và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://7c59e992.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration database.

### Dark mode và trạng thái tải/trống nhất quán

- Yêu cầu: Hoàn thiện dark mode và chuẩn hóa empty state/loading skeleton giữa các trang.
- Trước thay đổi: Code có một số class `dark:*` nhưng không có bộ chọn theme hoặc logic áp class; Dashboard hiển thị KPI `0 ₫` trong lúc request đang tải, còn nhiều trang chỉ hiện dòng chữ loading hoặc vùng danh sách trống.
- Sau thay đổi: Thêm ba chế độ `Theo thiết bị`, `Sáng`, `Tối`; lựa chọn được lưu trên thiết bị, áp trước khi React render để tránh nháy nền và đồng bộ `theme-color` của trình duyệt/PWA. Thêm skeleton/empty state dùng chung, áp dụng cho bootstrap/layout, lazy route, Dashboard, danh sách và form giao dịch, Danh mục, Thành viên; empty state có mô tả và hành động phù hợp.
- Kỹ thuật: Thêm `ThemeContext`, `ThemeSelect`, `AsyncStates`; cập nhật `index.html`, `index.css`, `main.tsx`, `App.tsx`, `Layout.tsx` và các page liên quan. Skeleton có accessible status, `aria-live` và tắt animation khi `prefers-reduced-motion`; không thay đổi database hay Supabase API.
- Kiểm thử: Bổ sung test lưu/xóa theme preference và cập nhật test empty Dashboard. Vitest đạt 34/34; ESLint đạt 0 warning; TypeScript strict và Vite production build/PWA đạt. QA local ở viewport mobile 390×844 xác nhận dark mode khởi tạo trước render, không tràn ngang và console không có lỗi.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://854e7d71.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration database.

## 2026-08-26

### Thêm tài liệu hướng dẫn deploy thủ công

- Yêu cầu: Viết tài liệu để developer/đội vận hành tự triển khai thay đổi code lên production.
- Nội dung: Thêm `HUONG-DAN-DEPLOY-THU-CONG.md` tại root, mô tả chuẩn bị môi trường, quality gate, deploy Cloudflare Pages, migration Supabase, Edge Function AI, biến môi trường theo tên, thứ tự triển khai, hậu kiểm, lỗi thường gặp, rollback frontend và checklist release.
- An toàn: Không đọc hoặc ghi giá trị `.env`, token hay secret; tài liệu nhấn mạnh không dùng lệnh phá hoại và không rollback migration dữ liệu tùy tiện.
- Kiểm thử: Rà soát command theo `package.json`, `AGENTS.md`, `supabase/config.toml` và cấu trúc code hiện tại. Thay đổi chỉ là tài liệu, không cần chạy runtime build.
- Triển khai: File tài liệu nội bộ trong workspace; không cần deploy frontend/backend.

### v1.1.0 — Sửa bố cục thao tác giao dịch trên mobile

#### Đồng bộ chiều cao nút xóa giao dịch

- Yêu cầu: Nút `Xóa` trên form sửa giao dịch thấp hơn hai nút `Lưu thay đổi` và `Hủy` ở mobile.
- Sau thay đổi: Cả ba nút thao tác dùng cùng chiều cao cố định 48 px, vẫn nằm trên một hàng và giữ kích thước vùng bấm thân thiện với màn hình cảm ứng.
- Kỹ thuật: Đồng bộ class `h-12` trong `src/pages/TransactionForm.tsx`; không đổi hành vi lưu/hủy/xóa hay phân quyền.
- Kiểm thử: Vitest đạt 32/32, ESLint đạt 0 warning, TypeScript và Vite production build/PWA thành công.
- Triển khai: Đã deploy cùng bản nhận diện bốn loại giao dịch lên Cloudflare Pages production tại `https://dc84ff81.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

#### Phân biệt bốn loại giao dịch trong danh sách

- Yêu cầu: Cả bốn loại `Chi tiêu`, `Tạm ứng`, `Thu nhập` và `Hoàn tiền` cần có dấu hiệu khác để dễ nhận biết trong danh sách.
- Sau thay đổi: Chi tiêu dùng nền/số tiền đỏ nhạt; Tạm ứng dùng cam/vàng; Thu nhập dùng xanh lá; Hoàn tiền dùng xanh dương. Mỗi dòng có badge ghi rõ loại giao dịch trên desktop và mobile, nên vẫn phân biệt được khi người dùng khó nhận biết màu.
- Kỹ thuật: Thêm helper `getTransactionListTone` và áp dụng class sáng/tối trong `src/pages/Transactions.tsx`; không đổi dữ liệu hay cách tính chi ròng.
- Kiểm thử: Bổ sung test mapping màu cho đủ bốn loại; Vitest đạt 32/32, ESLint đạt 0 warning, TypeScript và Vite production build/PWA thành công.
- Triển khai: Bản mở rộng đủ bốn loại đã deploy Cloudflare Pages production tại `https://dc84ff81.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

#### Mặc định hiển thị giao dịch của tháng hiện tại

- Yêu cầu: Màn hình Giao dịch khi mở lần đầu chỉ hiển thị dữ liệu của tháng hiện tại.
- Sau thay đổi: Nếu URL không truyền kỳ, bộ lọc tự chọn tháng và năm theo ngày trên thiết bị; URL có `month`/`year` hợp lệ vẫn được ưu tiên và nút `Xóa bộ lọc` vẫn cho phép xem toàn bộ dữ liệu. Danh sách năm luôn bổ sung năm mặc định kể cả khi tháng hiện tại chưa có giao dịch.
- Kỹ thuật: Thêm helper có thể kiểm thử `getInitialTransactionPeriod` trong `src/pages/Transactions.tsx`; không đổi RPC/database.
- Kiểm thử: Bổ sung 2 test cho kỳ mặc định và URL override; Vitest đạt 31/31, ESLint đạt 0 warning, TypeScript và Vite production build/PWA thành công.
- Triển khai: Đã deploy Cloudflare Pages production tại `https://bff03944.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

- Yêu cầu: Nút thêm giao dịch đang chạm thanh điều hướng dưới trên iPhone; nút xóa ở form sửa giao dịch bị xuống hàng.
- Trước thay đổi: FAB dùng `bottom-20` cố định, không tính `safe-area-inset-bottom`; nhóm nút form dùng `flex-wrap` và nhãn xóa dài nên bị tách thành hàng riêng trên màn hình hẹp.
- Sau thay đổi: FAB cách thanh điều hướng theo chiều cao menu cộng vùng an toàn của thiết bị. Ba thao tác Lưu/Hủy/Xóa luôn nằm cùng hàng; mobile dùng nhãn `Xóa`, từ breakpoint `md` giữ nhãn đầy đủ `Xóa giao dịch`.
- Kỹ thuật: Cập nhật responsive class trong `src/components/Layout.tsx`, `src/pages/TransactionForm.tsx`; tăng version package từ `1.0.0` lên `1.1.0`. Không thay đổi database, quyền xóa hay tài liệu baseline `HANDOFF-v1.0.md`.
- Kiểm thử: Vitest đạt 29/29; ESLint đạt 0 warning; TypeScript đạt; Vite production build/PWA thành công. CSS đầu ra có đúng công thức `bottom: calc(4.5rem + max(1rem, env(safe-area-inset-bottom)))`.
- Triển khai: Đã deploy Cloudflare Pages production thành công tại `https://7395ee48.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Chốt tài liệu bàn giao baseline v1.0

- Yêu cầu: Tạo tài liệu handoff tiếng Việt cho đội vận hành/dev/client chưa biết project, đóng băng trạng thái sản phẩm v1.0 và quy định mọi thay đổi sau mốc này phải thành version mới có changelog riêng.
- Kỹ thuật: Thêm `HANDOFF-v1.0.md` tại root, tổng hợp từ `AGENTS.md` theo scope, `package.json`, Vite/TypeScript/Supabase config, source frontend/Edge Function, 24 migration và changelog production. Tài liệu gồm kiến trúc Mermaid, folder map, env chỉ theo tên, setup/deploy, schema/RLS, quyền, technical debt, đề xuất và quy tắc Semantic Versioning.
- Git: Workspace không có `.git`; `git rev-parse HEAD` và `git tag` đều báo không phải repository. Handoff ghi `[CẦN BỔ SUNG]` thay vì đoán commit/tag và đề xuất tag `v1.0.0` sau khi đưa đúng baseline vào repository.
- An toàn: Không đọc `.env`/`.env.*`, không truy xuất secret và không thay đổi runtime/database/deployment.
- Kiểm thử: Đã rà soát đủ 11 mục yêu cầu, xác nhận file tồn tại/không rỗng, 24 migration được liệt kê đúng thứ tự và thống kê toàn bộ 12 marker `[CẦN BỔ SUNG]`. Không đọc file env và không có runtime change cần test/build.
- Triển khai: Tài liệu nội bộ trong workspace; không cần deploy frontend/backend.

### Cập nhật hướng dẫn người dùng theo đầy đủ tính năng v1.0

- Yêu cầu: Cập nhật tài liệu Word hướng dẫn end-user đã tạo trước đó theo trạng thái app hiện tại.
- Nội dung mới: Bổ sung card Chi ròng và công thức dấu, biểu đồ loại chi phí dạng cột, quyền xóa owner/member, import template Excel và lỗi sai template, quản lý/tạo/xóa gia đình, quản lý thành viên, cài PWA iOS/Android và FAQ tương ứng.
- Kỹ thuật: Cập nhật source `docs-assets/build_user_guide.py`, tái tạo `Huong-dan-su-dung-Family-Expense.docx` theo style hiện có và giữ hai ảnh minh họa cũ có alt text.
- Kiểm thử: DOCX mới render thành 12 trang bằng LibreOffice; đã kiểm tra trực quan đủ 12 ảnh PNG ở kích thước gốc, không clipping/overlap/bảng vỡ hoặc trang thừa. Accessibility audit có 0 lỗi high; 14 cảnh báo medium đều là callout một ô dùng làm note box không có header row, không phải bảng dữ liệu. Hai bảng dữ liệu thật có header lặp và ảnh đăng nhập có alt text.
- Triển khai: Artifact người dùng trong workspace; không cần deploy app.

### Làm rõ tổng tiền giao dịch và tính theo chi ròng

- Yêu cầu: Thiết kế lại tổng số tiền ở màn hình Giao dịch cho dễ nhìn; giao dịch `Thu nhập` và `Hoàn tiền` phải trừ khỏi tổng thay vì cộng.
- Trước thay đổi: Tổng tiền là một dòng chữ nhỏ dưới tiêu đề và cộng trực tiếp `amount` của mọi loại giao dịch, nên thu nhập/hoàn tiền làm tổng tăng sai. Chế độ Supabase tính tổng ở RPC, chế độ demo tính riêng trên frontend.
- Sau thay đổi: Thêm card KPI nổi bật “Chi ròng theo bộ lọc”, có icon, số VND lớn, số giao dịch phù hợp và chú thích công thức `Chi tiêu + Tạm ứng − Thu nhập − Hoàn tiền`. Card responsive và hỗ trợ dark mode.
- Kỹ thuật: Thêm helper `getTransactionTotalImpact` dùng cho dữ liệu local. Migration `202608260020_net_transaction_list_total.sql` định nghĩa lại RPC `list_family_transactions`; `totalAmount` dùng dấu âm cho `Thu nhập`/`Hoàn tiền` và dấu dương cho `Chi tiêu`/`Tạm ứng`, vẫn áp dụng toàn bộ bộ lọc phía server trước khi tính.
- Kiểm thử: Unit test xác nhận đủ bốn loại giao dịch; Vitest đạt 29/29, TypeScript đạt, ESLint đạt 0 warning và Vite production build/PWA thành công. `supabase db push --dry-run` chỉ liệt kê migration `202608260020` trước khi áp dụng.
- Triển khai: Đã áp `202608260020_net_transaction_list_total.sql` lên Supabase production và deploy Cloudflare Pages thành công tại `https://694f58e5.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Sửa lệch một ngày của dữ liệu migration ban đầu

- Yêu cầu: Toàn bộ giao dịch từ đợt migration Excel ban đầu đang sớm hơn dữ liệu thật một ngày; cộng thêm đúng 1 ngày cho nhóm dữ liệu này.
- Phạm vi xác minh: Truy vấn tổng hợp trên Supabase production tìm thấy đúng 2.083 dòng có `source='excel_import'`, `source_reference` khác null và không mang prefix `template:`. Khoảng ngày trước sửa là 31/12/2023–28/02/2027; dữ liệu nhập thủ công, AI và import bằng template end-user không thuộc phạm vi.
- Kỹ thuật: Migration `202608260019_shift_legacy_import_dates.sql` cập nhật `transaction_date = transaction_date + 1`. Migration kiểm tra cứng số dòng và khoảng ngày trước khi ghi, đồng thời kiểm tra số dòng thực sự được update; nếu production khác kết quả preview thì toàn bộ transaction SQL bị hủy thay vì cập nhật nhầm.
- Kết quả dự kiến: 2.083 dòng chuyển sang khoảng ngày 01/01/2024–01/03/2027. Bao gồm cả dòng migration ban đầu đã soft-delete để lịch sử vẫn nhất quán; không đổi `created_by`, `source_reference` hay nội dung giao dịch.
- Kiểm thử: Preview production trước migration xác nhận 2.083 dòng, khoảng ngày 31/12/2023–28/02/2027. `supabase db push --dry-run` chỉ liệt kê migration `202608260019`; sau khi áp dụng, truy vấn hậu kiểm vẫn có đúng 2.083 dòng và khoảng ngày đã thành 01/01/2024–01/03/2027.
- Triển khai: Đã áp `202608260019_shift_legacy_import_dates.sql` lên Supabase production thành công. Không đổi frontend nên không cần deploy Cloudflare Pages.

### Tối ưu hiệu năng khi số lượng giao dịch tăng

- Yêu cầu: Thực thi phương án tối ưu để app không tải/ch xử lý toàn bộ giao dịch trong trình duyệt khi dữ liệu gia tăng.
- Trước thay đổi: Sau đăng nhập, `AppContext` đọc toàn bộ bảng `transactions` theo batch 1.000 dòng và giữ một mảng toàn cục. Dashboard lọc/tổng hợp chart trên toàn bộ mảng; danh sách tìm kiếm, filter, sort cũng chạy client-side. Mọi page được import eager nên bundle khởi động chứa cả Recharts và thư viện Excel.
- Sau thay đổi: Với Supabase, login chỉ tải session/family/catalog. Dashboard nhận một JSON tổng hợp theo tháng/năm; danh sách filter/sort tại PostgreSQL và tải 50 dòng mỗi trang bằng nút `Tải thêm`; tìm kiếm debounce 300 ms; tổng tiền/số dòng lấy từ server. Route chi tiết tự tải đúng một giao dịch. Tạo/sửa/xóa/sao chép/xác nhận giao dịch invalidates cache liên quan; chế độ demo vẫn dùng state cục bộ. Import chỉ tải fingerprint giao dịch khi user chọn file để giữ kiểm tra trùng; export vẫn tải toàn bộ theo batch nhưng chỉ khi user chủ động xuất.
- Kỹ thuật database: Migration `202608260018_transaction_query_performance.sql` thêm partial composite indexes `transactions_family_date_cursor_idx`, `transactions_family_status_date_idx`; RPC `list_family_transactions` (RLS membership, filter/sort/page/total), `get_transaction_years` và `get_dashboard_summary` (KPI, hai chart, xu hướng, 5 giao dịch gần nhất và tối đa 20 giao dịch dự kiến đến hạn). RPC `security definer`, `search_path=''`, quyền execute chỉ cho `authenticated`.
- Kỹ thuật frontend: Thêm `src/lib/transactionsApi.ts`; dùng TanStack `useQuery`/`useInfiniteQuery` trong Dashboard, Transactions và TransactionForm. `AppContext` không còn đọc transaction cloud lúc bootstrap. `App.tsx` dùng `React.lazy`/`Suspense` để tách từng page; Dashboard/Recharts và Dữ liệu/XLSX/ExcelJS không còn nằm trong chunk khởi động.
- Kiểm thử: Vitest đạt 28/28; TypeScript (`tsc -b`) đạt; ESLint đạt 0 warning; Vite production build/PWA thành công. Build trước route splitting có main bundle khoảng 1.373 kB (gzip 414 kB); build mới có main chunk `index-CV-Jo0hz.js` khoảng 563 kB (gzip 165 kB), giảm xấp xỉ 59–60%. Dashboard và Excel nằm ở chunk riêng; Supabase chấp nhận migration/RPC không báo lỗi SQL.
- Triển khai: Đã áp migration `202608260018_transaction_query_performance.sql` lên Supabase production thành công, sau đó mới deploy frontend để tránh gọi RPC chưa tồn tại. Cloudflare Pages deployment: `https://675f4dfc.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Giảm latency phân tích AI bằng Flash-Lite

- Yêu cầu: Luồng Phân tích giao dịch bằng AI lại chậm; cần tối ưu thời gian phản hồi production.
- Chẩn đoán: Frontend chỉ thực hiện một lần invoke; Edge Function đã gộp auth/membership/rate-limit/catalog vào một RPC. Phần còn lại chủ yếu là cold start và thời gian sinh structured JSON của `gemini-3.6-flash`. Tác vụ là extraction/classification ngắn, không cần năng lực reasoning của Flash đầy đủ.
- Sau thay đổi: Chuyển model production sang stable `gemini-3.1-flash-lite`, model được Google định vị cho high-throughput/low-latency extraction. Vẫn giữ structured JSON, `thinkingLevel: MINIMAL`, validation Zod, kiểm tra catalog ID và cơ chế user xác nhận trước khi lưu.
- Kỹ thuật: `parse-expense/index.ts` bỏ `userId` khỏi catalog gửi Gemini, rút gọn prompt, giảm `maxOutputTokens` từ 1.024 xuống 512 và cố định một candidate. Thêm log `AI_TIMING` chỉ chứa `contextMs`, `geminiMs`, `totalMs`, model và edge region để phân biệt chậm ở RPC hay Gemini; không log prompt/nội dung tài chính. README cập nhật cách gọi HTTP và model mặc định hiện hành.
- Kiểm thử: Vitest đạt 28/28; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning. Supabase API bundling/deploy function thành công. Chưa đo end-to-end Gemini sau deploy vì phiên browser kiểm thử không có đăng nhập; dùng log `AI_TIMING` của request thật để đánh giá tiếp.
- Triển khai: Đã cập nhật Supabase production secret `GEMINI_MODEL=gemini-3.1-flash-lite` mà không đọc/hiển thị secret khác. Đã deploy `parse-expense` production thành công; function đang `ACTIVE`, version 6, `verify_jwt=true`. Frontend và database không đổi nên không cần deploy/migration.

### Xóa giao dịch tại màn hình chi tiết và giới hạn quyền member

- Yêu cầu: Cho phép xóa giao dịch ngay tại màn hình chi tiết/sửa; member chỉ được xóa giao dịch do chính mình tạo, không được xóa giao dịch của owner hoặc member khác.
- Trước thay đổi: Chỉ danh sách giao dịch có nút xóa; mọi member nhìn thấy nút này trên mọi dòng và policy update hiện tại cho phép member gửi soft-delete cho giao dịch bất kỳ trong gia đình.
- Sau thay đổi: Màn hình sửa giao dịch có nút `Xóa giao dịch` kèm icon và xác nhận trước khi xóa mềm. Owner có thể xóa mọi giao dịch trong gia đình; member chỉ thấy và dùng nút xóa với giao dịch có `created_by` là tài khoản hiện tại. Danh sách giao dịch áp cùng quy tắc. Nếu không đủ quyền hoặc dòng đã bị xóa, state không đổi và UI báo lỗi.
- Kỹ thuật: Thêm helper `canDeleteTransaction` trong `src/lib/domain.ts`, dùng chung tại `Transactions.tsx` và `TransactionForm.tsx`. Cả hai luồng ghi `deleted_at`/`updated_by` vào Supabase trước khi cập nhật state và scope theo `id`, `family_id`; query của member thêm `created_by`. Migration mới `202608260017_restrict_member_transaction_delete.sql` thêm trigger `transactions_guard_creator_and_delete`: khóa bất biến `created_by` để không thể chiếm quyền sở hữu rồi xóa, đồng thời chặn soft-delete khi actor không phải owner hoặc người tạo.
- Kiểm thử: Bổ sung unit test quyền owner/member; Vitest đạt 28/28, TypeScript (`tsc -b`) đạt, ESLint đạt với 0 warning, Vite production build/PWA thành công. Bundle: `dist/assets/index-BBI9SZ38.js`, `dist/assets/exceljs.min-B3LRNg1J.js`, CSS `dist/assets/index-whab7BnD.css`.
- Triển khai: Đã áp migration `202608260017_restrict_member_transaction_delete.sql` lên Supabase production thành công. Đã deploy Cloudflare Pages production: `https://9401950b.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Chuẩn hóa hướng dẫn Codex theo phạm vi project

- Yêu cầu: Phân tích codebase và tạo chuỗi `AGENTS.md` ngắn gọn để các phiên Codex sau nắm context, command, convention, review và safety mà không scan lại toàn bộ project.
- Trước thay đổi: `AGENTS.md` gốc chỉ mô tả quy trình changelog, chưa tóm tắt kiến trúc, command, coding/review/safety rule và chưa có hướng dẫn riêng cho Supabase.
- Sau thay đổi: `AGENTS.md` gốc mô tả React/PWA + Supabase/Gemini, lệnh pnpm/Supabase thực tế, pattern frontend, checklist review và giới hạn an toàn; quy tắc changelog bắt buộc được giữ nhưng rút gọn. Thêm `supabase/AGENTS.md` cho migration/RLS/RPC và `supabase/functions/AGENTS.md` cho Deno Edge Function/Gemini; file con chỉ chứa rule riêng và kế thừa file cha.
- Kỹ thuật: Quy tắc được rút ra từ `package.json`, TypeScript/ESLint/Vite config, AppContext/form/test hiện tại, migrations, `supabase/config.toml` và `parse-expense`. Tổng chuỗi trên mọi đường dẫn nhỏ hơn giới hạn 32 KiB.
- Kiểm thử: Thay đổi chỉ là tài liệu; đã kiểm tra file tồn tại, kích thước và nội dung theo phạm vi. Không chạy build runtime.
- Triển khai: Không cần triển khai frontend/backend.

### Thiết kế lại màn hình Dữ liệu và cảnh báo file sai template

- Yêu cầu: Làm màn hình Dữ liệu trực quan hơn bằng icon và báo lỗi rõ khi người dùng chọn file Excel không đúng template.
- Trước thay đổi: Ba thao tác tải template, import và xuất dữ liệu là các card chữ đơn giản; mọi kết quả đọc file dùng chung một dòng trạng thái nên lỗi sai định dạng/sai template khó nhận biết.
- Sau thay đổi: Màn hình có phần giới thiệu, hai card tác vụ Tải template/Xuất dữ liệu và khu Import riêng với icon Lucide, màu nhận diện và vùng chọn file dạng kéo-thả trực quan. File không phải `.xlsx`, file thiếu sheet `Giao dịch`, sai tiêu đề cột hoặc workbook bị hỏng đều bị từ chối trước khi import và hiển thị hộp cảnh báo đỏ ngay dưới vùng chọn file. File lỗi không giữ preview/dữ liệu hợp lệ từ lần chọn trước.
- Kỹ thuật: `src/pages/ImportExport.tsx` bổ sung component `DataCard`, các icon `FileSpreadsheet`, `Database`, `Upload`, `Download`, `FileCheck2`, `CheckCircle2`, `AlertTriangle`; thêm state `fileError`, kiểm tra phần mở rộng trước parser và ánh xạ lỗi parser thành thông báo hướng dẫn người dùng tải lại template. Không thay đổi database hoặc cấu trúc template.
- Kiểm thử: Vitest đạt 27/27; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build/PWA thành công. Bundle: `dist/assets/index-DeNgGxRp.js`, `dist/assets/exceljs.min-CgsyiHDa.js`, CSS `dist/assets/index-whab7BnD.css`.
- Triển khai: Đã triển khai Cloudflare Pages production: `https://91303490.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Import giao dịch bằng template Excel có validation

- Yêu cầu: Triển khai proposal import Excel: tải template từ app, chỉ có field của form tạo giao dịch, validation/dropdown, preview lỗi/trùng và xác nhận trước khi ghi.
- Trước thay đổi: Màn hình Dữ liệu chỉ xuất Excel; parser cũ phục vụ workbook migration `Giao dịch chuẩn hóa`, chưa có UI import cho end user.
- Sau thay đổi: User tải template động theo danh mục family, điền tối đa 1.000 dòng rồi chọn file để kiểm tra. UI thống kê hợp lệ/có thể trùng/lỗi, preview tối đa 100 dòng, mặc định bỏ qua dòng trùng và cho phép xác nhận import. Chỉ dòng hợp lệ được gửi database.
- Kỹ thuật: Thêm `exceljs` để tạo `.xlsx` có sheet `Giao dịch`, sheet `Danh mục` veryHidden, sheet `Hướng dẫn`, date/whole-number/list validation, freeze header và autofilter. `src/lib/templateImport.ts` tạo/parse template và map tên danh mục sang UUID. `src/pages/ImportExport.tsx` thêm download, file picker, preview và RPC. Migration `202608260016_excel_template_import.sql` thêm `import_template_transactions(uuid,text,jsonb)`, giới hạn 1–1.000 dòng, kiểm tra membership/catalog active, insert nguyên tử và ghi `import_batches`.
- Kiểm thử: Vitest đạt 27/27, gồm test tạo workbook có list validation và parse/mapping dòng hợp lệ; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build/PWA thành công. ExcelJS được dynamic import thành chunk riêng để không làm bundle khởi động vượt giới hạn PWA. Bundle: `dist/assets/index-Co2Mh68N.js`, `dist/assets/exceljs.min-BauDN1Gm.js`, CSS `dist/assets/index-0yBWmKW1.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260016_excel_template_import.sql`. Đã triển khai Cloudflare Pages production: `https://9c9c4e85.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Đăng xuất từ màn hình tạo gia đình

- Yêu cầu: Thêm chức năng đăng xuất ở màn hình onboarding Tạo gia đình.
- Trước thay đổi: User đã đăng nhập nhưng chưa có membership bị giữ ở `/tao-gia-dinh` và không có cách đổi tài khoản từ giao diện.
- Sau thay đổi: Form Tạo gia đình có nút **Đăng xuất** thứ cấp với icon; nút gọi Supabase Auth, hiển thị “Đang đăng xuất…” và chuyển về `/dang-nhap` khi thành công. Lỗi sign-out được hiển thị ngay trên form.
- Kỹ thuật: `src/pages/CreateFamily.tsx` thêm `supabase.auth.signOut`, state `signingOut` và khóa đồng thời hai thao tác tạo/đăng xuất. `CreateFamily.test.tsx` kiểm tra nút xuất hiện.
- Kiểm thử: Vitest đạt 26/26, gồm assertion nút Đăng xuất trên onboarding; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-DAfFtr3l.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Đã triển khai Cloudflare Pages production: `https://0e583646.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration database.

### Cho phép xóa sau khi đã xóa mềm toàn bộ giao dịch

- Yêu cầu: Sau khi xóa hết giao dịch trên giao diện, phải xóa được gia đình và danh mục.
- Trước thay đổi: Các guard tính cả transaction có `deleted_at`, nên giao dịch đã xóa mềm vẫn chặn family/catalog; FK RESTRICT cũng giữ tham chiếu lịch sử.
- Sau thay đổi: Chỉ transaction chưa xóa mới chặn. Xóa danh mục đã từng dùng sẽ đặt `active=false` để ẩn khỏi UI nhưng giữ khóa tham chiếu của lịch sử. Xóa family khi không còn transaction hoạt động sẽ purge vĩnh viễn các transaction đã xóa mềm rồi xóa family; hộp thoại cảnh báo rõ không thể hoàn tác.
- Kỹ thuật: Migration `202608260015_allow_delete_after_soft_delete.sql` định nghĩa lại `can_delete_family`, `delete_empty_family`, hai trigger guard và `delete_catalog_item`. RPC family hard-delete các dòng `deleted_at is not null` trước để thỏa FK `ON DELETE RESTRICT`. Frontend cập nhật thông báo theo khái niệm giao dịch hoạt động.
- Kiểm thử: Vitest đạt 26/26; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. `supabase db push` áp dụng migration không báo lỗi SQL. Bundle mới: `dist/assets/index-DFsLbKlE.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Sau khi người dùng xác nhận rõ việc purge vĩnh viễn giao dịch đã xóa mềm, đã triển khai Supabase production migration `202608260015_allow_delete_after_soft_delete.sql`. Đã triển khai Cloudflare Pages production: `https://9b86c133.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Gia cố chặn xóa danh mục đang được sử dụng

- Sự cố: Người dùng kiểm tra và báo vẫn xóa được danh mục đã có giao dịch tham chiếu.
- Trước thay đổi: RPC `delete_catalog_item` có kiểm tra usage nhưng chạy `security invoker`, nên phụ thuộc vào ngữ cảnh RLS; frontend chỉ biết item đang dùng sau khi gọi xóa. FK mặc định là lớp bảo vệ nhưng chưa có guard nghiệp vụ thống nhất cho mọi đường xóa.
- Sau thay đổi: Mọi lệnh DELETE trực tiếp trên Mục đích chi, Loại chi phí hoặc Phương thức thanh toán đều bị trigger từ chối với `CATALOG_IN_USE` nếu có bất kỳ giao dịch nào tham chiếu, kể cả giao dịch xóa mềm. Danh mục chưa dùng vẫn xóa được.
- Kỹ thuật: Migration `202608260014_enforce_catalog_usage_guard.sql` thêm ba `BEFORE DELETE` trigger dùng chung function `guard_catalog_delete_in_use()`. RPC `delete_catalog_item` được định nghĩa lại thành `security definer`, `search_path=''`, dùng alias rõ ràng và vẫn kiểm tra family owner trước mọi thao tác.
- Kiểm thử: `supabase db push` kết nối production và tạo thành công ba trigger cùng RPC đã gia cố, không báo lỗi SQL. Frontend không đổi nên không cần chạy lại build.
- Triển khai: Đã triển khai Supabase production migration `202608260014_enforce_catalog_usage_guard.sql`. Cloudflare Pages không cần deploy lại.

### Hotfix sao chép giao dịch trên Supabase

- Yêu cầu: Sửa luôn thao tác còn lại sau audit là nút Sao chép giao dịch.
- Trước thay đổi: Sao chép chỉ thêm một object mới vào React state, nên bản sao mất sau reload/logout và không ảnh hưởng database.
- Sau thay đổi: Nút Sao chép insert bản ghi mới vào Supabase trước, sau đó dùng `id/created_at` trả về để cập nhật danh sách. Nếu insert lỗi, không tạo bản sao giả trên UI và hiển thị thông báo.
- Kỹ thuật: `src/pages/Transactions.tsx` thêm `copyTransaction`. Bản sao giữ ngày, số tiền, phân loại, thanh toán và ghi chú; nội dung thêm “(bản sao)”. Source được đặt `manual`, `source_reference=null` và `ai_generated=false` để không xung đột unique key của giao dịch import/AI. Gửi đầy đủ `family_id`, `created_by`, `updated_by`; nút bị khóa trong lúc xử lý.
- Kiểm thử: Vitest đạt 26/26; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-CwVQljZ9.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Đã triển khai Cloudflare Pages production: `https://c8b6a603.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration mới.

### Hotfix xóa giao dịch trên Supabase

- Sự cố: Nút xóa giao dịch chỉ làm dòng biến mất tạm thời; logout/login có thể thấy lại vì database chưa được cập nhật.
- Nguyên nhân: `Transactions.remove` chỉ gán `deletedAt` trong React state, không gửi `UPDATE` tới `public.transactions`.
- Sau thay đổi: Xóa thực hiện soft-delete trên Supabase bằng `deleted_at` và `updated_by`, giới hạn theo cả `id`, `family_id` và trạng thái chưa xóa. State chỉ cập nhật sau khi database trả bản ghi thành công. Nếu lỗi, dòng vẫn còn và màn hình hiển thị thông báo; nút xóa bị khóa trong lúc xử lý.
- Kỹ thuật: `src/pages/Transactions.tsx` lấy `familyId/currentUserId`, gọi Supabase update và giữ hành vi cục bộ chỉ khi app không cấu hình Supabase.
- Kiểm thử: Vitest đạt 26/26; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-CN7TvAk-.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Đã triển khai Cloudflare Pages production: `https://4bd2e9a0.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration mới vì cột `deleted_at` và RLS update đã tồn tại.

### Hotfix lưu giao dịch mới vào Supabase

- Sự cố: Giao dịch tạo trên family mới hiển thị ngay nhưng biến mất sau khi logout/login. Đây cũng là nguyên nhân database coi family chưa có giao dịch và trước đó vẫn cho phép xóa.
- Nguyên nhân: `TransactionForm.onSubmit` chỉ cập nhật `setTransactions` trong bộ nhớ React và điều hướng về danh sách; không có `INSERT` hoặc `UPDATE` tới bảng `public.transactions`.
- Sau thay đổi: Tạo/sửa giao dịch ghi Supabase trước, chỉ cập nhật state và điều hướng sau khi database trả về thành công. Nếu ghi thất bại, người dùng ở lại form và thấy lỗi; nút lưu hiển thị trạng thái đang xử lý. Chế độ demo không cấu hình Supabase vẫn dùng state cục bộ.
- Kỹ thuật: `src/pages/TransactionForm.tsx` map đầy đủ camelCase sang các cột snake_case, gửi `family_id`, `created_by`/`updated_by`, lấy `id` và `created_at` do database trả về. Update giới hạn đồng thời theo `id` và `family_id`.
- Kiểm thử: Vitest đạt 26/26; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-DIRdJXEP.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Đã triển khai Cloudflare Pages production: `https://c4d4e1cc.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`. Không cần migration mới vì bảng/RLS giao dịch đã tồn tại.
- Lưu ý: Giao dịch chỉ từng tồn tại trong state trước hotfix không thể tự khôi phục sau logout; cần nhập lại nếu không còn trong database.

### Đổi khóa ngoại giao dịch từ CASCADE sang RESTRICT

- Sự cố tiếp diễn: Người dùng kiểm tra database và xác nhận family vẫn đã bị xóa dù có giao dịch. Schema dump production qua CLI chưa thực hiện được vì môi trường không chạy Docker, nhưng migration gốc xác nhận FK `transactions.family_id` đang dùng `ON DELETE CASCADE`.
- Khắc phục mạnh hơn: PostgreSQL phải từ chối xóa family khi còn bất kỳ transaction nào, thay vì cho phép cascade xóa transaction.
- Kỹ thuật: Migration `202608260013_restrict_family_transaction_delete.sql` thay constraint `transactions_family_id_fkey` từ `ON DELETE CASCADE` sang `ON DELETE RESTRICT`. Đây là invariant cấp khóa ngoại và áp dụng cho RPC, SQL trực tiếp, Table Editor và mọi code path thông thường. Trigger guard và kiểm tra frontend/RPC vẫn được giữ.
- Kiểm thử: `supabase db push` kết nối production và thay khóa ngoại thành công, không báo lỗi SQL. Việc dump schema read-only trước đó thất bại do Supabase CLI yêu cầu Docker daemon, không phải lỗi database.
- Triển khai: Đã triển khai Supabase production migration `202608260013_restrict_family_transaction_delete.sql`. Frontend không đổi nên không cần deploy Cloudflare Pages.
- Lưu ý phục hồi: Thay đổi này ngăn mất dữ liệu trong tương lai nhưng không tự phục hồi family/transactions đã cascade trước đó.

### Frontend vô hiệu hóa xóa family đã có giao dịch

- Phản hồi: Sau hotfix database, frontend vẫn hiển thị nút xóa như có thể thao tác trên family đã có giao dịch.
- Trước thay đổi: Nút **Xóa gia đình** luôn bật với owner; database chỉ báo lỗi sau khi owner bấm và xác nhận.
- Sau thay đổi: Khi mở màn hình Thành viên, frontend hỏi database về điều kiện xóa. Nút bị khóa trong lúc kiểm tra và tiếp tục bị khóa với thông báo rõ ràng nếu family có bất kỳ giao dịch nào; chỉ family trống mới bật nút.
- Kỹ thuật: Migration `202608260012_family_delete_eligibility.sql` thêm RPC owner-only `can_delete_family(uuid)` kiểm tra trực tiếp toàn bộ `transactions`, bao gồm dòng xóa mềm. `Members.tsx` thêm state ba trạng thái `null/false/true`; kiểm tra lại điều kiện trong handler trước xác nhận. Trigger từ migration `202608260011` vẫn là lớp bảo vệ cuối.
- Kiểm thử: Vitest đạt 26/26; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-D-7vBZJc.js`, `dist/assets/index-DXnkBH_z.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260012_family_delete_eligibility.sql`. Đã triển khai Cloudflare Pages production: `https://e431710a.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Hotfix bắt buộc chặn xóa gia đình có giao dịch

- Sự cố: Người dùng xác nhận một gia đình đã có giao dịch vẫn bị xóa dù RPC dự kiến phải chặn. Xóa `families` có cascade nên đây là sự cố toàn vẹn dữ liệu nghiêm trọng.
- Khắc phục: Bổ sung guard ở cấp bảng để mọi lệnh xóa family, không chỉ RPC từ frontend, đều bị PostgreSQL từ chối nếu tồn tại bất kỳ dòng `transactions` nào.
- Kỹ thuật: Migration `202608260011_enforce_family_transaction_delete_guard.sql` tạo `BEFORE DELETE` trigger `guard_family_delete_with_transactions` và function cùng tên. Đồng thời gia cố `delete_empty_family(uuid)` bằng row lock `FOR UPDATE`, kiểm tra transaction có alias rõ ràng và lỗi nếu family không tồn tại. Trigger chạy trước cascade nên kiểm tra khi các giao dịch con vẫn còn.
- Kiểm thử: `supabase db push` kết nối production và áp dụng thành công trigger/RPC trong migration, không báo lỗi SQL. Frontend không thay đổi nên không cần build lại.
- Triển khai: Đã triển khai Supabase production migration `202608260011_enforce_family_transaction_delete_guard.sql`. Cloudflare Pages không cần triển khai lại.
- Lưu ý phục hồi: Family đã bị xóa trước hotfix có thể đã cascade xóa giao dịch; cần kiểm tra backup/PITR của Supabase nếu cần khôi phục.

### Xóa gia đình chưa có giao dịch

- Yêu cầu: Cho phép xóa gia đình nhưng chỉ khi chưa có dữ liệu giao dịch.
- Trước thay đổi: Không có thao tác xóa gia đình; user đã tạo nhầm gia đình không thể quay lại onboarding.
- Sau thay đổi: Owner có vùng nguy hiểm **Xóa gia đình** ở cuối màn hình Thành viên. Sau xác nhận, gia đình chỉ bị xóa nếu chưa từng có giao dịch; owner được chuyển về màn hình tạo gia đình mới. Member không thấy thao tác này.
- Kỹ thuật: Thêm migration `202608260010_delete_empty_family.sql` với RPC `delete_empty_family(uuid)`. RPC kiểm tra owner và chặn nếu tồn tại bất kỳ dòng `transactions` nào của family, kể cả `deleted_at` khác null. Xóa `families` cascade membership/danh mục; không xóa `auth.users`. `AppContext` thêm `deleteFamily`; `Members.tsx` thêm vùng nguy hiểm và xác nhận.
- Kiểm thử: Vitest đạt 26/26; test màn hình xác nhận owner thấy và member không thấy nút xóa gia đình. TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-j4zaiOh1.js`, `dist/assets/index-BgCpdftd.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260010_delete_empty_family.sql`. Đã triển khai Cloudflare Pages production: `https://33d9eebe.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Onboarding tạo gia đình mới

- Yêu cầu: Tài khoản đăng ký mới có thể tự tạo một gia đình theo luồng đã thống nhất.
- Trước thay đổi: `AppContext` coi việc không tìm thấy membership là lỗi; frontend không có màn hình tạo gia đình dù database đã có các RPC nền tảng.
- Sau thay đổi: User đã đăng nhập nhưng chưa thuộc gia đình tự động được chuyển đến `/tao-gia-dinh`. User nhập tên, trở thành owner, nhận danh mục mặc định và được chuyển vào Dashboard. User đã có membership không thể mở onboarding hoặc tạo gia đình thứ hai.
- Kỹ thuật: Thêm migration `202608260009_create_family_onboarding.sql` với RPC `create_family_with_defaults(text)` bọc `create_family` và `seed_family_defaults` trong cùng transaction, kiểm tra JWT, tên và membership hiện hữu. `AppContext` phân biệt trạng thái chưa có gia đình với lỗi tải, thêm `createFamily`. Thêm `src/pages/CreateFamily.tsx`, route công khai có auth guard, redirect trong `Layout` và test onboarding.
- Kiểm thử: Vitest đạt 26/26, gồm test mới cho form onboarding; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-D6IuF5zk.js`, `dist/assets/index-DcFDcUAo.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260009_create_family_onboarding.sql`. Đã triển khai Cloudflare Pages production: `https://2793260d.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Sửa tên gia đình và rút gọn icon chỉnh sửa

- Yêu cầu: Nút sửa tên gia đình và sửa tên thành viên chỉ hiển thị icon.
- Trước thay đổi: Chưa có thao tác sửa tên gia đình; nút đổi tên thành viên gồm icon và chữ “Đổi tên”.
- Sau thay đổi: Owner có icon bút chì cạnh tên gia đình để mở form sửa inline. Nút sửa tên thành viên chỉ còn icon bút chì. Cả hai icon có tooltip và `aria-label`; member không thấy icon sửa tên gia đình.
- Kỹ thuật: Thêm migration `202608260008_update_family_name.sql` với RPC owner-only `update_family_name(uuid,text)`; chuẩn hóa khoảng trắng, chặn tên rỗng và tên dài hơn 100 ký tự. `AppContext` thêm `updateFamilyName` và cập nhật state ngay sau lưu. `src/pages/Members.tsx` thêm form tên gia đình và đổi nút tên thành viên sang icon-only.
- Kiểm thử: Vitest đạt 25/25; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-BDFUc3g_.js`, `dist/assets/index-CozCPhim.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260008_update_family_name.sql`. Đã triển khai Cloudflare Pages production: `https://c2a66ba0.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Owner xóa thành viên khỏi gia đình

- Yêu cầu: Bổ sung chức năng remove thành viên còn thiếu.
- Trước thay đổi: Owner có thể thêm và đổi tên member nhưng không thể thu hồi quyền truy cập của member.
- Sau thay đổi: Owner thấy nút **Xóa** trên từng dòng có role `member`. Sau hộp thoại xác nhận, member bị xóa khỏi `family_members` và mất quyền truy cập khi đăng nhập/tải lại; giao dịch lịch sử vẫn được giữ nguyên.
- Kỹ thuật: Thêm migration `202608260007_remove_family_member.sql` với RPC `remove_family_member(uuid,uuid)`. RPC kiểm tra owner ở database và từ chối xóa target có role `owner`. `src/pages/Members.tsx` thêm nút xóa, xác nhận và thông báo kết quả.
- Kiểm thử: Vitest đạt 25/25; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-CRNE-1-r.js`, `dist/assets/index-DACs-KJb.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260007_remove_family_member.sql`. Đã triển khai Cloudflare Pages production: `https://4367e2c9.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Cho phép đổi tên hiển thị thành viên

- Yêu cầu: Cho phép đổi tên Chủ gia đình đang mặc định hiển thị email, đồng thời hỗ trợ tên hiển thị của các member.
- Trước thay đổi: Tên chỉ được đặt lúc tạo gia đình/thêm member; màn hình Thành viên không có thao tác chỉnh sửa.
- Sau thay đổi: Mỗi người có nút **Đổi tên** ở dòng của chính mình; owner thấy nút này trên mọi dòng và có thể đổi tên cho tất cả thành viên. Form chỉnh sửa hiển thị ngay trong danh sách.
- Kỹ thuật: Thêm migration `202608260006_update_member_name.sql` với RPC `update_family_member_name(uuid,uuid,text)`. RPC cho phép khi target là `auth.uid()` hoặc người gọi là owner, đồng thời chặn tên rỗng. `AppContext` công khai `currentUserId` cho kiểm tra hiển thị nút; `src/pages/Members.tsx` thêm form đổi tên inline.
- Kiểm thử: Vitest đạt 25/25; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-UDEtSW-z.js`, `dist/assets/index-5TdIBG17.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260006_update_member_name.sql`. Đã triển khai Cloudflare Pages production: `https://3b19e964.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Sửa RPC không tải được danh sách thành viên

- Yêu cầu: Màn hình Thành viên không hiện danh sách và báo `structure of query does not match function result type`.
- Nguyên nhân: `get_family_members(uuid)` khai báo cột `email` trả về là `text`, nhưng `auth.users.email` trong Supabase là `varchar`; PostgreSQL `RETURN QUERY` yêu cầu kiểu cột khớp chính xác và không tự chuyển kiểu trong trường hợp này.
- Sau thay đổi: RPC ép `coalesce(u.email, '')` sang `text`, nên danh sách owner/member có thể trả về đúng cấu trúc đã công bố cho frontend.
- Kỹ thuật: Thêm migration nối tiếp `202608260005_fix_family_member_result.sql`; không chỉnh migration `202608260004_family_members.sql` đã chạy production.
- Kiểm thử: `supabase db push` kết nối production và áp dụng migration thành công, không báo lỗi SQL. Không thay đổi frontend nên bộ test/build hiện tại không cần tạo lại.
- Triển khai: Đã triển khai Supabase production migration `202608260005_fix_family_member_result.sql`. Cloudflare Pages không cần triển khai lại vì mã giao diện không đổi.

### Quản lý thành viên tối giản

- Yêu cầu: Rút gọn proposal quản lý thành viên để triển khai nhanh; owner chỉ cần thêm member vào gia đình và member đăng nhập có thể xem dữ liệu gia đình.
- Trước thay đổi: Database có `family_members` và RLS theo owner/member nhưng chưa có giao diện hoặc API để owner thêm tài khoản khác. Bản migration đang phát triển từng dự kiến có link mời, token, hết hạn, đổi quyền và vô hiệu hóa nhưng chưa từng được chạy production.
- Sau thay đổi: Có màn hình **Thành viên** trên desktop/mobile. Owner nhập email của tài khoản đã đăng ký và tên hiển thị tùy chọn để thêm với role `member`, status `active`; member xem được danh sách nhưng không thấy form thêm. Khi member đăng nhập, luồng tải membership hiện có tự chọn gia đình và tải chung Dashboard, danh mục và giao dịch.
- Kỹ thuật: Migration `202608260004_family_members.sql` được rút gọn còn RPC `get_family_members(uuid)` và `add_family_member(uuid,text,text)`, đều `security definer` và tự kiểm tra membership/owner. RPC không đưa quyền đọc `auth.users` trực tiếp cho frontend. Thêm `src/pages/Members.tsx`, route `/thanh-vien`, menu desktop/mobile và `src/pages/Members.test.tsx`. Chặn email chưa đăng ký, thành viên trùng và tài khoản đang thuộc gia đình khác.
- Kiểm thử: Vitest đạt 25/25 (gồm 2 test mới cho quyền owner/member trên màn hình Thành viên); TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới: `dist/assets/index-DcRJXrhV.js` và `dist/assets/index-BLnABmK1.css`.
- Triển khai: Đã chạy `supabase db push` thành công cho migration `202608260004_family_members.sql`. Đã triển khai Cloudflare Pages production: `https://798ed391.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.
- Lưu ý cho lần sau: Không có link/email mời, xóa thành viên, đổi vai trò hoặc vô hiệu hóa. Người được thêm phải tự đăng ký trước; ứng dụng hiện hỗ trợ một tài khoản thuộc một gia đình hoạt động.

### Dashboard: ngăn biểu đồ làm tràn màn hình điện thoại

- Yêu cầu: Sửa Dashboard khi xem dọc trên điện thoại, phần biểu đồ đang kéo chiều rộng trang và tràn sang bên phải.
- Trước thay đổi: Các card biểu đồ là grid item có kích thước tối thiểu mặc định theo nội dung Recharts; biểu đồ cột còn có canvas tối thiểu 520px. Trình duyệt có thể mở rộng cả grid/page thay vì chỉ cho vùng biểu đồ cột cuộn ngang.
- Sau thay đổi: Mọi card và khung biểu đồ được phép co theo chiều rộng màn hình. Phần dư của biểu đồ tròn và xu hướng bị giới hạn trong card; riêng biểu đồ cột vẫn cuộn ngang bên trong card để giữ tên loại chi phí dễ đọc nhưng không còn làm toàn trang tràn ngang.
- Kỹ thuật: `src/pages/Dashboard.tsx` thêm `min-w-0`, `max-w-full` và `overflow-hidden` tại grid item/khung Recharts; vùng biểu đồ cột dùng `w-full overflow-x-auto overscroll-x-contain` để cô lập thao tác cuộn.
- Kiểm thử: Vitest đạt 23/23; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Kiểm tra trình duyệt ở viewport dọc 390×844 ghi nhận `documentScrollWidth` và `bodyScrollWidth` đều bằng 390px, không còn overflow ngang toàn trang.
- Triển khai: Đã triển khai Cloudflare Pages production. Deployment: `https://d9bb10fc.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.
- Lưu ý cho lần sau: Migration quản lý thành viên `202608260004_family_members.sql` đang được phát triển riêng và chưa được đẩy database; không chạy `supabase db push` trong bản sửa giao diện Dashboard này.

### Dashboard: đổi biểu đồ loại chi phí sang biểu đồ cột

- Yêu cầu: Chuyển biểu đồ “Chi tiêu theo loại chi phí” từ biểu đồ tròn sang biểu đồ cột.
- Trước thay đổi: Cả Mục đích chi và Loại chi phí đều dùng component biểu đồ tròn `ExpensePieChart`, khiến hai góc nhìn có cách trình bày giống nhau và khó so sánh độ lớn giữa nhiều loại chi phí.
- Sau thay đổi: Mục đích chi vẫn là biểu đồ tròn. Loại chi phí dùng biểu đồ cột đứng với trục số tiền, nhãn VND rút gọn trên đầu cột và tooltip số tiền đầy đủ. Tên loại chi phí được xoay để dễ đọc; nếu có nhiều loại, vùng biểu đồ cho phép cuộn ngang trên màn hình hẹp thay vì ép các cột chồng lên nhau. Dữ liệu, bộ lọc tháng/năm và quy tắc chỉ tính giao dịch `Thực tế` không thay đổi.
- Kỹ thuật: `src/pages/Dashboard.tsx` bổ sung `BarChart`/`Bar` của Recharts và component `ExpenseBarChart`; chiều rộng tối thiểu được tính theo số loại chi phí. `src/pages/Dashboard.test.tsx` kiểm tra tiêu đề biểu đồ mới vẫn xuất hiện sau khi lọc kỳ.
- Kiểm thử: `vitest run` đạt 23/23; TypeScript (`tsc -b`) đạt; ESLint đạt với 0 warning; Vite production build thành công. Bundle mới tạo `dist/assets/index-Dwpb1zjB.js` và `dist/assets/index-CDb2RFQN.css`.
- Triển khai: Đã triển khai Cloudflare Pages production. Deployment: `https://de5fcd08.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Thiết lập quy trình ghi nhật ký bắt buộc

- Yêu cầu: Mọi thay đổi từ thời điểm này phải được ghi log theo ngày và mô tả đủ kỹ để code assistant khác có thể tiếp tục dự án.
- Trước thay đổi: Project chưa có `AGENTS.md` ở thư mục gốc và chưa có changelog tập trung; ngữ cảnh thay đổi chủ yếu nằm trong lịch sử hội thoại.
- Sau thay đổi: Thêm `AGENTS.md` với quy tắc bắt buộc đọc README/changelog trước khi làm việc và cập nhật changelog trong cùng lượt thay đổi. Thêm file `CHANGELOG.md` này làm nguồn bàn giao kỹ thuật liên tục.
- Kỹ thuật: Quy ước log bao gồm yêu cầu, hành vi trước/sau, file hoặc database object liên quan, kiểm thử, trạng thái triển khai và lưu ý cho lần sau. Không được ghi secret hoặc dữ liệu nhạy cảm.
- Kiểm thử: Không thay đổi runtime; đã kiểm tra nội dung file và vị trí ở root để các agent tự động phát hiện.
- Triển khai: Chỉ là tài liệu trong workspace, không cần triển khai frontend/backend.

### Dashboard: hai biểu đồ phân loại chi tiêu

- Yêu cầu: Hiển thị thống kê chi tiêu theo cả Mục đích chi và Loại chi phí.
- Trước thay đổi: Dashboard chỉ có biểu đồ tròn “Theo mục đích trong tháng” và biểu đồ đường “Xu hướng 5 tháng”.
- Sau thay đổi: Có hai biểu đồ tròn riêng “Chi tiêu theo mục đích chi” và “Chi tiêu theo loại chi phí”. Cả hai dùng cùng bộ lọc tháng/năm của Dashboard, chỉ lấy giao dịch không bị xóa có trạng thái `Thực tế`, dùng chi ròng và chỉ hiển thị nhóm có giá trị dương. Tooltip hiển thị số VND đầy đủ; nhãn trên lát biểu đồ dùng K/M để tránh chồng chữ. Biểu đồ xu hướng 5 tháng được giữ lại và chiếm toàn bộ hàng bên dưới trên desktop.
- Kỹ thuật: `src/pages/Dashboard.tsx` lấy thêm `expenseTypes` từ `useApp`, tạo `byExpenseType`, dùng component dùng chung `ExpensePieChart` và palette `chartColors`. `src/pages/Dashboard.test.tsx` bổ sung mock loại chi phí và kiểm tra hai trạng thái trống.
- Kiểm thử: `vitest run` đạt 23/23; ESLint đạt; TypeScript đạt sau khi thêm fallback màu; Vite production build thành công.
- Triển khai: Đã triển khai Cloudflare Pages production. Deployment: `https://05e9d2ad.family-expense-8fo.pages.dev`; domain chính: `https://family-expense-8fo.pages.dev`.

### Ẩn trạng thái khỏi từng dòng danh sách giao dịch

- Yêu cầu: Không hiển thị dòng “Thực tế/Dự kiến” bên dưới nội dung ở danh sách giao dịch.
- Trước thay đổi: Mỗi dòng giao dịch hiển thị mô tả và một dòng phụ chứa trạng thái.
- Sau thay đổi: Dòng trạng thái được ẩn khỏi danh sách để giao diện gọn hơn. Trạng thái vẫn tồn tại trong dữ liệu, biểu mẫu, bộ lọc, Dashboard và quy trình xác nhận giao dịch dự kiến.
- Kỹ thuật: Xóa phần render `transaction.status` trong `src/pages/Transactions.tsx`; không thay đổi schema hoặc backend.
- Kiểm thử: Vitest đạt 23/23; TypeScript và ESLint đạt; Vite build thành công.
- Triển khai: Đã triển khai Cloudflare Pages production. Deployment: `https://20e88659.family-expense-8fo.pages.dev`.

### Tối ưu tốc độ phân tích giao dịch bằng AI

- Yêu cầu: Giảm thời gian chờ khoảng 5 giây khi dùng “Nhập bằng AI”.
- Trước thay đổi: Edge Function lần lượt gọi xác thực user, kiểm tra membership, đếm rate limit và tải ba danh mục; bundle còn phụ thuộc SDK `@google/genai`.
- Sau thay đổi: Trước khi gọi Gemini chỉ còn một lượt RPC database. Edge Function gọi Gemini GenerateContent bằng HTTP trực tiếp, dùng structured JSON output và `thinkingLevel: MINIMAL`. Log thành công vẫn chạy nền; giới hạn 10 request/user/phút và kiểm tra membership vẫn giữ nguyên.
- Kỹ thuật: `supabase/functions/parse-expense/index.ts` bỏ `@google/genai` và `db.auth.getUser()`. RPC `public.get_ai_request_context(uuid)` trả `userId`, danh sách purposes, expense types và payment methods sau khi kiểm tra `auth.uid()`, membership và rate limit. Thêm migrations `202608260002_ai_request_context.sql` và `202608260003_ai_context_user.sql`. Supabase Function vẫn bật `verify_jwt = true`.
- Kiểm thử: Vitest đạt 23/23; TypeScript đạt. Endpoint warm không xác thực phản hồi khoảng 0,37–0,41 giây; cold start đo được khoảng 2,6 giây. Đây chỉ là thời gian khởi động/route, không đại diện toàn bộ thời gian Gemini sinh kết quả.
- Triển khai: Đã chạy `supabase db push` cho cả hai migration và deploy `parse-expense` production, function version 3 tại thời điểm kiểm tra.
- Lưu ý cho lần sau: README cũ có thể còn mô tả Edge Function dùng SDK Google; mã nguồn và mục changelog này là trạng thái mới hơn.

### Hoàn thiện bộ lọc tháng/năm và số liệu Dashboard

- Dashboard có hai bộ chọn độc lập Tháng và Năm; danh sách giao dịch cũng lọc độc lập theo tháng và năm.
- KPI hiển thị số VND đầy đủ, không rút gọn K/M. Nhãn trên chart có thể viết tắt để giữ khả năng đọc.
- Dashboard chỉ tính giao dịch `Thực tế`; danh sách “Giao dịch dự kiến đến hạn” cho phép xác nhận thủ công để chuyển sang `Thực tế`.
- Khi chọn “Xem tất cả”, Dashboard truyền cả `month` và `year` sang màn hình Giao dịch.
- Kiểm thử liên quan nằm trong `src/pages/Dashboard.test.tsx` và `src/pages/Transactions.test.ts`.
- Triển khai: Đã có trên domain production trước các deployment được ghi phía trên.

### Hoàn thiện biểu mẫu giao dịch

- Bỏ field Tài khoản/Thẻ khỏi giao diện và cân lại bố cục form; schema vẫn còn `accountId` optional để tương thích dữ liệu cũ.
- Bỏ ký tự `đ` trong ô nhập số tiền; người dùng nhập số và giao diện tự định dạng dấu phân cách hàng nghìn.
- Các trường bắt buộc có dấu sao: Ngày, Số tiền, Loại giao dịch, Trạng thái, Nội dung, Phương thức thanh toán, Mục đích chi và Loại chi phí.
- Phương thức thanh toán là bắt buộc và mặc định chọn “Chuyển khoản” khi tạo mới.
- Khi tạo giao dịch mới, trạng thái tự đổi theo ngày: ngày tương lai là `Dự kiến`; ngày hiện tại/quá khứ là `Thực tế`. Người dùng vẫn có thể chỉnh lại trạng thái trong form.
- Giao dịch dự kiến không tự chuyển im lặng khi đến hạn; người dùng phải xác nhận trên Dashboard.
- Triển khai: Đã có trên production trước các deployment được ghi phía trên.

### Quản lý danh mục và tài liệu người dùng cuối

- Màn hình Danh mục hỗ trợ ba nhóm: Mục đích chi, Loại chi phí và Phương thức thanh toán.
- Owner có thể thêm, đổi tên và xóa danh mục chưa được sử dụng; member chỉ xem. Xóa danh mục đã được giao dịch tham chiếu sẽ bị chặn.
- Tạo tài liệu Word `Huong-dan-su-dung-Family-Expense.docx` gồm 10 trang, mô tả đăng nhập, Dashboard, giao dịch, AI, giao dịch dự kiến, danh mục, Excel và xử lý sự cố. Tài liệu đã render kiểm tra toàn bộ trang; ảnh có alt text.
- Triển khai: Tính năng danh mục đã có trên production; file hướng dẫn là artifact trong workspace, không được phục vụ trực tiếp từ website.

## 2026-08-25

### Khởi tạo và đưa Family Expense lên production

- Thiết lập frontend React 19 + TypeScript + Vite, giao diện mobile-first, React Router, Tailwind CSS, Recharts và PWA.
- Thiết lập Supabase Auth, PostgreSQL/RLS, Edge Function phân tích giao dịch bằng Gemini và các migration dữ liệu ban đầu.
- Thiết lập các màn hình Tổng quan, Giao dịch, biểu mẫu giao dịch, Danh mục và Dữ liệu/Excel.
- Frontend được host trên Cloudflare Pages project `family-expense`; domain chính `https://family-expense-8fo.pages.dev`.
- Supabase project ref: `przgwlpbhldxruyvlsnm`. Không ghi credentials hoặc secret vào changelog.
