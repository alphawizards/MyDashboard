# Implementation Plan — RetireAU Dashboard

## Overview
Phased build plan for converting the local HTML retirement dashboard into a multi-user Next.js web app. Each phase is independently deployable and testable. Do not proceed to the next phase until the current phase is verified working.

## Reference Documents
- `01-architecture-overview.md` — stack, architecture, data flow
- `02-database-schema.md` — Prisma schema, config JSONB structure, migration strategy
- `03-frontend-components.md` — component specs, hooks, calculation functions
- `04-css-design-system.md` — colour palette, typography, component patterns, Tailwind config
- `05-validation-checklist.md` — verification checks for all calculated values

## Source Dashboard
The original dashboard file to port from:
`Retirement_Dashboard_v2.html` (same directory as this project)

All calculation logic, chart configurations, and CONFIG structure must be extracted from this file.

---

## Phase 1: Project Scaffold & Design System (Day 1)

### Tasks
1. Initialise Next.js 14+ project with App Router and TypeScript
2. Install dependencies: `react-chartjs-2 chart.js zustand @clerk/nextjs prisma @prisma/client xlsx`
3. Configure Tailwind CSS with custom theme from `04-css-design-system.md`
4. Create base layout with dark theme (bg, font, global styles)
5. Build reusable UI components (no data logic yet):
   - `KPICard.tsx` + `KPIGrid.tsx`
   - `ChartCard.tsx`
   - `AlertBox.tsx`
   - `Badge.tsx`
   - `ProgressBar.tsx`
   - `TabView.tsx`
   - `DataTable.tsx`
   - `DropZone.tsx`
6. Create `Header.tsx` with app name, version badge
7. Build `ControlsPanel.tsx` shell (collapsible, section labels, empty inputs)
8. Create a `/dashboard` page that renders the component gallery
9. Create selector stub `src/lib/selectors/personas.ts` — exports `useMatty()` and `usePartner()` as aliases for `state.profile.user1` and `state.profile.user2`; referenced by all display components. Implementation is empty hooks returning the raw user1/user2 objects; display-name aliasing added in Phase 2.
10. Set up GitHub Actions CI pipeline (`.github/workflows/ci.yml`):
    - Triggers: push to any branch + PR to `main`
    - Jobs: `lint` (ESLint zero errors), `typecheck` (tsc --noEmit zero errors), `test` (full test suite), `build` (next build)
    - Required: all jobs green before PR can merge (branch protection rule)
    - `size-limit` job: fail PR if JS bundle grows > 10% (DoD Gate 7)
    - `lighthouse-ci` job: fail PR if Lighthouse score drops below 90 on any category (DoD Gate 8)

### Verification
- [ ] `npm run build` succeeds with no errors
- [ ] Dashboard page renders with dark theme
- [ ] All UI components visible in gallery layout
- [ ] Controls panel toggles open/closed
- [ ] Responsive: single column below 1000px

---

## Phase 2: Data Layer & Config State (Day 2)

### Tasks
1. Create TypeScript interfaces in `/lib/types.ts` (from `02-database-schema.md` config structure)
2. Create default Australian config template in `/lib/default-config.ts`
3. Create Australian tax data in `/lib/au-tax-data.ts`:
   - Super guarantee rates by fiscal year (11% FY24, 11.5% FY25, 12% FY26+)
   - Tax brackets (with Medicare levy)
   - Preservation age (60)
   - Concessional contributions tax (15%)
4. Create formatting helpers in `/lib/formatters.ts` (fmt, fmtK, pct)
5. Build Zustand store in `/hooks/useConfig.ts`:
   - Full DashboardConfig state
   - Update actions (profile, debts, expenses, property, familyProperty, defaults)
   - localStorage persistence middleware
   - SSR-safe hydration (skipHydration pattern)
6. Wire ControlsPanel inputs to Zustand store
7. Create schema migration framework in `/lib/config-migrations.ts`
8. Build `YearRolloverBanner` component and `useYearRollover()` hook:
   - On login, compare `config.profile.currentYear` with `new Date().getFullYear()`
   - If stale: show dismissible banner offering one-click `rollForward()` — updates `currentYear` and re-runs projections
   - Default action: "Yes, update to [year]" (user must actively dismiss to stay on old year)
   - State tracked in Zustand: `ui.yearRolloverDismissed: boolean`

### Verification
- [ ] Default config loads on fresh page visit
- [ ] Changing a control input updates the store (verify via React DevTools or console)
- [ ] Refreshing page retains state from localStorage
- [ ] Clearing localStorage loads default config
- [ ] All TypeScript types compile without errors

