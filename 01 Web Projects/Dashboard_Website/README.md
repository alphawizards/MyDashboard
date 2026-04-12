# RetireAU Dashboard — Implementation Handoff Pack

This folder contains the complete specification and reference material for rebuilding Matty's local single-file HTML retirement dashboard (`Retirement_Dashboard_v2.html`) as a multi-user Next.js web application. Everything you need to design, build, test, and ship the app is in this folder — no external context required.

## Start Here

1. Read this README fully.
2. Read the docs in the order listed below.
3. Run `node tools/verify_fixture_a.js` to confirm the verified calculation baseline reproduces on your machine.
4. Follow the 8-phase implementation plan in `docs/06-implementation-plan.md`, using phase verification gates before moving on.

## Folder Layout

```
Dashboard_Website/
├── README.md                         ← you are here
├── DEFINITION_OF_DONE.md             ← acceptance criteria for v1 ship
├── .env.example                      ← environment variable template
├── docs/                             ← specification documents (read in order)
│   ├── 01-architecture-overview.md
│   ├── 02-database-schema.md
│   ├── 03-frontend-components.md
│   ├── 04-css-design-system.md
│   ├── 05-validation-checklist.md
│   ├── 06-implementation-plan.md
│   ├── 07-config-reference.md
│   ├── 08-calculation-engine.md
│   ├── 09-chart-configs.md
│   ├── 10-test-fixtures.md
│   ├── 11-api-contracts.md
│   ├── 12-state-management.md
│   ├── 13-edit-mode-forms.md
│   ├── 14-loading-empty-error-states.md
│   ├── 15-accessibility.md
│   ├── 16-navigation-routing.md
│   ├── 17-auth-middleware.md
│   ├── 18-cloud-sync-flow.md
│   ├── 19-observability.md
│   ├── 20-db-migration-runbook.md
│   ├── 21-dev-seed-fixtures.md
│   ├── 22-security-threat-model.md
│   ├── 23-performance-budget.md
│   ├── 24-feature-flags.md
│   └── 25-error-taxonomy.md
├── tools/
│   └── verify_fixture_a.js           ← runnable baseline verification script
└── reference/
    └── Retirement_Dashboard_v2.html  ← frozen snapshot of the source dashboard
```

## Reading Order

The docs are numbered for a reason. Read them in this order on day one:

| Order | Document | Purpose | When you need it |
|-------|----------|---------|------------------|
| 1 | `01-architecture-overview.md` | Stack, auth flow, data flow, deployment | Before writing any code |
| 2 | `06-implementation-plan.md` | 8-phase build plan (Days 1–10) | Your daily playbook |
| 3 | `02-database-schema.md` | SQL/Prisma schema, TypeScript config interface | Phase 1 — data layer |
| 4 | `07-config-reference.md` | Every CONFIG field annotated | Phase 1 — data layer |
| 5 | `08-calculation-engine.md` | Every formula with inputs/outputs/edge cases | Phase 2 — calculation engine |
| 6 | `10-test-fixtures.md` | Three persona fixtures + verified expected outputs | Phase 2 onwards — TDD baseline |
| 7 | `03-frontend-components.md` | Component tree, props, hooks | Phase 3 — UI layer |
| 8 | `04-css-design-system.md` | Colour tokens, typography, Tailwind config | Phase 3 — UI layer |
| 9 | `09-chart-configs.md` | All 16 Chart.js instances mapped | Phase 3 — charts |
| 10 | `11-api-contracts.md` | Zod schemas, endpoints, auth, errors | Phase 4 — backend API |
| 11 | `17-auth-middleware.md` | Clerk middleware, route protection, webhooks | Phase 4 — backend API |
| 12 | `18-cloud-sync-flow.md` | Local-first sync, conflict resolution, offline queue | Phase 4 — backend API |
| 13 | `12-state-management.md` | Zustand slices, selectors, persistence, hydration | Phase 3 — UI layer |
| 14 | `13-edit-mode-forms.md` | Edit mode pattern, react-hook-form, optimistic updates | Phase 3 — UI layer |
| 15 | `14-loading-empty-error-states.md` | Skeletons, error boundaries, offline banner, copy deck | Phase 3 — UI layer |
| 16 | `16-navigation-routing.md` | App Router tree, layouts, nav components | Phase 3 — UI layer |
| 17 | `15-accessibility.md` | WCAG 2.1 AA, keyboard nav, chart table alternatives | Phase 3 — UI layer |
| 18 | `19-observability.md` | Sentry + pino, PII redaction, correlation IDs | Phase 4 onwards |
| 19 | `25-error-taxonomy.md` | Complete error code table, user-facing copy | Phase 4 — backend API |
| 20 | `20-db-migration-runbook.md` | Prisma + JSONB schema migration playbook | Referenced when schema changes |
| 21 | `21-dev-seed-fixtures.md` | Seed script, Fixture B/C loaders, PII guards | Phase 1 — local dev setup |
| 22 | `23-performance-budget.md` | Core Web Vitals, bundle budget, measurement plan | Phase 8 — polish |
| 23 | `22-security-threat-model.md` | STRIDE, OWASP mapping, incident response | Before launch |
| 24 | `24-feature-flags.md` | `NEXT_PUBLIC_ENABLE_*` flag behaviour and lifecycle | Phase 4 onwards |
| 25 | `05-validation-checklist.md` | 10-section verification checklist + regression tests | Before each phase gate |

