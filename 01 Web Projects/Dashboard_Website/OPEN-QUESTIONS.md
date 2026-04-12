# Open Questions — RetireAU Handoff Pack

**Status:** Raised during gap audit on 2026-04-10. Every question below blocks at least one critical fix to the spec. Resolve before Phase 1 kicks off. Mark answers inline under each question and date them.

Questions are ordered by blast radius — Q1 unblocks the most downstream work.

---

## Q1 — What is the canonical `DashboardConfig` shape?

**Why it matters:** Three docs define three incompatible shapes for the same blob:

| Doc | Example path |
|---|---|
| `docs/01-architecture-overview.md` | flat: `mattySuper`, `partnerSuper`, `mattyGrossSalary` |
| `docs/02-database-schema.md` | nested: `profile.user1` / `profile.user2`, `expenses.fixed[]` / `variable[]` |
| `docs/07-config-reference.md` | nested: `profile.matty` / `profile.partner` |
| `docs/03-frontend-components.md` | reads `user1` / `user2` |
| `docs/12-state-management.md` | reads `matty` / `partner` |

Until this is resolved, **every component, calculator, migration, API contract, Zod schema, and test fixture is ambiguous**.

**Options:**

- **(A)** `doc 07` wins (`profile.matty` / `profile.partner`) — persona-specific naming, matches Fixture A, reads naturally
- **(B)** `doc 02` wins (`profile.user1` / `profile.user2`) — persona-agnostic, safer for multi-user future
- **(C)** Hybrid — keep `user1`/`user2` in the persisted schema but expose `matty`/`partner` as display aliases via selectors

**Recommendation:** Option B. It future-proofs for Fixture B (Alex) and Fixture C (Patricia) without renaming fields later, and it matches the persona-free nature of the calculation engine.

**Answer:** Option C — `user1`/`user2` in persisted DB schema and API contracts; `matty`/`partner` exposed as display aliases via Zustand selectors only. No persona names in DB, migrations, or Zod schemas.
**Date:** 2026-04-11

---

## Q2 — Is schema v2 (`residency.state`) real or hypothetical?

**Why it matters:** `docs/02-database-schema.md` declares `CURRENT_SCHEMA_VERSION = 1` with no migrations. `docs/20-db-migration-runbook.md` shows a working `migrateV1ToV2()` that adds `residency.state` — a field that exists in neither `doc 02` nor `doc 07`. Agents building the schema will not know which version is ground truth.

**Options:**

- **(A)** v2 is real → bump `doc 02` base schema to v2, add `residency.state` to `doc 07`, ship v1→v2 migration in Phase 2
- **(B)** v2 is a sample future migration → reword `doc 20` as "illustrative", delete the test fixture, keep `CURRENT_SCHEMA_VERSION = 1`
- **(C)** v2 was abandoned → delete the migration section entirely

**Recommendation:** Option B. The v1→v2 example is useful as a migration pattern; mark it clearly as illustrative.

**Answer:** Option C — delete the v1→v2 migration section from doc 20 entirely. `CURRENT_SCHEMA_VERSION = 1` stays. No `residency.state` field in v1 scope.
**Date:** 2026-04-11

---

## Q3 — Are Fixtures B and C ground truth or illustrative?

**Why it matters:** `docs/10-test-fixtures.md` says Fixtures B and C are "not verified against any live calculation". Only `tools/verify_fixture_a.js` exists. DoD Gate 1.6 requires all three to match documented expected outputs. Either Phase 3 builds two more verify scripts, or Gate 1.6 is softened.

**Options:**

- **(A)** All three are ground truth → build `verify_fixture_b.js` and `verify_fixture_c.js` before Phase 3 exit
- **(B)** Only Fixture A is ground truth; B and C are illustrative → rewrite `doc 10` to say so, soften DoD Gate 1.6
- **(C)** Drop B and C entirely → single-persona testing only

**Recommendation:** Option A. Fixtures B (Alex, single) and C (Patricia, retired) cover edge cases Fixture A doesn't (no partner, post-preservation), and the verify script pattern is already proven.

**Answer:** Option A — all three fixtures are ground truth. Build `verify_fixture_b.js` (Alex, single) and `verify_fixture_c.js` (Patricia, retired) before Phase 3 exit. DoD Gate 1.6 unchanged.
**Date:** 2026-04-11

---

## Q4 — What are the canonical FY2026 AU tax constants?

**Why it matters:** Three docs disagree on the SG rate, and `doc 01`'s `medicareLevyThreshold: 180000` is wrong (that's the top tax bracket, not the Medicare levy threshold).

**Decisions needed:**

