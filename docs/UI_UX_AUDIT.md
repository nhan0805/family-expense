# Family Finance — UI/UX Audit

> Audit date: **18/09/2026** (`Asia/Ho_Chi_Minh`)
> Scope: source review of the complete frontend UI, shared styles/components, route tree, page tests and current working-tree behavior. No application runtime or business logic was changed for this audit.

## 1. Executive summary

Family Finance already has a credible product foundation: a mobile-first shell, a deliberate light/dark token layer, Lucide icons, 44px interaction targets for most primary controls, responsive transaction cards, explicit loading/error/empty states, confirmation before destructive financial actions, and a strong RTL-free Vietnamese-first content model. The recent UI synchronization work is visible across authentication, transactions, assets, budgets, catalogs, members, recurring expenses and data tools.

The main opportunity is refinement and consolidation, not a visual rebrand. The application feels like one product at the layout level, but not yet like one fully systematized product at the interaction level. The highest-impact gaps are:

- custom dialog/popover behavior is not consistently keyboard-safe;
- the transaction filter and bulk-edit workflow is still dense on mobile;
- settings have both an embedded surface and a hidden deep-link surface;
- semantic tokens coexist with many one-off Tailwind colors and local component rules;
- bilingual coverage and accessible labels are incomplete in shared/high-frequency controls;
- chart alternatives and some selection controls need more explicit keyboard/screen-reader behavior;
- the design system is expressed mostly through CSS convention rather than reusable primitives.

There are no P0 findings. I found no evidence in this UI audit of a destructive financial action that bypasses confirmation, automatic AI saving, or a missing family boundary. The P1 findings are nevertheless important because they affect keyboard users, mobile repeat use, and confidence in high-risk financial actions.

### Audit counts

| Measure | Count | Counting rule |
|---|---:|---|
| Registered route patterns audited | **15** | Three auth routes plus twelve routes under `Layout` (including the index route). |
| Unique page modules audited | **15** | Every file in `src/pages/` that is rendered by the route tree. |
| Operational screen states | **16** | Counts new and edit transaction as separate states; login has four modes inside one module. |
| Shared UI modules inspected | **8** | Every module in `src/components/`. |
| Shared exported UI/provider pieces inspected | **12** | Includes skeleton/empty-state exports and feedback/layout providers where applicable. |
| Cross-screen consistency issues | **15** | Findings C1–C15 below. |
| UX issues | **15** | Findings U1–U15 below. |
| Accessibility issues | **14** | Findings A1–A14 below. |
| P0 roadmap items | **0** | No immediate data-loss or unusable-core-flow issue found. |
| P1 roadmap items | **8** | High-impact usability, accessibility and system issues. |
| P2 roadmap items | **10** | Medium-impact consolidation and responsive work. |
| P3 roadmap items | **5** | Polish, regression tooling and documentation alignment. |

The three issue counts are intentionally separate: one underlying implementation gap may affect consistency, UX and accessibility at the same time. Priority counts refer to the implementation roadmap, not a sum of those three issue lists.

## 2. Scope, method and evidence

### What was inspected

- `AGENTS.md`, `README.md`, `HANDOFF.md`, the latest `CHANGELOG.md` entry and `docs/PROJECT_MAP.md`.
- `package.json`, Vite/Tailwind setup, `src/main.tsx`, `src/App.tsx`, `src/index.css` and the theme/language contexts.
- All 15 routed page modules and their page-level tests.
- All 8 modules under `src/components/`.
- Conditional UI: mobile drawer, bottom navigation, budget notification popover, confirmation dialog, toasts, filter disclosure, multiselect, chart/table alternatives, inline editors and import preview.
- Current test and build evidence: TypeScript, ESLint, 48 Vitest files / 233 tests, and Vite build.
- The installed `ui-ux-pro-max` guidance and relevant searches for focus/error-summary patterns, mobile filter drawers, chart alternatives, color semantics and React list performance.

### Live validation boundary

The local Vite build was launched without changing source or environment files. The browser was authenticated against the configured Supabase environment, so protected routes correctly redirected to `/dang-nhap`. I visually checked the rendered authentication screen at 1280×720 and found no browser console warnings. I did not use credentials, submit auth forms, mutate family data or bypass authentication.

Therefore, the authenticated-screen conclusions are source- and test-backed, with responsive behavior additionally checked against the CSS breakpoints, mobile-first markup, existing UI tests and the current handoff. A follow-up implementation pass should add authenticated visual QA at 320, 375, 390, 430, 768, 1024, 1280 and 1440px.

## 3. Application UI architecture

### Verified stack

| Concern | Current implementation | Audit implication |
|---|---|---|
| Framework | React 19 + TypeScript strict + Vite | Component extraction can stay within the existing stack. |
| Routing | React Router route tree in `src/App.tsx` | Auth routes and `Layout` routes have different shells. |
| Styling | Tailwind CSS v4 plus 1,446-line `src/index.css` | Tokens exist, but local utility classes still create drift. |
| Icons | `lucide-react` | A coherent icon family is already available. |
| Server state | TanStack Query | Loading/error/retry states are screen-specific and can be standardized. |
| Forms | React Hook Form/Zod for transactions; local controlled forms elsewhere | Form-field semantics are split between local implementations. |
| Charts | Recharts | Data alternatives and keyboard semantics need a common chart wrapper. |
| Localization | `LanguageContext` (`vi`/`en`) plus inline ternaries | High-frequency shared strings are not fully centralized. |
| Theme | `ThemeContext`, `.dark` class, CSS variables | Light and dark values are explicit; there is no user-selectable system option. |
| Responsive strategy | Mobile-first Tailwind, fixed mobile drawer/bottom nav, desktop sidebar | The shell adapts well; dense feature screens need separate mobile information architecture. |
| Feedback | Shared `FeedbackProvider` for toasts/confirmation; local inline feedback elsewhere | Confirmation is centralized; modal/popover semantics are not. |
| Offline/demo | Demo fallback when Supabase is absent; no offline mutation queue | UI must distinguish “local/demo” and “saved” states clearly. |

