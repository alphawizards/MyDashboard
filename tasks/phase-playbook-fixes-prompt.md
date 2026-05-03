# Agent Prompt — Execute Phase Playbook Fixes

Copy everything below the `---` into the target agent's first message.

---

You are executing a documentation + minor-code fix pass on the Morning Dashboard web transition project. The full fix plan is already written — your job is to apply it task by task, verify each edit, and commit in small atomic commits.

## Read first (in this order, before any edit)

1. `C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\tasks\phase-playbook-fixes.md` — the fix plan. This is your primary instruction set. Every task below maps to a numbered section in that file.
2. `C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\CLAUDE.md` — project invariants and working style.
3. `C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\docs\invariants.md` — the 13 invariants. Task 1.4 and Task 4.1 touch I5/I7/I12.
4. `C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\docs\conventions.md` — code style.

When the fix plan says "§2.3" or "Step 5.6", treat `tasks/phase-playbook-fixes.md` as authoritative; the phase playbook is what you're editing.

## Operating rules

1. **Do not deviate from the fix plan.** If you find something genuinely broken that isn't in the plan, stop and ask the human before acting. The plan already ruled out scope expansion.
2. **Surgical edits only.** Touch only what each task names. No adjacent "while I'm here" cleanup. No re-flowing paragraphs.
3. **Re-read before editing.** The `Edit` tool fails silently on stale context. Before every `Edit` call: (a) `Read` the file, (b) apply edit, (c) `Read` again to confirm.
4. **Preserve markdown fidelity.** No broken code fences, no dropped backticks, no removed blank lines between sections.
5. **Conventional commits, one per subtask group.** Formats:
   - `fix(phase-1): use next.config.ts instead of .js in playbook`
   - `fix(phase-2): resolve legacy html path relative to script file`
   - `fix(phase-2): brace-balanced defaultStocks parser`
   - `docs(invariants): add I5 carve-out for phase-3 watchlist page`
   - `chore(env): align .env.example with phase-5 keys`
   - `docs(tasks): rewrite todo.md to match 0..6 phase numbering`
   - etc.
6. **Type/lint/test gate** — after any commit that touches `web_transition/app/**`, run from `web_transition/app/`:
   ```
   npm run typecheck && npm run lint && npm test
   ```
   Must be green. Playbook-only edits (markdown) skip this.
7. **Never touch secrets or `.env.local`.** `.env.example` is the only env file you may edit. Append-only.
8. **Never commit if a gate fails.** Fix the issue, re-stage, new commit.

## Task execution order

Follow the exact order in `tasks/phase-playbook-fixes.md` §"Execution order":

1. **Task 0** — Prereqs. Read listed files. Before touching anything, print a one-line note stating: actual Next.js version from `web_transition/app/package.json`, actual `next.config.*` extension, and current `.env.example` keys.
2. **Task 1.1** → `tasks/phases/phase-1-scaffold.md` §1.2. Swap JS→TS next.config. Commit.
3. **Task 1.2** → `tasks/phases/phase-2-schema.md` §2.3. Fix cwd-relative path. Update pitfall bullet. Commit.
4. **Task 1.3** → `tasks/phases/phase-2-schema.md` §2.3. Replace `parseDefaultStocks` with brace-balanced version. Add sub-step 2.3b referencing parser unit test. Commit.
5. **Task 1.4** — **STOP AND ASK HUMAN** which option (A or B) to implement for Invariant I5 carve-out. Do not pick silently. After human replies, apply edits across `phase-3-read-path.md`, `phase-5-auth.md`, and `docs/invariants.md`. Commit.
6. **Task 1.5** → `tasks/phases/phase-5-auth.md` §5.6. Fix middleware matcher + add curl verify step. Commit.
7. **Task 2.1** → `tasks/phases/phase-1-scaffold.md` §1.3 + `web_transition/app/.env.example`. Append env keys. Commit.
8. **Task 2.2** → `infra/env-vars.md`. If file missing, create it with the minimum row-per-key table described. Commit.
9. **Task 3.1** → `tasks/todo.md` wholesale rewrite per exact template in fix plan. Commit.
10. **Task 3.2** → Align Next.js version string across `CLAUDE.md`, phase docs, README, implementation_guide. Grep verify. Commit.
11. **Task 3.3** → `tasks/phases/phase-4-refresh-worker.md` §4.9. Build command edit + "why" note. Commit.
12. **Task 3.4** → `tasks/phases/phase-2-schema.md` §2.7 + `tasks/phases/phase-4-refresh-worker.md` §4.4. Add verify SQL + kind-unique constraint. If `schema/001_initial.sql` lacks the constraint, create `schema/003_ndx_kind_unique.sql`. Commit.
13. **Task 4.1** → `tasks/phases/phase-6-mvp-test.md` Gate. Add audit + /api/refresh live-test items. Commit.
14. **Task 4.2** → `tasks/phases/phase-4-refresh-worker.md` §4.6 + §4.4 refactor note. Commit.
15. **Task 4.3** → `tasks/phases/phase-0-decisions.md` §0.4. Replace hardcoded X user ID block. Commit.
16. **Task 4.4** → `tasks/phases/phase-0-decisions.md` §0.6. Scope spike to `/tmp/yfinance-spike`. Commit.
17. **Task 5.1** + **Task 5.2** — Minor polish in `phase-3-read-path.md` and `tasks/phases/README.md`. Single commit: `docs(phases): minor polish`.

