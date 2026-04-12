# Definition of Done — RetireAU Dashboard v1

This document is the contract for "shippable". The Claude Code agent is **not** done until every item below is checked off with evidence. No verbal claims, no assumptions — run the commands, read the output, confirm each gate.

## BLUF

v1 is shippable when:

1. **Every regression test passes** (all 10 historical bugs from `docs/05-validation-checklist.md`).
2. **Fixture A outputs match `tools/verify_fixture_a.js` exactly** (zero drift on any calculated value).
3. **Feature parity with `reference/Retirement_Dashboard_v2.html`** is confirmed tab-by-tab.
4. **The app is deployed to Railway + Cloudflare** with Clerk auth working end-to-end on the live domain.
5. **A full end-to-end smoke test passes on production**: sign up → edit config → save → log out → log back in → confirm persistence → delete account → data removed.
6. **No known P0 or P1 bugs remain open.**

All claims below require evidence (command output, screenshot, or passing CI run). No gate may be marked complete from memory or assumption.

---

## Gate 1 — Calculation Engine Parity

| # | Criterion | Verification Command / Evidence |
|---|-----------|--------------------------------|
| 1.1 | `node tools/verify_fixture_a.js` runs cleanly and produces the numbers documented in `docs/10-test-fixtures.md` Fixture A. | Paste output into PR. |
| 1.2 | TypeScript `calculateBudget(FIXTURE_A)` returns `combinedMonthly=17940, fixedTotal=6095, variableTotal=4193, totalSpend=10288, surplus=7652, savingsRate≈42.65`. | `npm test -- calculateBudget` passes. |
| 1.3 | `calcMortgageSchedule(1100000, 0.056, 30, 5, 'io-then-pi')` returns year-1 balance $1,100,000, year-5 balance $1,100,000, year-6 balance $1,079,222, year-30 balance $0. | `npm test -- calcMortgageSchedule` passes. |
| 1.4 | Family property 30-year projection table matches the table in `docs/10-test-fixtures.md` row-by-row (property value, mortgage, equity loan, net equity) for all 31 rows. | Snapshot test against the documented table. |
| 1.5 | Superannuation projection at 8.5% return hits ≥$500k combined by year 8 and ≥$1M by year 14 for Fixture A. | `npm test -- calculateSuperProjection` passes. |
| 1.6 | All three fixtures (A, B, C) produce their documented expected outputs for budget KPIs, debt summary, super projection, and deposit strategy. | Full fixture test suite passes. |

## Gate 2 — Regression Tests (10 historical bugs)

Each bug from `docs/05-validation-checklist.md` must have a named regression test that would fail if the bug were reintroduced. Verify the red-green cycle for each: write the test, confirm it passes, revert the fix temporarily, confirm it fails, restore the fix, confirm it passes again.

| # | Bug | Regression Test | Verified Red-Green |
|---|-----|-----------------|---------------------|
| 1 | Fixed KPI hardcoded ($6,287 stale) | `assertBudgetKPIsReadFromConfig` | ☐ |
| 2 | Variable KPI stale ($6,237) | `assertVariableExcludesCCPayments` | ☐ |
| 3 | Total spend wrong ($12,523) | `assertTotalSpendIsFixedPlusVariableExCC` | ☐ |
| 4 | Debt repayments $2,369 / "3 loans" stale | `assertDebtSummaryMatchesActiveLoans` | ☐ |
| 5 | Savings rate 30.3% stale | `assertSavingsRateFromSurplusOverIncome` | ☐ |
| 6 | Budget tab phantom categories | `assertBudgetTableRendersOnlyConfigItems` | ☐ |
| 7 | "33%" ownership hardcoded | `assertOwnershipShareFromConfig` | ☐ |
| 8 | "$1.1M" deposit target hardcoded | `assertDepositTargetFromConfig` | ☐ |
| 9 | Mortgage calc used 60%-of-rent approximation | `assertMortgageUsesAnnuityFormula` | ☐ |
| 10 | `modeLabel` reference error (use-before-declare) | `assertDashboardLoadsWithoutConsoleErrors` | ☐ |

## Gate 3 — Feature Parity vs. Source Dashboard

Work through `reference/Retirement_Dashboard_v2.html` tab-by-tab and confirm every feature is implemented. Use `docs/05-validation-checklist.md` as the master list.

