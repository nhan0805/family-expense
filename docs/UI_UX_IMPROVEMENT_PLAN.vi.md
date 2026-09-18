# Family Finance — Kế hoạch cải thiện UI/UX

> Đây chỉ là tài liệu kế hoạch. Tài liệu không ủy quyền và không bao gồm redesign runtime, thay đổi business logic, schema hoặc dependency.

## 1. Nguyên tắc thiết kế mục tiêu

1. **Tinh chỉnh nhận diện hiện có.** Giữ ngôn ngữ xanh navy/xanh dương đáng tin cậy và hướng surface dark purple lấy cảm hứng từ Dracula đang được thiết lập. Cải thiện tính nhất quán; không thay thế sản phẩm bằng một phong cách thị giác không liên quan.
2. **Làm rõ trạng thái tài chính.** Số tiền, loại giao dịch, trạng thái thực tế/dự kiến, trạng thái ngân sách và thao tác tài sản phải dễ hiểu mà không chỉ phụ thuộc vào màu sắc.
3. **Tối ưu cho việc sử dụng mobile lặp lại.** Người dùng cần có thể xem nhanh Dashboard, lọc giao dịch, thêm một khoản chi và xác nhận thao tác rủi ro bằng một tay trên viewport cỡ iPhone.
4. **Dùng progressive disclosure có chủ đích.** Surface tổng quan chỉ hiển thị những dữ kiện cần cho quyết định; chi tiết, lịch sử, giải thích AI và bộ lọc nâng cao mở khi cần.
5. **Mỗi pattern có một interaction contract.** Dialog, popover, field, tab, button, status message và overflow của table phải có cùng một hành vi accessible ở mọi nơi.
6. **Bảo toàn quyền kiểm soát của người dùng.** AI chỉ đề xuất; người dùng xác nhận. Mutation phải hoàn tất trước khi UI đổi state. Thao tác phá hủy phải giải thích tác động và yêu cầu xác nhận.
7. **Bản địa hóa giao diện như một hệ thống.** Tiếng Việt tiếp tục là mặc định, tiếng Anh là một mode được hỗ trợ đầy đủ, accessible name phải theo ngôn ngữ đang hiển thị.
8. **Ưu tiên stack hiện có.** Cải thiện token Tailwind v4, CSS variable, React component, TanStack Query, RHF/Zod và tooling test hiện tại. Không thêm UI framework.
9. **Đo lường trước khi polish.** Thiết lập baseline về contrast, viewport, bàn phím và hình ảnh trước các refactor diện rộng.

## 2. Design system thống nhất được đề xuất

### 2.1 Ownership của design token

Giữ `src/index.css` là source of truth của token, nhưng tách thành các section hoặc layer rõ ràng:

1. theme primitive và semantic variable;
2. vai trò typography và spacing;
3. shared component primitive;
4. rule layout/navigation;
5. ngoại lệ riêng của feature.

JSX của feature nên ưu tiên semantic variable và role class thay vì màu palette raw. Visualization có thể dùng chart palette được ghi nhận, nhưng surface trạng thái và hành động không nên tự tạo các contract `rose/amber/emerald/slate` cục bộ.

### 2.2 Semantic color token

Các tên dưới đây mở rộng vocabulary token hiện tại; ban đầu nên giữ nguyên giá trị light/dark hiện có và đo lường trước khi điều chỉnh.

