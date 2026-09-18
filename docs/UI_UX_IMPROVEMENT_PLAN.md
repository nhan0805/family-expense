# Family Finance — UI/UX Improvement Plan

> This is a planning document only. It does not authorize or include runtime redesign, business-logic changes, schema changes or dependency changes.

## 1. Target design principles

1. **Refine the existing identity.** Keep the trustworthy light navy/blue language and the established dark purple/Dracula-inspired surface direction. Improve consistency; do not replace the product with an unrelated visual style.
2. **Make financial state explicit.** Amount, transaction type, actual/planned status, budget state and asset actions must be understandable without relying on color alone.
3. **Optimize for repeated mobile use.** A user should be able to scan the dashboard, filter transactions, add an expense and confirm a risky action one-handed on an iPhone-sized viewport.
4. **Use progressive disclosure deliberately.** Overview surfaces show the few facts needed for a decision; details, history, AI explanation and advanced filters open on demand.
5. **One interaction contract per pattern.** Dialogs, popovers, fields, tabs, buttons, status messages and table overflow should have one accessible behavior wherever they appear.
6. **Preserve user control.** AI suggests; the user confirms. Mutations complete before UI state changes. Destructive actions explain impact and require confirmation.
7. **Localize the interface as a system.** Vietnamese remains the default, English is a complete supported mode, and accessible names follow the visible language.
8. **Prefer the existing stack.** Improve Tailwind v4 tokens, CSS variables, React components, TanStack Query, RHF/Zod and current test tooling. Do not add a UI framework.
9. **Measure before polishing.** Establish contrast, viewport, keyboard and visual baselines before broad refactors.

## 2. Proposed unified design system

### 2.1 Design-token ownership

Keep `src/index.css` as the token source of truth, but separate it into clear sections or imported layers:

1. theme primitives and semantic variables;
2. typography and spacing roles;
3. shared component primitives;
4. layout/navigation rules;
5. feature-specific exceptions.

Feature JSX should prefer semantic variables and role classes over raw palette colors. A visualization may use a documented chart palette, but status and action surfaces should not invent local `rose/amber/emerald/slate` contracts.

### 2.2 Semantic color tokens

The names below extend the current token vocabulary; the existing light and dark values should be preserved initially and measured before adjustment.

| Role | Light direction | Dark direction | Use |
|---|---|---|---|
| `--app-bg` | Cool near-white | Deep navy/Dracula background | Page canvas. |
| `--surface` | White | Elevated dark surface | Cards, fields, dialogs. |
| `--surface-hover` | Slightly tinted surface | Slightly brighter surface | Hover/pressed background. |
| `--surface-muted` | Slate-50/100 | Dark muted panel | Toolbars, segmented controls, table headers. |
| `--surface-subtle` | Near-background | Dark subtle panel | Helper areas and secondary sections. |
| `--border` | Slate-200 | Translucent light border | Default boundaries. |
| `--border-strong` | Slate-300 | Muted purple/slate border | Fields, focusable controls. |
| `--text` | Slate-900 | Warm near-white | Primary text. |
| `--muted` | Slate-600 | Light muted lavender/gray | Secondary text and labels. |
| `--text-on-primary` | White | Dark surface text where needed | Primary button/icon contrast. |
| `--primary` | Existing trusted blue | Existing purple | Primary action and selected state. |
| `--primary-hover` | Existing stronger blue | Existing lighter purple | Hover/active state. |
| `--primary-soft` | Existing blue tint | Existing purple tint | Selected backgrounds and filter chips. |
| `--success`, `--success-soft`, `--success-strong` | Existing green family | Existing green family | Saved/within-budget/income. |
| `--warning`, `--warning-soft`, `--warning-strong` | Existing amber family | Existing amber family | Planned/due/near-limit. |
| `--danger`, `--danger-soft`, `--danger-strong` | Existing red family | Existing red family | Delete/error/over-budget. |
| `--info`, `--info-soft`, `--info-strong` | Existing blue/cyan family | Existing cyan family | Informational state. |
| `--focus-ring` | Measured blue | Measured cyan | All keyboard focus. |
| `--overlay` | Neutral translucent black | Stronger neutral translucent black | Modal/scrim; never feature-colored. |

Rules:

- every status badge includes a text label or accessible text in addition to color;
- every text/background pair gets a light/dark contrast test;
- raw color utilities remain allowed inside chart-only palette definitions and documented illustration surfaces;
- primary controls should share the same theme mapping; remove the special dark FAB pink gradient unless it is deliberately promoted to a brand token.

