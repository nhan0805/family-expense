# Project Agent Instructions

## 1. Before starting

Use the smallest context that answers the task:

1. Read this file.
2. Read `HANDOFF.md` for the current state and the latest entry in `CHANGELOG.md` for recent changes.
3. Read the relevant section of `docs/PROJECT_MAP.md` when architecture context is needed.
4. Read scoped rules before working in their directories: `supabase/AGENTS.md` and `supabase/functions/AGENTS.md`.
5. Read a matching workflow in `.agent/skills/` when the task is a recurring workflow.
6. Inspect only the files directly related to the request; scan the wider repository only when context is stale or the change is cross-cutting.

Canonical context files are the root `HANDOFF.md` and `CHANGELOG.md`. Do not create duplicate copies under `docs/`.

## 2. Project purpose

Family Expense is a Vietnamese, mobile-first PWA for family members to manage VND income, expenses, budgets, recurring transactions, imports and exports. The app uses `Asia/Ho_Chi_Minh`. AI only produces suggestions or structured search filters; the user must confirm before a transaction is saved.

## 3. Common commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
supabase start
supabase test db --local
```

Use `node scripts/import-excel.mjs "/path/file.xlsx"` only for the documented Excel migration dry-run. Production migrations and Edge Functions are applied by `.github/workflows/supabase-deploy.yml` after merge; do not turn the CLI command into an unreviewed production shortcut.

## 4. Architecture rules

- Frontend entry is `src/main.tsx`; routes and page composition are in `src/App.tsx`.
- `src/context/` owns session/family bootstrap and cross-cutting theme/language state. TanStack Query owns server-backed screen data.
- `src/lib/` owns domain types, validation, API/RPC adapters, import/export, AI client behavior and error recovery. Keep Supabase field mapping explicit (`snake_case` ↔ `camelCase`).
- There are no application API routes in this repository. Browser mutations use Supabase tables/RPCs or the approved Edge Functions.
- Every cloud query and mutation must be scoped by `family_id`; RLS and guarded RPCs are the authorization boundary, not the UI.
- A successful Supabase mutation must complete before React state, cache or navigation is updated.
- Demo/local fallback must continue working when Supabase is not configured; do not make the cloud path the only path without a request.
- Edge Functions run in Deno/Supabase Edge. Keep server-only secrets and provider calls there; never import server-only code into the browser bundle.
- Recurring transaction generation is a database/cron concern. The browser refreshes relevant queries but must not create duplicate occurrences locally.

## 5. Coding conventions

- TypeScript strict mode; use named functional React components and existing patterns.
- Use `camelCase` in TypeScript and map explicitly to Supabase `snake_case`.
- Reuse existing helpers, schemas, components and `lucide-react` icons before introducing abstractions.
- Validate untrusted input at the boundary with the existing Zod/domain schemas. Amounts are positive VND values; net meaning comes from `transaction_type`.
- Keep user-facing UI and errors in Vietnamese, preserving the existing bilingual behavior where present.
- Handle loading, error and empty states explicitly. Do not hide failed cloud mutations behind optimistic UI.
- Do not change public API, business rules, schema or dependencies unless the request requires it.

## 6. Database rules

- Migrations live in `supabase/migrations/` and must use a new `YYYYMMDDHHMM_name.sql` file. Never edit an applied migration.
- Tables containing family data need `family_id`, RLS and policies appropriate for owner/member access. Check direct SQL and RPC paths.
- Privileged RPCs use `security definer set search_path=''`, schema-qualified objects, explicit `auth.uid()`/membership checks, and least-privilege grants.
- Use constraints, foreign keys and triggers for invariants. Treat soft-deleted transactions (`deleted_at`) deliberately in every query and guard.
- Run local DB tests or CI pgTAP for schema/RLS changes. Rehearse risky migrations on isolated staging; do not test mutations against production.
- Production schema changes go through the GitHub Supabase workflow after merge; do not run destructive production commands.

## 7. Security and privacy

- Never read, print or commit `.env`, `.env.*`, tokens, access keys, service-role keys or Gemini/Brevo secrets. Refer to variable names only.
- Browser may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; RLS still protects the data.
- Gemini and Brevo credentials stay in Supabase Edge Function secrets. Do not call those providers directly from the frontend.
- Edge Functions must verify JWT/membership, validate request and response, enforce rate limits/timeouts, and return stable error statuses.
- Do not log prompts, AI responses, auth headers, tokens, emails or detailed financial data. Telemetry is metadata-only.

## 8. UI and API rules

- Preserve the mobile-first/PWA behavior, current visual system and theme support. Reuse existing layout/form/feedback components.
- Every form control needs a label or accessible name; errors use the existing accessible alert/status patterns.
- Use API adapters in `src/lib/` for reusable Supabase access. Pages may compose queries, but must not bypass family scoping or duplicate mapping logic.
- AI/import data is untrusted: validate again before applying IDs or writing data, detect duplicates, and never auto-save an AI suggestion without confirmation.

## 9. Testing and validation

- Relevant bug/logic changes require Vitest/RTL regression coverage; important user flows should update Playwright coverage when practical.
- Normal quality gate: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`.
- Run `pnpm test:e2e` for release or important user-flow changes. CI also runs coverage, performance budget and local Supabase DB/RLS tests.
- For database changes, run `supabase test db --local` when local Supabase is available; otherwise record the limitation and rely on CI/staging evidence.
- Build warnings about existing large XLSX/ExcelJS/chart chunks are not failures unless the performance budget fails.