| Role | Hướng light | Hướng dark | Cách dùng |
|---|---|---|---|
| `--app-bg` | Gần trắng, hơi lạnh | Nền navy sâu/Dracula | Canvas của trang. |
| `--surface` | Trắng | Surface tối nâng lên | Card, field, dialog. |
| `--surface-hover` | Surface hơi tinted | Surface sáng hơn một chút | Nền hover/pressed. |
| `--surface-muted` | Slate-50/100 | Panel tối muted | Toolbar, segmented control, header table. |
| `--surface-subtle` | Gần màu nền | Panel tối subtle | Khu vực helper và section phụ. |
| `--border` | Slate-200 | Border sáng trong suốt | Ranh giới mặc định. |
| `--border-strong` | Slate-300 | Border purple/slate muted | Field và control có thể focus. |
| `--text` | Slate-900 | Gần trắng ấm | Text chính. |
| `--muted` | Slate-600 | Lavender/gray muted sáng | Text phụ và label. |
| `--text-on-primary` | Trắng | Text surface tối khi cần | Contrast của primary button/icon. |
| `--primary` | Xanh dương đáng tin cậy hiện có | Purple hiện có | Hành động chính và state được chọn. |
| `--primary-hover` | Xanh dương đậm hơn hiện có | Purple sáng hơn hiện có | State hover/active. |
| `--primary-soft` | Tint xanh hiện có | Tint purple hiện có | Nền selected và filter chip. |
| `--success`, `--success-soft`, `--success-strong` | Nhóm xanh lá hiện có | Nhóm xanh lá hiện có | Đã lưu/trong ngân sách/thu nhập. |
| `--warning`, `--warning-soft`, `--warning-strong` | Nhóm amber hiện có | Nhóm amber hiện có | Dự kiến/sắp đến hạn/gần giới hạn. |
| `--danger`, `--danger-soft`, `--danger-strong` | Nhóm đỏ hiện có | Nhóm đỏ hiện có | Xóa/lỗi/vượt ngân sách. |
| `--info`, `--info-soft`, `--info-strong` | Nhóm xanh/cyan hiện có | Nhóm cyan hiện có | Trạng thái thông tin. |
| `--focus-ring` | Xanh dương đã đo | Cyan đã đo | Mọi keyboard focus. |
| `--overlay` | Đen trung tính trong suốt | Đen trung tính trong suốt đậm hơn | Modal/scrim; không dùng màu của feature. |

Quy tắc:

- mọi status badge phải có label hoặc accessible text ngoài màu sắc;
- mọi cặp text/background phải được kiểm tra contrast ở light/dark;
- raw color utility vẫn được phép trong palette chỉ dành cho chart và surface minh họa đã được ghi nhận;
- control chính nên dùng cùng một mapping theme; bỏ gradient hồng đặc biệt của FAB dark trừ khi chủ động đưa nó thành brand token.

### 2.3 Hệ thống typography

Tiếp tục dùng Inter/system fallback. Tạo role utility thay vì dựa vào các tổ hợp cục bộ.

| Role | Size / line height | Weight | Cách dùng điển hình |
|---|---|---:|---|
| Display | 40 / 44px | 800 | Auth hero hoặc product statement hiếm dùng. |
| Page title | 28–34 / 32–38px | 800 | Heading của route; dùng đầu thấp hơn trên mobile nhỏ. |
| Section title | 20 / 26px | 800 | Heading section/card chính. |
| Card title | 17–18 / 24px | 750 | Title của row/card và heading editor. |
| Body large | 16 / 24px | 400–600 | Giải thích form và nội dung quan trọng. |
| Body | 14 / 21px | 400–600 | Nội dung mặc định và text table. |
| Body small | 13 / 19px | 400–600 | Mô tả phụ. |
| Label | 13 / 18px | 700 | Label field/navigation; phải dễ đọc trong tiếng Việt. |
| Caption | 12 / 16px | 600 | Metadata, chi tiết trạng thái và hint gọn. |
| Numeric emphasis | Tùy ngữ cảnh, 24–32px | 800 | Giá trị KPI/tóm tắt; dùng title/accessibility description cho giá trị đầy đủ. |

Không thêm một font weight chỉ cho một màn hình. Coi letter spacing là thuộc tính của role: chỉ dùng tight cho heading lớn, normal cho body tiếng Việt và tracking uppercase vừa phải cho kicker.

### 2.4 Hệ thống spacing

Dùng scale Tailwind hiện có với nhịp sản phẩm được ghi nhận:

`4 → 8 → 12 → 16 → 20 → 24 → 32 → 40 → 48 → 64px`

Quy tắc khuyến nghị:

- label field tới field: 6px;
- các field trong form: 16px;
- padding card: 16px mobile, 20px desktop gọn, chỉ dùng 24px cho surface lớn/auth;
- khoảng cách giữa section: 20–24px;
- mép trang: 16px mobile, 20px desktop nhỏ, 32px desktop rộng;
- chỉ dùng 32/40px cho phân tách section có chủ đích, không để tạo khoảng trống ngẫu nhiên;
- ghi nhận các giá trị custom bắt buộc như chart min-width, header offset cố định và safe-area padding.