### 2.3 Typography system

Continue using Inter/system fallback. Introduce role utilities rather than relying on local combinations.

| Role | Size / line height | Weight | Typical use |
|---|---|---:|---|
| Display | 40 / 44px | 800 | Auth hero or rare product statement. |
| Page title | 28–34 / 32–38px | 800 | Route heading. Use the lower end on compact mobile. |
| Section title | 20 / 26px | 800 | Major card/section heading. |
| Card title | 17–18 / 24px | 750 | Row/card title and editor heading. |
| Body large | 16 / 24px | 400–600 | Form explanation and important copy. |
| Body | 14 / 21px | 400–600 | Default content and table text. |
| Body small | 13 / 19px | 400–600 | Secondary descriptions. |
| Label | 13 / 18px | 700 | Field/navigation label. Keep readable in Vietnamese. |
| Caption | 12 / 16px | 600 | Metadata, status detail and compact hints. |
| Numeric emphasis | Context-dependent, 24–32px | 800 | KPI/summary values; use full-value title/accessible description. |

Avoid introducing another font weight for a single screen. Treat letter spacing as a role property: tight only for large headings, normal for Vietnamese body copy, and modest uppercase tracking for kickers.

### 2.4 Spacing system

Use the existing Tailwind scale with a documented product rhythm:

`4 → 8 → 12 → 16 → 20 → 24 → 32 → 40 → 48 → 64px`

Recommended rules:

- field label to field: 6px;
- fields in a form: 16px;
- card padding: 16px mobile, 20px compact desktop, 24px only for large/auth surfaces;
- page section gap: 20–24px;
- page edge: 16px mobile, 20px small desktop, 32px wide desktop;
- use 32/40px only for intentional section separation, not accidental empty space;
- document unavoidable custom values such as chart min-width, fixed header offset and safe-area padding.

### 2.5 Radius and elevation

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 8px | Small icon/menu/control internals. |
| `radius-md` | 12px | Inputs and buttons. |
| `radius-lg` | 16px | Cards and feature sections. |
| `radius-xl` | 24px | Auth surfaces and dialogs. |
| `radius-full` | 999px | Chips, pills and badges. |

| Elevation | Use |
|---|---|
| `shadow-card` | Base card/field grouping. |
| `shadow-interactive` | Hovered/selected card. |
| `shadow-overlay` | Popover, dialog and mobile drawer. |

Avoid combining a new radius and new shadow for every feature. The visual difference between a card, an editor and a status panel should come primarily from hierarchy and spacing.

### 2.6 Icon system

- Continue with Lucide only.
- Inline icon: 16px.
- Standard action/icon: 18–20px.
- Feature/card icon: 20–24px.
- Every icon-only action uses a 44×44px wrapper at touch sizes and a localized accessible name.
- Every destructive icon has a title only as a supplement; the accessible name is the contract.
- Do not use an icon to convey a financial state without visible text or an accessible equivalent.
- Build a small `IconButton` primitive so label, tooltip/title, disabled state and focus behavior are consistent.

## 3. Component standards

The following primitives should be introduced only where two or more current screens already share the pattern.

| Primitive | Standard | Initial consumers |
|---|---|---|
| `Button` | `primary`, `secondary`, `danger`, `ghost`, `icon`; 44px default; 48px large; loading preserves width; localized label | All forms, list toolbars, data tools, recurring/assets. |
| `IconButton` | 44px wrapper, icon role size, `aria-label`, optional tooltip, visible focus, disabled state | Header, rows, catalogs, assets, notifications. |
| `Field` | Real `<label>`, explicit `id`, helper/error slots, `aria-invalid`, `aria-describedby`, required text | Transaction, auth, budgets, catalogs, settings. |
| `Select` | Same field geometry and label semantics; empty option copy localized | Every native select and bulk editor. |
| `Card` | Base/interactive/status variants; 16px radius; consistent padding | Dashboard, budgets, assets, data, members. |
| `PageHeader` | Kicker, title, subtitle, action slot, responsive alignment | All routed pages. |
| `SectionHeader` | Heading, supporting text, optional trailing action | Dashboard sections, lists and cards. |
| `Dialog` | `role=dialog`/`alertdialog`, `aria-modal`, labelled title, described description, focus in/trap/restore, Escape, `dvh` sizing | Shared confirm, bulk edit, future editors. |
| `Popover` | Trigger `aria-expanded/controls`, focus policy, outside/Escape close, placement/safe width | Budget notifications, action menus. |
| `Tabs` | Shared roles, selected state, roving tabindex, arrows/Home/End, panel linkage | Settings, Catalogs. |
| `StatusMessage` | `info`, `success`, `warning`, `error`; alert/status politeness set intentionally | Auth, mutations, import, query errors. |
| `EmptyState` | Icon, title, one-sentence explanation, optional primary action | Already shared; extend to standard spacing. |
| `LoadingState` | Page/list skeleton with label and reduced motion | Already shared; add error/retry pairing. |
| `DataTable` / `ResponsiveDataList` | Explicit label/region, table alternative, mobile card contract, overflow hint | Transactions, import preview, chart alternatives. |
| `Amount` | Full/compact variants, currency semantics, optional accessible full value | Dashboard, transactions, assets, budgets. |
| `FilterDisclosure` | Summary count, explicit expanded state, apply/reset policy and mobile layout | Transactions and default filters. |

