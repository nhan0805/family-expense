# Family Finance — Audit UI/UX

> Ngày audit: **18/09/2026** (`Asia/Ho_Chi_Minh`)
> Phạm vi: rà soát mã nguồn frontend, style/component dùng chung, route, test theo màn hình và hành vi của working tree hiện tại. Audit này không thay đổi runtime hoặc business logic của ứng dụng.

## 1. Tóm tắt điều hành

Family Finance đã có nền tảng sản phẩm tốt: shell mobile-first, lớp token light/dark có chủ đích, icon Lucide, vùng tương tác tối thiểu 44px cho phần lớn control chính, card giao dịch responsive, trạng thái loading/error/empty rõ ràng, xác nhận trước các thao tác tài chính có tính phá hủy và cách tổ chức nội dung ưu tiên tiếng Việt. Các thay đổi đồng bộ UI gần đây đã được áp dụng trên xác thực, giao dịch, tài sản, ngân sách, danh mục, thành viên, chi phí định kỳ và dữ liệu.

Cơ hội chính là tinh gọn và hợp nhất, không phải đổi nhận diện. Ứng dụng đã tạo cảm giác cùng một sản phẩm ở cấp layout, nhưng chưa hoàn toàn là một design system thống nhất ở cấp tương tác. Các khoảng trống có tác động lớn nhất:

- dialog/popover tùy biến chưa có cùng một hành vi an toàn với bàn phím;
- bộ lọc và sửa hàng loạt giao dịch vẫn dày trên mobile;
- Settings có cả bề mặt nhúng và route deep-link ẩn;
- semantic token tồn tại song song với nhiều màu Tailwind và rule cục bộ;
- bản dịch song ngữ và accessible label chưa đầy đủ ở các control dùng thường xuyên;
- alternative cho chart và một số control chọn cần semantics bàn phím/screen reader rõ hơn;
- design system hiện được thể hiện chủ yếu qua quy ước CSS thay vì các primitive dùng chung.

Không có phát hiện P0. Audit không thấy bằng chứng về thao tác tài chính phá hủy mà không yêu cầu xác nhận, việc AI tự lưu giao dịch hoặc thiếu family boundary. Tuy vậy, các phát hiện P1 quan trọng vì ảnh hưởng đến người dùng bàn phím, tần suất dùng mobile và sự tin tưởng khi thực hiện thao tác tài chính rủi ro.

### Số liệu audit

| Hạng mục | Số lượng | Quy tắc đếm |
|---|---:|---|
| Route pattern đã audit | **15** | Ba route xác thực và mười hai route dưới `Layout` (gồm cả index route). |
| Page module đã audit | **15** | Mọi file trong `src/pages/` được route tree render. |
| Trạng thái màn hình vận hành | **16** | Tách tạo mới và chỉnh sửa giao dịch; Login có bốn mode trong cùng module. |
| Shared UI module đã kiểm tra | **8** | Toàn bộ module trong `src/components/`. |
| UI/provider export dùng chung đã kiểm tra | **12** | Gồm các export skeleton/empty state và provider feedback/layout khi phù hợp. |
| Vấn đề consistency giữa màn hình | **15** | Các phát hiện C1–C15 bên dưới. |
| Vấn đề UX | **15** | Các phát hiện U1–U15 bên dưới. |
| Vấn đề accessibility | **14** | Các phát hiện A1–A14 bên dưới. |
| Hạng mục P0 | **0** | Không thấy lỗi mất dữ liệu tức thời hoặc core flow bị vô hiệu. |
| Hạng mục P1 | **8** | Vấn đề hệ thống, usability và accessibility có tác động cao. |
| Hạng mục P2 | **10** | Công việc hợp nhất và responsive có tác động trung bình. |
| Hạng mục P3 | **5** | Polish, regression tooling và đồng bộ tài liệu. |

Ba nhóm issue được đếm độc lập: một khoảng trống implementation có thể đồng thời ảnh hưởng consistency, UX và accessibility. Số lượng P0–P3 là số hạng mục trong roadmap, không phải tổng của ba nhóm issue.

## 2. Phạm vi, phương pháp và bằng chứng

### Nội dung đã kiểm tra

- `AGENTS.md`, `README.md`, `HANDOFF.md`, entry mới nhất của `CHANGELOG.md` và `docs/PROJECT_MAP.md`.
- `package.json`, cấu hình Vite/Tailwind, `src/main.tsx`, `src/App.tsx`, `src/index.css` và các context theme/language.
- Toàn bộ 15 page module được route và test theo page.
- Toàn bộ 8 module trong `src/components/`.
- UI điều kiện: mobile drawer, bottom navigation, budget notification popover, confirmation dialog, toast, filter disclosure, multiselect, chart/table alternative, inline editor và import preview.
- Bằng chứng test/build hiện tại: TypeScript, ESLint, 48 file Vitest / 233 test và Vite build.
- Hướng dẫn `ui-ux-pro-max` đã cài và các tìm kiếm liên quan đến focus/error summary, mobile filter drawer, chart alternative, semantic color và hiệu năng list React.

### Giới hạn kiểm tra live

Local Vite build được chạy mà không thay đổi source hoặc file môi trường. Browser đang dùng Supabase đã cấu hình nên protected route chuyển đúng về `/dang-nhap`. Mình đã kiểm tra trực quan màn hình xác thực ở 1280×720 và không thấy cảnh báo console. Mình không dùng credential, không submit form xác thực, không thay đổi dữ liệu gia đình và không bypass auth.

Vì vậy, kết luận về màn hình đã đăng nhập dựa trên source và test, đồng thời đối chiếu với breakpoint CSS, markup mobile-first, UI test hiện có và handoff hiện tại. Trước khi implementation nên bổ sung visual QA có auth ở 320, 375, 390, 430, 768, 1024, 1280 và 1440px.