### 2.5 Radius và elevation

| Token | Giá trị | Cách dùng |
|---|---:|---|
| `radius-sm` | 8px | Phần bên trong icon/menu/control nhỏ. |
| `radius-md` | 12px | Input và button. |
| `radius-lg` | 16px | Card và feature section. |
| `radius-xl` | 24px | Auth surface và dialog. |
| `radius-full` | 999px | Chip, pill và badge. |

| Elevation | Cách dùng |
|---|---|
| `shadow-card` | Nhóm card/field cơ bản. |
| `shadow-interactive` | Card hover/selected. |
| `shadow-overlay` | Popover, dialog và mobile drawer. |

Tránh tạo radius và shadow mới cho từng feature. Khác biệt thị giác giữa card, editor và status panel nên chủ yếu đến từ hierarchy và spacing.

### 2.6 Hệ thống icon

- Tiếp tục chỉ dùng Lucide.
- Icon inline: 16px.
- Action/icon tiêu chuẩn: 18–20px.
- Icon của feature/card: 20–24px.
- Mọi icon-only action dùng wrapper 44×44px ở kích thước touch và accessible name theo locale.
- Icon phá hủy chỉ dùng title như phần bổ sung; accessible name mới là contract chính.
- Không dùng icon để truyền tải trạng thái tài chính nếu không có text hiển thị hoặc tương đương accessible.
- Tạo primitive `IconButton` nhỏ để label, tooltip/title, disabled state và focus behavior nhất quán.

## 3. Tiêu chuẩn component

Chỉ giới thiệu các primitive dưới đây khi từ hai màn hình trở lên đã dùng cùng một pattern.

| Primitive | Tiêu chuẩn | Consumer ban đầu |
|---|---|---|
| `Button` | `primary`, `secondary`, `danger`, `ghost`, `icon`; mặc định 44px; loại lớn 48px; loading giữ nguyên chiều rộng; label đã bản địa hóa | Tất cả form, list toolbar, data tools, recurring/assets. |
| `IconButton` | Wrapper 44px, icon theo role size, `aria-label`, tooltip tùy chọn, focus rõ, disabled state | Header, row, catalog, asset, notification. |
| `Field` | `<label>` thật, `id` rõ, slot helper/error, `aria-invalid`, `aria-describedby`, text required | Transaction, auth, budget, catalog, settings. |
| `Select` | Cùng geometry và semantics label với field; copy option rỗng đã bản địa hóa | Mọi native select và bulk editor. |
| `Card` | Variant base/interactive/status; radius 16px; padding nhất quán | Dashboard, budget, asset, data, member. |
| `PageHeader` | Kicker, title, subtitle, action slot, alignment responsive | Mọi routed page. |
| `SectionHeader` | Heading, text hỗ trợ, action trailing tùy chọn | Section Dashboard, list và card. |
| `Dialog` | `role=dialog`/`alertdialog`, `aria-modal`, title có label, description được liên kết, focus vào/trap/restore, Escape, sizing theo `dvh` | Confirm dùng chung, bulk edit, editor sau này. |
| `Popover` | Trigger có `aria-expanded/controls`, focus policy, đóng khi click ngoài/Escape, placement/safe width | Budget notification, action menu. |
| `Tabs` | Role dùng chung, selected state, roving tabindex, Arrow/Home/End, liên kết panel | Settings, Catalogs. |
| `StatusMessage` | `info`, `success`, `warning`, `error`; chọn politeness alert/status có chủ đích | Auth, mutation, import, query error. |
| `EmptyState` | Icon, title, giải thích một câu, primary action tùy chọn | Đã có shared; mở rộng spacing chuẩn. |
| `LoadingState` | Skeleton page/list có label và reduced motion | Đã có shared; bổ sung cặp error/retry. |
| `DataTable` / `ResponsiveDataList` | Region/label rõ, table alternative, mobile card contract, overflow hint | Transaction, import preview, chart alternative. |
| `Amount` | Variant full/compact, semantics tiền tệ, full value accessible tùy chọn | Dashboard, transaction, asset, budget. |
| `FilterDisclosure` | Tóm tắt số lượng, expanded state rõ, policy apply/reset và layout mobile | Transaction và filter mặc định. |

