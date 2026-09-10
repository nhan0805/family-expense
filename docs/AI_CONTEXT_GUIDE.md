# AI Context Guide

## Document responsibilities

| Document | Responsibility | Update when |
|---|---|---|
| `AGENTS.md` | Permanent coding, security, architecture and release rules | A rule or invariant changes |
| `supabase/AGENTS.md` | Database migration, RLS, RPC and production DB rules | Database conventions change |
| `supabase/functions/AGENTS.md` | Deno Edge Function, AI, secret and error rules | Function conventions change |
| `docs/PROJECT_MAP.md` | Stable architecture, modules, data flow and source-of-truth boundaries | Architecture, module ownership or integrations change |
| `HANDOFF.md` | Current state, pending work, known issues and latest validation | Release/status state changes, recorded in one synchronized update |
| `CHANGELOG.md` | Historical record of meaningful changes and releases | User-visible or important internal behavior changes, recorded in the release/status update |
| `.agent/skills/*/SKILL.md` | Repeatable task workflow and validation | A recurring workflow changes |
| `README.md` | Human onboarding, setup and feature behavior | Setup, commands or user-facing product behavior changes |
| `docs/*RUNBOOK*.md` | Operational procedures and incident/release steps | Operations or deployment procedure changes |
| `docs/AI_PRIVACY.md` | Data sent to AI, retention and privacy constraints | AI provider, prompt or transmitted fields change |

Do not duplicate the same source of truth across documents. Link to the authoritative file instead.

## Context loading order

1. `AGENTS.md`
2. `HANDOFF.md`
3. The newest relevant `CHANGELOG.md` entry
4. A matching `.agent/skills/*/SKILL.md`
5. The relevant section of `docs/PROJECT_MAP.md`
6. Scoped rules and implementation files for the requested area

Use the full repository only when documentation is stale, the change is cross-cutting, the project structure changed substantially or the local context cannot answer the question. Do not load generated assets, dependency output, old handoff history or environment values without a specific need.

## Documentation impact matrix

| Change | Project Map | Changelog | Handoff | AGENTS | Skill |
|---|---:|---:|---:|---:|---:|
| New module/integration | Yes | Yes | If current | If permanent rule | If workflow repeats |
| User-visible bug fix | Usually no | Yes | If active/current | Usually no | Usually no |
| Database/RLS/RPC change | If boundary changes | Yes | Yes | If rule changes | `database-change` |
| AI provider/prompt/data change | If integration boundary changes | Yes | Yes | If security rule changes | Review `AI_PRIVACY.md`; update AI workflow if needed |
| Deploy/release | No, unless architecture changes | Yes | Yes | Only if release rule changes | `release-handoff` |
| Documentation-only correction | No | If historically meaningful | If current state changes | If rule changes | No |

## Post-change protocol

After implementation and validation, ask:

1. Did the architecture, data flow, boundary or integration change? Update `docs/PROJECT_MAP.md`.
2. Did user-visible behavior or important internal behavior change? Add a concise entry to `CHANGELOG.md` in the release/status update; the feature PR can describe the change in its PR body while it is waiting to merge.
3. Did current work, pending tasks, known issues or deployment status change? Rewrite `HANDOFF.md` in the same release/status update so it remains current.
4. Did a permanent rule or convention change? Update the relevant `AGENTS.md`.
5. Did a repeatable workflow change? Update the relevant project skill.

Do not update documents merely because a file changed. Do not leave a newer release handoff/changelog only in the working tree when deploying: stage, commit and push them in the single release/status PR after the feature branch is synchronized.

## Handoff policy

`HANDOFF.md` is a current snapshot, not an append-only journal. It should contain:

- the production and branch state;
- recently completed work that still affects continuation;
- active work and one primary next step;
- confirmed pending tasks and known issues;
- important decisions and their impact;
- latest files/DB objects touched;
- validation and deployment evidence.

Move historical detail to `CHANGELOG.md` or stable architecture/runbook documents. Remove stale “not deployed” statements after a release is verified.

## Changelog policy

`CHANGELOG.md` is chronological. Each meaningful entry should say what changed, the relevant files/DB objects, validation and deployment state. It should not become an active task list or a duplicate architecture guide.

## Parallel PR and auto-merge policy

Feature PRs should not rewrite the root `HANDOFF.md` or the top of `CHANGELOG.md` while other release work is in flight. Keep the release summary in the PR description, then update the canonical files once in a release/status PR after the feature branch is merged or queued. This keeps the files authoritative without making them merge-conflict hotspots.

## Skills policy

Use only the smallest relevant project skill. Current workflows are:

- `.agent/skills/feature-development/SKILL.md` for normal frontend/domain work;
- `.agent/skills/database-change/SKILL.md` for migrations, RLS, RPC or scheduled database behavior;
- `.agent/skills/release-handoff/SKILL.md` for validation, documentation synchronization and release preparation.

Skills should point to source-of-truth documents, not copy the entire project map.