### Shell and state flow

`src/main.tsx` composes theme, language, feedback, query and router providers. `AppProvider` owns the authenticated family bootstrap and demo fallback. `App.tsx` lazy-loads every page and places authenticated routes under `Layout`.

`Layout` provides:

- sticky header with family identity, member link, notifications, theme/language and logout;
- desktop sidebar;
- mobile fixed drawer with focus trap and Escape handling;
- five-item mobile bottom navigation with a “More” entry;
- skip link, main-content focus on route changes and safe-area padding;
- a mobile floating add-transaction action.

This is a strong structural base. The next layer should make page-level dialogs, form fields, tabs, tables and status messages use the same interaction contracts as the shell.

### Shared UI modules inspected

| Module | Responsibility | Strengths | Main follow-up |
|---|---|---|---|
| `AsyncStates.tsx` | Skeleton, page loading, transaction loading, empty state | Consistent semantic status containers and reduced-motion skeletons | Add a shared error/retry state and standardize copy/layout. |
| `AuthShell.tsx` | Auth/onboarding card shell | Reused by reset/create-family and aligned with the auth visual language | Add optional theme/language controls and shared message slot. |
| `BudgetNotifications.tsx` | Header notification popover and due-transaction actions | Family-scoped data, confirmation before planned-to-actual mutation | Add dialog/popover focus semantics and count in accessible name. |
| `Feedback.tsx` | Toasts and confirmation dialog | Central confirmation, Escape, focus-in, focus trap and focus restore | Add description linkage, locale-safe labels and a reusable modal contract. |
| `Layout.tsx` | Navigation and authenticated shell | Good mobile drawer focus handling and safe-area treatment | Standardize active state for “More” and expose route IA consistently. |
| `MultiSelectField.tsx` | Filter/catalog multiselect | Wrapped options and large checkbox rows | Use a real label/control relationship and explicit disclosure/list semantics. |
| `ThemeSelect.tsx` | Theme and language switches | Compact 44px controls, persisted preferences | Reconcile the unused “System” translation with an actual preference or remove it. |
| `TransactionRow.tsx` | Responsive mobile card/desktop row | Good mobile action menu, 44px actions and row memoization | Localize all accessible names/titles and move repeated row colors to semantic tokens. |

## 4. Screen inventory

There are 15 registered route patterns and 15 unique page modules. The table treats authentication modes and inline editors as conditional surfaces rather than inventing routes that do not exist.

| # | Route | Screen/state | Feature | Layout | Main components | Responsive behavior | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | `/dang-nhap` | Login, create account, magic link, forgot password | Authentication | Standalone auth split layout | Inline auth form, password toggle, feature cards | Hero hides below `lg`; form remains centered/card-based | Four modes share one route/component. |
| 2 | `/dat-lai-mat-khau` | Reset password | Authentication | `AuthShell` | Password fields, session check, status message | Single-column card | Link/session errors are polite status messages. |
| 3 | `/tao-gia-dinh` | Create family/onboarding | Onboarding | Wide `AuthShell` with form + benefits aside | Family form, benefits list, logout | Two columns at `lg`, stacked below | Copy says family name can be changed in Settings; actual control is Members. |
| 4 | `/` | Dashboard | Overview, budgets, assets, charts, AI summary | `Layout` | KPI cards, snapshots, Recharts, details/table alternatives | Multi-column desktop, stacked cards/mobile | High information density; chart alternatives are conditional. |
| 5 | `/giao-dich` | Transactions ledger | Search, filters, bulk actions, trash | `Layout` | Toolbar, chips, multiselects, `TransactionRow`, bulk dialog | Mobile cards; desktop min-width table with overflow | Most complex recurring-use screen. |
| 6 | `/giao-dich/moi` | New transaction | Entry, AI suggestion, draft | `Layout` | RHF/Zod form, error summary, AI/speech, confirmation | Single column mobile; 3-column grouping at desktop | Strong validation and draft recovery. |
| 7 | `/giao-dich/:id` | Edit/copy transaction | Entry/edit | `Layout` | Same `TransactionForm` with edit/delete state | Same as new transaction | Operationally distinct from create even though it shares a component. |
| 8 | `/tai-san` | Savings and gold ledger | Assets | `Layout` | Savings/gold summaries, inline editors, history, sale/settlement forms | Mobile cards and stacked action groups | Two financial domains share one long screen. |
| 9 | `/ngan-sach` | Budgets | Monthly limits and progress | `Layout` | Period controls, summary cards, budget rows, inline editor | 2-column summary on mobile; row editor | Strong actual-only explanation and destructive confirmation. |
| 10 | `/chi-phi-dinh-ky` | Recurring expenses | Templates, due generation, history, trash | `Layout` | Toolbar, inline editor, recurring rows, action menu | Stacked cards; action groups adapt | Background job and manual generation need clearer mental model. |
| 11 | `/danh-muc` | Catalogs | Purposes, categories, payment methods, icons | `Layout` | Tabs, inline editor, icon picker, empty states | Cards/stacked editor; icon grid reflows | Tab and icon picker semantics are locally implemented. |
| 12 | `/thanh-vien` | Family members | Invite, rename, remove, family delete | `Layout` | Invite form, member rows, danger zone, confirmation | Two-column invite at `sm`; list rows stack | Family-name editing lives here, not Settings. |
| 13 | `/du-lieu` | Data center | Template, import, export, owner email | `Layout` | Data cards, upload/drop zone, preview table, stats | Cards stack; preview scrolls horizontally | Safe confirm-before-import model is good. |
| 14 | `/cai-dat` | Settings tabs | Default filters and automatic transaction defaults | `Layout` | Roving-ish tabs, embedded filter settings, automation settings | Tab strip wraps/scrolls according to CSS | Main settings surface embeds another page module. |
| 15 | `/cai-dat/giao-dich` | Default transaction filters deep link | Personal preferences | `Layout` | Same `TransactionFilterSettings` without embedded mode | Long form/cards | Hidden from sidebar but still a public deep link. |