Không chuyển mọi element cục bộ thành generic component. Mục tiêu là tập trung các hành vi mà người dùng không nên phải học lại.

## 4. Chiến lược responsive

### Hợp đồng breakpoint

Xác minh toàn bộ flow quan trọng ở 320, 375, 390, 430, 768, 1024, 1280 và 1440px. Dùng 375px làm viewport regression iPhone mặc định và 1280/1440px cho desktop snapshot.

### Mobile

- Giữ bottom nav và drawer, nhưng làm “Thêm” có active state trực quan khi route hiện tại thuộc nhóm phụ.
- Giữ FAB cách bottom nav và safe-area inset; bảo đảm sticky bulk/filter bar không che nội dung đang focus.
- Giao dịch: hiển thị search, filter thường dùng và tóm tắt kết quả trước; đưa loại trừ catalog, khoảng tiền và control nâng cao vào disclosure hoặc sheet có chủ đích.
- Ưu tiên card mobile cho giao dịch và tài sản. Chỉ cho scroll ngang với dữ liệu thực sự dạng bảng, đồng thời có region được label và hint nhìn thấy.
- Dialog dùng `max-height: calc(100dvh - safe offsets)` và scroll bên trong nhưng không làm mất heading/action.
- Label tiếng Việt dài được wrap; không truncation mạnh với action label. Dùng menu khi nhóm action không thể vừa.
- Giữ text input từ 16px trở lên để tránh browser mobile tự zoom.

### Tablet và desktop

- Coi 768–1023px là một khoảng layout thực, không đơn giản là “desktop table mode”. Kiểm tra min-width của table và card chart ở khoảng này.
- Giữ max-width dễ đọc cho form và card nội dung; không kéo form 400px ra toàn trang.
- Chỉ dùng sidebar ở breakpoint hiện tại khi content còn lại đủ rộng.
- Không để legend chart và nhóm action ép min-width gây overflow ngang ẩn.

### Theme và locale

- Test mọi responsive fixture ở light/dark và tiếng Việt/Anh.
- Thêm fixture label dài cho `Chi phí định kỳ`, `Phương thức thanh toán`, `Khôi phục mặc định hệ thống` và tên gia đình/thành viên dài.
- Quyết định `system` có phải preference thứ ba thật hay không. Nếu có, triển khai; nếu không, xóa translation chưa dùng và mô tả rõ hành vi theo OS.

## 5. Cải thiện accessibility

Ưu tiên công việc accessibility theo rủi ro người dùng:

1. Làm cho mọi dialog/popover tùy biến dùng cùng quy tắc focus-in, focus-trap, Escape, restore-focus, `aria-modal`, title và description.
2. Đưa focus lỗi tới control đang nhìn thấy; nếu control lỗi nằm trong disclosure đóng, mở nó trước khi focus hoặc focus disclosure kèm thông báo rõ ràng.
3. Dùng `role=alert` hoặc error region assertive cho lỗi chặn/auth/form; dành `role=status`/polite cho progress và cập nhật nền thành công.
4. Đưa count cần chú ý vào accessible name của control tương tác, không chỉ đặt trên badge trang trí.
5. Thay listbox semantics không đầy đủ bằng checkbox group native trong disclosure có label hoặc triển khai đầy đủ pattern listbox.
6. Thêm hành vi Arrow/Home/End cho tab Catalog bằng cách tái sử dụng contract tab của Settings.
7. Thêm text summary/table alternative hạng nhất cho mọi chart; bảo đảm dữ liệu trend dùng được mà không cần hover bằng pointer.
8. Mở rộng vùng click checkbox và label region overflow của transaction table.
9. Bản địa hóa mọi accessible name và title từ translation key dùng chung.
10. Chạy contrast check cho mọi semantic pair light/dark và thêm axe/keyboard check tự động cho shared primitive.

## 6. Roadmap P0/P1/P2/P3

### P0 — Sửa ngay

