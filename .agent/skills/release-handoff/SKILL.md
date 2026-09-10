# Release Handoff

## Purpose

Use at the end of a meaningful implementation session or when the user requests deploy/release preparation.

## Read first

- `AGENTS.md`
- `HANDOFF.md`
- The newest `CHANGELOG.md` entry
- `docs/AI_CONTEXT_GUIDE.md`
- `docs/DEPLOY_RUNBOOK.md` and any scoped rules for changed areas

## Workflow

1. Inspect `git status` and `git diff`; preserve unrelated user changes.
2. Confirm intended files and check for secrets, generated artifacts and conflict markers.
3. Run the relevant tests. A normal release uses `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check`; include E2E/DB checks when applicable.
4. Perform the documentation impact check using `docs/AI_CONTEXT_GUIDE.md`.
5. Put the release summary in the PR body while the feature branch is in flight; update `CHANGELOG.md` with what changed, files/DB objects, validation and expected deployment state in the single synchronized release/status update.
6. Update `docs/PROJECT_MAP.md` only when architecture, module ownership or integration boundaries changed.
7. Update permanent rules in `AGENTS.md` or scoped rules only when a rule actually changed.
8. Rewrite `HANDOFF.md` as a current snapshot in that release/status update. Remove stale pending/deployment statements; do not append a full session history or rewrite it on every parallel feature branch.
9. For a deploy request, stage and commit the feature, push the branch, synchronize it with `origin/main`, create/update the PR to `main`, enable auto-merge and monitor required checks. If Merge Queue is enabled, ensure the CI workflow includes `merge_group`.
10. Conclude production release only after the PR merge, relevant Supabase workflow, Cloudflare Pages production deployment for the merge commit and HTTP smoke check succeed.
11. If a post-deploy update only records status/links and cannot affect the artifact, do not create a second production deploy solely for that update.
12. Report the commit/PR, checks, deployment evidence, remaining risks and one next recommended step.

## Do not

- Leave newer release documents only on a local branch when the release is pushed.
- Rewrite the canonical release documents independently on multiple parallel feature branches.
- Claim production completion from a green preview or branch build alone.
- Use `wrangler pages deploy` for normal production deployment.
- Turn `HANDOFF.md` into a historical changelog.