### Conditional surfaces audited

- Desktop sidebar and mobile drawer, including focus restore, Escape and Tab wrapping.
- Mobile bottom nav and floating add-transaction action.
- Budget notification popover, unread/due badge, mark-read/delete-read actions and planned-transaction confirmation.
- Shared toast stack and destructive/non-destructive confirmation dialog.
- Transaction filter disclosure, filter chips, catalog multiselect and bulk edit dialog.
- Dashboard chart legends, drill-down links, chart data-table alternatives and collapsible asset lists.
- Inline editors for catalogs, budgets, savings, gold, recurring expenses and family/member names.
- Import upload/drop zone, file-status feedback, duplicate checkbox, horizontally scrollable preview and final confirmation.
- Loading skeletons, no-data empty states, network/query errors, field errors, draft restoration and retry controls.

## 5. Current design system

### Typography

The application uses `Inter, ui-sans-serif, system-ui, sans-serif` in `src/index.css`. The base system is legible and appropriate for Vietnamese financial data. A page-title utility uses `clamp(1.6rem, 3vw, 2.15rem)`, heavy weight and tight tracking. Labels are approximately 12–13px and 700 weight; fields use 16px; common body text is 14–16px.

What is working:

- page kicker/title/subtitle hierarchy is recognizable;
- 16px form text reduces mobile zoom risk;
- numeric values use strong weight and clear VND formatting;
- reduced-motion rules are present.

What needs systemization:

- no named typography roles exist beyond local utilities;
- visually equivalent buttons and toolbars use 14px, 15px, 16px and 18px variants;
- navigation labels can fall to 10px on the bottom nav, which is fragile for long Vietnamese labels;
- helper/error text is variously `text-xs`, `text-sm`, `text-gray-*` and semantic muted tokens;
- `font-extrabold`, `font-black`, `font-bold` and numeric weights are mixed without a documented role map.

### Color system

The token layer is a meaningful strength. Light mode defines app background, surface, muted surface, border, text, primary, success, warning, danger, info, accent, focus and chart values. Dark mode defines a Dracula-like navy/purple surface system with explicit semantic values.

The main risk is token leakage. A repository search found approximately 241 raw color utility/hex occurrences in `src/pages`, `src/components` and `src/context`. Many are legitimate local variants, but the count is high enough to make semantic consistency difficult. Examples include raw `rose`, `amber`, `emerald`, `slate`, `gray`, `blue`, `violet` and one-off hex colors in page JSX. The dark FAB also has a special pink/purple gradient rather than using the same brand mapping as other primary actions.

Recommendation: keep the current light navy/blue and dark purple identity, but route state colors and surfaces through semantic variables (`--surface-hover`, `--text-primary`, `--text-secondary`, `--overlay`, chart semantic roles). Use raw palette utilities only inside the token definition layer or a deliberately documented visualization palette.

Contrast has not been instrumentally measured for every token pair in this audit. The dark theme especially needs a contrast matrix for muted text, warning/danger text on soft surfaces, chart axes and focus rings.

### Spacing

The code mostly uses Tailwind's spacing scale and common values such as 8, 12, 16, 20, 24 and 32px. The shell uses clear `p-4`, `sm:p-5`, `md:p-8`, `lg:p-9` progression. Local exceptions such as `mt-32`, `sm:mt-20`, `p-2.5`, `gap-1.5`, `h-[46px]` and mixed editor padding are understandable but undocumented.

Recommended system scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Reserve arbitrary values for chart/layout constraints and document them when they affect reusable UI.

### Border, radius and elevation

`--radius-card: 1rem` and `--shadow-card` provide a clear base. Fields/buttons are approximately 12–13px radius; cards commonly use 16px; mobile auth/onboarding surfaces use 24px or 32px; chips are full radius. This is visually coherent at a glance but locally recreated with `rounded-xl`, `rounded-2xl`, `rounded-3xl` and raw borders.

The recommended hierarchy is:

- `sm`: 8px for compact controls;
- `md`: 12px for fields/buttons;
- `lg`: 16px for cards;
- `xl`: 24px for dialogs/auth surfaces;
- `full`: pills/status chips.

Use three elevation levels only: base card, interactive card, and modal/popover. Avoid adding a new shadow per feature.

### Iconography

Lucide is used consistently and is the right choice. Most inline icons are 16–20px, major card icons are 20–24px, and icon-button wrappers are 44px. Recent asset/dashboard work also corrected several icon alignment issues.

