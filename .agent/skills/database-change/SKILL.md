# Database Change

## Purpose

Use for Supabase migrations, PostgreSQL functions/RPCs, RLS/policies, constraints, indexes, retention jobs or recurring-transaction generation.

## Read first

- `AGENTS.md`
- `supabase/AGENTS.md`
- `HANDOFF.md` and the newest relevant `CHANGELOG.md` entry
- `docs/PROJECT_MAP.md` database/deployment sections
- `docs/RELEASE_GOVERNANCE.md` and `docs/OPERATIONS_RUNBOOK.md` for risky changes
- Relevant migrations and `supabase/tests/*.sql`

## Workflow

1. Identify the authoritative schema/RPC/policy and all frontend/functions that consume it.
2. Add a new timestamped migration; never edit an applied migration.
3. Review tenant scoping, owner/member authorization, direct table grants, `security definer` search path, constraints, soft-delete behavior and idempotency.
4. Rehearse on local or isolated staging when the change is risky. Never use production as a test target.
5. Add/update pgTAP or focused regression coverage and update frontend/function tests for contract changes.
6. Run `supabase test db --local` when available, then the relevant frontend/function quality gates and `git diff --check`.
7. Update `CHANGELOG.md`, `HANDOFF.md` and `docs/PROJECT_MAP.md` when the schema boundary/data flow changes.
8. For deployment, commit and push the migration, dependent code and latest release documents together. Production is applied by the GitHub Supabase workflow after merge to `main`.

## Do not

- Run `supabase db reset`, `drop database`, bulk production mutations or destructive rollback commands.
- Use a new column/RPC in production frontend before the migration is deployed successfully.
- Assume UI role checks replace RLS/RPC authorization.
- Log or place secrets in migration, test output or documentation.