The docs are grouped by when you need them, not by numeric order. Docs 01–11 are the foundational pack (architecture, data, calculations, UI scaffolding, tests). Docs 12–25 are deeper specifications for specific subsystems: state management, forms, error handling, routing, accessibility, auth middleware, cloud sync, observability, migrations, seeding, performance, security, feature flags, and the error taxonomy. Skim titles 12–25 early so you know where to look; read them fully when you hit the matching phase.

The `reference/Retirement_Dashboard_v2.html` file is a frozen snapshot of the source dashboard at handoff time. Use it as the authoritative source for line-number references inside the docs — if a doc says "see line 1876", it means line 1876 of this frozen copy. Do not edit this file.

## Quickstart

```bash
# 1. Clone / create the Next.js project per docs/06-implementation-plan.md Phase 1
npx create-next-app@14 retire-au --typescript --tailwind --app --src-dir

# 2. Install core dependencies (pin versions as documented in Phase 1)
cd retire-au
npm install @clerk/nextjs@latest @prisma/client prisma zod zustand \
            react-chartjs-2 chart.js chartjs-plugin-annotation

# 3. Copy the env template and fill in real values
cp ../Dashboard_Website/.env.example .env.local
# Edit .env.local with your Clerk keys, DATABASE_URL, etc.

# 4. Reproduce the verified calculation baseline
cd ../Dashboard_Website
node tools/verify_fixture_a.js
# You should see: savingsRate : 42.65, monthlyIO : 5,133, monthlyPI : 6,821, etc.

# 5. Start Phase 1: scaffold + data layer (see docs/06-implementation-plan.md)
```

## How to Use the Verification Script

`tools/verify_fixture_a.js` is a standalone Node script (no dependencies) that re-implements the source dashboard's calculation functions against Matty & Partner's real CONFIG blob. It produces the exact values documented as Fixture A in `docs/10-test-fixtures.md`.

Use it as your TDD ground truth:

1. Port a calculation function to TypeScript (e.g., `calculateBudget`).
2. Write a Vitest/Jest test that feeds it Fixture A and asserts against the documented expected output (e.g., `expect(result.savingsRate).toBeCloseTo(42.65, 0.1)`).
3. If the test fails, run `node tools/verify_fixture_a.js` and compare — either your port is wrong, or the doc is stale (almost always the port).
4. Never edit the expected values in the doc to make a test pass. If you genuinely believe the doc is wrong, re-run the verification script; if it still disagrees, raise it for review before changing anything.

## PII and Data Handling — Read This Before First Commit

**`reference/Retirement_Dashboard_v2.html` and `docs/10-test-fixtures.md` (Fixture A) contain real personal financial information** — actual salaries, real debt balances, real property values, and real family details. This data must not leak into a public repository.

Before your first `git push`:

1. Add `reference/` to `.gitignore` **or** keep the repo private indefinitely.
2. Before writing test fixtures into your source tree, replace Fixture A's numeric values with sanitised equivalents in a file named `tests/fixtures/fixture-a.local.ts` and add that path to `.gitignore`. Keep a scrubbed `fixture-a.example.ts` in the repo for other contributors.
3. Never paste the full CONFIG blob into commit messages, PR descriptions, issue comments, CI logs, or any public channel.
4. Environment variables go in `.env.local` (already in the default Next.js `.gitignore`). Never commit `.env.local`, `.env.production`, or any file with real Clerk secrets or database URLs.
5. If the app is deployed to a shared staging environment, seed it with Fixture B or C (synthetic personas in `docs/10-test-fixtures.md`) rather than Fixture A.

If you're unsure whether something contains PII, assume it does and ask before committing.

## Definition of Done

See `DEFINITION_OF_DONE.md` for the full acceptance criteria. At a high level: v1 is shippable when all documented regression tests pass, Fixture A matches `verify_fixture_a.js` output exactly, feature parity with the local HTML dashboard is confirmed via the checklist in `docs/05-validation-checklist.md`, the app is deployed to Railway + Cloudflare with auth working end-to-end, and a full signup → save config → reload → verify persistence smoke test passes.

## Questions / Escalation

If a doc is ambiguous, contradicts another doc, or contradicts the source dashboard, **do not guess**. Pause, flag the conflict, and ask for clarification before building against an assumption. The reference dashboard is the ground truth for calculation behaviour; the specification docs are the ground truth for new architectural decisions. When in doubt, run the verification script.
