# Critical Fix Proposals — RetireAU Handoff Pack

**Status:** Draft fixes for Critical gaps identified in the 2026-04-10 audit. Part 1 can be applied immediately (no decisions needed — these are bugs). Part 2 is blocked on answers in `OPEN-QUESTIONS.md`.

Apply fixes top-to-bottom. Each fix lists the affected file, the old text, and the replacement. Where a fix affects multiple docs, apply all sub-edits together.

---

## Part 1 — Apply Now (no decisions needed)

These are factual errors, orphan references, or sample code that contradicts its own rules. No question to answer.

### Fix 1.1 — Arithmetic error in `doc 08` Scenario B

**File:** `docs/08-calculation-engine.md` §Scenario B (worked example)
**Bug:** Text claims "25 years" of drawdown but formula is `max(85 − 65, 87 − 63)`.
**Correct value:** `max(20, 24) = 24 years`.

```diff
- Expected drawdown horizon: 25 years (max(85−65, 87−63) = 22 years)
+ Expected drawdown horizon: 24 years (max(85−65, 87−63) = max(20, 24) = 24 years)
```

Also update any downstream assertion in `docs/10-test-fixtures.md` that references the Scenario B horizon.

---

### Fix 1.2 — AU tax constant errors in `doc 01`

**File:** `docs/01-architecture-overview.md` §AU_TAX_DATA sample block

```diff
  superannuationGaranteeRate: 0.115,
- medicareLevyThreshold: 180000,
+ topMarginalBracket: 190000,          // FY2025+ top rate $190k+
+ medicareLevyLowIncomeThreshold: 27222, // Single, 2024. Source: ATO.
+ medicareLevyRate: 0.02,
```

Additionally, remove the entire inline `AU_TAX_DATA` sample from `doc 01` — it duplicates (and contradicts) `lib/au-tax-data.ts`. Replace with:

> AU tax constants live in a single source of truth at `lib/au-tax-data.ts`. See `docs/07-config-reference.md` for the authoritative values. Do not duplicate constants in this doc.

---

### Fix 1.3 — Preservation age range in `doc 07`

**File:** `docs/07-config-reference.md` §profile.preservationAge

```diff
- preservationAge: number   // Valid range: 55–67
+ preservationAge: number   // Fixed at 60 for anyone born after 1964 (AU legislation).
+                           // Older cohorts: see ATO preservation-age table. The app
+                           // defaults to 60 and only exposes the field for older users.
```

Default stays at `60`. Add a note in `doc 13-edit-mode-forms.md` that this field should be read-only in the UI unless the user's DOB predates 1964.

---

### Fix 1.4 — `doc 25` error taxonomy copy bug

**File:** `docs/25-error-taxonomy.md` §SYNC_NETWORK_ERROR

The current copy contains an unescaped apostrophe inside a JavaScript template literal: `you're`. Either escape it, use single quotes consistently, or switch to a double-quoted string.

```diff
- message: `Can't reach the cloud — you're working offline. Changes saved locally.`
+ message: `Can't reach the cloud — you are working offline. Changes saved locally.`
```

(Alternative: use `\u2019` or swap the outer template to double quotes.)

---

### Fix 1.5 — `doc 17` sample code violates DoD Gate 7.6

**File:** `docs/17-auth-middleware.md` §Clerk webhook handler (sample code)
**Bug:** Sample calls `console.error(...)`, but DoD Gate 7.6 forbids `console.log`/`console.error` in committed source.

```diff
- console.error('Webhook signature verification failed:', err);
+ logger.error({ err, event: 'clerk.webhook.signature_failed' }, 'Webhook signature verification failed');
+ Sentry.captureException(err, { tags: { scope: 'clerk-webhook' } });
```

Apply the same substitution to every `console.*` call in sample code across all spec docs. Run `grep -rn "console\." docs/` after fixing.

---

### Fix 1.6 — Orphan doc references in `doc 01`

**File:** `docs/01-architecture-overview.md` §File Structure + §Testing Strategy
**Bug:** References phantom docs: `02-component-specifications.md`, `03-deployment-guide.md`, `04-testing-strategy.md`. Real docs at those numbers are DB schema / frontend components / CSS.

**Action:** Replace each reference with the correct doc number. If no equivalent exists, delete the reference entirely.

```diff
- See docs/02-component-specifications.md for component details.
+ See docs/03-frontend-components.md for component details.

