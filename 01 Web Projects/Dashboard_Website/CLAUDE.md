# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **specification handoff pack** for a retirement planning dashboard called RetireAU. It contains 25 numbered spec docs, a frozen reference HTML dashboard, test fixtures, and a verification script. **The Next.js app lives in `app-next/`** (a subfolder of this repo, scaffolded in Phase 1).

The only executable in this repo is `tools/verify_fixture_a.js` — a zero-dependency Node script that is the authoritative calculation baseline.

## PII — Read Before Any Git Action

`reference/Retirement_Dashboard_v2.html` and `docs/10-test-fixtures.md` (Fixture A) contain **real personal financial information** — actual salaries, debt balances, property values, and family details.

Before any commit or push:

1. Add `reference/` to `.gitignore` **or** keep the repo private indefinitely.
2. In the Next.js project, store Fixture A values in `tests/fixtures/fixture-a.local.ts` (gitignored). Commit only a scrubbed `fixture-a.example.ts`.
3. Never paste the full CONFIG blob into commit messages, PR descriptions, issue comments, or CI logs.
4. `.env.local` must never be committed. All secrets (Clerk, DATABASE_URL) go there only.
5. For shared/staging environments, seed with Fixture B or C (synthetic personas), not Fixture A.

If unsure whether something contains PII, assume it does and ask before committing.

## Calculation Baseline

```bash
node tools/verify_fixture_a.js
```

This is the TDD ground truth for all calculation work. A clean run should produce:

```
savingsRate : 42.65
monthlyIO   : 5,133
monthlyPI   : 6,821
```

(Full expected values are in `docs/10-test-fixtures.md` Fixture A.)

**Rule:** If a ported calculation test fails, re-run this script and compare. The port is almost always wrong, not the doc. Never edit expected values in a doc to make a test pass — flag it for review first.

Paste the output of this script into any PR that touches calculation logic (required by DEFINITION_OF_DONE.md Gate 1.1).

## The App Stack (built in `app-next/`)

Next.js 14 App Router · TypeScript · Tailwind CSS · Clerk auth · Prisma + Railway PostgreSQL · Zustand · Chart.js

Quality commands (run from `app-next/`, not this folder):

```bash
cd app-next
npx tsc --noEmit        # TypeScript strict — must be zero errors
npm run lint            # ESLint — zero errors, zero warnings
npm run format:check    # Prettier — no unformatted files
npm test                # Full test suite
npm run build           # Production build
npm run db:seed         # Load Fixture B/C into local dev DB (Phase 6+)
```

Copy `app-next/.env.example` to `app-next/.env.local`. Required variables: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`.

## Doc Reading Order (Foundational Six)

| Doc | When |
|-----|------|
| `docs/01-architecture-overview.md` | Before writing any code |
| `docs/06-implementation-plan.md` | Daily build playbook (8 phases, Days 1–10) |
| `docs/02-database-schema.md` | Phase 1 — data layer |
| `docs/07-config-reference.md` | Phase 1 — CONFIG field reference |
| `docs/08-calculation-engine.md` | Phase 2 — every formula with edge cases |
| `docs/10-test-fixtures.md` | Phase 2 onwards — TDD baseline (⚠ contains PII) |

Full ordered reading guide (all 25 docs): see README.md §Reading Order.

## Shipping Contract

See `DEFINITION_OF_DONE.md` for the 10 shipping gates with exact verification commands. Every gate requires evidence (command output, screenshot, or CI run). No self-approval — open a PR titled `RetireAU v1 — Ready for Review` and wait for review before merging.

## Reference Dashboard

`reference/Retirement_Dashboard_v2.html` is a **frozen snapshot**. When a doc says "see line 1876", it means line 1876 of this file. Do not edit it. It is the authoritative source for calculation behaviour; spec docs are authoritative for new architectural decisions.

## Ambiguity Rule

If a doc is ambiguous, contradicts another doc, or contradicts the reference dashboard — **do not guess**. Pause, flag the conflict, and ask for clarification. The reference dashboard wins on calculation behaviour; the spec docs win on architecture.

## v1 Non-Goals

Do not build: multi-tenant organisations, email notifications, native mobile app, AI/LLM features, live bank integration (Basiq/Plaid), real-time websocket sync, internationalisation, social sharing, a public marketing site.
