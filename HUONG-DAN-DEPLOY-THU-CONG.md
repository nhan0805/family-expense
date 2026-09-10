# Hướng dẫn release Family Expense qua Git integration

> Áp dụng cho Family Expense từ v1.1.0. Production chỉ deploy qua pull request vào `main` và Cloudflare Pages Git integration. Không chạy Wrangler để đẩy production.

## 1. Kiến trúc triển khai

- Frontend React/Vite/PWA: Cloudflare Pages, project `family-expense`.
- Database, Authentication và RPC: Supabase.
- AI/email: Supabase Edge Functions `parse-expense`, `search-transactions`, `summarize-dashboard` và `email-transactions`.
- Domain production: <https://family-expense-8fo.pages.dev>.

Chỉ deploy thành phần thực sự thay đổi:

| Thay đổi | Cần deploy |
| --- | --- |
| Giao diện hoặc logic frontend | Cloudflare Pages |
| Bảng, index, trigger, RLS hoặc RPC | Supabase migration |
| Logic phân tích AI/tóm tắt | Edge Functions `parse-expense`, `search-transactions`, `summarize-dashboard` |
| Gửi email export | Edge Function `email-transactions` |
| Cả database và frontend | Migration trước, frontend sau |

## 2. Yêu cầu trên máy deploy

- Node.js và `pnpm`.
- Supabase CLI nếu cần deploy database hoặc Edge Function.
- Quyền truy cập đúng Cloudflare account và Supabase project production.

Mở Terminal và vào project:

```bash
cd /Users/hanhuynh/Downloads/Expense
```

Chỉ lần đầu hoặc khi lockfile thay đổi:

```bash
pnpm install
```

Khi cần làm việc với Supabase:

```bash
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
```

Lấy `SUPABASE_PROJECT_REF` trong Supabase Dashboard. Không ghi access token, service-role key hoặc Gemini API key vào tài liệu/source code.

## 3. Kiểm tra trước khi deploy

### 3.1. Kiểm tra changelog và version

- Ghi thay đổi mới nhất vào đầu ngày hiện tại trong `CHANGELOG.md`.
- Ghi rõ yêu cầu, trước/sau, file hoặc database object, kiểm thử và trạng thái triển khai.
- Cập nhật `version` trong `package.json` khi bắt đầu release mới.
- Không sửa đè lịch sử trong `CHANGELOG.md`; `HANDOFF.md` là snapshot hiện tại và phải được viết lại để bỏ trạng thái cũ.

### 3.2. Chạy quality gate

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Chỉ deploy khi cả bốn lệnh thành công. `pnpm build` tạo frontend production trong `dist/`.

Kiểm tra bản build trên máy nếu cần:

```bash
pnpm preview
```

Mở URL Vite hiển thị trong Terminal, thường là <http://localhost:4173>.

## 4. Deploy frontend lên Cloudflare Pages

Áp dụng khi thay đổi React, TypeScript, CSS, PWA hoặc logic frontend nhưng không đổi backend.

### Bước 1 — Build lại

```bash
pnpm build
```

Không deploy thư mục `dist` cũ nếu vừa thay đổi code.

### Bước 2 — Tạo PR và chờ Git integration

```bash
git push origin <branch>
gh pr create --base main --head <branch>
gh pr merge <number> --auto --squash --delete-branch=false
```

Required checks, Cloudflare Pages Preview và Cloudflare Pages production sẽ chạy từ GitHub. Chỉ kết luận release sau khi PR đã merge, check Cloudflare production trên merge commit pass và domain chính trả HTTP 200.

### Bước 3 — Hậu kiểm frontend

- Mở deployment URL trước, sau đó mở domain chính.
- Đăng nhập bằng owner và member nếu thay đổi liên quan phân quyền.
- Kiểm tra dashboard, danh sách, tạo/sửa/xóa giao dịch và reload trang.
- Kiểm tra màn hình mobile và PWA.
- Với PWA cũ, đóng hoàn toàn app rồi mở lại hoặc tải lại trang để service worker nhận phiên bản mới.
- Ghi deployment URL và kết quả hậu kiểm vào `CHANGELOG.md`.

## 5. Deploy migration Supabase

Áp dụng khi thay đổi schema, index, trigger, RLS, function hoặc RPC PostgreSQL.

### Bước 1 — Tạo migration mới

Không sửa migration đã áp dụng. Tạo file mới:

```text
supabase/migrations/YYYYMMDDHHMM_ten_thay_doi.sql
```

Migration cần an toàn khi chạy một lần, có RLS/phân quyền phù hợp và không xóa dữ liệu production ngoài phạm vi đã được xác nhận.

### Bước 2 — Xem trước

```bash
supabase db push --dry-run
```

Xác nhận danh sách chỉ chứa migration mong muốn. Nếu có file lạ hoặc thứ tự không đúng, dừng lại và kiểm tra.

### Bước 3 — Áp dụng production

```bash
supabase db push
```

Không chạy `supabase db reset`, `drop database` hoặc lệnh phá hoại trên production.

### Bước 4 — Hậu kiểm database

- Kiểm tra migration đã xuất hiện trong lịch sử migration.
- Kiểm tra RPC/policy/trigger mới bằng truy vấn chỉ đọc trước.
- Kiểm tra owner/member chỉ truy cập đúng `family_id`.
- Với CRUD, xác nhận dữ liệu vẫn đúng sau reload, không chỉ đúng trong React state.