- See docs/03-deployment-guide.md for Railway setup.
+ See docs/06-implementation-plan.md §Phase 7 for Railway setup.

- See docs/04-testing-strategy.md for test patterns.
+ See docs/10-test-fixtures.md for test fixtures and docs/05-validation-checklist.md for acceptance tests.
```

---

### Fix 1.7 — `currentYear` field leakage in `doc 08`

**File:** `docs/08-calculation-engine.md` §6 (Budget KPIs worked example)
**Bug:** Hardcodes "Matty fortnightly net: 5,298" and cites "Bank statement average (Jan–Mar 2026)" as a calculation input source. The engine spec must be persona-free.

```diff
- Example: Matty fortnightly net: 5,298 (Bank statement average Jan–Mar 2026).
+ Example: user1.fortnightlyNet (from config).
+ All numeric examples in this section are illustrative — real values come from
+ `lib/au-tax-data.ts` constants and the user's CONFIG blob.
```

Move the persona-specific values to `docs/10-test-fixtures.md` Fixture A only.

---

### Fix 1.8 — Field rename: `children.numChildren` → `children.count`

**Files:** `docs/02-database-schema.md`, all references across `docs/08`, `doc 12`, `doc 13`
**Bug:** `doc 07` uses `children.count`; `doc 02` uses `children.numChildren`. Pick one (recommend `count`, it's shorter and `doc 07` is closer to canonical).

**Action:** Global rename across all docs.

```diff
- numChildren: number
+ count: number
```

---

### Fix 1.9 — Hex color Zod regex rejects valid colors

**File:** `docs/11-api-contracts.md` §validation helpers (or wherever `hexColor` is defined)

```diff
- hexColor: z.string().regex(/^#[0-9a-f]{6}$/i)
+ hexColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
```

(Accept 3-digit shorthand. Reject `rgba()` — Chart.js doesn't need it in user-editable fields.)

---

### Fix 1.10 — `/api/sync` vs `/api/sync/resolve` path mismatch

**Files:** `docs/11-api-contracts.md`, `docs/17-auth-middleware.md`
**Bug:** `doc 17` lists `/api/sync/resolve` on the middleware matcher; `doc 11` only documents `POST /api/sync`.

**Action:** Pick one and update the other.

```diff
// In doc 17:
- '/api/sync/resolve',
+ '/api/sync',

// OR in doc 11:
+ ### POST /api/sync/resolve
+ Resolves a last-write-wins conflict. See doc 18 §Conflict Resolution.
```

Recommend renaming `doc 17` to match `doc 11` — the single `/api/sync` endpoint can handle conflict resolution via a `resolution` field in the body.

---

### Fix 1.11 — Health endpoint leaks error details

**File:** `docs/19-observability.md` §health route example

```diff
  } catch (err) {
    return Response.json(
-     { ok: false, database: err.message },
+     { ok: false, database: 'disconnected' },
      { status: 503 }
    );
  }