## 3. Kiến trúc UI ứng dụng

### Stack đã xác minh

| Mối quan tâm | Implementation hiện tại | Ý nghĩa đối với audit |
|---|---|---|
| Framework | React 19 + TypeScript strict + Vite | Có thể giữ nguyên stack khi tách component. |
| Routing | React Router trong `src/App.tsx` | Auth route và route dưới `Layout` dùng shell khác nhau. |
| Styling | Tailwind CSS v4 và `src/index.css` dài 1.446 dòng | Đã có token nhưng utility cục bộ vẫn tạo drift. |
| Icon | `lucide-react` | Đã có một bộ icon thống nhất. |
| Server state | TanStack Query | Loading/error/retry vẫn cần chuẩn hóa giữa các màn hình. |
| Form | React Hook Form/Zod cho giao dịch; controlled form ở các màn hình khác | Semantics của field đang bị chia nhỏ theo từng implementation. |
| Chart | Recharts | Cần wrapper chung cho alternative và keyboard semantics. |
| Localization | `LanguageContext` (`vi`/`en`) và inline ternary | String dùng thường xuyên chưa tập trung đầy đủ. |
| Theme | `ThemeContext`, class `.dark`, CSS variable | Light/dark rõ ràng; chưa có lựa chọn System cho người dùng. |
| Responsive | Tailwind mobile-first, drawer/bottom nav mobile, sidebar desktop | Shell thích ứng tốt; màn hình dày cần IA mobile riêng. |
| Feedback | `FeedbackProvider` dùng chung cho toast/confirm; inline feedback ở page | Confirm đã tập trung nhưng modal/popover semantics thì chưa. |
| Offline/demo | Demo fallback khi thiếu Supabase; chưa có offline mutation queue | UI phải phân biệt rõ local/demo với trạng thái đã lưu. |

### Shell và luồng state

`src/main.tsx` kết hợp provider theme, language, feedback, query và router. `AppProvider` quản lý bootstrap family đã xác thực và demo fallback. `App.tsx` lazy-load toàn bộ page và đặt route authenticated dưới `Layout`.

`Layout` cung cấp:

- header sticky với identity gia đình, link thành viên, notification, theme/language và logout;
- sidebar desktop;
- mobile drawer cố định có focus trap và xử lý Escape;
- mobile bottom navigation năm mục với entry “Thêm”;
- skip link, focus main khi đổi route và padding theo safe area;
- floating action thêm giao dịch trên mobile.

Đây là nền tảng tốt. Lớp tiếp theo nên đưa dialog, field, tab, table và status message ở cấp page về cùng interaction contract với shell.

### Các shared UI module đã kiểm tra

| Module | Trách nhiệm | Điểm mạnh | Việc cần làm tiếp |
|---|---|---|---|
| `AsyncStates.tsx` | Skeleton, loading page, loading transaction, empty state | Container status có semantics và skeleton tôn trọng reduced motion | Thêm error/retry state dùng chung và chuẩn hóa copy/layout. |
| `AuthShell.tsx` | Shell cho auth/onboarding | Dùng lại ở reset/create-family và cùng ngôn ngữ hình ảnh | Thêm tùy chọn theme/language và slot message chung. |
| `BudgetNotifications.tsx` | Notification popover và thao tác giao dịch đến hạn | Scope theo family, xác nhận trước planned → actual | Bổ sung focus semantics cho popover và đưa count vào accessible name. |
| `Feedback.tsx` | Toast và confirmation dialog | Có confirm dùng chung, Escape, focus vào, focus trap và restore | Thêm liên kết description, label đúng locale và modal contract dùng chung. |
| `Layout.tsx` | Navigation và authenticated shell | Drawer mobile xử lý focus/safe area tốt | Chuẩn hóa active state của “Thêm” và thể hiện IA route nhất quán. |
| `MultiSelectField.tsx` | Multiselect cho filter/catalog | Option wrap và checkbox row lớn | Dùng quan hệ label/control rõ và semantics disclosure/list rõ hơn. |
| `ThemeSelect.tsx` | Switch theme/language | Control compact 44px, lưu preference | Giải quyết translation “System/Theo thiết bị” chưa có option thật hoặc loại bỏ. |
| `TransactionRow.tsx` | Row mobile card/desktop | Menu action mobile tốt, action 44px, memo row | Localize toàn bộ label/title và đưa màu row về semantic token. |

## 4. Danh mục màn hình

Có 15 route pattern và 15 page module. Auth mode và inline editor được coi là surface điều kiện, không tạo thêm route không tồn tại.