Do not convert every local element into a generic component. The purpose is to centralize behavior that users should not have to relearn.

## 4. Responsive strategy

### Breakpoint contract

Validate all high-value flows at 320, 375, 390, 430, 768, 1024, 1280 and 1440px. Use 375px as the default iPhone regression viewport and 1280/1440px for desktop snapshots.

### Mobile

- Preserve the bottom nav and drawer, but make “More” visually active when the current route belongs to the secondary group.
- Keep the FAB clear of bottom nav and safe-area inset; ensure sticky bulk/filter bars do not hide focused content.
- Transactions: show search, the most common filters and a result summary first; place catalog exclusions, amount range and advanced controls behind a deliberate disclosure or sheet.
- Prefer mobile cards for transactions and assets. Allow horizontal scrolling only for genuinely tabular data and provide a labelled region plus a visible hint.
- Dialogs use `max-height: calc(100dvh - safe offsets)` and scroll internally without losing the heading/actions.
- Long Vietnamese labels wrap; do not use aggressive truncation on action labels. Use a menu when an action group cannot fit.
- Keep input text at 16px or larger to avoid mobile browser zoom.

### Tablet and desktop

- Treat 768–1023px as a real layout range, not simply “desktop table mode”. Check table min-widths and chart cards at this width.
- Preserve readable max-width for forms and editorial cards; do not stretch a 400px form to the full page.
- Use the sidebar at the existing breakpoint only if the remaining content width is comfortable.
- Keep chart legends and action groups from forcing minimum widths that create hidden horizontal overflow.

### Theme and locale

- Test every responsive fixture in light/dark and Vietnamese/English.
- Add long-label fixtures for `Chi phí định kỳ`, `Phương thức thanh toán`, `Khôi phục mặc định hệ thống`, and long family/member names.
- Decide whether `system` is a real third preference. If yes, implement it; if no, remove the unused translation and describe OS-following behavior clearly.

## 5. Accessibility improvements

Order accessibility work by user risk:

1. Make every custom dialog/popover obey the same focus-in, focus-trap, Escape, restore-focus, `aria-modal`, title and description rules.
2. Move error focus to visible controls; if an invalid control is inside a closed disclosure, open it before focusing or focus the disclosure with a clear message.
3. Use `role=alert` or an assertive error region for blocking/auth/form errors; reserve `role=status`/polite for progress and successful background updates.
4. Put attention counts in the interactive control’s accessible name, not on a decorative badge only.
5. Replace partial listbox semantics with either a native checkbox group inside a labelled disclosure or a fully implemented listbox pattern.
6. Add keyboard arrow/Home/End behavior to Catalog tabs by reusing the Settings tab contract.
7. Add a first-class text summary/table alternative for every chart; ensure trend data is reachable without pointer hover.
8. Enlarge checkbox hit areas and label the transaction table overflow region.
9. Localize all accessible names and titles from shared translation keys.
10. Run contrast checks against all light/dark semantic pairs and add automated axe/keyboard checks for the shared primitives.

## 6. P0/P1/P2/P3 roadmap

### P0 — Fix immediately

**Count: 0.** The audit found no P0-level broken core flow, unconfirmed destructive financial mutation or data-boundary failure. This should be revisited if authenticated visual testing exposes a blocker.

### P1 — High impact

**Count: 8.**