Remaining inconsistencies:

- some icon-only buttons have both localized `aria-label` and `title`, some only one;
- `Feedback` uses a hardcoded Vietnamese close label;
- `TransactionRow` has hardcoded Vietnamese desktop action labels;
- icon-picker options use 20px icons but an 11px check marker and local listbox behavior;
- icon sizes are often declared inline rather than via a role convention.

### Component sizing

The global `.field`, `.btn-primary`, `.btn-secondary` and `.icon-button` base is good: approximately 44px minimum height and a clear focus outline. Drift appears in local overrides:

- recurring toolbar buttons are 40px;
- AI actions use 46px;
- form actions use 48px;
- many native checkboxes remain 16–20px without a larger label wrapper;
- catalog icon options are 64px tall while unrelated compact options use smaller rows.

The goal should be consistent semantic sizes rather than forcing every control to identical geometry: compact desktop control, default touch control, and large primary action.

## 6. Screen-by-screen audit

Severity labels: **CRITICAL** means a core flow is blocked or unsafe; **HIGH** affects frequent use, assistive technology or financial-action confidence; **MEDIUM** is meaningful but has a workable path; **LOW** is limited friction; **POLISH** is refinement.

### 6.1 Login — `/dang-nhap`

**Purpose:** sign in, create an account, use a magic link or request a password reset.

- **Hierarchy:** the 1280px rendered screen has a clear split: product promise on the left, focused form card on the right. The title, field labels, primary CTA and recovery actions read in a sensible order.
- **Visual system:** the auth surface uses the same blue/neutral light tokens and `Inter` hierarchy as the app. The feature cards add confidence without competing with the form.
- **Flow/feedback:** mode switching clears stale messages and password visibility state. Loading text is explicit. Email/password autocomplete is correct.
- **Responsive:** the hero hides below `lg`, which is appropriate; the form remains usable on a narrow viewport. Auth-specific theme/language controls are absent.
- **Accessibility:** labels, `aria-invalid`, password-toggle names and button semantics are present. Error/status copy uses `role=status`/polite, which is less assertive than an invalid-login announcement should be.
- **Findings:** “Magic link” is hardcoded in English in Vietnamese mode; “Continue”/“Tiếp tục” is generic for login and account creation. **HIGH:** A6/U14. **MEDIUM:** C10.

### 6.2 Reset password — `/dat-lai-mat-khau`

**Purpose:** validate a recovery session and set a new password.

- **Hierarchy and form:** compact `AuthShell`, clear heading, two fields, visibility controls and one primary action.
- **Feedback:** invalid/expired-link and update states are visible and the invalid-session state provides a path back to login.
- **Responsive:** the single-column card is a good mobile fit; 44px field/button conventions are preserved.
- **Accessibility:** fields are label-wrapped, invalid state is exposed and status is live. Errors still use a polite status role rather than an error alert and lack a top-level error summary.
- **Finding:** **MEDIUM:** A6; add consistent error announcement and message styling with Login/CreateFamily.

### 6.3 Create family — `/tao-gia-dinh`

**Purpose:** create the first family workspace after authentication.

- **Hierarchy:** the `1 / 1` progress cue, family-name field and benefits aside make the one-step flow easy to understand.
- **Visual system:** `AuthShell`, semantic tokens, large field, clear primary CTA and safe-area-friendly spacing are strong.
- **Feedback:** errors use `role=alert`, the field is marked invalid and the app does not claim success before the mutation finishes.
- **Responsive:** two-column layout at large screens and stacked layout below `lg`; benefit list stays readable.
- **UX/content:** helper text says the family name can be changed later in Settings, but the actual edit is on Members. **HIGH:** U1.
- **Accessibility:** semantic headings and labelled input are good. The literal `!` error marker is less consistent than the rest of the Lucide icon system but is hidden from assistive tech.

### 6.4 Dashboard — `/`

**Purpose:** give an at-a-glance view of money flow, budgets, assets and notable changes.

- **Hierarchy:** KPI → budget snapshot → assets/recent activity → trend and breakdowns is a coherent information order.
- **Visual system:** semantic chart tokens, KPI tones, compact cards, details disclosures and table alternatives show thoughtful dashboard work.
- **Interaction:** period controls, drill-down links and chart legend controls are useful; error, skeleton and empty states exist.
- **Responsive:** cards stack and chart/table containers use controlled overflow. Long currency values and several charts create a long mobile page.
- **Accessibility:** pie cells receive some keyboard treatment and data tables exist, but the trend chart and overall SVG charts do not expose a consistently navigable, text-first summary. The alternative is often hidden behind a disclosure/button.
- **Readability:** compact VND in KPI cards is efficient but differs from full amounts in transaction/asset surfaces; this convention is not stated.
- **Findings:** **HIGH:** A8/U10. **MEDIUM:** C12/U9.

### 6.5 Transactions — `/giao-dich`

**Purpose:** search, filter, review, edit, bulk-update, trash and restore family transactions.