| Section | Parity Confirmed | Notes |
|---------|------------------|-------|
| Scenario Controls panel (all input bindings) | ☐ | Every input writes to state and triggers recompute. |
| Preservation age alert | ☐ | |
| KPI cards grid (6 cards) | ☐ | |
| Scenario Comparison — Combined Super | ☐ | |
| Super Balance Projections chart | ☐ | |
| Net Worth chart | ☐ | |
| Retirement Readiness chart | ☐ | |
| Drawdown Longevity chart | ☐ | |
| Salary Sacrifice Optimiser chart | ☐ | |
| Key Milestones track | ☐ | |
| Children Cost Impact section | ☐ | |
| Pre-60 Bridge Fund Requirement | ☐ | |
| Family Trust Property section (all KPIs + 3 charts + table) | ☐ | |
| Debt Payoff Timeline chart + debt summary cards | ☐ | |
| Deposit Comparison (both scenarios) | ☐ | |
| Budget Profile tab (spending breakdown + monthly trend) | ☐ | |
| Expense Tracker (Excel upload + budget vs. actual bar chart) | ☐ | |
| Budget table (fixed + variable, dynamic from CONFIG) | ☐ | |

## Gate 4 — Data Layer

| # | Criterion | Evidence |
|---|-----------|----------|
| 4.1 | Prisma schema matches `docs/02-database-schema.md`. | `npx prisma validate` clean, schema diff against doc. |
| 4.2 | All migrations apply cleanly from empty database. | `npx prisma migrate reset --force && npx prisma migrate deploy` succeeds. |
| 4.3 | Seed script loads Fixture B or C into a dev database for local testing. | `npm run db:seed` succeeds. |
| 4.4 | DashboardConfig TypeScript type exactly matches the `docs/07-config-reference.md` schema. | `tsc --noEmit` clean. |
| 4.5 | Schema version field is set on every write and checked on every read. | Unit test for version guard. |

## Gate 5 — API Contracts

Every endpoint documented in `docs/11-api-contracts.md` must be implemented, tested, and return the documented shapes.

| # | Criterion | Evidence |
|---|-----------|----------|
| 5.1 | All endpoints return the documented success/error envelopes. | Contract tests pass. |
| 5.2 | Zod validation rejects malformed payloads with 422. | Negative test cases pass. |
| 5.3 | Auth middleware blocks unauthenticated requests with 401. | Integration test passes. |
| 5.4 | Rate limiting returns 429 with correct headers (or skipped if Upstash disabled). | Manual test or integration test. |
| 5.5 | Clerk webhook signature verification rejects unsigned payloads. | Integration test with bad signature. |
| 5.6 | Conflict resolution on `POST /api/sync` follows last-write-wins with version check. | Integration test covers both branches. |

## Gate 6 — Auth + Persistence End-to-End

Run this exact script on the deployed production URL (not localhost):