## Mandatory decision point

**Task 1.4 has two options (A = anon-read with RLS migration; B = documented audit carve-out).** You **must** ask the human before implementing. Present the two options concisely, recommend B (less scope), wait for reply. Do not proceed past Task 1.3 until you have the decision.

## Final verification pass (after Task 5)

Run from `web_transition/`:

```
grep -rn "next\.config\.js" tasks/ docs/ CLAUDE.md
grep -rn "Phase 1 — Scaffold & schema" tasks/
grep -rn "readFileSync.*'legacy/morning-watchlist" tasks/
grep -c '^## Phase' tasks/todo.md
grep -rn "Next\.js 15\|Next 15" CLAUDE.md tasks/ docs/ README.md implementation_guide.md
```

Expected:
- First three: zero matches.
- Fourth: `7`.
- Fifth: zero matches.

If any differ, stop and investigate before declaring done.

## Handoff output

When every task is complete, write a summary to `tasks/lessons.md` (append, don't overwrite) with this structure:

```md
## 2026-04-25 — Phase playbook fix pass

Files touched:
- <list, one per line, absolute paths>

Decisions escalated:
- Task 1.4: human chose Option <A|B>. <reason>

Skipped (with reason):
- <task id>: <why>

Final audit:
- <paste the 5 grep results here>

Commits created (newest first):
- <sha> <subject>
- ...
```

Then print a two-line final status to the human:
1. Count of tasks completed / skipped.
2. Path to the handoff summary.

## Failure handling

- If an edit fails twice (e.g., `Edit` tool returns "old_string not found" after two re-reads), stop, log the blockage in `tasks/lessons.md`, and ask the human.
- If a commit's type/lint/test gate fails, fix the underlying issue — never `--no-verify`.
- If the fix plan itself contradicts the invariants doc, the invariants doc wins. Stop and flag to human.

## Scope hard boundaries

You may edit:
- `tasks/phases/*.md`
- `tasks/todo.md`
- `tasks/lessons.md` (append only)
- `docs/invariants.md` (only the carve-out note per Task 1.4)
- `infra/env-vars.md` (create if missing)
- `web_transition/app/.env.example` (append only)
- `CLAUDE.md`, `README.md`, `implementation_guide.md` (version-string alignment only)
- `schema/003_ndx_kind_unique.sql` (create, if needed per Task 3.4)

You may NOT edit:
- Any `web_transition/app/**` source (`.ts`, `.tsx`, `.js`, `.json`) except `.env.example` and `next.config.ts` reconciliation if drift is found.
- `schema/001_initial.sql`, `schema/002_rls_policies.sql` — frozen unless Task 3.4 resolution requires a new migration file (create 003, don't mutate 001/002).
- `legacy/**` — read-only.
- `.env.local` — never.
- Any git config.

## Start

Begin with Task 0. Read `tasks/phase-playbook-fixes.md` in full before your first edit. Report back after prereqs with the three facts (Next version, config extension, env keys) before proceeding.