- **Hierarchy:** the latest filter-order work improves mobile reading: search/direct filters, advanced filters, summary and list are understandable.
- **Visual system:** chips wrap, cards are used on mobile, desktop rows are tabular and row actions have a consistent 44px target.
- **Flow:** debounced search, URL-synced filters, infinite loading, AI search, voice input, trash and empty/error states are strong. Mutations wait for completion before cache/navigation updates.
- **Responsive:** mobile cards avoid table overflow; desktop uses a min-width row with horizontal overflow. Eight multiselects and amount/date controls create a long filter surface on a small screen.
- **Accessibility:** visible labels and many icon names are present. The custom bulk-edit dialog lacks the shared focus/Escape/restore behavior. The header/table select controls are visually 20px and should have a larger pointer wrapper.
- **Findings:** **HIGH:** A3/U4/U5. **MEDIUM:** A10/A14.

### 6.6 New transaction — `/giao-dich/moi`

**Purpose:** create an income/expense with validation, AI suggestions, speech input and local draft recovery.

- **Hierarchy:** putting description before amount follows the user’s mental model; transaction type is prominent and classification is grouped.
- **Form quality:** RHF/Zod, field errors, top error summary, focus-on-invalid, numeric input mode, draft recovery and explicit “confirm and save” are excellent foundations.
- **AI trust:** AI is visually marked, confidence/warnings are shown and suggestions are not saved automatically.
- **Responsive:** single-column fields are mobile-safe; classification becomes a multi-column grid at `md`; action buttons remain large.
- **Accessibility/flow:** when validation points to `transaction-status` while Advanced options are closed, the focus target can be hidden from the user. **HIGH:** A5; mapped to P1-02.
- **Consistency:** local `Field`, AI badges and raw status colors are not shared with other forms. **MEDIUM:** C4/C5/C9.

### 6.7 Edit/copy transaction — `/giao-dich/:id`

**Purpose:** edit, copy or delete an existing transaction.

- **Strengths:** reuses the same validated form, draft protection, confirmation and mutation recovery as create; route change returns to the top for a fresh edit context.
- **Risk control:** deletion is icon-only but has a localized accessible name/title and uses confirmation through the shared flow.
- **Responsive:** same safe field layout as create; long description/category labels wrap.
- **Finding:** the screen is behaviorally distinct from create but visually/route-wise does not state whether the user is editing, copying or viewing detail. **MEDIUM:** C12/U11 (make mode and amount conventions explicit).

### 6.8 Assets — `/tai-san`

**Purpose:** manage savings books and gold holdings, movements, settlement and sales.

- **Hierarchy:** asset summaries, current holdings and inline forms expose important financial values; recent mobile changes improved card grouping and remaining quantity.
- **Visual system:** savings/gold actions use semantic success/warning treatments and familiar Lucide icons. Form sections have explicit headings and close actions.
- **Flow:** linked transaction behavior is explained, settlement/sale forms preview totals and destructive archive/delete actions confirm.
- **Responsive:** cards and action groups stack at mobile widths; this is one of the better mobile-adapted feature areas.
- **Risk/readability:** savings and gold are two different mental models in one long screen, and each has history/edit/close actions. Long VND/quantity values need matrix testing at 320/375px.
- **Finding:** **MEDIUM:** U8; group by domain or provide a lightweight asset sub-navigation without changing business logic.

### 6.9 Budgets — `/ngan-sach`

**Purpose:** set monthly purpose limits and compare actual spending.

- **Hierarchy:** period selector, four summary cards, unbudgeted-spend warning and budget rows form a clear sequence.
- **Feedback:** loading/error/retry/empty states exist; delete and overwrite-copy actions confirm; actual-only scope is stated.
- **Responsive:** summary cards use a 2×2 mobile grid; rows and inline editors stack acceptably.
- **Accessibility:** status labels pair with progress and text, which is good. Some row colors still come from page-local raw palettes rather than shared semantic tokens.
- **Finding:** **MEDIUM:** C1/C2; token migration and consistent progress/status semantics.

### 6.10 Recurring expenses — `/chi-phi-dinh-ky`

**Purpose:** create templates, pause/resume, skip, generate due items, inspect history and restore/delete templates.

- **Hierarchy:** summary cards, due count, editor and active/deleted sections are understandable.
- **Flow:** editor scrolls and focuses the first field; pause/resume/skip/delete/restore have appropriate confirmations; history is on demand.
- **Responsive:** action groups were recently tightened and preserve touch targets; long Vietnamese labels remain a stress case at 320–390px.
- **Mental model:** “Generate due transactions” sits beside an explanation that the daily job generates them automatically. The button should be described as a manual retry/refresh operation so users do not infer duplicate creation.
- **Finding:** **HIGH:** U7 for clarity around automatic versus manual generation; no business-logic change is recommended.

### 6.11 Catalogs — `/danh-muc`

**Purpose:** manage purposes, expense types, payment methods and icon assignments.

- **Hierarchy:** category tabs and compact lists work well; inline editor keeps context.
- **Visual system:** icon picker, budget visibility chip and empty state are coherent with the rest of the app.
- **Responsive:** icon grid reflows from four to six columns; editor fields remain full width.
- **Accessibility:** labels and selected icon names exist. The custom `role=listbox`/`role=option` icon picker behaves like a set of buttons without arrow-key listbox behavior. Tabs also rely on local button behavior instead of a shared keyboard contract.
- **Findings:** **HIGH:** A11/A12. **MEDIUM:** C7/C8.

### 6.12 Family members — `/thanh-vien`

**Purpose:** invite members, rename members/family, remove members and delete the family.

- **Hierarchy:** family identity, invite card, member list and danger zone are clear.
- **Feedback:** loading skeleton, alert message, confirmation and owner/member gating are explicit.
- **Responsive:** invite fields become two columns at `sm`, member actions stack/wrap and family-name edit autofocuses.
- **Risk:** family deletion is appropriately isolated at the bottom and explains retention/destruction. The route also contains the family-name control referenced by the onboarding copy mismatch.
- **Finding:** **LOW/MEDIUM:** U1/C13 copy and information-architecture alignment.