**Số lượng: 0.** Audit không thấy core flow bị hỏng ở mức P0, mutation tài chính phá hủy không xác nhận hoặc lỗi data boundary. Cần đánh giá lại nếu visual testing có auth phát hiện blocker.

### P1 — Tác động cao

**Số lượng: 8.**

| ID | Khu vực | Vấn đề | Đề xuất | Màn hình ảnh hưởng | Component/file | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P1-01 | Dialog/popover | Notification và bulk-edit surface chưa dùng chung focus contract an toàn. | Mở rộng shared dialog/popover primitive với `aria-modal`, liên kết description, focus-in/trap/restore, Escape và sizing an toàn theo viewport; migrate cả hai surface. | Giao dịch, Dashboard/header, mọi confirm phá hủy | `Feedback.tsx`, `BudgetNotifications.tsx`, `Transactions.tsx`, primitive `Dialog`/`Popover` mới | M | Medium |
| P1-02 | Form/error | Auth error là status message polite; validation giao dịch có thể trỏ tới field nâng cao đang ẩn. | Tạo contract chung cho error summary/message; mở Advanced trước khi focus field ẩn; đồng bộ Login/Reset/CreateFamily/TransactionForm. | Login, reset, tạo gia đình, giao dịch mới/sửa | `Login.tsx`, `ResetPassword.tsx`, `CreateFamily.tsx`, `TransactionForm.tsx`, `Field` | M | Medium |
| P1-03 | Information architecture | Settings có bản embedded và deep-link ẩn; copy onboarding trỏ sai đích. | Chọn `/cai-dat` làm canonical, để deep link kích hoạt tab filter hoặc redirect, thêm context/back link và sửa copy tên gia đình. | Settings, filter mặc định, tạo gia đình, thành viên | `Settings.tsx`, `TransactionFilterSettings.tsx`, `CreateFamily.tsx`, `App.tsx`, `docs/PROJECT_MAP.md` | S | Low |
| P1-04 | Giao dịch mobile | Flow filter và bulk-edit được dùng nhiều nhất quá dày; selection bar cạnh tranh với UI sticky/fixed. | Tách filter thường dùng và nâng cao, hiển thị tóm tắt kết quả, cải thiện apply/reset trên mobile và đưa bulk edit về sheet/dialog dùng chung. | Giao dịch, filter mặc định | `Transactions.tsx`, `MultiSelectField.tsx`, `TransactionRow.tsx`, `index.css` | L | Medium |
| P1-05 | Token/contrast | Palette utility raw và màu riêng theo feature làm yếu tính nhất quán light/dark. | Thiết lập semantic token đã đo, migrate trước các surface status/card/action dễ thấy và thêm contrast check trước khi đổi giá trị. | Dashboard, ngân sách, tài sản, danh mục, định kỳ, giao dịch, dữ liệu | `index.css` và các feature page | L | Medium |
| P1-06 | Localization | Accessible name và action dùng thường xuyên/shared chưa song ngữ đầy đủ. | Thêm translation key cho feedback, row action, status/CTA phổ biến và accessible name; bỏ literal inline trước ở shared component. | Login, giao dịch, header, toast, mọi shared action | `LanguageContext.tsx`, `Feedback.tsx`, `TransactionRow.tsx`, `Login.tsx`, các page | M | Low |
| P1-07 | Accessibility của chart | Tương tác chart và text alternative chưa nhất quán. | Tạo chart summary/table wrapper dùng lại; làm trend value đọc được bằng bàn phím và đưa “Xem dữ liệu” thành action rõ ràng. | Dashboard | `Dashboard.tsx`, chart utility/component, test | M | Medium |
| P1-08 | Tính rõ ràng tài chính | Format số tiền và ngôn ngữ action chính/phụ khác nhau giữa các surface. | Định nghĩa quy tắc amount compact cho overview/full cho quyết định; thêm accessible title full value và làm rõ action như tạo giao dịch định kỳ thủ công. | Dashboard, giao dịch, tài sản, ngân sách, định kỳ, dữ liệu | `Dashboard.tsx`, `TransactionRow.tsx`, `Assets.tsx`, `Budgets.tsx`, `RecurringExpenses.tsx`, `ImportExport.tsx` | M | Medium |