| ID | Area | Problem | Recommendation | Affected screens | Components/files | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P1-01 | Dialogs/popovers | Notification and bulk-edit surfaces do not share the safe focus contract. | Extend the shared dialog/popover primitives with `aria-modal`, description linkage, focus-in/trap/restore, Escape and viewport-safe sizing; migrate both surfaces. | Transactions, Dashboard/header, all destructive confirmations | `Feedback.tsx`, `BudgetNotifications.tsx`, `Transactions.tsx`, new `Dialog`/`Popover` primitive | M | Medium |
| P1-02 | Forms/errors | Auth errors are polite status messages and transaction validation can target a hidden advanced field. | Create a shared error-summary/message contract; open Advanced options before focusing a hidden field; align Login/Reset/CreateFamily/TransactionForm. | Login, reset, create family, new/edit transaction | `Login.tsx`, `ResetPassword.tsx`, `CreateFamily.tsx`, `TransactionForm.tsx`, `Field` | M | Medium |
| P1-03 | Information architecture | Settings has an embedded and hidden deep-link version; onboarding copy points to the wrong destination. | Choose `/cai-dat` as canonical, make the deep link activate the filter tab or redirect, add context/back link and correct family-name copy. | Settings, default filters, create family, members | `Settings.tsx`, `TransactionFilterSettings.tsx`, `CreateFamily.tsx`, `App.tsx`, `docs/PROJECT_MAP.md` | S | Low |
| P1-04 | Mobile transactions | The most-used filter and bulk-edit flow is too dense and the selection bar competes with sticky/fixed UI. | Stage common vs advanced filters, show a result summary, improve mobile apply/reset behavior, and make bulk edit a shared sheet/dialog. | Transactions, default filters | `Transactions.tsx`, `MultiSelectField.tsx`, `TransactionRow.tsx`, `index.css` | L | Medium |
| P1-05 | Tokens/contrast | Raw palette utilities and feature-specific colors weaken light/dark consistency. | Establish measured semantic tokens, migrate visible status/card/action surfaces first, and add contrast checks before changing values. | Dashboard, budgets, assets, catalogs, recurring, transactions, data | `index.css` and feature pages | L | Medium |
| P1-06 | Localization | Shared/high-frequency accessible names and actions are not fully bilingual. | Add translation keys for feedback, row actions, common status/CTA text and accessible names; remove inline literals in shared components first. | Login, transactions, header, toasts, all shared actions | `LanguageContext.tsx`, `Feedback.tsx`, `TransactionRow.tsx`, `Login.tsx`, page files | M | Low |
| P1-07 | Chart accessibility | Chart interaction and text alternatives are inconsistent. | Add a reusable chart summary/table wrapper; make trend values keyboard-readable and promote “View data” as a clear action. | Dashboard | `Dashboard.tsx`, chart utility/components, tests | M | Medium |
| P1-08 | Financial clarity | Amount format and primary/secondary action language differ by surface. | Define compact-overview/full-decision amount rules; add full-value accessible titles and clarify actions such as manual recurring generation. | Dashboard, transactions, assets, budgets, recurring, data | `Dashboard.tsx`, `TransactionRow.tsx`, `Assets.tsx`, `Budgets.tsx`, `RecurringExpenses.tsx`, `ImportExport.tsx` | M | Medium |

### P2 — Medium impact

**Count: 10.**

