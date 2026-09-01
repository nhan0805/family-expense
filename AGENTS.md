# AGENTS.md

## Project overview

- Family Expense: web app tiếng Việt, mobile-first/PWA để quản lý giao dịch và thành viên gia đình; VND, múi giờ `Asia/Ho_Chi_Minh`.
- Frontend: React 19, TypeScript strict, Vite, React Router, Tailwind CSS, React Hook Form + Zod, Recharts.
- Backend: Supabase Auth/PostgreSQL/RLS/RPC/Edge Functions; Gemini chỉ đề xuất dữ liệu, user phải xác nhận trước khi lưu.
- Production: Cloudflare Pages; đọc mục mới nhất trong `CHANGELOG.md` trước khi sửa vì mới hơn README.
- Quy trình deploy bắt buộc: production chỉ deploy qua Git bằng Cloudflare Pages Git integration sau khi thay đổi được push/merge vào `main`; PR dùng preview deployment. Không chạy `wrangler pages deploy` trực tiếp cho production.
- Quy trình tự động đầy đủ khi người dùng yêu cầu deploy: (1) đọc handoff/changelog và kiểm tra working tree; (2) chạy test, typecheck, lint, build; (3) cập nhật handoff/changelog đầy đủ trước khi commit, gồm thay đổi, kiểm thử, trạng thái triển khai dự kiến và thông tin release nếu đã biết; (4) commit và push branch; (5) nếu chưa có PR thì dùng GitHub CLI/API đã đăng nhập để tự tạo PR vào `main`; (6) nếu branch behind thì cập nhật branch với `main`; (7) bật auto-merge; (8) theo dõi required checks, sửa lỗi và push bổ sung nếu cần; (9) chỉ kết luận hoàn tất sau khi PR merge và Cloudflare Pages production deployment của merge commit thành công; (10) sau deploy chỉ xác minh và cập nhật handoff trạng thái thực tế nếu thay đổi đó không làm ảnh hưởng artifact đã deploy, không tạo deploy lần hai chỉ để cập nhật handoff. Báo blocker cụ thể nếu thiếu quyền GitHub.

## Commands

- Cài: `pnpm install`
- Dev/preview: `pnpm dev`, `pnpm preview`
- Test: `pnpm test`; E2E: `pnpm test:e2e`
- Chất lượng: `pnpm lint`, `pnpm typecheck`, `pnpm build`
- Database local: `supabase start`, `supabase db reset`; production migration: `supabase db push`
- Edge Function: `supabase functions deploy parse-expense`
- Excel migration dry-run: `node scripts/import-excel.mjs "/path/file.xlsx"`

## Coding rules

- Dùng TypeScript strict, functional component/named export, camelCase trong app; map rõ sang snake_case của Supabase.
- UI/text lỗi bằng tiếng Việt; tái dùng `useApp`, helper/schema trong `src/lib`, class/component hiện có và icon `lucide-react`.
- Validate dữ liệu bằng Zod ở biên; tiền luôn dương, tính chi ròng qua `transaction_type`; giữ VND và timezone hiện tại.
- Mutation cloud phải ghi Supabase thành công rồi mới cập nhật state/điều hướng; luôn scope theo `family_id`; giữ demo fallback khi Supabase chưa cấu hình.
- Khi sửa bug/logic, thêm hoặc cập nhật Vitest/RTL; luồng người dùng quan trọng dùng Playwright. Chạy test phù hợp + lint + typecheck + build.
- Mọi thay đổi project phải thêm mục mới nhất dưới ngày hiện tại (`Asia/Ho_Chi_Minh`) trong `CHANGELOG.md`: trước/sau, file/DB object, kiểm thử và trạng thái triển khai. Chẩn đoán read-only không cần log.
- Theo pattern sẵn có; không thêm dependency, đổi public API, schema/database hay quy tắc nghiệp vụ nếu chưa được yêu cầu/xác nhận.
- Không sửa migration đã áp dụng; thêm migration timestamp mới. Không đưa secret/service-role/Gemini key vào frontend.

## Review rules

- Kiểm tra loading/error/empty state, input validation, responsive mobile và accessibility (`label`, accessible name, `role="alert"`).
- Với CRUD: kiểm tra persistence sau reload, soft-delete, owner/member, RLS/RPC và ràng buộc database; không chỉ cập nhật React state.
- Với AI/import: coi dữ liệu ngoài là không tin cậy, validate lại phía server, chống trùng và không tự lưu khi chưa xác nhận.
- Không log token, secret, email/dữ liệu tài chính chi tiết hoặc nội dung AI nhạy cảm; kiểm tra bundle không chứa server secret.

## Safety

- Không đọc hoặc in nội dung `.env`, `.env.*`, token hay secret; chỉ tham chiếu tên biến.
- Không chạy `drop database`, `rm -rf`, force push/reset, sửa/xóa production data hoặc lệnh phá hoại.
- Hỏi trước khi cài package, truy cập mạng ngoài/gọi API bên thứ ba, deploy hoặc chạy migration production.
- Ngoại lệ deploy: chỉ dùng deploy thủ công khi Git/Cloudflare integration không khả dụng và người dùng xác nhận rõ trong cùng lượt; sau đó phải ghi lý do, commit/branch và URL deployment vào `CHANGELOG.md`.
- Không dùng project production để test mutation; ưu tiên demo/local/test project và thao tác có thể hoàn tác.