1. Visit `/sign-up`, create a new account with a throwaway email.
2. Land on `/dashboard` with the default seed CONFIG loaded.
3. Edit at least 3 input fields in the Scenario Controls panel (e.g., change Matty's super balance, mortgage rate, retirement age).
4. Observe at least one chart and one KPI card visibly update.
5. Wait 5 seconds for debounced cloud sync.
6. Log out via the Clerk user menu.
7. Log back in with the same account.
8. Confirm all three edits are still present.
9. Visit `/settings` (or wherever account deletion lives) and delete the account.
10. Attempt to log back in — should be rejected.
11. Inspect the database directly and confirm the `configs` row and `users` row for the test user are gone.

| Step | Passed | Screenshot / evidence |
|------|--------|----------------------|
| 1–4 | ☐ | |
| 5–8 | ☐ | |
| 9–11 | ☐ | |

- [ ] Account deletion E2E: `DELETE /api/user` with `{ "confirmation": "DELETE" }` returns 200, user row gone from DB, Clerk user deleted, session revoked, redirect to `/` verified.
- [ ] `user.deleted` webhook: simulate Clerk dashboard deletion, verify cascade-delete runs and is idempotent.

## Gate 7 — Code Quality

| # | Criterion | Command |
|---|-----------|---------|
| 7.1 | TypeScript strict mode passes with zero errors. | `npx tsc --noEmit` exit 0 |
| 7.2 | ESLint passes with zero errors and zero warnings. | `npm run lint` exit 0 |
| 7.3 | Prettier check passes (no unformatted files). | `npm run format:check` exit 0 |
| 7.4 | Full test suite passes. | `npm test` exit 0 |
| 7.5 | Production build succeeds. | `npm run build` exit 0 |
| 7.6 | No `console.log`, `console.debug`, or `TODO` / `FIXME` comments remain in source (outside of explicitly allowlisted files). | `grep -rn "console.log\\|TODO\\|FIXME" src/` returns only allowlisted matches. |
| 7.7 | No hardcoded values that should come from CONFIG (every number rendered in the UI traces back to CONFIG or a documented constant). | Manual review against `docs/05-validation-checklist.md`. |

## Gate 8 — Deployment

| # | Criterion | Evidence |
|---|-----------|----------|
| 8.1 | App is deployed to Railway (or equivalent) with auto-deploy from `main`. | Deployment URL + screenshot of Railway dashboard. |
| 8.2 | Custom domain configured via Cloudflare DNS with valid TLS certificate. | Browser shows padlock, `curl -I https://<domain>` returns 200. |
| 8.3 | Database is provisioned on Railway PostgreSQL with backups enabled. | Screenshot of Railway DB + backup config. |
| 8.4 | All environment variables from `.env.example` are set in the production environment. | Checklist against `.env.example`. |
| 8.5 | Clerk production keys are in use (not test keys). | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_live_`. |
| 8.6 | `/api/health` endpoint returns 200 with database status `ok`. | `curl https://<domain>/api/health` |
| 8.7 | Sentry optional-fallback verified: deploying with `SENTRY_DSN` unset does not throw; startup log contains "Sentry disabled (no DSN)"; pino logs still emit. | |

## Gate 9 — Documentation

| # | Criterion | Evidence |
|---|-----------|----------|
| 9.1 | Project `README.md` (in the code repo, not this handoff folder) documents how to run locally. | Follow it cold and confirm it works. |
| 9.2 | Any deviations from the handoff specs are documented in a `DEVIATIONS.md` file with rationale. | File exists and every deviation has a justification. |
| 9.3 | New environment variables (beyond `.env.example`) are added to the handoff `.env.example` with inline comments. | Diff against this folder's `.env.example`. |
| 9.4 | `docs/26-runbooks.md` exists and covers: Railway rollback, Prisma migration rollback, backup restore drill, secret rotation, Sentry quota, incident classification. | |
| 9.5 | `docs/27-privacy.md` exists and covers APP 1, APP 3, APP 8 (cross-border disclosure), APP 11, informal DPIA. | |
| 9.6 | `/privacy` and `/data-policy` pages render in production. | |

## Gate 10 — No P0 / P1 Bugs Open

| # | Criterion | Evidence |
|---|-----------|----------|
| 10.1 | Zero P0 (blocking) bugs in the tracker. | Screenshot of filtered issue list. |
| 10.2 | Zero P1 (serious) bugs in the tracker. | Screenshot of filtered issue list. |
| 10.3 | All known P2/P3 bugs are logged with reproduction steps and triaged for a post-v1 milestone. | Linked issue list. |

---

## Non-Goals for v1

The following are explicitly **out of scope** for v1. Do not build them, even if they seem easy. Log them as future work.

- Multi-tenant organisations (v1 is single-user per account).
- Email notifications or reminders.
- Native mobile app (responsive web only).
- AI / LLM features (no chat, no suggestions).
- Social sharing or collaborative editing.
- Financial advice or recommendations (the app is a modelling tool only).
- Live bank account integration (Basiq, Plaid, etc.).
- Real-time collaboration or multi-device sync via websockets (debounced REST sync is sufficient).
- Internationalisation beyond Australian English / AUD.
- A public marketing site (auth-gated dashboard only for v1).

## When You're Done

When every gate is checked off with evidence, open a pull request titled `RetireAU v1 — Ready for Review` and attach:

1. This document with every box ticked.
2. The output of `node tools/verify_fixture_a.js`.
3. A screenshot of the deployed app's dashboard tab.
4. A CI run link showing all checks green.
5. A link to the production URL.

Do not self-approve. Wait for review before merging to `main`.