| # | Route | Màn hình/trạng thái | Tính năng | Layout | Component chính | Responsive | Ghi chú |
|---:|---|---|---|---|---|---|---|
| 1 | `/dang-nhap` | Đăng nhập, tạo tài khoản, magic link, quên mật khẩu | Xác thực | Auth split layout độc lập | Auth form, password toggle, feature card | Hero ẩn dưới `lg`; form vẫn card/center | Bốn mode cùng route/component. |
| 2 | `/dat-lai-mat-khau` | Đặt lại mật khẩu | Xác thực | `AuthShell` | Password field, session check, status message | Card một cột | Lỗi link/session dùng status polite. |
| 3 | `/tao-gia-dinh` | Tạo gia đình/onboarding | Onboarding | `AuthShell` rộng, form + benefits aside | Family form, benefits list, logout | Hai cột ở `lg`, xếp dọc bên dưới | Copy nói đổi tên ở Settings; thực tế control ở Members. |
| 4 | `/` | Dashboard | Tổng quan, ngân sách, tài sản, chart, AI summary | `Layout` | KPI, snapshot, Recharts, details/table alternative | Nhiều cột desktop, card xếp dọc mobile | Mật độ thông tin cao; chart alternative mở theo điều kiện. |
| 5 | `/giao-dich` | Sổ giao dịch | Search, filter, bulk action, trash | `Layout` | Toolbar, chip, multiselect, `TransactionRow`, bulk dialog | Card mobile; table min-width desktop có overflow | Màn hình dùng lặp lại phức tạp nhất. |
| 6 | `/giao-dich/moi` | Giao dịch mới | Nhập liệu, AI suggestion, draft | `Layout` | RHF/Zod form, error summary, AI/speech, confirm | Một cột mobile; nhóm ba cột desktop | Validation và draft recovery tốt. |
| 7 | `/giao-dich/:id` | Sửa/copy giao dịch | Nhập/sửa | `Layout` | `TransactionForm` với edit/delete state | Như tạo mới | Khác trạng thái vận hành dù dùng chung component. |
| 8 | `/tai-san` | Sổ tiết kiệm và vàng | Tài sản | `Layout` | Summary, inline editor, history, sale/settlement form | Card mobile và action stack | Hai domain tài chính trên một màn hình dài. |
| 9 | `/ngan-sach` | Ngân sách | Hạn mức tháng và progress | `Layout` | Period control, summary card, budget row, inline editor | Summary 2 cột mobile; row editor | Giải thích actual-only và confirm tốt. |
| 10 | `/chi-phi-dinh-ky` | Chi phí định kỳ | Template, due generation, history, trash | `Layout` | Toolbar, inline editor, recurring row, action menu | Card xếp dọc; action group thích ứng | Cần làm rõ job nền và generation thủ công. |
| 11 | `/danh-muc` | Danh mục | Mục đích, loại chi, phương thức, icon | `Layout` | Tab, inline editor, icon picker, empty state | Card/editor xếp dọc; icon grid reflow | Semantics tab/icon picker đang cục bộ. |
| 12 | `/thanh-vien` | Thành viên gia đình | Mời, đổi tên, xóa, xóa gia đình | `Layout` | Invite form, member row, danger zone, confirm | Invite hai cột ở `sm`; row xếp dọc | Edit tên gia đình nằm ở đây, không phải Settings. |
| 13 | `/du-lieu` | Trung tâm dữ liệu | Template, import, export, email owner | `Layout` | Data card, upload/drop zone, preview, stats | Card xếp dọc; preview scroll ngang | Luồng confirm-before-import an toàn. |
| 14 | `/cai-dat` | Tab Settings | Filter mặc định và default giao dịch tự động | `Layout` | Tab, embedded filter settings, automation settings | Tab strip wrap/scroll theo CSS | Settings nhúng page module khác. |
| 15 | `/cai-dat/giao-dich` | Deep link filter mặc định | Preference cá nhân | `Layout` | `TransactionFilterSettings` không embedded | Form/card dài | Ẩn khỏi sidebar nhưng vẫn là deep link public. |

### Surface điều kiện đã audit

- Sidebar desktop và drawer mobile, gồm focus restore, Escape và Tab wrap.
- Bottom nav mobile và floating action thêm giao dịch.
- Budget notification popover, badge unread/due, mark-read/delete-read và confirm planned transaction.
- Toast stack và confirmation dialog destructive/non-destructive.
- Transaction filter disclosure, filter chip, catalog multiselect và bulk edit dialog.
- Dashboard chart legend, drill-down link, chart data-table alternative và danh sách asset thu gọn.
- Inline editor cho catalog, budget, savings, gold, recurring và tên family/member.
- Import upload/drop zone, file-status feedback, duplicate checkbox, preview scroll ngang và confirm cuối.
- Loading skeleton, empty state, query/network error, field error, draft restore và retry.

## 5. Design system hiện tại

### Typography

Ứng dụng dùng `Inter, ui-sans-serif, system-ui, sans-serif` trong `src/index.css`. Nền tảng dễ đọc và phù hợp với dữ liệu tài chính tiếng Việt. Utility page title dùng `clamp(1.6rem, 3vw, 2.15rem)`, weight cao và tracking chặt. Label khoảng 12–13px/700; field 16px; body thường 14–16px.

Điểm tốt:

- hierarchy kicker/title/subtitle dễ nhận ra;
- chữ form 16px giảm nguy cơ browser mobile tự zoom;
- số liệu dùng weight mạnh và format VND rõ;
- đã có rule reduced motion.

Cần system hóa:

- chưa có typography role có tên, chủ yếu là utility cục bộ;
- button/toolbar tương đương dùng nhiều biến thể 14, 15, 16 và 18px;
- label bottom nav có thể xuống 10px, dễ yếu khi gặp tiếng Việt dài;
- helper/error text chia giữa `text-xs`, `text-sm`, `text-gray-*` và muted token;
- `font-extrabold`, `font-black`, `font-bold` và numeric weight trộn mà chưa có role map.

### Color system

Token layer là điểm mạnh. Light mode có app background, surface, muted surface, border, text, primary, success, warning, danger, info, accent, focus và chart. Dark mode có surface navy/purple kiểu Dracula với giá trị semantic rõ.

Rủi ro chính là token bị rò ra ngoài. Tìm kiếm repository ghi nhận khoảng 241 occurrence của raw color utility/hex trong `src/pages`, `src/components` và `src/context`. Nhiều occurrence có thể hợp lệ, nhưng số lượng đủ lớn để gây khó kiểm soát nhất quán. Ví dụ có raw `rose`, `amber`, `emerald`, `slate`, `gray`, `blue`, `violet` và hex riêng trong JSX. Dark FAB còn dùng gradient hồng/tím riêng thay vì mapping primary chung.