---

## Phase 3: Calculation Engine (Day 3)

### Tasks
1. Extract ALL calculation functions from `Retirement_Dashboard_v2.html` into `/lib/calculations.ts`:
   - `projectSuper()` — super balance projection with SG rates, salary growth, tax, leave
   - `simulateDebtPayoff()` — debt avalanche with lump sum and surplus
   - `calcMortgageSchedule()` — IO-then-PI and full PI amortisation
   - `simulateDepositScenarios()` — Scenario A (debts first) and B (save first)
   - `calcBudgetKPIs()` — income, expenses, surplus, savings rate
   - `projectFamilyProperty()` — inheritance projection with equity loan paydown
2. Write all functions as pure TypeScript (no DOM access, no side effects)
3. Create unit tests for each calculation function:
   - `calcMortgageSchedule`: verify IO payment = $5,133/mo, P&I = $6,821/mo, balance = $0 at year 30
   - `simulateDebtPayoff`: verify debt-free by month ~9 with lump sum
   - `calcBudgetKPIs`: verify savings rate calculation matches
   - `projectFamilyProperty`: verify equity loan clears by ~year 7

### Verification
- [ ] All unit tests pass
- [ ] Mortgage schedule: IO years have zero principal reduction
- [ ] Mortgage schedule: P&I years amortise to $0
- [ ] Debt simulation: matches side-by-side table from original dashboard
- [ ] Budget KPIs: savings rate matches independent calculation

---

## Phase 4: Dashboard Sections — Budget & Debt (Day 4-5)

### Tasks
1. Build `BudgetProfile.tsx`:
   - Income KPI grid (dynamically calculated from config)
   - Expense KPI grid (fixed total, variable excl CC, total spend, debt repayments)
   - Spending doughnut chart (react-chartjs-2, porting existing config)
   - Monthly trend bar chart
   - Fixed and variable expense tables
   - Budget tab table (all categories)
2. Build `DebtPayoff.tsx`:
   - Debt summary cards
   - Payoff timeline chart
   - Scenario comparison chart (lump sum vs minimum vs standard)
   - Milestone track
3. Build `DepositComparison.tsx`:
   - Scenario A vs B simulation
   - KPI grid with milestone dates
   - Savings comparison chart
   - Net position chart
   - Side-by-side comparison table

### Verification
- [ ] Budget KPIs match validation checklist section 1-4
- [ ] No hardcoded dollar amounts in rendered HTML
- [ ] Changing debt balances in controls recalculates debt section
- [ ] Side-by-side table matches original dashboard values exactly
- [ ] All charts render with correct dark theme styling

---

## Phase 5: Dashboard Sections — Super & Property (Day 6-7)

### Tasks
1. Build `SuperProjection.tsx`:
   - KPI grid (combined super at 60, sustainable income, readiness)
   - Scenario comparison grid (3 return rates)
   - Super balance chart, net worth chart, readiness chart, drawdown chart
   - Salary sacrifice chart
   - Children cost chart (conditional)
   - Bridge fund section
   - Tabbed data tables (User1, User2, Combined, Mortgage, Children)
2. Build `FamilyProperty.tsx`:
   - Alert box with property summary
   - KPI grid (6 cards including mortgage repayment)
   - Projection table with IO/P&I phase labels
   - Property value + equity chart
   - Net worth inheritance impact chart
   - Full breakdown chart (5-line)
   - Mortgage mode toggle (IO→P&I / Full P&I)
3. Build `ExpenseTracker.tsx`:
   - DropZone for xlsx upload
   - SheetJS client-side parsing
   - Tracker KPI summary
   - Budget vs actual bar chart

### Verification
- [ ] Super projection matches original dashboard at same inputs
- [ ] Family property: IO payment = $5,133/mo, P&I = $6,821/mo (at default config)
- [ ] Family property: equity loan clears by ~year 7
- [ ] Mortgage mode toggle recalculates all 3 charts
- [ ] Excel upload parses and renders tracker (test with original Weekly_Expense_Tracker.xlsx)
- [ ] All ownership % labels read from config (no hardcoded "33%")

---

## Phase 6: Auth & Cloud Sync (Day 8)

### Tasks
1. Set up Clerk:
   - Install and configure `@clerk/nextjs`
   - Add ClerkProvider to root layout
   - Create sign-in/sign-up pages (or use Clerk modal)
   - Add middleware for API route protection
2. Set up Prisma + PostgreSQL:
   - Write Prisma schema (from `02-database-schema.md`)
   - Run `prisma migrate dev`
   - Create Prisma client singleton in `/lib/db.ts`
