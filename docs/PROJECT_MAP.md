# Family Expense — Project Map

## Project overview

Family Expense is a Vietnamese, mobile-first Progressive Web App for managing family income, expenses, budgets, recurring transactions, catalogs, members and Excel data. Amounts are VND and dates use `Asia/Ho_Chi_Minh`. The application supports a demo/local fallback when Supabase is not configured.

The browser is a React application backed by Supabase Auth, PostgreSQL, RLS, RPCs and Deno Edge Functions. Cloudflare Pages hosts the frontend. Gemini is used only behind Edge Functions for transaction suggestions, natural-language search filters and dashboard summaries; the user confirms any suggested transaction before saving.

## Technology stack

| Area | Technology | Source of truth |
|---|---|---|
| Frontend | React 19, TypeScript strict, Vite | `src/`, `vite.config.ts` |
| Routing/UI | React Router, Tailwind CSS, Lucide icons | `src/App.tsx`, `src/index.css` |
| Server state | TanStack Query | `src/main.tsx`, page components |
| Forms/validation | React Hook Form, Zod | `src/pages/`, `src/lib/domain.ts` |
| Charts/PWA | Recharts, vite-plugin-pwa | `src/pages/Dashboard.tsx`, `vite.config.ts` |
| Database/auth | Supabase PostgreSQL, Auth, RLS, RPC | `supabase/migrations/`, `src/lib/supabase.ts` |
| Server integrations | Supabase Edge Functions on Deno | `supabase/functions/` |
| AI/email | Google Gemini API, Brevo SMTP API | Edge Functions and Supabase secrets |
| Hosting | Cloudflare Pages Git integration | External Pages project; `.github/workflows/` verifies builds |
| Tests | Vitest, Testing Library, Playwright, pgTAP | `vite.config.ts`, `playwright.config.ts`, `supabase/tests/` |
| Package manager | pnpm | `package.json`, `pnpm-lock.yaml` |

## Repository structure

```text
/
├── src/
│   ├── components/       Shared layout, feedback, fields and transaction row UI
│   ├── context/          Auth/family bootstrap, language and theme state
│   ├── lib/              Domain models, validation, API/RPC adapters, AI and imports
│   ├── pages/            Routed screens and page-level tests
│   ├── test/              Vitest setup
│   ├── App.tsx            Route tree and auth/layout composition
│   └── main.tsx           React, providers and TanStack Query bootstrap
├── supabase/
│   ├── migrations/        Schema, constraints, RLS, RPCs and scheduled jobs
│   ├── functions/         Deno Edge Functions and scoped rules
│   ├── tests/             pgTAP database/security tests
│   ├── config.toml        Auth URLs and function JWT settings
│   └── AGENTS.md          Database-specific rules
├── scripts/               Excel migration, performance and staging operations
├── tests/e2e/             Playwright browser flows
├── docs/                  Stable architecture, privacy, deploy and operations docs
├── .agent/skills/         Project-specific repeatable agent workflows
├── .github/workflows/     CI, preview verification, Supabase deploy and staging drill
├── public/                PWA assets and SPA/offline routing helpers
├── AGENTS.md              Permanent agent rules
├── HANDOFF.md             Current development state only
├── CHANGELOG.md           Historical meaningful changes
└── README.md              Human setup and feature documentation
```

Generated/dependency output such as `node_modules/`, `dist/`, `coverage/`, Playwright reports and Supabase temp state is not application source and must not be used as architecture context.

## Major application modules

### Bootstrap, auth and family context

- `src/main.tsx` creates the browser root, theme/language/feedback/query providers and query defaults.
- `src/App.tsx` defines login, reset-password, family onboarding and authenticated routes.
- `src/context/AppContext.tsx` loads the authenticated user, active family, role and catalogs; it also preserves demo fallback behavior and exposes family/member/catalog mutations.
- `src/context/LanguageContext.tsx` and `src/context/ThemeContext.tsx` own cross-cutting presentation preferences.

### Transactions