Nên giữ nhận diện light navy/blue và dark purple hiện tại, nhưng đưa state color/surface qua semantic variable (`--surface-hover`, `--text-primary`, `--text-secondary`, `--overlay`, chart semantic role). Raw palette utility chỉ nên dùng trong token layer hoặc palette chart được tài liệu hóa.

Audit này chưa đo bằng công cụ cho toàn bộ token pair. Dark theme cần đặc biệt có contrast matrix cho muted text, warning/danger trên soft surface, chart axis và focus ring.

### Spacing

Code chủ yếu dùng Tailwind scale với 8, 12, 16, 20, 24 và 32px. Shell có nhịp `p-4`, `sm:p-5`, `md:p-8`, `lg:p-9` rõ. Các ngoại lệ như `mt-32`, `sm:mt-20`, `p-2.5`, `gap-1.5`, `h-[46px]` và padding editor khác nhau là có lý do nhưng chưa được ghi thành quy ước.

Scale đề xuất: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. Giá trị tùy ý chỉ nên dành cho chart/layout constraint và cần được ghi chú nếu ảnh hưởng UI dùng chung.

### Border, radius và elevation

`--radius-card: 1rem` và `--shadow-card` tạo base rõ. Field/button khoảng 12–13px; card thường 16px; auth/onboarding mobile 24–32px; chip full radius. Nhìn tổng thể khá nhất quán nhưng đang được lặp cục bộ bằng `rounded-xl`, `rounded-2xl`, `rounded-3xl` và raw border.

Hierarchy đề xuất:

- `sm`: 8px cho control/menu nhỏ;
- `md`: 12px cho field/button;
- `lg`: 16px cho card;
- `xl`: 24px cho dialog/auth;
- `full`: chip/status.

Chỉ nên dùng ba cấp elevation: card cơ bản, card tương tác và modal/popover. Khác biệt giữa card, editor và status panel nên đến từ hierarchy/spacing thay vì mỗi feature tự tạo shadow mới.

### Iconography

Lucide được dùng nhất quán và là lựa chọn phù hợp. Phần lớn icon inline 16–20px, icon card 20–24px, icon-button wrapper 44px. Các thay đổi gần đây ở asset/dashboard cũng đã sửa nhiều vấn đề alignment.

Điểm còn lệch:

- một số icon-only button có cả `aria-label` localized và `title`, số khác chỉ có một;
- `Feedback` dùng close label tiếng Việt hardcode;
- `TransactionRow` có label action desktop tiếng Việt hardcode;
- icon-picker dùng icon 20px, check marker 11px và listbox behavior riêng;
- size icon thường khai báo inline thay vì theo role.

### Kích thước component

Base `.field`, `.btn-primary`, `.btn-secondary`, `.icon-button` tốt: khoảng 44px và có focus outline. Drift đến từ override cục bộ:

- recurring toolbar 40px;
- AI action 46px;
- form action 48px;
- nhiều checkbox native 16–20px nhưng label wrapper không mở rộng;
- catalog icon option cao 64px trong khi option compact khác thấp hơn.

Nên chuẩn hóa theo semantic size thay vì bắt mọi control có cùng hình học: compact desktop, touch mặc định và primary action lớn.

## 6. Audit từng màn hình

Nhãn mức độ: **CRITICAL** là core flow bị chặn hoặc không an toàn; **HIGH** ảnh hưởng sử dụng thường xuyên, assistive technology hoặc sự tin tưởng khi thao tác tài chính; **MEDIUM** có friction nhưng vẫn có đường đi; **LOW** là bất tiện giới hạn; **POLISH** là tinh chỉnh.

### 6.1 Đăng nhập — `/dang-nhap`

**Mục đích:** đăng nhập, tạo tài khoản, dùng magic link hoặc yêu cầu reset mật khẩu.

- **Hierarchy:** ở 1280px, layout chia rõ: product promise bên trái, form tập trung bên phải. Title, label, CTA chính và recovery action có thứ tự hợp lý.
- **Visual:** auth surface dùng cùng token xanh/neutral và hierarchy Inter với app. Feature card tăng confidence nhưng không tranh sự chú ý với form.
- **Flow/feedback:** đổi mode xóa message và trạng thái hiện password cũ. Loading text rõ. Autocomplete email/password đúng.
- **Responsive:** hero ẩn dưới `lg` hợp lý; form vẫn dùng được ở viewport hẹp. Auth không có control theme/language.
- **Accessibility:** label, `aria-invalid`, password toggle và button semantic có đủ. Error/status dùng `role=status`/polite nên kém assertive so với lỗi đăng nhập.
- **Phát hiện:** **HIGH:** A6/U14. **MEDIUM:** C10.

### 6.2 Đặt lại mật khẩu — `/dat-lai-mat-khau`

**Mục đích:** kiểm tra recovery session và đặt password mới.

- `AuthShell` gọn, heading rõ, hai field, visibility control và một CTA chính.
- Lỗi link hết hạn và trạng thái cập nhật hiển thị; trạng thái session lỗi có đường quay lại login.
- Card một cột phù hợp mobile; field/button 44px.
- Field có label, invalid state và live status; lỗi vẫn dùng polite status thay vì error alert và chưa có error summary đầu form.
- **Phát hiện:** **MEDIUM:** A6.

### 6.3 Tạo gia đình — `/tao-gia-dinh`

**Mục đích:** tạo workspace gia đình đầu tiên sau khi xác thực.