| ID | Area | Problem | Recommendation | Affected screens | Components/files | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P2-01 | Shared primitives | Buttons, fields, cards, tabs, headers and status banners are recreated locally. | Introduce a small primitives layer using the standards above; migrate two consumers at a time. | All screens | New `src/components/ui/` plus existing pages | L | Medium |
| P2-02 | Responsive QA | The shell is responsive, but feature breakpoints/table overflow are not validated as one matrix. | Add viewport fixtures and fix 320–430, 768–1024 and 1280–1440 layout regressions found by snapshots. | All screens, especially transactions/assets/dashboard | `index.css`, `Layout.tsx`, page CSS/classes, Playwright | L | Medium |
| P2-03 | Theme preferences | “System” is translated but not an available setting, and auth screens do not expose theme/language controls. | Implement an explicit system option or remove it; decide whether auth shell gets compact language/theme controls. | Auth, header, settings | `ThemeContext.tsx`, `ThemeSelect.tsx`, `LanguageContext.tsx`, `AuthShell.tsx` | M | Low |
| P2-04 | Import flow | Import is safe but visually reads as a collection of cards rather than a stepwise task. | Add explicit choose/validate/review/confirm headings, show when preview is capped at 100 rows and explain disabled email export. | Data center | `ImportExport.tsx`, `AsyncStates.tsx` | M | Low |
| P2-05 | Asset IA | Savings and gold are rich domains in one long page with many secondary actions. | Group by domain with clear section navigation and primary-action hierarchy; preserve the current inline editor model initially. | Assets, dashboard asset snapshot | `Assets.tsx`, `Dashboard.tsx` | M | Medium |
| P2-06 | Recurring clarity | Automatic background generation and manual generation are adjacent concepts. | Rename/manual-help text to “Check and generate due transactions” or equivalent, explain idempotence and show last generation state. | Recurring, notifications, dashboard due list | `RecurringExpenses.tsx`, shared status copy | M | Low |
| P2-07 | Dashboard density | Too many equally prominent modules extend the mobile scan. | Keep KPI/budget/asset priorities, collapse lower-frequency breakdowns by default and make AI summary secondary. | Dashboard | `Dashboard.tsx`, `index.css` | M | Medium |
| P2-08 | Visual tokens | Typography, spacing, radius and elevation roles are implicit. | Add role classes/tokens and replace repeated local values during normal feature edits; do not do a blind global rewrite. | All screens | `index.css`, page classes | M | Medium |
| P2-09 | Catalog interaction | Icon picker and catalog tabs have local keyboard semantics. | Use shared Tabs and a labelled checkbox/button grid or fully implement the listbox pattern. | Catalogs, settings | `Catalogs.tsx`, new `Tabs`/`IconPicker` primitive | M | Medium |
| P2-10 | Load performance | ExcelJS/XLSX/chart chunks remain large on the mobile PWA path. | Profile route loading; keep import libraries isolated, consider worker/route-triggered loading and chart chunk review without weakening functionality. | Data, Dashboard | `ImportExport.tsx`, Vite config, chart imports | M | Medium |

### P3 — Polish

**Count: 5.**

| ID | Area | Problem | Recommendation | Affected screens | Components/files | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P3-01 | Motion | Transitions exist but are a mix of global button scale, local enter/exit classes and feature animations. | Document motion roles, ensure all nonessential motion honors reduced-motion, and use one enter/exit timing scale. | All interactive surfaces | `index.css`, dialogs, toasts, editors | S | Low |
| P3-02 | Icon polish | Icon sizes/titles/tooltips vary in equivalent action groups. | Apply the icon role scale and add tooltip/title only where an icon is not self-evident; keep accessible names localized. | Header, rows, assets, catalogs, recurring | `IconButton`, `TransactionRow.tsx`, feature pages | S | Low |
| P3-03 | State polish | Empty/loading/error states are shared in some places and hand-built in others. | Extend `AsyncStates` with a shared retry/error variant and harmonize copy, spacing and icon treatment. | All data pages | `AsyncStates.tsx`, page states | M | Low |
| P3-04 | Regression tooling | Current tests cover behavior but not a repeatable visual/accessibility matrix. | Add authenticated test fixtures, Playwright screenshot checkpoints for key widths/themes/locales and axe/keyboard checks for primitives. | Shell, dashboard, transactions, forms | `tests/e2e`, `playwright.config.ts`, new a11y helpers | M | Low |
| P3-05 | Documentation | README and project map do not fully match current theme/routes. | Update stable docs after runtime decisions land; keep audit/handoff as the decision record until then. | Project documentation | `README.md`, `docs/PROJECT_MAP.md`, `HANDOFF.md` | S | Low |

## 7. Quick-win batch

The safest first visible changes are:

1. Localize shared close/copy/delete/action labels.
2. Correct onboarding family-name copy.
3. Make Settings deep links activate the appropriate tab.
4. Add notification count to the button name and `aria-modal`/focus-in behavior.
5. Add Escape/focus restore to bulk edit.
6. Add an explicit amount-format convention and full-value accessible titles.
7. Add chart “View data” summary affordances.
8. Add a disabled-reason line for email export and a “first 100 rows shown” note for large import previews.

These changes are intentionally small enough to land before the broader primitives refactor and should each receive a focused regression test.

## 8. Safest implementation sequence

```text
Baseline fixtures and measurements
        ↓
Semantic token/contrast contract
        ↓
Dialog, popover, button, field and status primitives
        ↓
Settings route/IA and localization cleanup
        ↓
Layout/navigation and mobile fixed-surface checks
        ↓
Transactions/filter/bulk-edit flow
        ↓
Dashboard charts and amount convention
        ↓
Assets, recurring, catalogs and data center
        ↓
Responsive matrix and accessibility pass
        ↓
Motion, icon and visual polish
```

