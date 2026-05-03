# Morning Dashboard — Web Transition

Port of a local Python + static HTML stock dashboard to:
- **Next.js 16** (App Router, TypeScript) on Railway
- **Supabase** (Postgres + Auth + RLS)
- **Cloudflare** (DNS + TLS + WAF)

Single user, email-allowlist auth. MVP scope ends at Phase 6.

---

## Read first

Before taking any action, the executing agent must load:

@tasks/phases/README.md
@tasks/todo.md
@docs/invariants.md
@docs/conventions.md
@docs/commands.md

For deeper context (load on demand, not at start):
- `implementation_guide.md` — full architectural plan
- `tasks/mvp_plan.md` — phase-by-phase MVP walkthrough
- `docs/data-flow.md` — sequence diagrams for refresh + page load
- `legacy/context.md` — quirks and constraints from the source dashboard
- `decisions/` — architectural decision records

---

## Current state

The project is in pre-build scaffolding. The executing agent should:
1. Check `tasks/todo.md` for which Phase is active.
2. Open the corresponding `tasks/phases/phase-N-*.md` and execute steps in order.
3. Do **not** skip phases. Each has a Gate section that must pass before advancing.

---

## Non-negotiable rules

These are the invariants that, if violated, corrupt data or leak secrets. Full list in `docs/invariants.md`. Top five:

1. **Never commit secrets.** X bearer token, Supabase service role key, `REFRESH_SHARED_SECRET` — all live in Railway env vars. Only placeholders in `.env.example`.
2. **`watchlist` metadata is sacred.** `catalyst`, `price_target`, `priority`, `notes` are written only by authenticated UI. The cron worker **must not** touch them. This replaces the regex-preservation hack in `legacy/refresh_all.py`.
3. **Service-role client is server-only.** `getServiceClient()` must never be imported into a `'use client'` component or any code path reachable by the browser.
4. **`/api/refresh/*` stays allowlisted in middleware.** Both the cron service and the manual "Refresh now" button call it without a user session — they rely on `REFRESH_SHARED_SECRET` instead.
5. **Fail hard on empty source data.** Importers and the refresh worker throw on zero rows. Silent data loss is never acceptable.

---

## File layout

```
web_transition/
├── CLAUDE.md                      ← this file (project root instructions)
├── README.md                      ← human-facing project overview
├── implementation_guide.md        ← full architectural plan
├── app/                           ← Next.js project (created in Phase 1)
├── schema/                        ← Supabase SQL migrations + seed
├── scripts/                       ← one-shot tooling (importer, rollback)
├── tests/                         ← unit / integration / e2e / contracts / fixtures
├── legacy/                        ← read-only reference copies from local dashboard
├── decisions/                     ← ADRs — one per architectural choice
├── tasks/
│   ├── todo.md                    ← phase checklist + current state
│   ├── lessons.md                 ← corrections log (append on every mistake)
│   ├── mvp_plan.md                ← MVP summary
│   └── phases/                    ← step-by-step playbooks (phase-0 → phase-6)
├── docs/
│   ├── invariants.md              ← data integrity + security rules (MUST obey)
│   ├── conventions.md             ← code style + file organisation
│   ├── commands.md                ← shell command reference
│   ├── data-flow.md               ← sequence diagrams
│   ├── parity-checklist.md        ← web vs legacy comparison
│   └── runbook/                   ← incident playbooks
├── infra/                         ← Railway + Cloudflare config docs
└── .github/workflows/             ← CI — typecheck, lint, test, weekly contract tests
```

---

## Tech stack constraints

- **Node 20+** — cron worker and Next runtime.
- **Next.js 16 App Router** — server components by default; mark client with `'use client'`.
- **TypeScript strict mode** — no `any`, no implicit `any`, no suppressed errors.
- **Tailwind** — utility-first; copy legacy CSS into `globals.css` for parity panels.
- **Vitest** — unit + integration. **Playwright** — e2e (3–5 tests max).
- **Supabase SSR helpers** (`@supabase/ssr`) — use `createServerClient` + `createBrowserClient`.

---

## Working style (inherits parent CLAUDE.md)

- **Plan and build are separate steps.** When asked to plan, output only the plan — no code until the user says go.
- **Re-read before editing.** Edit tool fails silently on stale context. Re-read file, edit, read again.
- **Phased execution.** Break multi-file work into phases ≤ 5 files each. Complete + verify before advancing.
- **Forced verification.** Before claiming a task done: `npm run typecheck && npm run lint && npm test`. If no checks configured, say so explicitly — never claim success with errors outstanding.
- **Sub-agent swarming.** Tasks touching > 5 independent files → launch parallel sub-agents (5–8 files each).

---

## Deferred (not MVP)

Explicitly out of scope until `mvp-v0.1.0` is tagged. See `tasks/mvp_plan.md` §"Post-MVP Backlog":
- `/feed` (X tweets) page
- Inline metadata edit UI
- Sentry + heartbeat observability
- Contract tests running weekly
- Pixel-perfect CSS parity with legacy
- Mobile polish
- Staging environment

---

## Key references

- Legacy Python worker (logic reference): `legacy/refresh_all.py`
- Legacy HTML (layout + `defaultStocks` data source): `legacy/morning-watchlist.html`
- Legacy quirks log: `legacy/context.md`
- Stack decision: `decisions/2026-04-23-stack-choice.md`
- Single-user decision: `decisions/2026-04-23-single-user-mode.md`
- Cron pattern decision: `decisions/2026-04-23-cron-pattern.md`