- Cue `1 / 1`, field tên gia đình và benefits aside giúp flow một bước dễ hiểu.
- `AuthShell`, semantic token, field lớn và primary CTA rõ.
- Error dùng `role=alert`, field invalid; không báo thành công trước mutation.
- Hai cột ở `lg`, xếp dọc bên dưới; benefits vẫn đọc được.
- Helper nói đổi tên sau ở Settings nhưng action thật nằm tại Members. **HIGH:** U1.
- Heading/label tốt; ký hiệu lỗi `!` tuy ẩn với assistive tech nhưng kém nhất quán với Lucide.

### 6.4 Dashboard — `/`

**Mục đích:** xem nhanh dòng tiền, ngân sách, tài sản và điểm đáng chú ý.

- Thứ tự KPI → budget snapshot → assets/recent activity → trend/breakdown hợp lý.
- Semantic chart token, KPI tone, card gọn, details disclosure và table alternative là điểm mạnh.
- Period control, drill-down link, legend control, error, skeleton và empty state đều có.
- Mobile card xếp dọc; chart/table làm page dài.
- Pie cell có một phần keyboard treatment và có table; trend/SVG chart chưa có text-first/keyboard contract nhất quán; alternative thường nằm sau disclosure/button.
- KPI dùng VND compact trong khi transaction/asset dùng full; quy ước chưa nói rõ.
- **Phát hiện:** **HIGH:** A8/U10. **MEDIUM:** C12/U9.

### 6.5 Giao dịch — `/giao-dich`

**Mục đích:** search, filter, review, edit, bulk update, trash và restore giao dịch gia đình.

- Thứ tự filter gần đây đã tốt hơn trên mobile: search/direct filter, advanced filter, summary, list.
- Chip wrap, card mobile, row desktop và action 44px khá nhất quán.
- Debounced search, URL filter, infinite load, AI search, voice, trash, empty/error là nền tảng mạnh. Mutation chờ hoàn tất trước cache/navigation.
- Card mobile tránh table overflow; desktop dùng row min-width. Tám multiselect và amount/date khiến filter dài trên màn hình nhỏ.
- Label và nhiều icon name đầy đủ. Bulk-edit dialog chưa dùng chung focus/Escape/restore; checkbox select ở header/table nhìn 20px và nên có wrapper hit area lớn hơn.
- **Phát hiện:** **HIGH:** A3/U4/U5. **MEDIUM:** A10/A14.

### 6.6 Giao dịch mới — `/giao-dich/moi`

**Mục đích:** tạo thu/chi có validation, AI suggestion, speech input và draft recovery.

- Đặt Nội dung trước Số tiền hợp với mental model; transaction type nổi bật; classification được nhóm.
- RHF/Zod, field error, error summary, focus-on-invalid, numeric input, draft và “confirm and save” là nền tảng tốt.
- AI có badge, confidence/warning và không tự lưu.
- Mobile một cột; classification thành nhiều cột ở `md`; action lớn.
- Khi validation trỏ đến `transaction-status` trong lúc Advanced options đang đóng, focus target có thể bị ẩn. **HIGH:** A5.
- `Field`, AI badge và raw status color vẫn cục bộ. **MEDIUM:** C4/C5/C9.

### 6.7 Sửa/copy giao dịch — `/giao-dich/:id`

**Mục đích:** sửa, copy hoặc xóa giao dịch hiện có.

- Dùng lại form có validation, draft, confirm và mutation recovery.
- Delete icon-only có accessible name/title và đi qua confirm.
- Layout field mobile giống tạo mới; label dài wrap.
- Route chưa nói rõ người dùng đang edit, copy hay chỉ xem detail. **MEDIUM:** C12/U11; nên làm mode và quy ước số tiền rõ hơn.

### 6.8 Tài sản — `/tai-san`

**Mục đích:** quản lý sổ tiết kiệm, vàng, movement, settlement và sale.

- Summary tài sản, holding và inline form đưa được các giá trị quan trọng; thay đổi mobile gần đây cải thiện card và số lượng còn lại.
- Savings/gold action dùng success/warning semantic và icon phù hợp; form có heading/close rõ.
- Linked transaction, settlement/sale preview và destructive archive/delete có giải thích/confirm.
- Card và action group stack trên mobile, thuộc nhóm feature thích ứng mobile tốt.
- Savings và gold là hai mental model trên một page dài; cần test số VND/quantity dài ở 320/375px.
- **Phát hiện:** **MEDIUM:** U8; nên nhóm theo domain hoặc có sub-navigation nhẹ.

### 6.9 Ngân sách — `/ngan-sach`

**Mục đích:** đặt hạn mức theo mục đích và so sánh chi thực tế.

- Period selector, bốn summary card, cảnh báo chưa đặt budget và row tạo chuỗi đọc rõ.
- Loading/error/retry/empty có; delete và copy-overwrite có confirm; actual-only được nói rõ.
- Summary dùng lưới 2×2 mobile; row/editor stack ổn.
- Status có label đi kèm progress/text; màu vẫn đến từ palette cục bộ thay vì semantic token chung.
- **Phát hiện:** **MEDIUM:** C1/C2.

### 6.10 Chi phí định kỳ — `/chi-phi-dinh-ky`

**Mục đích:** tạo template, pause/resume, skip, tạo item đến hạn, xem history, restore/delete.

- Summary, due count, editor và active/deleted section dễ hiểu.
- Editor tự scroll/focus field đầu; pause/resume/skip/delete/restore có confirm; history mở khi cần.
- Action group đã được thu gọn và giữ touch target; label dài vẫn cần test 320–390px.
- “Generate due transactions” đứng cạnh giải thích job hằng ngày tự chạy. Nên mô tả là manual retry/refresh để tránh người dùng nghĩ sẽ tạo trùng.
- **Phát hiện:** **HIGH:** U7.

### 6.11 Danh mục — `/danh-muc`