### 6.13 Data center — `/du-lieu`

**Purpose:** download/import/export family transaction data and send an owner-authorized email export.

- **Hierarchy:** template, export, email and import are separated into cards; import clearly says it requires review and confirmation.
- **Flow:** file format/size/row limits, validation result, duplicate handling, preview, row counts and confirm-import state are unusually well covered.
- **Responsive:** cards stack; the preview provides a visible horizontal-swipe hint and a focusable region.
- **Accessibility:** upload input has an accessible label and status/error regions are live. The preview table is readable but only shows the first 100 valid/error rows, which should be explicit in copy when more exist.
- **UX finding:** email export can be disabled by configuration/role without always showing the reason next to the disabled action. **MEDIUM:** U13.

### 6.14 Settings — `/cai-dat`

**Purpose:** manage personal default transaction filters and family automatic-transaction catalog defaults.

- **Hierarchy:** two tabs are a sensible grouping and have `aria-selected`, `aria-controls`, roving tab index and arrow/Home/End handling.
- **Visual system:** settings pages use familiar cards, status banners and save/reset actions.
- **Flow:** defaults show saved/system state, preview the Transactions landing state, guard owner-only automation and confirm reset.
- **IA issue:** one page embeds two separate page-level modules while one of them also has its own route. This makes linking, breadcrumbs and future navigation harder.
- **Finding:** **HIGH:** U2/C13; consolidate as one canonical settings surface or make the deep link redirect to/activate the correct tab.

### 6.15 Default transaction filters deep link — `/cai-dat/giao-dich`

**Purpose:** provide a direct URL for the personal filter preset.

- **Strengths:** the form is structured into main, catalog and amount sections; preview copy explains priority over Dashboard/shared URL filters; save/reset states are explicit.
- **Density:** the catalog exclusion/inclusion controls are powerful but long, especially on mobile. `MultiSelectField` behavior repeats the main filter concerns.
- **Discoverability:** the route is intentionally hidden from the sidebar, but there is no obvious URL-level breadcrumb or active settings-tab state when reached directly.
- **Finding:** **HIGH:** U2/C13; **MEDIUM:** A4/U4.

## 7. Cross-screen consistency findings

These findings compare equivalent patterns rather than judging a single feature in isolation.

| ID | Finding | Evidence / affected surfaces | Severity |
|---|---|---|---|
| C1 | Semantic tokens are not the only color source. | `src/index.css` tokens coexist with ~241 raw color utility/hex occurrences across pages/components. | HIGH |
| C2 | Brand/state mapping differs by theme and feature. | Light primary is navy/blue; dark primary is purple; the dark FAB uses a special pink/purple gradient; Budgets/Catalogs still use local palette classes. | MEDIUM |
| C3 | Typography roles are implicit. | Page titles, nav labels, card headings, helper text and errors use many local size/weight combinations. | MEDIUM |
| C4 | Equivalent actions do not have one size contract. | 40px recurring toolbar, 44px shared buttons/fields, 46px AI action, 48px form actions. | MEDIUM |
| C5 | Form label/control semantics are split. | `Field` in `TransactionForm`, wrapping labels in many pages, and a non-label `<span>` heading in `MultiSelectField`. | HIGH |
| C6 | Card/radius/padding variants are locally recreated. | Base `.card` is 16px, while pages use 12/16/24/32px surfaces and raw borders. | MEDIUM |
| C7 | Modal/popover behavior is duplicated. | Shared confirm dialog, custom bulk-edit dialog, notification popover, native details menus. | HIGH |
| C8 | Tabs are duplicated without a shared contract. | `Settings` has keyboard roving behavior; `Catalogs` has local tabs; each owns styling/semantics. | MEDIUM |
| C9 | Feedback semantics and presentation vary. | `role=alert`, `role=status`, `inline-feedback`, raw banners and toasts are mixed by page. | HIGH |
| C10 | Localization is distributed through inline ternaries. | `LanguageContext` has shared nav translations, but high-frequency action strings remain inline/hardcoded. | HIGH |
| C11 | Icon action labeling is inconsistent. | Some icon buttons have localized label + title, some only one; shared close/row actions contain Vietnamese literals. | MEDIUM |
| C12 | Numeric/display conventions are not declared. | Dashboard KPIs use compact VND while transaction/asset values use full VND; chart/table formats differ. | MEDIUM |
| C13 | Settings and documentation do not describe one route model. | `/cai-dat/giao-dich` is hidden but live; `docs/PROJECT_MAP.md` omits both settings routes; onboarding says name changes in Settings. | HIGH |
| C14 | Responsive action patterns differ by feature. | Transaction menus, recurring menus, asset action groups, catalog editors and budget row actions each have local breakpoint rules. | MEDIUM |
| C15 | Data/table overflow patterns are not unified. | Transactions use mobile cards and desktop min-width rows; import uses an explicit scroll region; chart tables use their own min widths. | MEDIUM |

## 8. UX flow findings