| Constant | `doc 01` | `doc 06` | `doc 08` | Legislated FY2026 | Your call |
|---|---|---|---|---|---|
| Super Guarantee rate | 11.5% | 12% | 12% | 12.0% | ____ |
| Concessional cap | 30000 | 30000 | 30000 | $30,000 | ____ |
| Preservation age | 60 | 60 | 60 | 60 (all born post-1964) | ____ |
| Medicare levy (low-income threshold) | 180000 ❌ | — | — | ~$27,222 (2024 single) | ____ |
| Top tax bracket | — | — | — | $190,000 (FY2025+) | ____ |

**Action:** Pick numbers, put them in a single `lib/au-tax-data.ts`, delete inline constants from every spec doc.

**Answer:** All legislated FY2026 values: SG rate 12.0%, concessional cap $30,000, preservation age 60, Medicare levy low-income threshold ~$27,222, top tax bracket $190,000. Single source of truth: `lib/au-tax-data.ts` (created in Phase 2). Delete inline constants from spec docs.
**Date:** 2026-04-11

---

## Q5 — How does a user delete their account? Which endpoint?

**Why it matters:** DoD Gate 6 (steps 9–11) requires a full account-deletion flow with cascade to `configs` and `users`. `doc 22` names `DELETE /api/user`; `doc 11` doesn't spec it. `doc 17` shows a `user.deleted` webhook branch but `doc 11` doesn't spec the webhook handler either.

**Options:**

- **(A)** In-app `DELETE /api/user` → we control the flow, can show confirmation dialogs, emit Sentry, queue final sync. Clerk user is deleted via Clerk API as part of the handler.
- **(B)** Clerk UserProfile UI → user clicks delete in Clerk's widget, Clerk fires `user.deleted` webhook, we cascade-delete from Postgres on receipt
- **(C)** Both — (A) for first-party flow, (B) as fallback for users who delete via Clerk dashboard

**Recommendation:** Option C. Primary UX via `DELETE /api/user`; webhook handler as defense-in-depth for any deletion that bypasses the app.

**Answer:** Option C — primary UX via `DELETE /api/user` (confirmation dialog, Sentry event, cascade delete via Clerk API); `user.deleted` webhook handler as defense-in-depth for any deletion bypassing the app. Both must be implemented.
**Date:** 2026-04-11

---

## Q6 — Is Upstash rate limiting mandatory for v1?

**Why it matters:** `.env.example` marks it optional; `doc 11` specifies numeric quotas with response headers; DoD Gate 5.4 allows skipping. If Upstash is absent, the rate-limit headers spec becomes a lie, and Railway's multi-replica deployment means in-memory fallback is per-replica (not global).

**Options:**

- **(A)** Mandatory for v1 → remove "optional" from `.env.example`, add Upstash setup to Phase 7
- **(B)** Optional with documented no-op fallback → spec "if Upstash URL unset, rate-limit headers omitted, logs note 'rate-limiting disabled'"
- **(C)** Optional with in-memory LRU fallback → per-replica is good enough for v1 invite-only

**Recommendation:** Option B for v1 (the app is single-user / invite-only). Promote to Option A post-launch.

**Answer:** Option B — optional with documented no-op fallback. If `UPSTASH_REDIS_REST_URL` unset: rate-limit headers omitted, server logs "rate-limiting disabled". `.env.example` keeps "optional" label. Promote to mandatory post-launch.
**Date:** 2026-04-11

---

## Q7 — Is Sentry mandatory at ship?

**Why it matters:** `.env.example` marks `SENTRY_DSN` optional; `doc 19` assumes it's always present. `beforeSend`, `reportWebVitals`, and health checks will throw if DSN is unset.

**Options:**

- **(A)** Mandatory → DSN must be set before production deploy; DoD Gate 8 adds Sentry check
- **(B)** Optional with no-op fallback → spec "if DSN unset: `Sentry.init()` skipped; `captureException`/`captureMessage` become no-ops; pino still emits"

**Recommendation:** Option B for v1 flexibility, Option A for v1.1.

**Answer:** Option B — optional with no-op fallback. If `SENTRY_DSN` unset: `Sentry.init()` skipped, `captureException`/`captureMessage` become no-ops, pino logging still active. DoD Gate 8 does not require Sentry. Promote to mandatory for v1.1.
**Date:** 2026-04-11

---

## Q8 — Does the app comply with Australian Privacy Principles (APPs)?

**Why it matters:** RetireAU stores real financial PII from Australian residents. Railway (US-based) and Clerk (US-based) mean AU data crosses borders. APP 8 (cross-border disclosure) requires "reasonable steps" to ensure the overseas recipient does not breach APPs. There is no DPIA, privacy policy, or data-residency statement in the spec pack.