- `src/pages/Transactions.tsx` handles filters, pagination, bulk actions, deletion and confirmation. Due planned transactions are surfaced and confirmed from `src/components/BudgetNotifications.tsx`.
- `src/pages/TransactionForm.tsx` handles create/edit/copy and AI-assisted entry.
- `src/components/TransactionRow.tsx` renders responsive desktop/mobile transaction rows.
- `src/lib/transactionsApi.ts` maps rows and calls family-scoped RPC/table queries. `src/lib/transactionDraft.ts`, `src/lib/quickTransactionSearch.ts` and `src/lib/domain.ts` hold reusable transaction logic.
- Planned recurring rows are created by the database scheduled job; active screens refetch server queries every 30 seconds and on window focus.

### Dashboard and budgets

- `src/pages/Dashboard.tsx` loads aggregate facts, trends, recent and due transactions and the AI summary.
- `src/pages/Budgets.tsx`, `src/lib/budgetsApi.ts`, `src/lib/budget.ts` and `src/lib/budgetNotifications.ts` implement monthly budgets, totals and alerts.
- Dashboard aggregate and budget RPCs keep large calculations in PostgreSQL rather than relying only on browser state.

### Recurring transactions

- `src/pages/RecurringExpenses.tsx`, `src/lib/recurringExpensesApi.ts` and `src/lib/recurringExpense.ts` implement template CRUD, pause/resume, due generation, history, restore and permanent deletion.
- Migrations `202609050001`–`202609050005` define the recurring schema, idempotent occurrence runs, hardening and owner-only deletion/restore RPCs.

### Catalogs and members

- `src/pages/Catalogs.tsx` manages purposes, expense types, payment methods and icons.
- `src/pages/Members.tsx` manages owner/member access and display names through guarded RPCs.
- Catalog and member authorization is enforced in Supabase; UI role checks are only a presentation layer.

### Import/export and data tools

- `src/pages/ImportExport.tsx` handles Excel template import, CSV export, data summary and owner-only email export.
- `src/lib/importExcel.ts`, `src/lib/templateImport.ts`, `src/lib/importSummary.ts` and `src/lib/templateTypes.ts` implement parsing, normalization, duplicate handling and validation.
- `supabase/functions/email-transactions/` sends owner-requested CSV exports through Brevo; credentials remain server-side.

### Edge Functions and AI

| Function | Responsibility | Provider/data boundary |
|---|---|---|
| `parse-expense` | Suggest one transaction from natural language | Gemini; validates output; does not save automatically |
| `search-transactions` | Turn natural language into structured transaction filters | Gemini when needed; results are applied by the frontend through family-scoped queries |
| `summarize-dashboard` | Generate a dashboard summary from aggregate facts | Gemini; sends aggregate facts rather than raw transaction lists |
| `email-transactions` | Email owner-authorized CSV export | Brevo; queries by authenticated user/family |

All functions verify JWT and membership, validate inputs, enforce rate/timeout behavior and read secrets with `Deno.env.get`. Semantic embedding functions/tables were removed from the current production path; do not reintroduce them without an explicit design decision.

## Data flow

### Authenticated cloud flow

```text
Browser route
  → AppContext/session + family_id
  → page query or src/lib adapter
  → Supabase table/RPC or verified Edge Function
  → PostgreSQL/RLS or external provider
  → validated response
  → TanStack Query/cache and UI
```

### Transaction creation

```text
Form/import/AI suggestion
  → Zod/domain validation and catalog ID checks
  → Supabase insert/RPC scoped by family_id
  → invalidate affected queries after success
  → render persisted transaction
```

AI suggestions and imported values are untrusted. AI never writes a transaction directly; import writes are batch-audited and duplicate-aware.

### Recurring transaction generation

```text
Supabase pg_cron
  → generate_due_recurring_transactions()
  → idempotent recurring_transaction_runs
  → planned transactions
  → browser refetch/focus refresh
  → user confirmation
```

## Core entities and relationships