```

Keep the full error in the server log via `logger.error({ err })`, but never surface it in the response body.

---

### Fix 1.12 — Seed script guard is incomplete

**File:** `docs/21-dev-seed-fixtures.md` §seed script guard

```diff
- if (process.env.NODE_ENV === 'production') {
+ const allowedEnvs = ['development', 'test'];
+ if (!allowedEnvs.includes(process.env.NODE_ENV ?? '')) {
    console.error('Seed script refused: only runs in development/test.');
    process.exit(1);
  }
```

Whitelist, not blacklist. Prevents accidental runs in Railway staging/preview.

---

## Part 2 — Unblocked (answers recorded 2026-04-11)

### Fix 2.1 — Collapse config schema to a single source

**Answer:** Q1 → Option C. `user1`/`user2` in DB/API/Zod; `matty`/`partner` as selector aliases only.

**Files affected:**
- `docs/02-database-schema.md` — Prisma schema, DashboardConfig TS interface
- `docs/07-config-reference.md` — field-by-field reference
- `docs/01-architecture-overview.md` — remove inline TS interface
- `docs/03-frontend-components.md` — rename component prop references
- `docs/12-state-management.md` — rename Zustand slice accessors
- `docs/13-edit-mode-forms.md` — rename form field paths
- `docs/08-calculation-engine.md` — rename calculation input references
- `docs/11-api-contracts.md` — rename Zod schema paths
- `docs/25-error-taxonomy.md` — rename error sample field paths
- `tools/verify_fixture_a.js` — rename any fixture path accessors

**Fix shape (Q1 → Option C):**

1. Delete the TypeScript `DashboardConfig` interface from `doc 01` entirely.
2. Make `doc 02` the canonical schema declaration. Every other doc references it via `import type { DashboardConfig } from '../types/config'`.
3. Global rename across all docs:
   - `profile.matty` → `profile.user1`
   - `profile.partner` → `profile.user2`
   - `mattySuper`, `partnerSuper`, `mattyGrossSalary` → `profile.user1.super`, `profile.user2.super`, `profile.user1.grossSalary`
4. Add to `doc 07`: "Display aliases (`matty`, `partner`) are computed in `lib/selectors/personas.ts` — reads `displayName` from `profile.user1`/`profile.user2`. The persisted schema and all API contracts always use `user1`/`user2`. Never use persona names in DB migrations, Zod schemas, or API routes."
5. Add to `doc 12`: Zustand selectors expose `useMatty()` / `usePartner()` as aliases for `state.profile.user1` / `state.profile.user2`. Underlying store shape is `user1`/`user2` only.
6. Add a migration note: if any Fixture A data uses old names, add `migrateV0ToV1()` that renames keys on first load.

**Verification:** `grep -rn "profile\.matty\|profile\.partner\|mattySuper\|partnerSuper\|mattyGrossSalary" docs/ tools/` should return zero results after the rename.

---

### Fix 2.2 — Reconcile mortgage field names

**Answer:** Q1 → Option C. Same rename pass as Fix 2.1.

**Files affected:** `docs/02`, `docs/07`, `docs/08`, `docs/13`, `docs/25`

**Fix shape (recommended canonical paths):**

```
mortgage.loanAmount      — principal owed today
mortgage.rate            — current interest rate (decimal, e.g. 0.056)
mortgage.termYears       — total loan term
mortgage.ioPeriodYears   — interest-only period within the term
mortgage.mode            — 'io-then-pi' | 'pi-only' | 'io-only'
```

Delete `amount`, `defaultRate`, `defaultTerm`, `mortgageRate` (flat) from every doc. Add a unit-test in Phase 3 that asserts every `mortgage.*` path exists in the config schema.

---

### Fix 2.3 — Resolve schema v2 ambiguity

**Answer:** Q2 → Option C. Delete `migrateV1ToV2()` section from `doc 20` entirely. `CURRENT_SCHEMA_VERSION = 1` stays. No `residency.state` field in v1 scope.

**Files affected:** `docs/20-db-migration-runbook.md`

**Fix shape:**

Delete the entire `migrateV1ToV2()` block and any test fixture or workflow step that references it. If doc 20 has a §Schema Versions table listing v2, remove that row. `CURRENT_SCHEMA_VERSION = 1` in `doc 02` is untouched.

---

### Fix 2.4 — Add DELETE endpoints for account deletion

**Answer:** Q5 → Option C. Both `DELETE /api/user` and `user.deleted` webhook.

**Files affected:** `docs/11-api-contracts.md`, `docs/17-auth-middleware.md`, `docs/22-security-threat-model.md`

**Fix shape:**

Add to `doc 11` §Endpoints:

```
### DELETE /api/user
Hard-deletes the authenticated user and cascades to their config rows.

Auth: required (Clerk session).
Request body: { confirmation: 'DELETE' }  // guard against accidental calls
Response (200): { deletedAt: ISO8601, clerkUserDeleted: boolean }
Response (400): { error: 'CONFIRMATION_MISMATCH' }
Side effects (in order):
  1. Delete all configs rows for this userId (cascade).
  2. Delete the users row.
  3. Call Clerk Backend API to delete the Clerk user (best-effort; if it fails, log and continue — webhook will pick up stragglers).
  4. Revoke all sessions via Clerk.
  5. Return response and let the client redirect to / with a toast.
```

Add to `doc 11` §Webhooks:

```
### POST /api/webhooks/clerk — user.deleted
Triggered when a user is deleted via the Clerk dashboard or any path that bypasses DELETE /api/user.
Handler:
  1. Verify webhook signature.
  2. Look up userId from event.data.id.
  3. If configs/users rows still exist, cascade-delete them.
  4. Idempotent — safe to receive twice.
  5. Emit a Sentry event (info level) for visibility.
```

Add a DoD gate evidence row that runs the full flow end-to-end.

---

### Fix 2.5 — Add `/api/export` + privacy policy spec for APP compliance

**Answer:** Q8 → public multi-user app. APP compliance mandatory. US hosting retained with cross-border disclosure in privacy policy.

**Files affected:** `docs/11-api-contracts.md`, new `docs/27-privacy.md`

**Fix shape:**

Add `/api/export` endpoint to `doc 11`:

```
### GET /api/export
Auth: required.
Response (200, application/json): the full DashboardConfig blob + metadata (userId, createdAt, updatedAt, schemaVersion).
Response headers: Content-Disposition: attachment; filename="retireau-export-<userId>-<timestamp>.json"
```

Add a button to `/settings` that hits this endpoint.

Create `docs/27-privacy.md` covering: APP 1 (privacy policy), APP 3 (collection notice at signup), APP 8 (cross-border disclosure — Railway US + Clerk US, "reasonable steps" clause), APP 11 (security of personal information), informal DPIA (one-page risk acceptance), data retention policy. Ship `/privacy` and `/data-policy` pages at launch. Add to DoD Gate 9 evidence.

---

### Fix 2.6 — Rate limit fallback spec

**Answer:** Q6 → Option B. Optional with no-op fallback.

**Files affected:** `docs/11-api-contracts.md`, `.env.example`

**Fix shape:**

Add to `doc 11` §Rate Limiting:

```
If UPSTASH_REDIS_REST_URL is unset:
  - Rate-limit middleware is a no-op.
  - Response headers X-RateLimit-* are omitted (not set to 0).
  - Server logs emit a single startup warning: "Rate limiting disabled (no Upstash URL)".
  - Sentry tag: rate_limiting=disabled on every request.
Never fall back to per-replica in-memory limiting — misleading and not global.
```

---

### Fix 2.7 — Sentry fallback spec

**Answer:** Q7 → Option B. Optional with no-op fallback.

**File:** `docs/19-observability.md`

**Fix shape:**

Add to `doc 19` §Setup:

```
If SENTRY_DSN is unset:
  - Sentry.init() is not called.
  - Sentry.captureException, Sentry.captureMessage, Sentry.setTag, Sentry.addBreadcrumb all become no-op wrappers (import from lib/sentry.ts, not @sentry/nextjs directly).
  - beforeSend and reportWebVitals degrade to no-ops.
  - pino continues to emit structured logs to stdout.
  - Startup logs a single warning: "Sentry disabled (no DSN)".
```

Create `lib/sentry.ts` as a thin wrapper with the no-op fallback — no file in the codebase should import from `@sentry/nextjs` directly.

---

### Fix 2.8 — Clerk session token storage assertion (unblocks C8, related to Q5)

**File:** `docs/22-security-threat-model.md` §Assets

```diff
- Asset 2: Clerk session tokens (JWT in localStorage)
+ Asset 2: Clerk session tokens (HttpOnly cookies, managed by Clerk SDK).
+                Code must never read tokens from localStorage. The Clerk JS SDK
+                uses HttpOnly cookies by default; if any code path is found
+                reading `__clerk_*` from localStorage, treat as a bug.
```

Add a DoD Gate 7 item: `grep -rn "localStorage.*clerk" src/` must return empty.

---

### Fix 2.9 — Add `docs/26-runbooks.md`

**Answer:** Q10 → Option A. Create runbook doc.

**Fix shape:**

New file `docs/26-runbooks.md` with sections:

1. **Deploy rollback** — Railway dashboard steps, Prisma down-migration command, post-rollback smoke test
2. **Database backup restore drill** — quarterly cadence, restore-to-staging command, verification script
3. **Secret rotation** — 90-day cadence for `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `DATABASE_URL`; step-by-step zero-downtime rotation
4. **Sentry quota exhaustion** — rate-limit fallback, alert routing
5. **Incident response** — classification (P0/P1/P2), first-hour checklist, post-mortem template
6. **Clerk outage** — fallback UX (read-only local-first mode), user communication template

Reference from `DEFINITION_OF_DONE.md` Gate 8 as an evidence item.

---

### Fix 2.10 — Unify Gates vs Phases vocabulary

**Answer:** Q11 → Option A. Keep both, add Phase→Gate traceability map.

**Fix shape:**

Add a new section at the end of `docs/06-implementation-plan.md`:

```
## §Phase → Gate Traceability

| Phase | Name | DoD Gates Verified |
|-------|------|---------------------|
| 1 | Project Scaffold | 7 (partial — build succeeds, lint clean) |
| 2 | Data Layer & Config | 4 (partial), 7 (tsc clean) |
| 3 | Calculation Engine | 1 (all), 2 (regression tests for bugs 1–5) |
| 4 | Dashboard — Budget & Debt | 3 (partial), 2 (bugs 6–8) |
| 5 | Dashboard — Super & Property | 3 (complete), 2 (bugs 9–10) |
| 6 | Auth & Cloud Sync | 4 (complete), 5, 6 (partial) |
| 7 | Deployment & DNS | 6 (complete), 8 |
| 8 | Polish & Launch | 7 (complete), 9, 10 |
```

Update `docs/25-error-taxonomy.md` line 481 ("see Gate 7") to add the specific gate sub-number.

---

## Part 3 — Implementation Plan Additions (for consideration)

These weren't in the original 8-phase plan but every gap audit flagged their absence. Add as **Phase 0** (setup) and **Phase 9** (post-launch) if scope permits, or fold into existing phases as noted.

| Addition | Fold into | Rationale |
|---|---|---|
| CI/CD (GitHub Actions: lint, test, build, type-check on every PR) | Phase 1 exit criterion | Without this, DoD Gate 7 can't be verified automatically |
| `size-limit` bundle budget enforcement | Phase 8 | DoD Gate 7 claims "PR rejected if bundle +10%" — needs a tool |
| Backup restore drill (first run) | Phase 7 | DoD claims RTO 15min / RPO 24h — unverified without a drill |
| Monitoring dashboard setup (Sentry + Railway metrics) | Phase 7 | Observability doc assumes dashboards exist |
| Secret rotation dry-run | Phase 7 | Prove zero-downtime rotation works before you need it |
| Performance budget verification (Lighthouse CI) | Phase 8 | Gate 8 claims Lighthouse > 90 — needs a CI job |

---

## Verification

After applying Part 1:

```bash
# No phantom doc references
grep -rn "02-component-specifications\|03-deployment-guide\|04-testing-strategy" docs/

# No console.* in sample code
grep -rn "console\." docs/

# No legacy field names (if Q1 → Option B)
grep -rn "profile\.matty\|profile\.partner\|mattySuper\|partnerSuper" docs/ tools/

# Arithmetic fix landed
grep -n "24 years" docs/08-calculation-engine.md

# Medicare levy fix landed
grep -n "medicareLevyThreshold" docs/01-architecture-overview.md
# (should return zero results)
```

After Part 2 is unblocked and applied:

```bash
# Config rename complete
grep -rn "matty\|partner" docs/ | grep -v "display aliases"
# (should only find the one-line alias note)

# All 25 error codes referenced in code map back to the taxonomy
# (run a lint script TBD)

# Phase→Gate table exists
grep -n "Phase → Gate Traceability" docs/06-implementation-plan.md
```

---

## Suggested commit order

1. **One commit for Part 1** — all factual fixes, squashable, low review overhead. Title: `docs: fix critical errors from 2026-04-10 gap audit`.
2. **Await answers on OPEN-QUESTIONS.md.**
3. **One commit per Part 2 section** — each fix ties to a specific question, clear blame chain. Title: `docs(fix-2.x): <summary>`.
4. **One commit for Part 3** — plan additions, clearly labelled as scope decision. Title: `docs(plan): add CI/CD, perf budget, backup drill to implementation plan`.

Do not bundle Part 1 with Part 2 — Part 1 should land immediately even if questions aren't answered for days.
