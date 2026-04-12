# Blueprint A — RetireAU Planning Pipeline

**Objective:** Close every critical gap in the RetireAU handoff pack, generate the code-as-spec scaffold, and produce executable phase-by-phase briefs so that implementation is pure wiring.

**Produced:** 2026-04-10 · Blueprint skill: everything-claude-code:blueprint
**Repo:** `Dashboard_Website/` (spec handoff pack — no Next.js app yet)
**Next plan:** `plans/retireau-b-implementation-phases.md` (do not start until this plan's Gate passes)

---

## Before You Start (cold-start brief)

You are working in a **spec handoff pack**, not a runnable app. The Next.js app does not exist yet. The key files you will need are:

| File | Purpose |
|------|---------|
| `OPEN-QUESTIONS.md` | 11 decisions you must answer (Q1–Q11) |
| `CRITICAL-FIXES.md` | 22 critical fixes (Part 1 = apply now; Part 2 = after Q1–Q11 answered) |
| `docs/06-implementation-plan.md` | 8-phase build scaffold for Blueprint B |
| `docs/08-calculation-engine.md` | Every formula — your TDD spec for Step 8 |
| `tools/verify_fixture_a.js` | Canonical calculation ground truth — never edit |
| `DEFINITION_OF_DONE.md` | 10 shipping gates — your ship contract |
| `CLAUDE.md` | Project rules and (after Step 2) decisions |

**PII rule:** `reference/Retirement_Dashboard_v2.html` and `docs/10-test-fixtures.md` (Fixture A) contain real financial PII. Never commit them to a public repo. Never paste their values into commit messages or CI logs.

**Ground truth rule:** `tools/verify_fixture_a.js` is the authoritative calculation baseline. If a test fails, your port is wrong — never edit expected values to make a test pass.

---

## Step 0 — Environment Baseline ✓ COMPLETE

**Status:** Done (plans/ directory created 2026-04-10).

**What was done:**
- Created `Dashboard_Website/plans/` directory.
- Confirmed all 25 spec docs present, `tools/verify_fixture_a.js` intact.

---

## Step 1 — Resolve OPEN-QUESTIONS.md (Q1–Q11)

**Depends on:** Step 0
**Model:** Opus (strongest) — these decisions have multi-phase blast radius
**Parallel:** No — decisions are interdependent (Q1 unblocks Q2, which unblocks Step 4)

### Context brief

`OPEN-QUESTIONS.md` has 11 blocking decisions. Q1 (canonical config shape) is the most critical — it unblocks the schema rename in Step 4, the type generation in Step 6, and the entire calculation scaffold in Step 8. All other questions are scoped.

The `tools/verify_fixture_a.js` file uses `profile.matty/partner` naming — this is direct evidence for Q1's answer. The verify script IS the ground truth, so this shape is what all three ported functions expect.

### Tasks

For each question Q1–Q11, work through `OPEN-QUESTIONS.md`:

1. **Q1 — Canonical config shape**
   - Evidence: `verify_fixture_a.js` uses `profile.matty/partner/currentYear/projectionYears/preservationAge/contribTaxRate/concessionalCap`
   - Evidence: `verify_fixture_a.js` expenses use `expenses.fixed[]/variable[]`
   - Evidence: `verify_fixture_a.js` debts use `debts.active[]`
   - **Decision is locked:** ADR-001 **must** choose Option A (`profile.matty/partner`). The verify script is the immutable ground truth and cannot be renamed. If the schema used `user1/user2`, the verify script would have to be renamed — which violates the fundamental ground truth rule. This is not a user preference question; it is a hard constraint.
   - Write `Answer: Option A — profile.matty/partner (locked by verify script ground truth)` to `OPEN-QUESTIONS.md` Q1 Answer field.
   - Note: the `OPEN-QUESTIONS.md` recommendation said Option B (`user1/user2`). That recommendation is overridden by this constraint. Update Q1's recommendation note accordingly.

2. **Q2 — Schema v2 real or illustrative**
   - Check `docs/20-db-migration-runbook.md` — does `migrateV1ToV2()` add `residency.state`?
   - If the field appears nowhere else in 25 docs, it is illustrative. Recommend Option B.

3. **Q3 — Fixtures B/C ground truth or illustrative**
   - Check `docs/10-test-fixtures.md` — do B/C have explicit expected-output tables?
   - If no verify script exists and doc says "not verified against live calculation" → recommend Option A (build scripts) or Option B (mark illustrative). Present to user, get explicit answer.

4. **Q4 — FY2026 AU tax constants**
   - FY2026 SG rate = 12.0% (legislated, ATO confirmed)
   - Concessional cap = $30,000 (legislated)
   - Medicare levy low-income threshold ≈ $27,222 (single, 2024–25)
   - Top marginal bracket = $190,000 (FY2025+)
   - Preservation age = 60 (born after 1964)
   - Write to Q4 answer field.

5. **Q5–Q11** — explicit responsibility per question:
   - **AskUserQuestion required (user must choose):** Q5 (account deletion flow), Q8 (AU Privacy / data residency), Q10 (runbooks scope)
   - **Apply stated Recommendation automatically (no user prompt):** Q2 (Option B — v2 is illustrative), Q3 (present to user — verify script doesn't cover B/C), Q6 (Option B — Upstash optional with no-op), Q7 (Option B — Sentry optional with no-op), Q9 (Option C — banner + explicit roll-forward), Q11 (Option A — keep both vocabs, add traceability table)
   - **Apply Recommendation but confirm with user:** Q3 — explicitly ask whether B/C are ground truth or illustrative since this affects DoD Gate 1.6

6. Write each answer with today's date (2026-04-10) in the `OPEN-QUESTIONS.md` Answer field.

### ADR output

For each answered question, create `docs/adr/NNN-<slug>.md`:

```markdown
# ADR-NNN: <Title>

**Date:** 2026-04-10
**Status:** Accepted
**Context:** <one paragraph: why this decision was needed>
**Decision:** <the chosen option>
**Rationale:** <why this option over alternatives>
**Consequences:** <what this decision enables or constrains>
```

Files to create:
- `docs/adr/001-canonical-config-schema.md`
- `docs/adr/002-schema-version-strategy.md`
- `docs/adr/003-fixture-b-c-ground-truth.md`
- `docs/adr/004-au-tax-constants-fy2026.md`
- `docs/adr/005-account-deletion-flow.md`
- `docs/adr/006-rate-limiting-strategy.md`
- `docs/adr/007-sentry-mandatory.md`
- `docs/adr/008-au-privacy-compliance.md`
- `docs/adr/009-currentyear-autoroll.md`
- `docs/adr/010-runbooks-scope.md`
- `docs/adr/011-gates-vs-phases-vocabulary.md`

### Verification

```bash
# All 11 ADRs exist
ls docs/adr/*.md | wc -l   # expect: 11

# No unanswered questions
grep -c "Answer: ___" OPEN-QUESTIONS.md   # expect: 0
```

### Exit criteria

- [ ] Every Q1–Q11 has an Answer + Date in `OPEN-QUESTIONS.md`
- [ ] 11 ADR files exist in `docs/adr/`
- [ ] Q1 answer is documented (determines schema field names for Steps 4, 6, 8)

### Rollback

If you partially answered questions and need to restart: delete the partial ADR files and reset the Answer fields in `OPEN-QUESTIONS.md` to `___`. No code was written; rollback is pure doc revert.

---

## Step 2 — Distill Decisions into CLAUDE.md

**Depends on:** Step 1
**Model:** default
**Parallel:** No

### Context brief

`CLAUDE.md` at the repo root is loaded by every future Claude Code session. It currently has a `§Decisions` section that is empty. Distilling the 11 ADR decisions into short rules here means every future session inherits the answers without needing to re-read 11 ADR files.

Use `/everything-claude-code:rules-distill` skill to extract the decision rules.

### Tasks

1. Read each of the 11 ADR files created in Step 1.
2. For each, extract a single rule sentence (what an agent must do, not what was debated).
3. Append a `## Decisions (from ADRs)` section to `CLAUDE.md` with:
   - One bullet per ADR
   - Format: `**[ADR-NNN]** <rule sentence>. See docs/adr/NNN-*.md.`
4. Example entries:
   - `**[ADR-001]** Use `profile.matty`/`profile.partner` as the canonical DashboardConfig shape. See docs/adr/001-canonical-config-schema.md.`
   - `**[ADR-004]** FY2026 SG rate = 12.0%, concessional cap = $30,000, preservation age = 60. All AU tax constants live exclusively in lib/au-tax-data.ts. See docs/adr/004-au-tax-constants-fy2026.md.`

### Verification

```bash
grep "ADR-0" CLAUDE.md | wc -l   # expect: 11
```

### Exit criteria

- [ ] `CLAUDE.md` has a `## Decisions (from ADRs)` section with 11 entries
- [ ] Each entry is a single actionable rule sentence with an ADR link
- [ ] No ADR decision contradicts another rule already in `CLAUDE.md`

### Rollback

Remove the `## Decisions (from ADRs)` section from `CLAUDE.md`. ADR files are unaffected.

---

## Step 3 — Apply CRITICAL-FIXES.md Part 1 (12 Factual Fixes)

**Depends on:** Step 0 (most fixes can run in parallel with Steps 1–2)
**Model:** default
**Parallel:** Partial — see note below

> ⚠ **Parallel constraint:** Fix 1.7 (remove "Matty fortnightly net" persona leakage from doc 08) and Fix 1.8 (`children.numChildren` rename) touch persona-naming fields. These two fixes must wait until Step 1 (ADR-001) is answered, since ADR-001 is pinned to `profile.matty/partner` (see Step 1 Note). Fixes 1.1–1.6 and 1.9–1.12 can run immediately in parallel with Steps 1–2.

### Context brief

`CRITICAL-FIXES.md` Part 1 contains 12 fixes that require no decisions — they are factual errors, orphan references, and sample code bugs. Apply all 12 now. None of these changes affect logic the Step 8 scaffold will depend on.

### Tasks

Apply each fix from `CRITICAL-FIXES.md` §Part 1 — Apply Now:

| Fix | File | Change |
|-----|------|--------|
| 1.1 | `docs/08-calculation-engine.md` §Scenario B | `25 years` → `24 years`; update formula annotation to `max(20,24) = 24` |
| 1.2 | `docs/01-architecture-overview.md` §AU_TAX_DATA | Remove `medicareLevyThreshold: 180000`; add correct fields; add redirect note to `lib/au-tax-data.ts` |
| 1.3 | `docs/07-config-reference.md` §profile.preservationAge | Range `55–67` → fixed at 60 with note about pre-1964 cohorts |
| 1.4 | `docs/25-error-taxonomy.md` §SYNC_NETWORK_ERROR | Escape apostrophe in JS template literal |
| 1.5 | `docs/17-auth-middleware.md` §webhook handler sample | Replace `console.error` with `logger.error` + `Sentry.captureException` |
| 1.6 | `docs/01-architecture-overview.md` §File Structure | Fix 3 phantom doc references (02-component-spec, 03-deployment, 04-testing) |
| 1.7 | `docs/08-calculation-engine.md` §6 | Remove persona leakage ("Matty fortnightly net: 5,298") |
| 1.8 | `docs/02-database-schema.md` + all referencing docs | `children.numChildren` → `children.count` |
| 1.9 | `docs/11-api-contracts.md` §hexColor | Update regex to accept 3-digit shorthand |
| 1.10 | `docs/17-auth-middleware.md` §middleware matcher | `/api/sync/resolve` → `/api/sync` |
| 1.11 | `docs/19-observability.md` §health route | `err.message` → `'disconnected'` in 503 response body |
| 1.12 | `docs/21-dev-seed-fixtures.md` §seed guard | Blacklist → whitelist (`allowedEnvs = ['development','test']`) |

After each edit, annotate the corresponding entry in `CRITICAL-FIXES.md` with:
```
Fixed: <brief description>, 2026-04-10
```

### Verification

```bash
# Arithmetic fix
grep -n "24 years" docs/08-calculation-engine.md

# Medicare fix removed
grep -n "medicareLevyThreshold" docs/01-architecture-overview.md   # expect: 0 results

# No console.* in sample code
grep -rn "console\." docs/   # expect: 0 results

# Orphan refs gone
grep -rn "02-component-specifications\|03-deployment-guide\|04-testing-strategy" docs/   # expect: 0

# All 12 annotated
grep -c "Fixed:" CRITICAL-FIXES.md   # expect: ≥12
```

### Exit criteria

- [ ] All 12 fixes applied across the relevant docs
- [ ] All 12 entries in `CRITICAL-FIXES.md` Part 1 annotated with `Fixed:`
- [ ] `grep -rn "console\." docs/` returns zero results

### Rollback

`git diff docs/` — revert individual files if a fix introduced a new error.

---

## Step 4 — Apply CRITICAL-FIXES.md Part 2 (10 Decision-Blocked Fixes)

**Depends on:** Steps 2 (ADRs distilled) and 3 (Part 1 applied)
**Model:** default
**Parallel:** No — requires Q1–Q11 answers

### Context brief

`CRITICAL-FIXES.md` Part 2 contains 10 fixes that were blocked on decisions from `OPEN-QUESTIONS.md`. Now that ADRs exist, apply each fix. The most important is Fix 2.1 (schema rename) — it propagates across the most files.

### Tasks

Apply each fix from `CRITICAL-FIXES.md` §Part 2 in this order (dependency order):

1. **Fix 2.1** — Collapse config schema (depends on Q1/ADR-001)
   - If ADR-001 chose `matty/partner`: no renames needed (verify_fixture_a.js uses this shape)
   - If ADR-001 chose `user1/user2`: global rename across all 25 docs + tools/verify_fixture_a.js
   - Either way: delete inline TS interfaces from `docs/01` and `docs/02`; declare `docs/07` as canonical; add alias note

2. **Fix 2.2** — Mortgage field names (depends on Q1/ADR-001)
   - Canonicalise to: `mortgage.loanAmount`, `mortgage.rate`, `mortgage.termYears`, `mortgage.ioPeriodYears`, `mortgage.mode`
   - Update all docs using old names

3. **Fix 2.3** — Schema v2 ambiguity (depends on Q2/ADR-002)
   - If v2 is illustrative: add header to `docs/20`; keep `CURRENT_SCHEMA_VERSION = 1`
   - If v2 is real: bump schema, add `residency.state` to `docs/07`, ship migration in Phase 2

4. **Fix 2.4** — DELETE endpoints (depends on Q5/ADR-005)
   - Add `DELETE /api/user` spec to `docs/11`; add `user.deleted` webhook handler spec

5. **Fix 2.5** — `GET /api/export` (depends on Q8/ADR-008)
   - If AU Privacy compliance required: add endpoint spec to `docs/11`

6. **Fix 2.6** — Rate limit fallback (depends on Q6/ADR-006)
   - Add no-op fallback spec if Upstash is optional

7. **Fix 2.7** — Sentry fallback (depends on Q7/ADR-007)
   - Add `lib/sentry.ts` no-op wrapper spec if Sentry is optional

8. **Fix 2.8** — Clerk session storage (depends on ADR-001/auth decisions)
   - Update `docs/22` Asset 2 to say HttpOnly cookies; add grep gate to DoD

9. **Fix 2.9** — Runbooks doc (depends on Q10/ADR-010)
   - If runbooks in scope: create `docs/26-runbooks.md` per the shape in Part 2.9

10. **Fix 2.10** — Gates vs Phases traceability (depends on Q11/ADR-011)
    - Add §Phase → Gate Traceability table to `docs/06`

After each: annotate entry in `CRITICAL-FIXES.md` Part 2 with `Fixed: <desc>, 2026-04-10`.

### Verification

```bash
# All Part 2 entries annotated
grep -A2 "### Fix 2\." CRITICAL-FIXES.md | grep "Fixed:" | wc -l   # expect: 10

# No unannotated fixes remain
grep "Fix shape\|depends on" CRITICAL-FIXES.md | grep -v "Fixed:" | wc -l   # expect: 0
```

### Exit criteria

- [ ] All 10 Part 2 fixes applied or explicitly marked `N/A — <ADR decision reason>`
- [ ] `CRITICAL-FIXES.md` has zero unannotated entries across Part 1 and Part 2
- [ ] `docs/06-implementation-plan.md` has §Phase → Gate Traceability section

### Rollback

`git diff docs/` — revert per-file.

---

## Step 4.5 — Bootstrap Scaffold Toolchain

**Depends on:** Step 0
**Model:** default
**Parallel:** Can run in parallel with Steps 1–4

### Context brief

Steps 5, 6, 7, and 8 all produce TypeScript files and need `tsc` and `vitest` available. This step creates the minimal toolchain in `Dashboard_Website/` so those steps can verify their outputs immediately. The `package.json` created here is for the planning scaffold only — it will be superseded by the real Next.js `package.json` in Blueprint B.

### Tasks

1. Create `Dashboard_Website/package.json`:
```json
{
  "name": "retireau-scaffold",
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.1.0",
    "zod": "^3.22.0"
  }
}
```

2. Create `Dashboard_Website/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["vitest/globals"]
  },
  "include": ["lib/**/*", "types/**/*", "tests/**/*"]
}
```

3. Run `npm install` from `Dashboard_Website/`:
```bash
cd "Dashboard_Website"
npm install
```

### Verification
```bash
cd "Dashboard_Website"
npx tsc --version   # expect: 5.x
npx vitest --version   # expect: 2.x
```

### Exit criteria
- [ ] `node_modules/` exists in `Dashboard_Website/`
- [ ] `npx tsc --version` prints 5.x
- [ ] `npx vitest --version` prints 2.x

### Rollback
Delete `Dashboard_Website/node_modules/`, `Dashboard_Website/package.json`, `Dashboard_Website/tsconfig.json`.

---

## Step 5 — Generate `lib/au-tax-data.ts`

**Depends on:** Steps 2 (Q4/ADR-004 answered) and 4.5 (toolchain)
**Model:** default
**Parallel:** Yes — can run in parallel with Step 6

### Context brief

`lib/au-tax-data.ts` is the single source of truth for all AU tax constants. It replaces every inline constant across all 25 docs. Generating it during planning means Phase 2 of the build just copies this file into `src/lib/` — no design decisions required.

The scaffold lives in `Dashboard_Website/lib/` (not in the Next.js repo yet — it will be copied in Blueprint B Step 1).

### Tasks

Create `Dashboard_Website/lib/au-tax-data.ts`:

```typescript
// AU Tax Data — FY2026 constants
// Source: ATO.gov.au, confirmed 2026-04-10
// ALL AU tax constants must live here. Never inline in other files.

export const AU_TAX = {
  // Super Guarantee
  sgRate: {
    fy2025: 0.115,   // 11.5%
    fy2026: 0.120,   // 12.0% — legislated
  },
  currentSgRate: 0.120,  // use this in all calculations for FY2026

  // Concessional (before-tax) contributions cap
  concessionalCap: 30_000,  // $30,000 FY2025–26

  // Non-concessional cap
  nonConcessionalCap: 120_000,  // $120,000 FY2025–26

  // Contribution tax
  contributionsTaxRate: 0.15,  // 15% on concessional contributions
  divisionSurchargeTaxRate: 0.30,  // 30% if income > $250k

  // Preservation
  preservationAge: 60,  // Born after 30 June 1964: fixed at 60

  // Medicare levy
  medicareLevy: 0.02,  // 2% of taxable income
  medicareLevyLowIncomeThreshold: 27_222,  // Single, FY2024–25 (ATO)
  medicareLevySurchargeThreshold: 93_000,  // Single, before surcharge

  // Income tax brackets FY2025–26 (Stage 3 cuts)
  taxBrackets: [
    { from: 0,       to: 18_200,   rate: 0.00, fixedTax: 0 },
    { from: 18_201,  to: 45_000,   rate: 0.19, fixedTax: 0 },
    { from: 45_001,  to: 135_000,  rate: 0.325, fixedTax: 5_092 },
    { from: 135_001, to: 190_000,  rate: 0.37,  fixedTax: 34_342 },
    { from: 190_001, to: Infinity, rate: 0.45,  fixedTax: 54_742 },
  ],

  // Low Income Tax Offset (LITO) FY2025–26
  lito: {
    maxOffset: 700,
    phasesOut: [
      { from: 37_500, to: 45_000,  reduction: 0.05 },
      { from: 45_000, to: 66_667,  reduction: 0.015 },
    ],
  },

  // Low and Middle Income Tax Offset (LMITO) — expired FY2023. Do not use.

  // Financial year
  currentFY: '2025-26',
  currentFYStart: new Date('2025-07-01'),
  currentFYEnd: new Date('2026-06-30'),
} as const;

/** Calculate income tax payable on a gross annual salary (AU, FY2025-26). */
export function calcIncomeTax(grossAnnual: number): number {
  const bracket = AU_TAX.taxBrackets.findLast(b => grossAnnual >= b.from);
  if (!bracket) return 0;
  return bracket.fixedTax + (grossAnnual - bracket.from) * bracket.rate;
}

/** Calculate Medicare levy (no surcharge logic). */
export function calcMedicareLevy(grossAnnual: number): number {
  if (grossAnnual <= AU_TAX.medicareLevyLowIncomeThreshold) return 0;
  return grossAnnual * AU_TAX.medicareLevy;
}

/** Net annual salary after income tax and Medicare levy. */
export function calcNetAnnual(grossAnnual: number): number {
  return grossAnnual - calcIncomeTax(grossAnnual) - calcMedicareLevy(grossAnnual);
}
```

### Verification

```bash
cd "Dashboard_Website"
npx tsc --noEmit   # expect: zero errors

# Smoke-test values via vitest inline (tsx not needed — vitest handles .ts natively)
npx vitest run --reporter=verbose lib/au-tax-data.ts 2>/dev/null || true
# (full test is in Step 8; here just confirm tsc passes)
```

### Exit criteria

- [ ] `Dashboard_Website/lib/au-tax-data.ts` exists
- [ ] `npx tsc --noEmit` exits 0
- [ ] Code review confirms: `AU_TAX.currentSgRate === 0.12`, `concessionalCap === 30000`, `preservationAge === 60`
- [ ] `findLast` usage noted — requires Node ≥ 20 (covered by `engines` in package.json)

### Rollback

Delete `Dashboard_Website/lib/au-tax-data.ts`.

---

## Step 6 — Generate `types/config.ts` + Zod Schemas

**Depends on:** Steps 2 (Q1/ADR-001 answered), 4 (schema renames applied)
**Model:** default
**Parallel:** Yes — can run in parallel with Step 5

### Context brief

The `DashboardConfig` TypeScript type and all Zod validation schemas are generated here from the canonical shape in `docs/07-config-reference.md` (as amended by Step 4). The verify script (`tools/verify_fixture_a.js`) provides the ground-truth shape.

From `verify_fixture_a.js`, the canonical top-level keys are:
- `profile` — matty, partner, currentYear, projectionYears, preservationAge, contribTaxRate, concessionalCap
- `debts` — active[]
- `expenses` — fixed[], variable[]
- `familyProperty` — purchasePrice, currentValue, ownershipShare, weeklyRent, growthRate, loans, parents

Generate these files in `Dashboard_Website/types/`:

### Tasks

1. Create `Dashboard_Website/types/config.ts` — TypeScript interface tree matching the canonical shape
2. Create `Dashboard_Website/types/config.zod.ts` — Zod schemas mirroring the interfaces
3. Create `Dashboard_Website/types/index.ts` — re-exports

Key Zod schemas to generate (derived from `docs/07-config-reference.md` + verify script):
- `PersonSchema` (matty/partner)
- `DebtSchema` (active debt item)
- `ExpenseItemSchema` (fixed/variable item)
- `MortgageTermsSchema`
- `FamilyPropertySchema`
- `DashboardConfigSchema` (root)
- `ApiConfigResponseSchema` (API envelope)
- `ApiConfigRequestSchema` (save request)

Include `schemaVersion: z.literal(1)` on the root schema (or `z.literal(2)` per ADR-002 decision).

### Verification

```bash
cd "Dashboard_Website"
npx tsc --noEmit   # expect: zero errors across lib/ types/ (tsconfig.json covers both)
# Runtime Zod parse test happens in Step 8 vitest suite — not here
```

### Exit criteria

- [ ] `types/config.ts` compiles with `tsc --noEmit`
- [ ] `types/config.zod.ts` compiles and `DashboardConfigSchema.parse(FIXTURE_A_SHAPE)` passes at runtime
- [ ] Every field in `verify_fixture_a.js`'s `CONFIG` object has a corresponding schema entry
- [ ] `schemaVersion` field present on root schema

### Rollback

Delete `Dashboard_Website/types/`.

---

## Step 7 — Generate `lib/copy.ts`

**Depends on:** Step 4 (error taxonomy fixes applied)
**Model:** default

### Context brief

All user-facing UI strings live in one file. This prevents the copy-deck drift found in the audit (strings invented per-component in `docs/03`, `docs/13`, `docs/14` without a central registry). Generating it now means the implementation just imports from here — no string invention during building.

Sources: `docs/14-loading-empty-error-states.md` §copy deck, `docs/25-error-taxonomy.md` §user-facing messages.

### Tasks

Create `Dashboard_Website/lib/copy.ts`:

```typescript
// Central copy deck — ALL user-facing strings live here.
// Never invent strings in components. Import from this file.

export const COPY = {
  // Auth
  auth: {
    signInToSave: 'Sign in to save your progress',
    signingIn: 'Signing in...',
    signedOut: 'Signed out',
  },

  // Sync states
  sync: {
    saving: 'Saving...',
    saved: 'Saved ✓',
    saveFailed: 'Save failed. Retry?',
    offline: "Can't reach the cloud — you are working offline. Changes saved locally.",
    conflictPrompt: 'Your settings were updated on another device. Use cloud version or keep local?',
    useCloud: 'Use cloud version',
    keepLocal: 'Keep local',
  },

  // Loading / skeleton
  loading: {
    dashboard: 'Loading your dashboard...',
    chart: 'Loading chart...',
    config: 'Loading your settings...',
  },

  // Empty states
  empty: {
    noExpenses: 'No expenses added yet. Edit your profile to get started.',
    noDebts: 'No active debts. Your debt section will appear when you add loans.',
    noTransactions: 'Upload a bank export to see your spending breakdown.',
  },

  // Edit mode
  edit: {
    incomeSaved: 'Income saved ✓',
    superSaved: 'Superannuation saved ✓',
    debtSaved: 'Debt updated ✓',
    saveFailed: 'Save failed. Retry?',
    unsavedChanges: 'You have unsaved changes. Leave anyway?',
  },

  // Errors (user-facing text; codes are in ERRORS below)
  errors: {
    generic: 'Something went wrong. Please try again.',
    offline: 'You appear to be offline. Changes will sync when you reconnect.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    configInvalid: 'Your settings appear corrupted. Restoring defaults.',
    syncConflict: 'Sync conflict detected. Choose which version to keep.',
    calcError: 'Could not calculate results. Check your inputs.',
  },

  // Navigation
  nav: {
    dashboard: 'Dashboard',
    budget: 'Budget & Expenses',
    debt: 'Debt Payoff',
    super: 'Superannuation',
    property: 'Family Property',
    settings: 'Settings',
    notFound: 'Section not found',
  },
} as const;

// Error codes — maps doc 25 error taxonomy to user copy
export const ERROR_COPY: Record<string, string> = {
  CONFIG_VALIDATION_FAILED: COPY.errors.configInvalid,
  CONFIG_MIGRATION_FAILED: COPY.errors.configInvalid,
  SYNC_CONFLICT: COPY.errors.syncConflict,
  SYNC_NETWORK_ERROR: COPY.errors.offline,
  AUTH_SESSION_EXPIRED: COPY.errors.sessionExpired,
  CALC_NEGATIVE_BALANCE: COPY.errors.calcError,
  IMPORT_PARSE_ERROR: 'Could not import dashboard file. Check the format.',
  IMPORT_XLSX_PARSE_ERROR: 'Could not read Excel file. Check the format.',
};
```

### Verification

```bash
npx tsc --noEmit Dashboard_Website/lib/copy.ts   # expect: clean
grep "COPY\." Dashboard_Website/lib/copy.ts | wc -l   # expect: >20 string entries
```

### Exit criteria

- [ ] `lib/copy.ts` compiles cleanly
- [ ] All user-facing strings from `docs/14` copy deck are present
- [ ] All error codes from `docs/25` that have user-facing messages are in `ERROR_COPY`
- [ ] No string is more than 120 characters (SMS rule — keeps UI clean)

### Rollback

Delete `Dashboard_Website/lib/copy.ts`.

---

## Step 8 — Port Calculation Engine + Write Vitest Tests

**Depends on:** Steps 4 (fixes applied), 5 (au-tax-data.ts), 6 (types)
**Model:** Opus for design; default for implementation
**Parallel:** No — this is the critical path

### Context brief

This is the highest-value step. The goal is: **by the end of this step, all calculation logic is in TypeScript with passing Vitest tests against Fixture A, before a single component is written.** When Blueprint B Phase 3 runs, it just wires these functions into selectors — no design work required.

**Ground truth:** `tools/verify_fixture_a.js` contains the exact implementations of three functions. Port them verbatim first, then write tests, then add the remaining functions from `docs/08-calculation-engine.md`.

**Functions already in verify script (port these first):**
1. `calcBudgetKPIs(config)` — line 70–104 of verify script
2. `calcMortgageSchedule(principal, annualRate, totalTerm, ioPeriod, mode)` — line 109–151
3. `calcFamilyPropertyProjection(config)` — line 157–249

**Additional functions from `docs/08-calculation-engine.md` (port after tests pass for the above):**
4. `projectSuper(config)` — super balance projection (compound growth + concessional contributions)
5. `simulateDebtPayoff(config)` — avalanche/snowball debt simulation
6. `simulateDepositScenarios(config)` — two deposit-saving scenarios
7. `calcRetirementReadiness(config)` — years to target balance + drawdown longevity
8. `calcSalarySacrifice(config)` — optimiser for concessional contributions

**PII rule:** Tests use the CONFIG from `verify_fixture_a.js` (Fixture A) which contains real personal data. Tests go in `Dashboard_Website/tests/fixtures/fixture-a.local.ts` (gitignored). A scrubbed `fixture-a.example.ts` (numbers zeroed out or replaced) goes in the repo. Add both paths to a local `.gitignore`.

### Tasks

1. Create `Dashboard_Website/lib/calc/` directory with:
   - `budget.ts` — `calcBudgetKPIs`
   - `mortgage.ts` — `calcMortgageSchedule`
   - `property.ts` — `calcFamilyPropertyProjection`
   - `super.ts` — `projectSuper`
   - `debt.ts` — `simulateDebtPayoff`
   - `deposit.ts` — `simulateDepositScenarios`
   - `retirement.ts` — `calcRetirementReadiness`, `calcSalarySacrifice`
   - `index.ts` — re-exports all

2. Create `Dashboard_Website/tests/` with:
   - `fixtures/fixture-a.local.ts` — real Fixture A values (gitignored)
   - `fixtures/fixture-a.example.ts` — scrubbed version (all numbers = 0 or placeholders)
   - `calc/budget.test.ts`
   - `calc/mortgage.test.ts`
   - `calc/property.test.ts`
   - `calc/super.test.ts`
   - `calc/debt.test.ts`
   - `calc/deposit.test.ts`
   - `calc/retirement.test.ts`

3. For each function, follow the TDD cycle:
   - Write the test first (using Fixture A expected outputs from `docs/10-test-fixtures.md`)
   - Run `node tools/verify_fixture_a.js` to confirm the expected value
   - Port the function from the verify script / doc 08
   - Run test — it must pass

4. **Critical assertions** (from DoD Gate 1):
   Exact expected values live in `tests/fixtures/fixture-a.local.ts` (gitignored — contains PII).
   Do **not** hardcode expected numbers in this plan file or in committed test files.
   Get values by running `node tools/verify_fixture_a.js` locally and reading its output.
   The fields to assert are documented (without values) in `DEFINITION_OF_DONE.md` Gate 1:
   - `calcBudgetKPIs`: `combinedMonthly`, `fixedTotal`, `varExCC`, `totalSpend`, `surplus`, `savingsRate`
   - `calcMortgageSchedule(principal, 0.056, 30, 5, 'io-then-pi')`: year-1/5/6/30 balances
   - `calcFamilyPropertyProjection`: `statics.monthlyIO`, `statics.monthlyPI`
   Write assertions as: `expect(result.savingsRate).toBeCloseTo(FIXTURE_A_EXPECTED.savingsRate, 1)` where `FIXTURE_A_EXPECTED` is imported from `fixture-a.local.ts`.

5. Add a local `.gitignore` inside `Dashboard_Website/tests/fixtures/`:
   ```
   fixture-a.local.ts
   fixture-b.local.ts
   fixture-c.local.ts
   ```

6. Create `Dashboard_Website/package.json` (minimal, for vitest):
   ```json
   {
     "name": "retireau-scaffold",
     "type": "module",
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "typecheck": "tsc --noEmit"
     },
     "devDependencies": {
       "vitest": "^1.0.0",
       "typescript": "^5.0.0"
     }
   }
   ```

### Verification

```bash
cd Dashboard_Website
npm install
npx vitest run   # ALL tests must pass
node tools/verify_fixture_a.js   # sentinel values must match test expectations
npx tsc --noEmit   # zero type errors
```

### Exit criteria

- [ ] `npx vitest run` exits 0 with all tests passing
- [ ] `calcBudgetKPIs(FIXTURE_A).savingsRate` matches value from `node tools/verify_fixture_a.js` (within 0.1)
- [ ] `calcMortgageSchedule` year-6 balance matches verify script output
- [ ] `calcFamilyPropertyProjection(FIXTURE_A).statics.monthlyIO` and `.monthlyPI` match verify script output
- [ ] No expected values are hardcoded in committed files — all come from `fixture-a.local.ts` (gitignored)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `tests/fixtures/fixture-a.local.ts` is in `.gitignore`
- [ ] `tests/fixtures/fixture-a.example.ts` exists (scrubbed) and is committed

### Rollback

Delete `Dashboard_Website/lib/calc/`, `Dashboard_Website/tests/`, `Dashboard_Website/package.json`.

---

## Step 9 — Fixtures B and C

**Depends on:** Step 8 (calc engine verified), Step 1 (Q3/ADR-003 answered)
**Model:** default

### Context brief

`docs/10-test-fixtures.md` describes Fixture B (Alex, single) and Fixture C (Patricia, retired). Per ADR-003:

- **If ground truth:** create `verify_fixture_b.js`, `verify_fixture_c.js` with explicit expected outputs, add tests to `calc/*.test.ts`
- **If illustrative:** add a header to `docs/10` marking B/C as "not verified against live calculation — for documentation reference only" and update DoD Gate 1.6 to remove the B/C passing requirement

### Tasks

**If ADR-003 = ground truth:**
1. Read Fixture B/C CONFIG shapes from `docs/10-test-fixtures.md`
2. Create `tools/verify_fixture_b.js` and `tools/verify_fixture_c.js` mirroring the pattern in `verify_fixture_a.js`
3. Run each script; note the actual outputs
4. If outputs match docs/10's expected tables: add them as passing assertions in `calc/*.test.ts`
5. If outputs diverge: flag the specific field mismatches in `CRITICAL-FIXES.md` as a new Part 1 item; resolve before Blueprint B

**If ADR-003 = illustrative:**
1. Add to the top of `docs/10-test-fixtures.md` Fixture B and C sections:
   > ⚠ This fixture is illustrative only and has not been verified against a live calculation baseline. Use only as documentation reference, not as a test oracle.
2. Update DoD Gate 1.6: change "All three fixtures (A, B, C)" to "Fixture A; Fixtures B and C are illustrative."

### Verification

```bash
# If ground truth:
node tools/verify_fixture_b.js   # runs without error
node tools/verify_fixture_c.js   # runs without error
cd "Dashboard_Website" && npx vitest run   # still all pass

# If illustrative:
grep -n "illustrative" docs/10-test-fixtures.md   # warning headers present
```

### Exit criteria

- [ ] ADR-003 decision applied
- [ ] If ground truth: all B/C tests pass, verify scripts exist
- [ ] If illustrative: DoD Gate 1.6 updated, docs/10 warning headers added
- [ ] `npx vitest run` still passes

### Rollback

**If ground truth path:** Delete `tools/verify_fixture_b.js`, `tools/verify_fixture_c.js`. Remove B/C test blocks from `calc/*.test.ts`. Run `npx vitest run` to confirm A tests still pass.

**If illustrative path:** Revert the warning header additions to `docs/10-test-fixtures.md`. Revert DoD Gate 1.6 wording. Log the rollback in `plans/rollback.log` with date and reason (so Q3 isn't re-answered blindly).

---

## Step 10a — Generate Phase 1–2 Briefs (early unlock)

**Depends on:** Steps 3 (Part 1 fixes), 6 (types generated)
**Model:** Opus
**Parallel:** Can run as soon as Steps 3 and 6 are complete — does not need calc engine

Phase 1 (scaffold) and Phase 2 (data layer) do not depend on the calculation engine. Generate these two briefs early so Blueprint B's earliest steps are ready while Steps 8–9 are still in progress.

Create `plans/phase-1-scaffold.md` and `plans/phase-2-data-layer.md` per the brief template in Step 10b.

**Verification:** Both files exist and each has the 5 required sections.

**Rollback:** Delete `plans/phase-1-scaffold.md` and `plans/phase-2-data-layer.md`.

---

## Step 10b — Generate Phase 3–8 Briefs

**Depends on:** Steps 4 (all fixes applied), 5, 6, 7, 8 (scaffold complete)
**Model:** Opus (strongest) — these briefs are the Blueprint B inputs; quality here determines execution quality
**Parallel:** No — each brief references the outputs of all prior steps

### Context brief

Each phase-brief is a **self-contained cold-start document** for a single build phase. A fresh agent dropped into the repo with only the brief should be able to execute that phase without reading any other file (except `CLAUDE.md` which is auto-loaded).

Each brief must include:
- One-paragraph context (what this phase builds, why, what comes before/after)
- Pre-conditions checklist (what must be true before starting)
- Exact file list (new files created, files modified, files read-only)
- Task list (ordered, specific, with file paths and line-level guidance where needed)
- Verification commands (copy-paste ready)
- DoD gates verified by this phase
- Exit criteria (explicit pass/fail)
- Rollback strategy

### Tasks

Create one file per phase (phases 3–8) in `Dashboard_Website/plans/`:

| File | Phase | Key builds |
|------|-------|-----------|
| `plans/phase-3-calc-engine.md` | Calculation Engine | lib/calc/ copy-in, Vitest wired, all DoD Gate 1 assertions passing |
| `plans/phase-4-budget-debt.md` | Budget & Debt Sections | BudgetProfile, DebtPayoff, DepositComparison + charts + tables |
| `plans/phase-5-super-property.md` | Super & Property | SuperProjection, FamilyProperty, ExpenseTracker + Excel upload |
| `plans/phase-6-auth-sync.md` | Auth & Cloud Sync | Clerk, Prisma, Railway Postgres, API routes, useCloudSync, DELETE /api/user |
| `plans/phase-7-deployment.md` | Deployment & DNS | Railway deploy, Cloudflare, prod smoke test, validation checklist on live URL |
| `plans/phase-8-polish.md` | Polish & Launch | Loading/empty/error states, onboarding, Lighthouse CI, bundle budget, DoD walkthrough |

For phases 1–3, the brief should reference the pre-built scaffold files (copy-in instructions with exact source paths from `Dashboard_Website/lib/`, `Dashboard_Website/types/`).

### Verification

```bash
ls "Dashboard_Website/plans/phase-*.md" | wc -l   # expect: 8 (including 1+2 from Step 10a)

# Each brief has required sections (5 per file)
for f in "Dashboard_Website/plans/phase-*.md"; do
  echo "--- $f ---"
  grep -c "## Pre-conditions\|## Tasks\|## Verification\|## Exit criteria\|## Rollback" "$f"
done
# each should output 5
```

### Exit criteria

- [ ] 8 phase-brief files total (phases 1–2 from Step 10a, phases 3–8 from Step 10b)
- [ ] Each brief has: Pre-conditions, Tasks, Verification, Exit criteria, Rollback sections
- [ ] Phases 3–8 briefs each reference the scaffold copy-in steps from Blueprint A Steps 5–8
- [ ] Each brief is ≤ 400 lines
- [ ] DoD gates mapped per brief

### Rollback

Delete `plans/phase-3-scaffold.md` through `plans/phase-8-polish.md` (Step 10a files are separate rollback).

---

## Step 11 — Security Review Pass

**Depends on:** Step 10 (all phase briefs complete, full scaffold generated)
**Model:** Opus (strongest)
**Skill:** `/everything-claude-code:security-review`

### Context brief

Run a security review across:
1. All generated scaffold files (`lib/au-tax-data.ts`, `types/config.ts`, `lib/copy.ts`, `lib/calc/*.ts`)
2. The API contract spec (`docs/11-api-contracts.md`) with the new DELETE/export endpoints
3. The auth middleware spec (`docs/17-auth-middleware.md`) with corrected Clerk storage claim
4. The threat model (`docs/22-security-threat-model.md`) with the STRIDE gaps

Focus areas from the audit:
- Webhook signature verification completeness
- CSP directive completeness (now spec'd as mandatory)
- No secrets in generated files
- No PII in generated non-fixture files
- Zod schemas reject injection payloads (fuzz test the hexColor and URL fields)

### Tasks

1. Invoke `/everything-claude-code:security-review` with the generated scaffold + affected spec docs as context
2. For each Critical finding: fix immediately before proceeding to Step 12
3. For each Important finding: annotate in `CRITICAL-FIXES.md` as a new Part 1 entry with fix instructions
4. Create `Dashboard_Website/SECURITY-REVIEW.md` with the full report and status of each finding

### Verification

```bash
# No hardcoded secrets or PII
grep -rn "sk_\|pk_\|postgres://\|whsec_" Dashboard_Website/lib/ Dashboard_Website/types/
# expect: 0 results

# No console.log in generated files
grep -rn "console\." Dashboard_Website/lib/ Dashboard_Website/types/
# expect: 0 results
```

### Exit criteria

- [ ] `SECURITY-REVIEW.md` exists with all findings documented
- [ ] Zero Critical findings remain open
- [ ] No secrets or PII in any generated file
- [ ] `grep -rn "console\." Dashboard_Website/lib/ Dashboard_Website/types/` returns empty

### Rollback

If a Critical finding requires deleting a generated file (e.g., `lib/calc/retirement.ts` has an injection risk): delete the file, log the finding in `SECURITY-REVIEW.md` as "Blocked", rewrite the affected function, re-run the security review on that file only before re-adding it. Do not block all of Blueprint A on one file — scope the fix narrowly.

---

## Step 12 — Adversarial Review + Register

**Depends on:** Step 11
**Model:** Opus (strongest)
**Parallel:** No — final gate

### Context brief

This is the blueprint skill's Review phase. A fresh Opus sub-agent reads this entire plan file and checks it against the anti-pattern catalog and quality checklist. All Critical findings are fixed before Blueprint A is considered complete.

### Tasks

1. Spawn an Opus sub-agent with this prompt:
   > "Review `Dashboard_Website/plans/retireau-a-planning-pipeline.md`. Check for: (a) any step whose task list is ambiguous enough that two agents would implement it differently; (b) any dependency edge that would cause a deadlock or wrong ordering; (c) any step that assumes a file exists that no prior step creates; (d) any step missing a rollback strategy; (e) any PII leak risk not already guarded. Return Critical findings (must fix before Blueprint B) and Important findings (fix at discretion)."
2. Fix all Critical findings in this plan file.
3. Update `CLAUDE.md` with a one-line status: `Blueprint A complete: 2026-04-10. Begin Blueprint B.`
4. Update `OPEN-QUESTIONS.md`: add a `Status: Resolved` line at the top.
5. Update `CRITICAL-FIXES.md`: add a `Status: All fixes applied` line at the top.

### Verification (Blueprint A → Blueprint B Gate)

```bash
cd Dashboard_Website

# Q1: zero open questions
grep -c "Answer: ___" OPEN-QUESTIONS.md   # expect: 0

# Q2: every Part 1 and Part 2 fix has a "Fixed:" or "N/A —" annotation
part1=$(grep -c "^### Fix 1\." CRITICAL-FIXES.md)
part2=$(grep -c "^### Fix 2\." CRITICAL-FIXES.md)
annotated=$(grep -c "^Fixed:\|^N/A —" CRITICAL-FIXES.md)
echo "Fixes: $((part1 + part2))  Annotated: $annotated"
# expect: Annotated == Fixes (both numbers identical)

# Q3: calculation baseline
node tools/verify_fixture_a.js   # must produce savingsRate: 42.65, monthlyIO: 5,133, monthlyPI: 6,821

# Q4: tests pass
npx vitest run   # all passing

# Q5: types compile
npx tsc --noEmit

# Q6: all 8 phase briefs exist
ls plans/phase-*.md | wc -l   # expect: 8

# Q7: no PII in tracked (committed) files
git ls-files | xargs grep -l "Matty\|Partner\|196000\|155000" 2>/dev/null \
  | grep -v "fixture-a.example.ts\|verify_fixture_a.js\|plans/"
# expect: empty (verify_fixture_a.js and example fixture are the only allowed exceptions)
# Note: plans/ files are excluded — this blueprint itself must not contain PII numbers (see C3 fix)
```

### Exit criteria

- [ ] All 7 gate checks above pass
- [ ] `CLAUDE.md` has `Blueprint A complete` status line
- [ ] Sub-agent adversarial review found zero Critical findings (or all were fixed)
- [ ] `plans/retireau-b-implementation-phases.md` is the next file to be produced

**When this step is complete, proceed to Blueprint B.**

---

## Summary

| Step | Name | Model | Parallel | Creates |
|------|------|-------|----------|---------|
| 0 | Environment baseline | — | done | `plans/` directory |
| 1 | Resolve Q1–Q11 | Opus | serial | `docs/adr/001–011.md`, `OPEN-QUESTIONS.md` filled |
| 2 | Distill to CLAUDE.md | default | after 1 | `CLAUDE.md §Decisions` |
| 3 | Apply Part 1 fixes | default | ∥ 1–2 (excl. 1.7, 1.8) | 12 doc edits |
| 4 | Apply Part 2 fixes | default | after 2+3 | 10 doc edits |
| 4.5 | Bootstrap toolchain | default | ∥ 1–4 | `package.json`, `tsconfig.json`, `node_modules/` |
| 5 | Generate au-tax-data.ts | default | ∥ 6 (after 2, 4.5) | `lib/au-tax-data.ts` |
| 6 | Generate types + Zod | default | ∥ 5 (after 2, 4.5) | `types/config.ts`, `types/config.zod.ts` |
| 7 | Generate lib/copy.ts | default | after 4, 4.5 | `lib/copy.ts` |
| 8 | Port calc engine + tests | Opus/default | serial (after 4,5,6) | `lib/calc/*.ts`, `tests/calc/*.test.ts` |
| 9 | Fixtures B & C | default | after 8 | verify scripts or doc update |
| 10a | Phase 1–2 briefs (early) | Opus | after 3, 6 | `plans/phase-1–2.md` |
| 10b | Phase 3–8 briefs | Opus | after 5–8 | `plans/phase-3–8.md` |
| 11 | Security review | Opus | after 10b | `SECURITY-REVIEW.md` |
| 12 | Adversarial review + register | Opus | after 11 | plan finalized, CLAUDE.md updated |

**Blueprint A is complete when Step 12 exit criteria are satisfied. Do not start Blueprint B before then.**