- `families` owns the tenant boundary.
- `family_members` links authenticated users to a family with owner/member role and active status.
- `purposes`, `expense_types`, `payment_methods` and `beneficiaries` are family-scoped catalogs.
- `transactions` belongs to a family and references catalogs; soft deletion uses `deleted_at`. Amount is positive; `transaction_type` determines income/expense net meaning.
- `budgets` belongs to a family/month/purpose and is guarded by budget visibility rules.
- `recurring_transactions` stores templates; `recurring_transaction_runs` records idempotent occurrences; generated `transactions` link back with `recurring_transaction_id`.
- `import_batches` and `import_issues` audit Excel imports.
- `ai_usage_logs` records minimal AI request metadata and is subject to retention; AI cache/RPC access is server-controlled where configured.

The authoritative schema and policy definitions are the ordered SQL migrations, not this document.

## Important entry points

### Browser routes

| Route | Screen |
|---|---|
| `/dang-nhap` | Login, sign-up, magic link and password reset request |
| `/dat-lai-mat-khau` | Password reset completion |
| `/tao-gia-dinh` | Family onboarding |
| `/` | Dashboard |
| `/giao-dich` | Transaction list, filters and planned confirmation |
| `/giao-dich/moi`, `/giao-dich/:id` | Create/edit transaction |
| `/ngan-sach` | Budgets |
| `/chi-phi-dinh-ky` | Recurring templates and runs |
| `/danh-muc` | Catalog management |
| `/thanh-vien` | Family members |
| `/du-lieu` | Import/export and email export |

### Backend entry points

- Migrations and RPCs: `supabase/migrations/`.
- Edge Functions: `supabase/functions/*/index.ts`.
- Local DB/security tests: `supabase/tests/*.sql` through `supabase test db --local`.
- GitHub deploy entry: `.github/workflows/supabase-deploy.yml`.

## External services and configuration

| Service | Used for | Configuration names | Failure considerations |
|---|---|---|---|
| Supabase Auth/Postgres | Login, tenant data, RLS, RPC, cron | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, workflow Supabase secrets/vars | Membership, RLS and network errors must be surfaced; demo fallback only applies when cloud is not configured |
| Gemini | AI suggestion/search/summary | `GEMINI_API_KEY`, `GEMINI_MODEL` in Supabase secrets | Quota, timeout, malformed JSON and rate limit; allow manual fallback |
| Brevo | Owner email export | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` in Supabase secrets | Provider/quota failure must not expose credentials or financial data |
| Cloudflare Pages | Frontend preview/production hosting | Pages dashboard build settings and `VITE_*` deploy environment values | Git integration builds from PR/main; verify merge-commit deployment and HTTP 200 |

Never put secret values in this map, changelog, handoff or source code.

## Deployment architecture

- Local development uses Vite (`pnpm dev`) and either demo fallback or a local/isolated Supabase project. Supabase local tests require the CLI/container runtime.
- Pull requests run CI quality, E2E, DB/security checks and a secret-free frontend build verification. Cloudflare Pages Git integration creates the preview deployment externally.
- A merge to protected `main` triggers the final CI and Cloudflare Pages production build. Changes under `supabase/migrations/`, `supabase/functions/` or `supabase/config.toml` also trigger the Supabase production workflow.
- Production deploy is Git-based. Do not use `wrangler pages deploy` for the normal production path.
- For schema/frontend contract changes, validate the migration and ensure the backend is available before relying on the new frontend contract. Rollback of frontend does not automatically rollback database migrations.

## Source-of-truth boundaries

- Permanent agent rules: `AGENTS.md` plus scoped Supabase `AGENTS.md` files.
- Stable architecture: this file and the solution architecture document.
- Current state: `HANDOFF.md`.
- History: `CHANGELOG.md`.
- Human setup/features: `README.md`.
- Deploy/operations details: `docs/DEPLOY_RUNBOOK.md`, `docs/RELEASE_GOVERNANCE.md`, `docs/OPERATIONS_RUNBOOK.md`.
- Database contract: ordered SQL migrations and pgTAP tests.
- AI/privacy contract: Edge Function source and `docs/AI_PRIVACY.md`.