### P2 — Tác động trung bình

**Số lượng: 10.**

| ID | Khu vực | Vấn đề | Đề xuất | Màn hình ảnh hưởng | Component/file | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P2-01 | Shared primitive | Button, field, card, tab, header và status banner đang được dựng lại cục bộ. | Tạo một lớp primitive nhỏ theo tiêu chuẩn trên; migrate từng hai consumer một. | Tất cả màn hình | `src/components/ui/` mới và các page hiện có | L | Medium |
| P2-02 | Responsive QA | Shell responsive nhưng breakpoint feature/overflow table chưa được xác minh trong một matrix thống nhất. | Thêm viewport fixture và sửa regression 320–430, 768–1024, 1280–1440 được snapshot phát hiện. | Tất cả màn hình, nhất là giao dịch/tài sản/Dashboard | `index.css`, `Layout.tsx`, class/CSS của page, Playwright | L | Medium |
| P2-03 | Preference theme | “System” có translation nhưng không phải setting có thể chọn; auth screen cũng chưa có control theme/language. | Triển khai option system thật hoặc bỏ nó; quyết định auth shell có control theme/language gọn hay không. | Auth, header, settings | `ThemeContext.tsx`, `ThemeSelect.tsx`, `LanguageContext.tsx`, `AuthShell.tsx` | M | Low |
| P2-04 | Import flow | Import an toàn nhưng nhìn như một tập card thay vì task theo từng bước. | Thêm heading chọn/kiểm tra/xem lại/xác nhận, hiển thị preview bị giới hạn 100 dòng và giải thích email export bị disable. | Trung tâm dữ liệu | `ImportExport.tsx`, `AsyncStates.tsx` | M | Low |
| P2-05 | Asset IA | Tiết kiệm và vàng là domain giàu chức năng trên một page dài với nhiều action phụ. | Nhóm theo domain với điều hướng section rõ và hierarchy primary-action; ban đầu giữ inline editor hiện tại. | Tài sản, asset snapshot của Dashboard | `Assets.tsx`, `Dashboard.tsx` | M | Medium |
| P2-06 | Độ rõ của định kỳ | Tạo nền tự động và tạo thủ công nằm cạnh nhau nhưng khái niệm khác nhau. | Đổi label/helper thành “Kiểm tra và tạo giao dịch đến hạn” hoặc tương đương, giải thích idempotence và hiển thị trạng thái tạo lần cuối. | Định kỳ, notification, due list Dashboard | `RecurringExpenses.tsx`, shared status copy | M | Low |
| P2-07 | Mật độ Dashboard | Quá nhiều module có độ nổi bật ngang nhau làm kéo dài việc scan trên mobile. | Giữ ưu tiên KPI/ngân sách/tài sản, mặc định thu gọn breakdown ít dùng và hạ AI summary thành nội dung phụ. | Dashboard | `Dashboard.tsx`, `index.css` | M | Medium |
| P2-08 | Visual token | Vai trò typography, spacing, radius và elevation còn ngầm định. | Thêm role class/token và thay các giá trị local lặp lại trong các feature edit bình thường; không rewrite mù toàn bộ. | Tất cả màn hình | `index.css`, class của page | M | Medium |
| P2-09 | Tương tác danh mục | Icon picker và tab danh mục có keyboard semantics cục bộ. | Dùng shared Tabs và grid checkbox/button có label hoặc triển khai đầy đủ listbox pattern. | Danh mục, settings | `Catalogs.tsx`, primitive `Tabs`/`IconPicker` mới | M | Medium |
| P2-10 | Hiệu năng tải | Chunk ExcelJS/XLSX/chart vẫn lớn trên đường tải PWA mobile. | Profile route loading; giữ thư viện import tách riêng, cân nhắc worker/route-triggered loading và review chart chunk nhưng không giảm chức năng. | Dữ liệu, Dashboard | `ImportExport.tsx`, Vite config, chart import | M | Medium |

### P3 — Polish

**Số lượng: 5.**