## 10. Dependencies and generated files

- The repository uses `pnpm` and `pnpm-lock.yaml`; use `pnpm` commands and inspect `package.json` before adding a dependency.
- Prefer installed libraries and avoid duplicates. Explain meaningful dependency additions.
- Do not commit `node_modules`, `dist`, coverage, Playwright reports, Supabase temp files, Python caches, secrets or other generated artifacts.

## 11. Documentation impact check

After a meaningful change, decide explicitly:

- Architecture or boundary changed → update `docs/PROJECT_MAP.md`.
- User-visible or important internal behavior changed → update `CHANGELOG.md`.
- Current status, pending task or known issue changed → update `HANDOFF.md` and remove stale status.
- Permanent rule/convention changed → update this file or the scoped `AGENTS.md`.
- Repeatable workflow changed → update the relevant `.agent/skills/*/SKILL.md`.

Do not update every document mechanically. Keep `HANDOFF.md` as a current snapshot, `CHANGELOG.md` as history, `PROJECT_MAP.md` as stable architecture, and `README.md` as human onboarding.

## 12. Git and release workflow

- Preserve unrelated working-tree changes. Keep commits logically scoped and never force-push, reset destructively or overwrite user work.
- For a deploy request: inspect current docs/status, run the quality gate, update release docs before committing, and stage/push code plus the latest `HANDOFF.md`/`CHANGELOG.md` together.
- Push a feature branch and open a PR to `main`. Keep the branch current with `main`, enable auto-merge, and wait for required checks.
- Production frontend deploy is only Cloudflare Pages Git integration from the merged `main` commit. Do not use `wrangler pages deploy` for production.
- Supabase migrations/functions deploy from the GitHub workflow when matching `supabase/` paths reach `main`; preview is not production.
- Conclude a deploy only after the PR is merged, checks pass, the Cloudflare production deployment for that merge commit succeeds, and the production URL is smoke-tested.
- A post-deploy handoff status-only update may be recorded without creating a second production deploy.
- Ask before production migration, external API access, package installation or deployment unless the user has explicitly requested the deploy in the current task.

## 13. Token-efficient context loading

Start with `AGENTS.md` → `HANDOFF.md` → latest `CHANGELOG.md` → relevant skill → specific files. Use `docs/PROJECT_MAP.md` for deeper architecture. Do not reread historical handoff entries or generated assets unless they answer the task.