| ID | Flow | Finding | Severity |
|---|---|---|---|
| U1 | Login → create family → family management | Onboarding says the family name can be changed in Settings, but the action is in Members. | HIGH |
| U2 | Settings → personal filter defaults | The same feature is embedded in Settings and available as a hidden standalone route; direct entry does not activate a tab/breadcrumb. | HIGH |
| U3 | Mobile navigation | Secondary-route users open “More”, but the More control is not clearly active as the current navigation context. | MEDIUM |
| U4 | Transactions → filter | The powerful filter model becomes a long vertical task on small screens; progressive disclosure exists but still exposes many controls in one flow. | HIGH |
| U5 | Transactions → bulk edit | Custom bulk edit has a weaker interaction contract than shared confirm: no Escape/focus restore, Vietnamese-only copy and no clear empty-selection guidance. | HIGH |
| U6 | Header → notifications | Budget alerts and due transactions are combined in one popover; the count says “items needing attention” but the two action types are not visually separated as strongly as their consequences differ. | MEDIUM |
| U7 | Recurring → generate due | Manual “Generate due transactions” is adjacent to background-job messaging and can be mistaken for a separate generation path. | HIGH |
| U8 | Assets → savings/gold | Two different financial domains, multiple histories and linked transaction actions create a long, high-context page. | MEDIUM |
| U9 | Dashboard scan | The dashboard is useful but vertically dense on mobile: KPI, budgets, assets, recent transactions, trend, pies, breakdowns and AI summary all compete for attention. | MEDIUM |
| U10 | Dashboard → chart insight | Chart/table alternatives are present but often hidden behind a disclosure; users must discover the accessible/text representation. | HIGH |
| U11 | Review money values | Compact and full VND formats are mixed without a documented “overview vs decision” rule. | MEDIUM |
| U12 | Data → import | Validation is safe and detailed, but the overall process is not visually framed as explicit steps (choose → validate → review → confirm). | MEDIUM |
| U13 | Data → email export | A disabled owner/configuration-dependent action does not always explain its disabled reason near the control. | MEDIUM |
| U14 | Authentication | Generic “Continue” and untranslated “Magic link” reduce confidence in a high-frequency bilingual flow. | HIGH |
| U15 | Theme/language | Theme/language controls are available in the authenticated header, but auth/onboarding surfaces have no equivalent controls and “System” is translated but not selectable. | MEDIUM |

## 9. Responsive findings

### What is already strong

- `min-width: 320px`, dynamic viewport heights and safe-area padding are present.
- Mobile drawer and bottom navigation are first-class rather than scaled desktop navigation.
- Transaction rows intentionally change from desktop table to mobile cards.
- Import preview advertises horizontal swipe and uses a focusable scroll region.
- Asset cards, recurring actions and icon buttons have been recently adjusted for mobile touch targets.
- Reduced motion removes transitions/scale/animations where appropriate.

### Matrix to validate before implementation

| Width | Primary risk to validate | Expected behavior |
|---:|---|---|
| 320 | Long Vietnamese labels, bottom-nav text, action groups, VND/quantity overflow | No clipped labels; primary actions remain reachable; cards stack. |
| 375 | Transaction filter vertical length, bulk bar and FAB/bottom-nav collision | Sticky bars do not obscure focused content; filter summary remains visible. |
| 390 | Recurring/asset action groups and chart legends | Action labels wrap or menu without overflow; legends remain understandable. |
| 430 | Two-column form/card breakpoints | No premature two-column layout for long labels; fields remain at least 44px. |
| 768 | Desktop table threshold, sidebar transition, chart/table min widths | No accidental clipped table; navigation mode transition is predictable. |
| 1024 | Auth split layout, dashboard density, side navigation space | Page content does not become cramped between mobile and wide desktop. |
| 1280 | Header/sidebar/main rhythm, chart width and popover placement | The current login screen is visually clean at this width; authenticated shell needs visual snapshot. |
| 1440 | Max-width discipline and excessive empty space | Content remains grouped; no stretched cards or oversized gaps. |

Specific responsive risks:

- desktop tables use `min-w-[1080px]`, so the `md` threshold deserves inspection at 768–1023px;
- fixed header, sticky bulk actions, bottom nav and FAB share vertical real estate;
- 10px bottom-nav labels and long Vietnamese strings may wrap or become visually weak;
- charts and data tables need explicit mobile summaries, not just shrinking;
- popovers and dialogs need viewport-safe `dvh` sizing and focus-scroll checks;
- amounts and gold quantities need long-value fixtures, not only short demo values.

## 10. Accessibility findings