| ID | Khu vực | Vấn đề | Đề xuất | Màn hình ảnh hưởng | Component/file | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P3-01 | Motion | Transition là sự pha trộn giữa button scale toàn cục, class enter/exit cục bộ và animation theo feature. | Ghi nhận motion role, bảo đảm motion không thiết yếu tôn trọng reduced-motion và dùng một scale timing enter/exit. | Mọi surface tương tác | `index.css`, dialog, toast, editor | S | Low |
| P3-02 | Icon polish | Kích thước icon/title/tooltip khác nhau trong các nhóm action tương đương. | Áp dụng icon role scale và chỉ thêm tooltip/title khi icon không tự rõ; giữ accessible name đã bản địa hóa. | Header, row, asset, catalog, định kỳ | `IconButton`, `TransactionRow.tsx`, các feature page | S | Low |
| P3-03 | State polish | Empty/loading/error state chỉ shared ở một số nơi, nơi khác tự dựng. | Mở rộng `AsyncStates` với variant retry/error dùng chung và đồng bộ copy, spacing, xử lý icon. | Mọi data page | `AsyncStates.tsx`, state của page | M | Low |
| P3-04 | Regression tooling | Test hiện tại cover behavior nhưng chưa có visual/accessibility matrix lặp lại. | Thêm authenticated fixture, Playwright screenshot checkpoint cho width/theme/locale chính và axe/keyboard check cho primitive. | Shell, Dashboard, giao dịch, form | `tests/e2e`, `playwright.config.ts`, helper a11y mới | M | Low |
| P3-05 | Tài liệu | README và project map chưa hoàn toàn khớp theme/route hiện tại. | Cập nhật tài liệu ổn định sau khi runtime decision hoàn tất; giữ audit/handoff làm record quyết định trong thời gian đó. | Tài liệu project | `README.md`, `docs/PROJECT_MAP.md`, `HANDOFF.md` | S | Low |

## 7. Batch quick win

Các thay đổi hiển thị an toàn nhất để làm trước:

1. Bản địa hóa label close/copy/delete/action dùng chung.
2. Sửa copy tên gia đình trong onboarding.
3. Để deep link Settings kích hoạt đúng tab.
4. Đưa notification count vào button name và thêm `aria-modal`/focus-in behavior.
5. Thêm Escape/focus restore cho bulk edit.
6. Đặt quy ước format amount rõ ràng và accessible title cho full value.
7. Thêm affordance summary “Xem dữ liệu” cho chart.
8. Thêm dòng lý do email export bị disable và ghi chú “đang hiển thị 100 dòng đầu” cho preview import lớn.

Các thay đổi này đủ nhỏ để merge trước refactor primitive diện rộng và mỗi thay đổi nên có regression test tập trung.

## 8. Trình tự triển khai an toàn nhất

```text
Fixture và số đo baseline
        ↓
Contract semantic token/contrast
        ↓
Primitive dialog, popover, button, field và status
        ↓
Dọn route/IA Settings và localization
        ↓
Kiểm tra layout/navigation và surface cố định trên mobile
        ↓
Flow giao dịch/filter/bulk-edit
        ↓
Chart Dashboard và quy ước amount
        ↓
Tài sản, định kỳ, danh mục và trung tâm dữ liệu
        ↓
Responsive matrix và accessibility pass
        ↓
Motion, icon và visual polish
```

Quy tắc triển khai:

- Không thay đổi database, business rule, family scoping hoặc AI confirmation model trong công việc UI.
- Giữ mỗi primitive migration nhỏ và test cả tiếng Việt lẫn tiếng Anh trước khi chuyển sang consumer tiếp theo.
- Giữ contract touch target tối thiểu 44px hiện tại, trừ ngoại lệ desktop compact có chủ đích và được ghi nhận.
- Không bao giờ che giấu cloud mutation thất bại bằng optimistic UI.
- Thêm regression test trước khi thay đổi interaction contract dùng chung.
- Chỉ cập nhật `HANDOFF.md`/`CHANGELOG.md` trong release/status workflow của project; không để feature song song tạo xung đột tài liệu canonical.

## 9. Chiến lược regression và xác minh

### Kiểm tra tự động cho từng batch