**Sub-questions:**
- Is the app private / single-user / you-and-your-partner only? (changes the compliance posture)
- Will you publish a privacy policy? (required by APP 1 if the app is "collecting personal information")
- Are you okay with US data residency, or do you need AU-region hosting (Supabase AU, AWS ap-southeast-2)?
- Do you need a formal DPIA, or is informal risk acceptance sufficient for a personal tool?

**Recommendation:** If single-user / you-and-your-partner, document the private-tool posture and accept US residency in a `docs/27-privacy.md`. If multi-user-in-future, bump to AU hosting before launch.

**Answer:** Public multi-user app — APP compliance mandatory. (1) Scope: public, users onboarded. (2) Publish privacy policy + data policy; create `docs/27-privacy.md` as spec, ship `/privacy` and `/data-policy` pages at launch (DoD Gate 9 addition). (3) Data residency: US hosting (Railway + Clerk) retained; cross-border disclosure documented in privacy policy under APP 8 "reasonable steps". (4) DPIA: informal — one-page risk acceptance in `docs/27-privacy.md`.
**Date:** 2026-04-11

---

## Q9 — Should `profile.currentYear` auto-roll?

**Why it matters:** If a user creates their config in 2026 and returns in 2028, should `currentYear` bump to 2028 automatically (so super projections, retirement readiness, etc. shift by 2 years) or stay pinned at 2026 (so the user sees what they planned from)?

**Options:**

- **(A)** Auto-roll on load — `currentYear = new Date().getFullYear()`, recompute everything. Safer for long-lived accounts.
- **(B)** Pin at creation — once set, never auto-bump. User manually advances via a "New Financial Year" action. Reproducible but stale.
- **(C)** Hybrid — show a banner on login if `currentYear < thisYear` offering a one-click roll-forward.

**Recommendation:** Option C. Explicit user consent to the update, with the default being "yes".

**Answer:** Option C — hybrid. Show banner on login if `currentYear < thisYear` offering one-click roll-forward. Default action is "yes, update". User must explicitly dismiss to stay on old year.
**Date:** 2026-04-11

---

## Q10 — Do we create `docs/26-runbooks.md`?

**Why it matters:** DoD claims RTO 15min / RPO 24h. There is no rollback procedure, incident response, on-call rotation, backup restore drill, or secret rotation schedule. For a solo operator this may be explicit scope — but it needs to be documented either way.

**Options:**

- **(A)** Create `docs/26-runbooks.md` with: Railway rollback steps, Prisma migration rollback, backup restore drill (quarterly), secret rotation (90-day), Sentry quota exhaustion, incident classification. Even solo operators need this for 3am incidents.
- **(B)** Accept "solo operator, no runbook" as explicit scope → note it in DoD Non-Goals and drop the RTO/RPO claims.

**Recommendation:** Option A. A 2-page runbook is cheap insurance against the one time you need it.

**Answer:** Option A — create `docs/26-runbooks.md` covering: Railway rollback steps, Prisma migration rollback, backup restore drill (quarterly), secret rotation (90-day), Sentry quota exhaustion, incident classification. RTO 15min / RPO 24h claims stand.
**Date:** 2026-04-11

---

## Q11 — "Gates" vs "Phases" — unify the vocabulary

**Why it matters:** `DEFINITION_OF_DONE.md` uses "Gates" (10 of them). `docs/06-implementation-plan.md` uses "Phases" (8 of them). `docs/25-error-taxonomy.md` cites "Gate 7" without context. Agents will not know which framework to build against.

**Options:**

- **(A)** Keep both — explicitly map each DoD Gate to the Phase(s) that satisfy it in a new §Phase → Gate Traceability section of `doc 06`
- **(B)** Collapse to one — rename DoD Gates as "Shipping Gates" and Phases as "Build Phases", remove cross-contamination

**Recommendation:** Option A. Phases are the build sequence; Gates are the ship/no-ship contract. The map is a one-line-per-gate addition.

**Answer:** Option A — keep both. Add §Phase → Gate Traceability table to `docs/06-implementation-plan.md` mapping each of the 8 Build Phases to the DoD Gates it satisfies. "Phases" = build sequence; "Gates" = ship/no-ship contract.
**Date:** 2026-04-11

---

## Next Steps

1. Answer each question inline and date it.
2. Once answered, update `CRITICAL-FIXES.md` Part 2 (pending-answer fixes) with concrete diffs against the affected docs.
3. Only then begin Phase 1 of the implementation plan.

**Do not start Phase 1 with open questions remaining** — the config schema ambiguity alone will cause silent data drift.