**Mục đích:** quản lý purpose, expense type, payment method và icon.

- Tab và list gọn; inline editor giữ context.
- Icon picker, budget chip và empty state phù hợp design language.
- Icon grid reflow; field editor full width.
- `role=listbox`/`role=option` hiện là các button nhưng chưa có arrow-key listbox behavior. Tab cũng không dùng chung keyboard contract với Settings.
- **Phát hiện:** **HIGH:** A11/A12. **MEDIUM:** C7/C8.

### 6.12 Thành viên gia đình — `/thanh-vien`

**Mục đích:** mời, đổi tên, xóa thành viên và xóa gia đình.

- Family identity, invite card, member list và danger zone rõ.
- Loading skeleton, alert, confirm và owner/member gating rõ ràng.
- Invite thành hai cột ở `sm`, member action wrap/stack, family-name edit autofocus.
- Family deletion được tách dưới cùng và giải thích tác động. Đây cũng là nơi có family-name control làm lộ copy mismatch của onboarding.
- **Phát hiện:** **LOW/MEDIUM:** U1/C13.

### 6.13 Trung tâm dữ liệu — `/du-lieu`

**Mục đích:** tải template, import/export dữ liệu và gửi email export cho owner.

- Template, export, email và import tách card; import nói rõ cần review/confirm.
- Format/size/row limit, validation result, duplicate, preview, count và confirm được xử lý kỹ.
- Card stack; preview có hint scroll ngang và focusable region.
- Upload label và status/error region tốt. Preview chỉ hiện 100 dòng valid/error đầu, nên nói rõ khi còn dữ liệu.
- Email export có thể bị disable do config/role nhưng lý do chưa luôn hiển thị cạnh control. **MEDIUM:** U13.

### 6.14 Settings — `/cai-dat`

**Mục đích:** quản lý filter mặc định cá nhân và default catalog cho giao dịch tự động.

- Hai tab hợp lý; có `aria-selected`, `aria-controls`, roving tab index và arrow/Home/End.
- Card, status banner, save/reset quen thuộc.
- Default state, preview Transactions, owner-only và reset confirm rõ.
- Một page nhúng hai page module trong khi một module cũng có route riêng, gây khó cho link/breadcrumb/navigation tương lai.
- **Phát hiện:** **HIGH:** U2/C13.

### 6.15 Filter giao dịch mặc định — `/cai-dat/giao-dich`

**Mục đích:** URL trực tiếp cho filter preset cá nhân.

- Form chia main, catalog và amount; preview giải thích ưu tiên filter.
- Catalog inclusion/exclusion mạnh nhưng dài trên mobile; `MultiSelectField` lặp lại các vấn đề filter chính.
- Deep link chưa có breadcrumb/active Settings tab rõ.
- **Phát hiện:** **HIGH:** U2/C13. **MEDIUM:** A4/U4.

## 7. Vấn đề consistency giữa các màn hình

| ID | Vấn đề | Bằng chứng / surface ảnh hưởng | Mức độ |
|---|---|---|---|
| C1 | Semantic token không phải nguồn màu duy nhất. | `src/index.css` có token nhưng pages/components có khoảng 241 raw color utility/hex. | HIGH |
| C2 | Mapping brand/state khác nhau theo theme/feature. | Light primary xanh navy; dark primary tím; dark FAB gradient hồng/tím; Budget/Catalog dùng palette cục bộ. | MEDIUM |
| C3 | Typography role chưa có tên. | Page title, nav, card heading, helper, error dùng nhiều size/weight cục bộ. | MEDIUM |
| C4 | Action tương đương không có một size contract. | Recurring 40px, shared 44px, AI 46px, form action 48px. | MEDIUM |
| C5 | Form label/control semantics bị chia nhỏ. | `Field` trong TransactionForm, wrapping label ở nhiều page và `<span>` heading ở MultiSelect. | HIGH |
| C6 | Card/radius/padding được tự dựng theo page. | `.card` 16px nhưng page dùng surface 12/16/24/32px và raw border. | MEDIUM |
| C7 | Modal/popover behavior bị lặp. | Shared confirm, bulk-edit dialog, notification popover, native details menu. | HIGH |
| C8 | Tab bị lặp nhưng không có contract chung. | Settings có arrow/Home/End; Catalogs dùng logic cục bộ. | MEDIUM |
| C9 | Feedback semantics/presentation khác nhau. | `role=alert`, `role=status`, `inline-feedback`, banner raw và toast trộn. | HIGH |
| C10 | Localization nằm rải trong inline ternary. | Shared nav có translation nhưng action thường xuyên vẫn hardcode. | HIGH |
| C11 | Label/title cho icon action không nhất quán. | Có nơi có label + title localized, nơi chỉ một hoặc dùng literal. | MEDIUM |
| C12 | Quy ước hiển thị số chưa khai báo. | Dashboard compact VND; transaction/asset full VND; chart/table khác format. | MEDIUM |
| C13 | Route Settings và tài liệu chưa mô tả cùng một model. | `/cai-dat/giao-dich` ẩn nhưng tồn tại; PROJECT_MAP thiếu hai settings route; onboarding chỉ sai destination. | HIGH |
| C14 | Responsive action pattern khác theo feature. | Transaction menu, recurring menu, asset action, catalog editor, budget row có breakpoint riêng. | MEDIUM |
| C15 | Pattern overflow/table chưa thống nhất. | Transactions dùng card/table, import có scroll region rõ, chart table có min-width riêng. | MEDIUM |

## 8. Vấn đề theo UX flow