- `pnpm test` / Vitest trực tiếp tương đương hiện tại cho behavior của page và primitive;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build` và review chunk warning;
- `git diff --check`;
- Playwright authenticated fixture cho flow cốt lõi khi có test credential;
- axe/keyboard check cho dialog, popover, tab, field và table primitive mới.

### Matrix thủ công/snapshot

Với mỗi thay đổi shared component, xác minh:

- width 320, 375, 390, 430, 768, 1024, 1280 và 1440px;
- theme light và dark;
- tiếng Việt và tiếng Anh;
- flow chỉ dùng bàn phím: skip link, navigation, focus rõ, Escape, Tab wrapping, submit/error recovery;
- preference reduced-motion;
- label gia đình/thành viên/danh mục dài và giá trị VND/vàng dài;
- loading, empty, query-error, offline và mutation-error state;
- confirm phá hủy, cancel, retry và focus restoration;
- surface cố định trên mobile: header, bottom nav, FAB, sticky bulk/filter bar và dialog;
- chart keyboard/text alternative và table overflow;
- ý nghĩa trạng thái thực tế/dự kiến/thu nhập/chi tiêu/ngân sách không phụ thuộc màu.

### End-to-end flow có giá trị cao

1. Đăng nhập → tạo gia đình → Dashboard.
2. Dashboard → drill down → lọc giao dịch.
3. Giao dịch → thêm → validation error → sửa → confirm/save.
4. Giao dịch → filter mobile → chọn nhiều → bulk edit → đóng/hủy/xác nhận.
5. Dashboard → cảnh báo ngân sách → notification → xác nhận giao dịch dự kiến.
6. Tiết kiệm/vàng → tạo/sửa/tất toán/bán → refresh giao dịch liên kết.
7. Định kỳ → tạo → tạm dừng/tiếp tục/bỏ qua → kiểm tra tạo đến hạn → lịch sử.
8. Danh mục → thêm/sửa/xóa/keyboard flow của icon picker.
9. Thành viên → mời/đổi tên/xóa → xác nhận sửa/xóa tên gia đình.
10. Dữ liệu → tải template → kiểm tra preview → xem lại trùng → xác nhận import.
11. Settings → chuyển tab → lưu/reset mặc định → mở route filter trực tiếp.
12. Đăng xuất và protected-route redirect có return location.

## 10. File/component dự kiến thay đổi

Bản audit chỉ thêm plan, audit report và tóm tắt handoff. Implementation trong tương lai dự kiến chạm đến các file sau theo từng giai đoạn:

| Giai đoạn | File/component dự kiến | Phạm vi |
|---|---|---|
| Foundation | `src/index.css`, `src/context/ThemeContext.tsx`, `src/context/LanguageContext.tsx` | Semantic token, role typography/spacing, quyết định theme preference, translation key. |
| Primitive | `src/components/ui/*` mới, `src/components/AsyncStates.tsx`, `src/components/Feedback.tsx` | Contract Button/IconButton, Field, Dialog, Popover, Tabs, Status, Amount và table. |
| Shell | `src/components/Layout.tsx`, `src/components/ThemeSelect.tsx`, `src/components/BudgetNotifications.tsx` | Active state navigation, header control, popover semantics và safe-area/focus check. |
| Auth/form | `src/components/AuthShell.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/CreateFamily.tsx`, `src/pages/TransactionForm.tsx` | Error announcement, hoàn thiện copy/locale, visible focus và field dùng chung. |
| Core finance | `src/pages/Transactions.tsx`, `src/components/TransactionRow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Budgets.tsx` | Flow filter/bulk mobile, chart alternative, quy ước amount, migrate token. |
| Feature phụ | `src/pages/Assets.tsx`, `src/pages/RecurringExpenses.tsx`, `src/pages/Catalogs.tsx`, `src/pages/Members.tsx`, `src/pages/ImportExport.tsx` | Hierarchy action, icon picker/tab, copy tạo định kỳ, nhóm asset và bước import. |
| Route/docs/test | `src/App.tsx`, `docs/PROJECT_MAP.md`, `README.md`, `tests/e2e/*`, `playwright.config.ts` | Route canonical của Settings, visual/auth fixture, đồng bộ tài liệu. |

Không đề xuất thêm UI framework. Không có thay đổi database, RLS/RPC, Edge Function, AI provider hoặc business rule trong kế hoạch này.