3. Build API routes:
   - `GET /api/config` — load user's active config
   - `POST /api/config` — upsert user's config (with schema migration)
   - `POST /api/webhooks/clerk` — handle user.created event
4. Build `useCloudSync.ts` hook:
   - Debounced auto-save (5 seconds)
   - Load from cloud on sign-in
   - Merge logic (cloud wins if newer, prompt on conflict)
5. Update Header with auth state (sign-in button / user avatar / sync indicator)
6. Build first-run onboarding flow:
   - New user signs up → Clerk redirects to `/onboarding`
   - `/onboarding` page: show APP 3 collection notice, require acknowledgement before proceeding
   - After acknowledgement: seed default config from `lib/default-config.ts`, redirect to `/dashboard`
   - Show welcome tour overlay (4 steps: "Edit your details", "Run projections", "Track debts", "Export your data")
   - Mark onboarding complete in `users` table: `onboardingCompletedAt: timestamp`

### Verification
- [ ] Sign up creates user row in PostgreSQL
- [ ] Sign in loads saved config from database
- [ ] Config changes auto-save to cloud (verify in DB)
- [ ] Sign out: local config persists, sync stops
- [ ] New user with no saved config gets default template
- [ ] Schema migration runs on load if config version < current

---

## Phase 7: Deployment & DNS (Day 9)

### Tasks
1. Push to GitHub repository
2. Connect Railway to GitHub repo
3. Provision PostgreSQL on Railway
4. Set environment variables on Railway:
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
5. Run `prisma migrate deploy` on Railway
6. Configure Cloudflare:
   - Add domain DNS A record pointing to Railway
   - Enable proxy (CDN)
   - SSL mode: Full (strict)
   - Cache static assets
7. Verify production deployment

### Verification
- [ ] App loads at custom domain via HTTPS
- [ ] Sign up and sign in work in production
- [ ] Config saves and loads from production database
- [ ] Charts render correctly (no CDN/CSP issues)
- [ ] Mobile responsive layout works
- [ ] No console errors
- [ ] Run full validation checklist (`05-validation-checklist.md`) against production

---

## Phase 8: Polish & Launch (Day 10)

### Tasks
1. Landing page with feature overview
2. Loading states for auth and config fetch
3. Error boundaries for chart rendering failures
4. Empty states for sections with no data (e.g. no debts, no family property)
5. Onboarding: guided setup for new users (name, age, salary, super balance)
6. Meta tags, OG image for social sharing
7. Favicon
8. Final cross-browser testing (Chrome, Firefox, Safari, mobile)
9. Create `/privacy` and `/data-policy` pages:
   - `/privacy` — human-readable privacy policy (content from docs/27-privacy.md)
   - `/data-policy` — data retention and user rights summary
   - Link both from footer on every page
   - Required before public launch (APP 1 obligation)

### Verification
- [ ] Full validation checklist passes
- [ ] Lighthouse score > 90 (performance, accessibility)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No ESLint warnings
- [ ] Works on Chrome, Firefox, Safari
- [ ] Works on mobile (iOS Safari, Android Chrome)

---

## §Phase → Gate Traceability

Each Build Phase satisfies one or more DoD Shipping Gates. Gates are defined in `DEFINITION_OF_DONE.md`.

| Build Phase | Name | DoD Gates Verified at Phase Exit |
|---|---|---|
| 1 | Project Scaffold & Design System | Gate 7 (partial — build succeeds, lint clean, tsc clean) |
| 2 | Data Layer & Config State | Gate 4 (partial — schema deployed, migrations run), Gate 7 (tsc clean) |
| 3 | Calculation Engine | Gate 1 (all — calculation parity), Gate 2 (regression tests bugs 1–5) |
| 4 | Dashboard — Budget & Debt | Gate 3 (partial — budget/debt sections), Gate 2 (bugs 6–8) |
| 5 | Dashboard — Super & Property | Gate 3 (complete — all sections), Gate 2 (bugs 9–10) |
| 6 | Auth & Cloud Sync | Gate 4 (complete), Gate 5 (API contracts), Gate 6 (partial — auth E2E) |
| 7 | Deployment & DNS | Gate 6 (complete — account deletion E2E), Gate 8 (deployment) |
| 8 | Polish & Launch | Gate 7 (complete — zero errors/warnings), Gate 9 (documentation), Gate 10 (no P0/P1 bugs) |

**Key:** A gate is "partial" at a phase if some but not all evidence items are met. A gate is "complete" only when ALL evidence items pass. Do not merge a phase PR if any required gate evidence is missing.