| ID | Flow | Phát hiện | Mức độ |
|---|---|---|---|
| U1 | Login → tạo family → quản lý family | Onboarding nói đổi tên ở Settings nhưng action nằm trong Members. | HIGH |
| U2 | Settings → filter mặc định | Cùng feature vừa embedded vừa có deep link ẩn; direct entry không activate tab/breadcrumb. | HIGH |
| U3 | Mobile navigation | Khi ở route phụ, control “Thêm” không thể hiện rõ đang là context hiện tại. | MEDIUM |
| U4 | Transactions → filter | Filter mạnh nhưng thành task dọc dài trên màn hình nhỏ; disclosure có nhưng vẫn lộ nhiều control. | HIGH |
| U5 | Transactions → bulk edit | Dialog custom yếu hơn confirm chung: thiếu Escape/focus restore, copy Việt-only, empty-selection guidance chưa rõ. | HIGH |
| U6 | Header → notification | Budget alert và due transaction trong cùng popover; count “mục cần chú ý” chưa tách mạnh hai loại action. | MEDIUM |
| U7 | Recurring → generate due | Manual generate đứng cạnh background job và dễ bị hiểu là đường tạo thứ hai. | HIGH |
| U8 | Assets → savings/gold | Hai domain, nhiều history và linked action tạo page dài, đòi hỏi nhiều context. | MEDIUM |
| U9 | Dashboard scan | Mobile phải đi qua quá nhiều module: KPI, budget, asset, recent, trend, pie, breakdown, AI. | MEDIUM |
| U10 | Dashboard → insight chart | Chart/table alternative có nhưng thường ẩn sau disclosure; khó discover text representation. | HIGH |
| U11 | Review money value | Compact/full VND trộn mà chưa có quy tắc overview vs decision. | MEDIUM |
| U12 | Data → import | Flow an toàn nhưng chưa được framing trực quan thành choose → validate → review → confirm. | MEDIUM |
| U13 | Data → email export | Action phụ thuộc owner/config nhưng disabled reason không luôn ở cạnh control. | MEDIUM |
| U14 | Authentication | “Continue” chung chung và “Magic link” chưa dịch làm giảm confidence. | HIGH |
| U15 | Theme/language | Header authenticated có control nhưng auth/onboarding không có; translation “System” chưa có lựa chọn. | MEDIUM |

## 9. Phát hiện responsive

### Điểm đang tốt

- Có `min-width: 320px`, dynamic viewport height và safe-area padding.
- Drawer và bottom nav mobile là navigation riêng, không chỉ scale desktop.
- Transaction row đổi có chủ đích từ table desktop sang card mobile.
- Import preview có hint vuốt ngang và scroll region có thể focus.
- Asset card, recurring action và icon button đã được điều chỉnh gần đây cho touch mobile.
- Reduced motion tắt transition/scale/animation phù hợp.

### Matrix cần kiểm tra trước implementation

| Width | Rủi ro chính | Hành vi mong đợi |
|---:|---|---|
| 320 | Label tiếng Việt dài, bottom-nav, action group, VND/quantity | Không cắt label; action chính vẫn chạm được; card xếp dọc. |
| 375 | Độ dài filter, bulk bar, va chạm FAB/bottom-nav | Sticky bar không che focus; filter summary vẫn thấy. |
| 390 | Recurring/asset action và chart legend | Action wrap/menu không tràn; legend vẫn hiểu được. |
| 430 | Breakpoint form/card hai cột | Không chuyển hai cột quá sớm khi label dài; field ≥44px. |
| 768 | Ngưỡng desktop table, sidebar, chart min-width | Không clip table; navigation transition rõ. |
| 1024 | Auth split, dashboard density, sidebar space | Không bị chật giữa mobile và desktop rộng. |
| 1280 | Header/sidebar/main rhythm, chart, popover | Login hiện sạch ở width này; authenticated shell cần snapshot. |
| 1440 | Max-width và khoảng trống lớn | Content vẫn được nhóm; không stretch card quá mức. |

Rủi ro cụ thể:

- transaction table dùng `min-w-[1080px]`, cần test rõ vùng 768–1023px;
- header sticky, bulk bar, bottom nav và FAB cùng chiếm vertical space;
- label bottom nav 10px và tiếng Việt dài có thể wrap/yếu;
- chart/table cần summary mobile thay vì chỉ thu nhỏ;
- popover/dialog cần `dvh`, safe width và focus-scroll;
- amount/quantity cần fixture giá trị dài, không chỉ demo ngắn.

## 10. Phát hiện accessibility

| ID | Phát hiện | Bằng chứng / tác động | Mức độ |
|---|---|---|---|
| A1 | Notification popover thiếu dialog contract hoàn chỉnh. | Có `role=dialog` nhưng thiếu `aria-modal`, focus vào panel, focus trap và restore. | HIGH |
| A2 | Count notification không nằm trong button name. | Count là `aria-label` trên badge trang trí; button vẫn chỉ có “Notifications/Thông báo”. | MEDIUM |
| A3 | Bulk-edit dialog không dùng behavior chung. | Có `aria-modal`/heading nhưng thiếu Escape, focus trap và restore. | HIGH |
| A4 | Multiselect label/list semantics chưa đầy đủ. | Label là span, disclosure là native details, option region là group; quan hệ labelled control chưa rõ như primitive chung. | MEDIUM |
| A5 | Error focus có thể trỏ vào nội dung ẩn. | TransactionForm có thể focus `transaction-status` khi Advanced đang đóng. | HIGH |
| A6 | Auth/reset error dùng polite status. | Lỗi credential/password có thể không được screen reader ngắt để thông báo; Login/Reset không theo pattern error summary mạnh hơn. | HIGH |
| A7 | Accessible name chưa luôn localized. | Toast close và transaction row copy/delete có literal tiếng Việt khi ở English. | MEDIUM |
| A8 | Chart cần contract keyboard/text chung. | Trend chưa có action keyboard tương đương; table có nhưng không luôn discoverable/primary. | HIGH |
| A9 | Chưa có contrast baseline đo bằng công cụ. | Token pair light/dark, đặc biệt muted/status/chart text, cần bằng chứng WCAG trước khi đổi token. | MEDIUM |
| A10 | Một số selection control nhỏ hơn touch contract. | Transaction select desktop là `size-5` nhưng không có label/wrapper 44px. | MEDIUM |
| A11 | Icon picker listbox semantics chưa đầy đủ. | Button gán `role=option` nhưng không có arrow navigation/active-descendant. | MEDIUM |
| A12 | Catalog tab thiếu keyboard contract như Settings. | Có role/selection nhưng không arrow/Home/End dùng chung. | MEDIUM |
| A13 | Toast live region chứa control dismiss. | Live container bọc toàn bộ toast markup nên assistive tech có thể đọc cả action control lặp lại. | LOW |
| A14 | Transaction overflow desktop chưa là region có label. | Wrapper scroll ngang có nhưng không có affordance labelled như import preview. | LOW |