Implementation rules:

- Do not change the database, business rules, family scoping or AI confirmation model as part of UI work.
- Keep each primitive migration small and test both Vietnamese and English before moving to the next consumer.
- Preserve the current 44px minimum touch contract unless a compact desktop exception is intentional and documented.
- Never hide a failed cloud mutation behind optimistic UI.
- Add the regression test before changing a shared interaction contract.
- Update `HANDOFF.md`/`CHANGELOG.md` only in the project’s release/status workflow; do not let parallel feature work create conflicting canonical-document edits.

## 9. Regression and verification strategy

### Automated checks per batch

- `pnpm test` / current direct Vitest equivalent for page and primitive behavior;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build` and review chunk warnings;
- `git diff --check`;
- Playwright authenticated fixture for core flows when test credentials are available;
- axe/keyboard checks for new dialog, popover, tabs, field and table primitives.

### Manual/snapshot matrix

For every shared component change, verify:

- widths 320, 375, 390, 430, 768, 1024, 1280 and 1440px;
- light and dark themes;
- Vietnamese and English;
- keyboard-only flow: skip link, navigation, focus visibility, Escape, Tab wrapping, submit/error recovery;
- reduced-motion preference;
- long family/member/category labels and long VND/gold values;
- loading, empty, query-error, offline and mutation-error states;
- destructive confirmation, cancel, retry and focus restoration;
- mobile fixed surfaces: header, bottom nav, FAB, sticky bulk/filter bars and dialogs;
- chart keyboard/text alternatives and table overflow;
- actual/planned/income/expense/budget status meaning without color.

### High-value end-to-end flows

1. Login → create family → dashboard.
2. Dashboard → drill down → filter transactions.
3. Transactions → add → validation error → correction → confirm/save.
4. Transactions → mobile filter → select several → bulk edit → close/cancel/confirm.
5. Dashboard → budget alert → notification → planned transaction confirmation.
6. Savings/gold → create/edit/settle/sell → linked transaction refresh.
7. Recurring → create → pause/resume/skip → check due generation → history.
8. Catalog → add/edit/delete/icon picker keyboard flow.
9. Members → invite/rename/remove → family-name edit/delete confirmation.
10. Data → download template → validate preview → duplicate review → confirm import.
11. Settings → switch tabs → save/reset defaults → open direct filter route.
12. Logout and protected-route redirect with return location.

## 10. Files/components expected to change

The audit itself only adds this plan, the audit report and a handoff summary. A future implementation is expected to touch the following in stages:

| Stage | Expected files/components | Scope |
|---|---|---|
| Foundation | `src/index.css`, `src/context/ThemeContext.tsx`, `src/context/LanguageContext.tsx` | Semantic tokens, typography/spacing roles, theme preference decision, translation keys. |
| Primitives | New `src/components/ui/*`, `src/components/AsyncStates.tsx`, `src/components/Feedback.tsx` | Button/IconButton, Field, Dialog, Popover, Tabs, Status, Amount and table contracts. |
| Shell | `src/components/Layout.tsx`, `src/components/ThemeSelect.tsx`, `src/components/BudgetNotifications.tsx` | Navigation active state, header controls, popover semantics and safe-area/focus checks. |
| Auth/forms | `src/components/AuthShell.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/CreateFamily.tsx`, `src/pages/TransactionForm.tsx` | Error announcements, copy/locale completion, visible focus and shared fields. |
| Core finance | `src/pages/Transactions.tsx`, `src/components/TransactionRow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Budgets.tsx` | Mobile filter/bulk flow, chart alternatives, amount convention, token migration. |
| Secondary features | `src/pages/Assets.tsx`, `src/pages/RecurringExpenses.tsx`, `src/pages/Catalogs.tsx`, `src/pages/Members.tsx`, `src/pages/ImportExport.tsx` | Action hierarchy, icon picker/tabs, generation copy, asset grouping and import steps. |
| Routing/docs/tests | `src/App.tsx`, `docs/PROJECT_MAP.md`, `README.md`, `tests/e2e/*`, `playwright.config.ts` | Settings canonical route, visual/auth fixtures, documentation alignment. |

No new UI framework is recommended. No database, RLS/RPC, Edge Function, AI provider or business-rule change is part of this plan.
