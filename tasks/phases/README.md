# Phase Playbooks

Executable phase-by-phase plan. Each file is self-contained: read it, execute every step, verify, move to the next phase.

## For the executing agent

1. Start at `phase-0-decisions.md`. Do not skip ahead.
2. Each phase has a **Gate** section at the bottom. You may NOT start the next phase until every gate item is checked.
3. If a step fails twice, stop. Log in `tasks/lessons.md`. Ask the human.
4. Run commands from the `web_transition/` repo root unless a step explicitly changes directory. All file paths are relative to that root.
5. All shell commands assume bash (use Unix paths, forward slashes).
6. Re-read [implementation_guide.md](../../implementation_guide.md) and [mvp_plan.md](../mvp_plan.md) before starting. This folder is the execution detail layer.

## Phase map

| # | File | Goal | Duration |
|---|------|------|----------|
| 0 | [phase-0-decisions.md](./phase-0-decisions.md) | Accounts + yfinance spike | 2h |
| 1 | [phase-1-scaffold.md](./phase-1-scaffold.md) | Empty Next.js deployed at `dashboard.<domain>` | 4h |
| 2 | [phase-2-schema.md](./phase-2-schema.md) | Supabase tables + seeded watchlist | 3h |
| 3 | [phase-3-read-path.md](./phase-3-read-path.md) | `/watchlist` renders real data | 1 day |
| 4 | [phase-4-refresh-worker.md](./phase-4-refresh-worker.md) | Cron-driven daily refresh | 1 day |
| 5 | [phase-5-auth.md](./phase-5-auth.md) | Magic-link auth + allowlist | 4h |
| 6 | [phase-6-mvp-test.md](./phase-6-mvp-test.md) | Walkthrough, fix, decommission local | 4h |

## Conventions

- **Files to create**: exact paths + stub content where non-obvious. Copy-paste where possible.
- **Verify**: a concrete check after each task. Don't move on without it.
- **Don't**: anti-patterns that have bitten similar ports.

## When in doubt

Read the relevant `docs/runbook/*.md` or the original `legacy/*.py` / `legacy/*.html`. The legacy code is the ground-truth spec.

If `tasks/todo.md` disagrees with this file, `tasks/phases/` is the source of truth.