| ID | Finding | Evidence / impact | Severity |
|---|---|---|---|
| A1 | Notification popover lacks a complete dialog contract. | It uses `role=dialog` but not `aria-modal`, does not move focus into the panel, and does not trap/restore focus. | HIGH |
| A2 | Notification count is not part of the button name. | The count is an `aria-label` on a decorative badge while the button name remains only “Notifications/Thông báo”. | MEDIUM |
| A3 | Bulk-edit dialog bypasses shared focus behavior. | Custom dialog has `aria-modal` and a heading, but no Escape handling, focus trap or focus restoration. | HIGH |
| A4 | Multiselect label/list semantics are incomplete. | The visible label is a span, the disclosure is a native `details` summary, and the option region is `role=group`; the relationship is not as explicit as a reusable labelled control. | MEDIUM |
| A5 | Error focus can target hidden advanced content. | `TransactionForm` can link to `transaction-status` while Advanced options are closed. | HIGH |
| A6 | Authentication/reset errors use polite status semantics. | Invalid credentials/password errors may not interrupt a screen-reader user as an error; Login/Reset do not share the stronger alert/error-summary pattern used elsewhere. | HIGH |
| A7 | Shared accessible names are not always localized. | Toast close and transaction row copy/delete labels contain Vietnamese literals even in English mode. | MEDIUM |
| A8 | Charts need a consistent keyboard/text alternative contract. | Trend chart has no equivalent keyboard action model; tables are available but not always discoverable or exposed as a primary alternative. | HIGH |
| A9 | Contrast baseline is not yet measured. | Token pairs across both themes, especially muted/status/chart text, need automated WCAG contrast evidence before token changes. | MEDIUM |
| A10 | Some selection controls are smaller than the app’s touch contract. | Desktop transaction select checkboxes are `size-5` without a 44px label/wrapper. | MEDIUM |
| A11 | Icon picker listbox semantics are incomplete. | Buttons are assigned `role=option` but do not implement listbox arrow navigation/active-descendant behavior. | MEDIUM |
| A12 | Catalog tabs lack the Settings tab keyboard contract. | Catalogs exposes tab roles/selection but does not share the Settings arrow/Home/End behavior. | MEDIUM |
| A13 | Toast live region contains interactive dismiss controls. | The live container wraps the entire toast markup, so assistive technology may announce action controls along with every message. | LOW |
| A14 | Desktop transaction overflow is not an explicitly labelled region. | The min-width table wrapper supports horizontal scrolling but lacks the explicit labelled-region affordance used by import preview. | LOW |

### Accessibility strengths to preserve

- skip link and route-change main focus exist;
- focus-visible outlines are globally preserved, including dark mode;
- shared confirmation dialog traps focus, closes on Escape and restores focus;
- transaction form has a focused error summary and linked fields;
- most visible labels, `aria-invalid`, `aria-busy`, `aria-expanded`, `aria-controls` and status regions are present;
- icon-only actions generally have accessible names;
- reduced-motion handling is present in CSS and several component effects;
- transaction and import surfaces provide non-color text labels for key states.

## 11. Technical UI findings

| ID | Finding | Why it matters |
|---|---|---|
| T1 | `src/index.css` is a large mixed token/component stylesheet. | It is the design-system source of truth but also contains feature-specific rules, making ownership and drift harder to see. |
| T2 | Major screens are large page modules. | `Transactions.tsx` and `Assets.tsx` are over 1,200 lines; Dashboard and TransactionForm are also large. Repeated UI contracts remain local. |
| T3 | There is no shared primitive layer for Button/Field/Modal/Tabs/PageHeader/Table. | The same patterns are reimplemented with slightly different sizing and semantics. |
| T4 | Architecture documentation omits live Settings routes. | `App.tsx` registers `/cai-dat` and `/cai-dat/giao-dich`, but the route map does not list them. |
| T5 | Automated coverage is good but visual/accessibility coverage is thin. | Current local evidence is 48 Vitest files / 233 passed tests; there is no repeatable axe/keyboard matrix or authenticated visual snapshot suite. |
| T6 | Build warnings show large data/chart chunks. | The current build includes large ExcelJS, XLSX and chart chunks; this is documented as a known issue and should be considered for mobile loading. |
| T7 | Theme capability and copy are out of sync. | `LanguageContext` contains “System/Theo thiết bị”; `ThemeContext` only supports light/dark and reads the OS preference only on first load. |
| T8 | Human docs are partially stale around theme behavior. | README still says there is no theme switch even though `ThemeSelect` exists. This can confuse future UI work and QA expectations. |

## 12. Main problems

1. Dialog/popover interaction contracts are not centralized, so high-risk actions and notification reading behave differently for keyboard users.
2. Transactions is powerful but over-dense on mobile; filtering and bulk edit need a task-oriented mobile mode.
3. Settings has an ambiguous route model and the architecture map does not reflect it.
4. Semantic tokens are present but not enforced; local palette utilities and raw hex values undermine theme consistency.
5. Localization is not a complete product contract; shared action names can remain Vietnamese in English mode.
6. The dashboard offers useful depth but needs a more discoverable text-first chart alternative and a clearer overview/detail convention.
7. Forms are individually thoughtful but duplicate field/error/advanced-disclosure behavior.
8. Assets, recurring expenses and data tools are functionally rich; they need clearer grouping of primary versus secondary actions at narrow widths.

## 13. Quick wins

These are deliberately small, high-visibility changes that can precede broader component extraction:

- Replace hardcoded shared action labels/titles with `LanguageContext` keys, beginning with toast close and transaction-row actions.
- Add the notification count to the notification button’s accessible name and add `aria-modal`/focus-in behavior to the popover.
- Add Escape/focus trap/restore to the bulk-edit dialog by reusing the shared dialog contract.
- Correct Create Family copy from “Settings” to “Members” or expose a real Settings destination.
- Make the Settings deep link activate the Filters tab and add a clear back/breadcrumb affordance.
- Add a visible “step 1: choose → step 2: review → step 3: confirm” treatment to import without changing the data flow.
- Create an explicit amount-display convention: compact for overview cards, full for decision/action surfaces, with accessible full-value titles.
- Normalize local page status/error colors to semantic tokens in the most visible rows/cards.
- Add visible text summaries above or beside charts before deeper chart interaction work.
- Enlarge transaction selection hit areas without changing their visual density.

## 14. Recommended next step

Use [`docs/UI_UX_IMPROVEMENT_PLAN.md`](UI_UX_IMPROVEMENT_PLAN.md) as the implementation contract. Start with the first P1 batch there, add regression coverage before changing shared primitives, and defer visual polish until the settings, dialog, filter and localization contracts are stable.
