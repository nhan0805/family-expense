# Feature Development

## Purpose

Use for a normal frontend, domain, import/export or non-schema feature in Family Expense.

## Read first

- `AGENTS.md`
- `HANDOFF.md` and the newest relevant `CHANGELOG.md` entry
- The relevant section of `docs/PROJECT_MAP.md`
- Existing tests and source files for the target module

## Workflow

1. Confirm the request, affected route/module and whether it changes a database or Edge Function contract.
2. Search for an existing helper, query key, schema, component or API adapter before creating one.
3. Implement the smallest change in the existing pattern. Preserve demo fallback, family scoping, loading/error/empty states and mobile/accessibility behavior.
4. Add or update Vitest/RTL regression tests. Update Playwright only when an important user flow changes.
5. Run the relevant tests, then `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check` as appropriate.
6. Complete the documentation impact check. Update `CHANGELOG.md` and `HANDOFF.md` when the behavior/current state warrants it; update `PROJECT_MAP.md` only for architecture changes.

## Do not

- Bypass `src/lib` adapters or `family_id` authorization.
- Treat an AI suggestion as persisted data without explicit user confirmation.
- Add a dependency before checking `package.json` and the existing installed libraries.
- Modify an applied migration as part of a frontend feature.