### Accessibility strengths cần giữ

- Có skip link và focus main khi đổi route;
- focus-visible outline được giữ cả dark mode;
- shared confirmation dialog có focus trap, Escape và restore;
- transaction form có error summary được focus và link field;
- phần lớn label, `aria-invalid`, `aria-busy`, `aria-expanded`, `aria-controls` và status region đã có;
- icon-only action thường có accessible name;
- reduced-motion có trong CSS và một số effect;
- transaction/import có text label cho state quan trọng, không chỉ dựa vào màu.

## 11. Phát hiện kỹ thuật UI

| ID | Phát hiện | Ý nghĩa |
|---|---|---|
| T1 | `src/index.css` vừa là token stylesheet vừa là feature stylesheet lớn. | Khó nhìn rõ ownership và drift. |
| T2 | Page module chính rất lớn. | `Transactions.tsx`/`Assets.tsx` trên 1.200 dòng; Dashboard/TransactionForm cũng lớn; UI contract bị giữ cục bộ. |
| T3 | Chưa có primitive Button/Field/Modal/Tabs/PageHeader/Table dùng chung. | Pattern lặp với size/semantics hơi khác nhau. |
| T4 | Tài liệu kiến trúc thiếu Settings route live. | `App.tsx` có `/cai-dat` và `/cai-dat/giao-dich` nhưng route map không liệt kê. |
| T5 | Test tự động tốt nhưng visual/a11y mỏng. | Bằng chứng local là 48 file/233 test pass; chưa có axe/keyboard matrix hoặc authenticated visual snapshot lặp lại. |
| T6 | Build cảnh báo chunk lớn. | ExcelJS, XLSX và chart chunk lớn; đã được ghi nhận là known issue và cần cân nhắc trên mobile. |
| T7 | Theme capability và copy lệch nhau. | Language có “System/Theo thiết bị”; ThemeContext chỉ có light/dark và chỉ đọc OS ở lần load đầu. |
| T8 | Tài liệu con người có phần stale về theme. | README nói chưa có theme switch trong khi `ThemeSelect` đã tồn tại. |

## 12. Vấn đề chính

1. Dialog/popover chưa có một interaction contract nên high-risk action và notification khác nhau với người dùng bàn phím.
2. Transactions mạnh nhưng quá dày trên mobile; filter và bulk edit cần task-oriented mobile mode.
3. Settings có route model mơ hồ và architecture map chưa cập nhật.
4. Semantic token có nhưng chưa được thực thi; palette utility và raw hex làm lệch theme.
5. Localization chưa là contract đầy đủ; accessible action name có thể vẫn tiếng Việt ở English.
6. Dashboard nhiều giá trị nhưng cần text-first chart alternative dễ discover hơn và quy tắc overview/detail rõ hơn.
7. Form được chăm chút riêng lẻ nhưng field/error/advanced disclosure bị lặp.
8. Assets, recurring và data tools giàu chức năng; cần nhóm primary/secondary action rõ hơn ở width hẹp.

## 13. Quick wins

- Đưa close/copy/delete/action label dùng chung về translation key, bắt đầu ở toast và transaction row.
- Đưa notification count vào accessible name của button và thêm `aria-modal`/focus-in cho popover.
- Thêm Escape/focus trap/restore cho bulk-edit dialog bằng contract chung.
- Sửa copy Create Family từ “Settings” thành “Members” hoặc cung cấp destination Settings thật.
- Cho deep link Settings activate Filters tab và có back/breadcrumb.
- Thêm treatment “bước 1: chọn → bước 2: kiểm tra → bước 3: xác nhận” cho import mà không đổi data flow.
- Quy ước amount: compact cho overview, full cho surface quyết định/action, có title/accessibility full value.
- Đưa màu trạng thái/card nổi bật về semantic token ở các row/card dễ thấy.
- Thêm text summary cạnh chart trước khi làm sâu interaction chart.
- Mở rộng hit area của transaction selection mà không tăng mật độ nhìn.

## 14. Bước tiếp theo đề xuất

Dùng [`docs/UI_UX_IMPROVEMENT_PLAN.md`](UI_UX_IMPROVEMENT_PLAN.md) làm implementation contract; bản tiếng Việt tương ứng là [`docs/UI_UX_IMPROVEMENT_PLAN.vi.md`](UI_UX_IMPROVEMENT_PLAN.vi.md). Bắt đầu từ batch P1 đầu tiên, thêm regression coverage trước khi đổi primitive dùng chung và để polish sau khi Settings, dialog, filter và localization ổn định.