Nếu frontend gọi RPC hoặc field mới, luôn deploy migration thành công trước rồi mới deploy frontend.

## 6. Deploy Edge Functions

Áp dụng khi thay đổi bất kỳ thư mục nào trong `supabase/functions/`.

Production deploy các function `parse-expense`, `email-transactions`, `summarize-dashboard` và `search-transactions` chạy qua `.github/workflows/supabase-deploy.yml` sau khi thay đổi được merge vào `main`. Không chạy `supabase functions deploy` trực tiếp cho production trong quy trình thông thường.

Khi cần kiểm tra cục bộ, dùng Supabase local/project cô lập. Nếu có quy trình khẩn cấp được phê duyệt để chạy CLI, ghi rõ lý do, function, project đích và kết quả vào changelog; không dùng production data để thử nghiệm.

Secret production được quản lý bằng Supabase Secrets, không đặt ở frontend:

```bash
supabase secrets set GEMINI_API_KEY=<key>
supabase secrets set GEMINI_MODEL=gemini-3.1-flash-lite
```

Chỉ chạy lệnh cập nhật secret khi thực sự cần và không ghi giá trị secret vào log/changelog. Sau deploy, kiểm tra function đang active qua workflow/Supabase Dashboard và thử một yêu cầu không chứa dữ liệu nhạy cảm bằng tài khoản test phù hợp.

Nếu chỉ sửa Edge Function thì Cloudflare Pages không cần build lại về mặt kỹ thuật, nhưng PR vẫn phải chạy CI/preview build; chỉ production Cloudflare deploy khi frontend hoặc artifact frontend thay đổi.

## 7. Deploy thay đổi đầy đủ

Khi một release thay đổi cả database, Edge Function và frontend, chạy theo thứ tự:

```bash
cd /Users/hanhuynh/Downloads/Expense

pnpm test
pnpm lint
pnpm typecheck
pnpm build

supabase db push --dry-run

# Commit/push migration, function và frontend lên branch, sau đó tạo PR vào main.
git push origin <branch>
gh pr create --base main --head <branch>
gh pr merge <number> --auto --squash --delete-branch=false
```

Workflow Supabase production và Cloudflare Pages Git integration sẽ xử lý thứ tự deploy sau khi PR merge. Không đảo thứ tự khi frontend phụ thuộc schema/RPC mới.

## 8. Biến môi trường

Frontend chỉ cần:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Vite đưa biến `VITE_*` vào bundle tại lúc build. Trước khi build production, bảo đảm chúng trỏ đúng Supabase production.

Không đưa các biến sau vào frontend hoặc repository:

```text
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

Không đọc, in hoặc gửi nội dung `.env`/`.env.*` khi hỗ trợ deploy.

## 9. Xử lý lỗi thường gặp

### Build lỗi TypeScript hoặc test

- Không deploy bản lỗi.
- Đọc lỗi đầu tiên, sửa code/test rồi chạy lại toàn bộ quality gate.
- Không bỏ qua test hoặc dùng ép kiểu chỉ để build qua.

### Frontend deploy xong nhưng vẫn thấy giao diện cũ

- Mở deployment URL được Cloudflare Pages ghi ở check của merge commit.
- Tải lại domain chính.
- Với PWA, đóng hoàn toàn app rồi mở lại.
- Kiểm tra service worker đã nhận bundle mới.

### Frontend báo không tìm thấy RPC/column

- Kiểm tra migration production đã chạy chưa.
- Kiểm tra frontend có bị deploy trước database không.
- Không sửa trực tiếp migration cũ; tạo migration sửa lỗi mới.

### Đăng nhập xong bị redirect sai

- Kiểm tra domain production trong Supabase Auth Redirect URLs.
- `supabase/config.toml` đang dùng `https://family-expense-8fo.pages.dev` làm `site_url`.

## 10. Quay lại phiên bản frontend trước

Cloudflare Pages giữ lịch sử deployment. Nếu frontend mới lỗi nghiêm trọng:

1. Vào Cloudflare Dashboard.
2. Chọn Workers & Pages → `family-expense` → Deployments.
3. Chọn deployment ổn định gần nhất.
4. Dùng chức năng rollback/promote của Dashboard nếu khả dụng.
5. Kiểm tra lại domain chính và ghi sự cố vào `CHANGELOG.md`.

Rollback frontend không tự rollback migration Supabase. Không tự ý đảo migration có dữ liệu; cần viết migration khắc phục mới và kiểm tra tác động trước khi chạy.

## 11. Checklist release

- [ ] `CHANGELOG.md` đã cập nhật.
- [ ] Version đã đúng với phạm vi release.
- [ ] `pnpm test` thành công.
- [ ] `pnpm lint` thành công.
- [ ] `pnpm typecheck` thành công.
- [ ] `pnpm build` thành công.
- [ ] Migration dry-run đã kiểm tra nếu có thay đổi database.
- [ ] Database/Edge Function đã deploy trước frontend khi có dependency.
- [ ] Deployment URL hoạt động.
- [ ] Domain chính hoạt động.
- [ ] Owner/member và RLS được kiểm tra khi liên quan.
- [ ] Mobile/PWA được kiểm tra.
- [ ] Deployment URL và trạng thái hậu kiểm đã ghi vào changelog.

## 12. Lệnh nhanh cho thay đổi frontend thông thường

```bash
cd /Users/hanhuynh/Downloads/Expense
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git push origin <branch>
gh pr create --base main --head <branch>
gh pr merge <number> --auto --squash --delete-branch=false
```
