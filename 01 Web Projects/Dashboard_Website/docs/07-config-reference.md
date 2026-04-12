# Configuration Reference — RetireAU Dashboard

## Overview

The entire RetireAU Dashboard state is contained in a single `CONFIG` JSON object, mirroring the structure from the original HTML dashboard. This object holds all financial parameters (salaries, super balances, debts, property values, expenses, assumptions) and drives all calculations, charts, and UI rendering. The CONFIG blob is persisted to Postgres as JSONB per user and is the single source of truth for all dashboard state.

This document provides a complete field-by-field breakdown of every property in CONFIG, including type, units, valid ranges, defaults, and which calculations consume it. For deployment and database storage, see **02-database-schema.md**. For calculation logic that reads these fields, see **06-implementation-plan.md** and `/lib/financial-maths.ts`.

---

## High-Level Architecture

```
CONFIG (root object)
├── profile          → Personal & salary data for user1 and user2
├── debts            → Active loans, paid-off debts, lump sum available
├── expenses         → Fixed, variable, and budget chart definitions
├── property         → Primary residence purchase scenario
├── mortgage         → Primary residence mortgage parameters
├── familyProperty   → Inherited property scenario (family trust)
├── children         → Childcare, school costs, years of arrival
├── defaults         → Fallback assumptions for calculations
```

Every top-level key is required. Missing fields should be populated with the **Default** values listed in this reference before saving to the database.

---

## 1. Profile Section

Controls personal data, ages, salaries, and superannuation for both user1 and user2. Also holds global projection assumptions (years, preservation age, tax rates).

> **Naming convention:** The persisted schema and all API contracts use `user1`/`user2`. Display aliases `matty`/`partner` are computed by `lib/selectors/personas.ts` from `profile.user1.name`/`profile.user2.name`. Never use persona names in DB migrations, Zod schemas, or API routes.

### 1.1 user1's Profile

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `profile.user1.name` | string | — | Any non-empty string | `"Matty"` | Display name for user1 (not used in calculations). // "Matty"/"Partner" are display aliases resolved via lib/selectors/personas.ts |
| `profile.user1.age` | number | years | 18–70 | 35 | Current age of user1. Used to calculate years to retirement and super drawdown eligibility. Controls retirement readiness projections. |
| `profile.user1.superBalance` | number | AUD | ≥ 0 | 155000 | Current superannuation balance. Starting point for all super projection calculations. Updated via control input. |
| `profile.user1.salary` | number | AUD | ≥ 0 | 196000 | Current gross annual salary. Drives SG contribution, tax calculations, and net income projections. Updated via control input. |
| `profile.user1.superRate` | number | decimal (0–1) | 0 – 1 | 0.14 | Employer superannuation rate (as a decimal: 14% = 0.14). Applied on top of SG minimum. Affects total super contributions. |
| `profile.user1.bonus` | number | decimal (0–1) | 0 – 1 | 0.15 | Expected annual bonus as a percentage of salary (15% = 0.15). Adds to gross income for projections. |
| `profile.user1.futureSalary` | number | AUD | ≥ 0 | 190000 | Projected salary after career change or role shift. Used if `switchYear` is reached. |
| `profile.user1.futureSuperRate` | number | decimal (0–1) | 0 – 1 | 0.125 | Projected employer super rate at future career stage (e.g. 12.5% = 0.125). |
| `profile.user1.switchYear` | number | year | ≥ 2026 | 2028 | Year when user1 switches to future salary and super rate. After this year, `futureSalary` and `futureSuperRate` apply instead of current values. |

**Calculation Dependencies**: `projectSuper()`, `calculateNetIncome()`, `retirementReadiness()`.

### 1.2 user2's Profile

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `profile.user2.name` | string | — | Any non-empty string | `"Partner"` | Display name for user2 (not used in calculations). |
| `profile.user2.age` | number | years | 18–70 | 26 | Current age of user2. Used to calculate years to their retirement and super drawdown eligibility. |
| `profile.user2.superBalance` | number | AUD | ≥ 0 | 35000 | Current superannuation balance. Starting point for user2's super projections. Updated via control input. |
| `profile.user2.salary` | number | AUD | ≥ 0 | 86000 | Current gross annual salary. Drives SG contribution, tax calculations, and net income projections. Updated via control input. |
| `profile.user2.employer` | string | — | Any non-empty string | `"MVF Sunshine Coast"` | Name of user2's employer (informational, not used in calculations). |

**Calculation Dependencies**: `projectSuper()`, `calculateNetIncome()`, `retirementReadiness()`.

### 1.3 Global Profile & Projection Parameters

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `profile.currentYear` | number | year | ≥ 2026 | 2026 | Starting year for all projections. Used to index chart labels and milestone tracking. Should typically be set to current calendar year. |
| `profile.projectionYears` | number | years | 10–50 | 35 | Number of years to project forward (e.g. 35 years = age 35 to 70). Affects all time-series calculations and chart x-axis range. |
| `profile.preservationAge` | number | years | 55–67 | 60 | Age at which superannuation can be accessed without penalty in Australia. Used to calculate years to super access. Typically 60 for most users. Do not change unless legislation updates. |
| `profile.contribTaxRate` | number | decimal (0–1) | 0 – 0.15 | 0.15 | Concessional tax rate applied to superannuation contributions. In Australia, super is taxed at 15%. Affects net super growth calculations. |
| `profile.concessionalCap` | number | AUD | ≥ 0 | 30000 | Annual concessional contribution cap (AUD). Contributions above this are taxed at marginal rate. Set to $30,000 per Australian tax law; do not change unless legislation updates. |

**Calculation Dependencies**: `projectSuper()`, `calculateConcessionalCap()`, `retirementReadiness()`.

---

## 2. Debts Section

Tracks active loans (car, personal finance, BNPL), paid-off debts (for historical reference), and lump sum available for debt payoff. Used for debt avalanche simulations and surplus calculations.

### 2.1 Active Debts (Array)

Each debt object in `debts.active[]` has the following structure:

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `debts.active[n].name` | string | — | Any non-empty string | e.g., `"Partner's Car"` | Display name of the debt. Used in charts and UI tables. |
| `debts.active[n].balance` | number | AUD | ≥ 0 | varies | Current outstanding balance. Updated as monthly payments reduce principal. Used in avalanche simulation. |
| `debts.active[n].payment` | number | AUD | ≥ 0 | varies | Current monthly payment amount. Used to calculate payoff timeline and cash flow surplus. |
| `debts.active[n].rate` | number | decimal (0–1) | 0 – 0.3 | varies | Annual interest rate as decimal (8% = 0.08). Highest-rate debts are targeted first in avalanche strategy. |
| `debts.active[n].color` | string | hex color | Valid hex codes | varies | Chart colour for this debt line (e.g., `"#f87171"` for red). Used to visually distinguish debts in charts. |

**Example debt:**
```json
{
  "name": "Partner's Car",
  "balance": 35000,
  "payment": 681,
  "rate": 0.08,
  "color": "#f87171"
}
```

**Calculation Dependencies**: `simulateAvalanche()`, `calculateMonthlySurplus()`, `debtPayoffChart()`.

### 2.2 Paid-Off Debts (Array)

Historical record of debts cleared. Used for UI display only; does not affect calculations.

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `debts.paidOff[n].name` | string | — | Any non-empty string | e.g., `"Credit Card (Qantas)"` | Name of the cleared debt (informational). |
| `debts.paidOff[n].finalPayment` | number | AUD | ≥ 0 | varies | Final payment amount to clear the debt. Informational; not used in calculations. |
| `debts.paidOff[n].datePaid` | string | — | e.g., `"Jan 2026"` | varies | Month and year paid off. Informational; used for milestone display. |

### 2.3 Lump Sum & Surplus

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `debts.lumpSum` | number | AUD | ≥ 0 | 34400 | One-time cash available for debt payoff or other uses. Drives "lump sum payoff" scenario in debt charts. Updated via control or calculation. |
| `debts.lumpSumBreakdown` | string | — | Any text | `"$20k savings + $7.4k Stake + $4k Raiz + $3k crypto"` | Narrative breakdown of where the lump sum came from (informational, not calculated). |
| `debts.monthlySurplus` | number | AUD | ≥ 0 | 5433 | Monthly cash surplus after all fixed expenses and debt payments. Calculated from income minus expenses and debt payments. Used to simulate accelerated payoff schedules. |

**Calculation Dependencies**: `calculateMonthlySurplus()`, `simulateLumpSumPayoff()`.

---

## 3. Expenses Section

Detailed breakdown of fixed and variable expenses, plus pre-calculated budget chart data for rendering. All values are monthly unless otherwise noted.

### 3.1 Fixed Expenses (Array)

Non-discretionary, committed monthly costs. Each item:

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `expenses.fixed[n].category` | string | — | Any non-empty string | e.g., `"Rent (ELP Trust)"` | Category name (used in UI and pivot tables). |
| `expenses.fixed[n].monthly` | number | AUD | ≥ 0 | varies | Monthly cost for this category. Summed to calculate total fixed expenses. |

**Example fixed expense:**
```json
{ "category": "Rent (ELP Trust)", "monthly": 3253 }
```

Fixed expenses typically include rent, loan repayments, insurance, utilities, phone, internet.

**Calculation Dependencies**: `calculateMonthlyExpenses()`, `calculateMonthlySurplus()`.

### 3.2 Variable Expenses (Array)

Discretionary spending with month-to-month variability. Structure identical to fixed expenses:

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `expenses.variable[n].category` | string | — | Any non-empty string | e.g., `"Groceries & Household"` | Category name. |
| `expenses.variable[n].monthly` | number | AUD | ≥ 0 | varies | Monthly budget/average for this category. Used to estimate variable spending. |

Variable expenses include groceries, dining, shopping, streaming, software subscriptions, travel, etc.

**Calculation Dependencies**: `calculateMonthlyExpenses()`, `budgetAnalysis()`.

### 3.3 Budget Chart Data

Pre-aggregated data for rendering charts. Populated either from manual entry or from Excel import.

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `expenses.budgetChart.categories` | array[string] | — | Non-empty array | 17 entries | Label names for each expense category displayed in pie/bar chart. Order matches `amounts` array. |
| `expenses.budgetChart.amounts` | array[number] | AUD | ≥ 0 per entry | 17 entries | Monthly amount for each category. Summed total should equal monthly budget. |
| `expenses.budgetChart.colors` | array[string] | hex color | Valid hex codes | 17 entries | Chart colour for each category. Order matches `categories` and `amounts`. |
| `expenses.budgetChart.monthlyTrend.months` | array[string] | — | e.g., `"Jan 2026"` | 3 months | Month labels for historical trend data. |
| `expenses.budgetChart.monthlyTrend.datasets[n].label` | string | — | Non-empty string | e.g., `"Rent"` | Category label for a single trend line. |
| `expenses.budgetChart.monthlyTrend.datasets[n].data` | array[number] | AUD | ≥ 0 per entry | varies | Array of monthly values (one per `months` entry). Visualised as line in trend chart. |
| `expenses.budgetChart.monthlyTrend.datasets[n].color` | string | hex color | Valid hex codes | varies | Chart colour for this trend line. |

**Example budget chart structure:**
```json
{
  "categories": ["Rent", "Groceries", "Dining"],
  "amounts": [3253, 1554, 827],
  "colors": ["#f87171", "#4ade80", "#2dd4bf"],
  "monthlyTrend": {
    "months": ["Jan 2026", "Feb 2026", "Mar 2026"],
    "datasets": [
      {"label": "Rent", "data": [3838, 2960, 2960], "color": "#f87171"},
      {"label": "Groceries", "data": [1193, 1099, 1845], "color": "#4ade80"}
    ]
  }
}
```

**Calculation Dependencies**: Populated from Excel import or manual entry; used by `BudgetProfile` component for chart rendering.

---

## 4. Property Section

Primary residence purchase scenario parameters (not the family trust property).

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `property.targetPrice` | number | AUD | ≥ 100000 | 1100000 | Target purchase price of primary residence. Used to calculate deposit required. |
| `property.stampDuty` | number | AUD | ≥ 0 | 38000 | Estimated stamp duty (land transfer tax). Varies by state and price; user should verify with tax office. Added to total upfront cost. |
| `property.legals` | number | AUD | ≥ 0 | 5000 | Legal and conveyancing fees. Typically $3k–$8k depending on state. Added to total upfront cost. |
| `property.appreciationRate` | number | decimal (0–1) | 0 – 0.1 | 0.04 | Expected annual property appreciation rate (4% = 0.04). Used in deposit comparison scenarios (Scenario A vs B). |
| `property.hisaRate` | number | decimal (0–1) | 0 – 0.1 | 0.05 | High-interest savings account rate (5% = 0.05). Used to calculate deposit growth if money is held in HISA rather than invested. Applies to deposit comparison scenarios. |

**Calculation Dependencies**: `calculateDepositRequired()`, `depositComparisonScenario()`, `propertyValueProjection()`.

---

## 5. Mortgage Section

Parameters for primary residence mortgage (distinct from family trust property mortgage).

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `mortgage.loanAmount` | number | AUD | ≥ 0 | 1000000 | Loan amount (property price minus deposit). Used to calculate monthly repayment. Updated via control input. |
| `mortgage.startYear` | number | year | ≥ 2026 | 2027 | Year in which the mortgage begins. Used to time mortgage payments in cash flow projection. |
| `mortgage.rate` | number | decimal (0–1) | 0 – 0.15 | 0.06 | Interest rate as decimal (6% = 0.06). Updated via control input. Used in monthly repayment and schedule calculations. |
| `mortgage.termYears` | number | years | 10–40 | 30 | Loan term in years (30-year mortgage typical). Updated via control input. Used to calculate monthly repayment. |
| `mortgage.ioPeriodYears` | number | years | 0–15 | 0 | Interest-only period within the loan term (integer, years). Zero means full P&I from start. |
| `mortgage.mode` | string | enum | `'io-then-pi' \| 'pi-only' \| 'io-only'` | `'pi-only'` | Repayment mode for primary residence mortgage. |
| `mortgage.propertyValue` | number | AUD | ≥ 0 | 1000000 | Starting value of property on purchase (usually equals target price minus costs). Used as base for growth projections. |
| `mortgage.propertyGrowth` | number | decimal (0–1) | 0 – 0.1 | 0.04 | Annual property appreciation rate (4% = 0.04). Updated via control input. Used to project future equity. |

**Calculation Dependencies**: `calcMortgageSchedule()`, `monthlyRepayment()`, `propertyEquityProjection()`, `netWorthProjection()`.

---

## 6. Family Property Section

Parameters for an inherited property held in a family trust (distinct from primary residence).

### 6.1 Property & Ownership

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `familyProperty.address` | string | — | Any valid address string | `"49 Gloucester St, Spring Hill, Brisbane"` | Physical address (informational, for display only). |
| `familyProperty.purchasePrice` | number | AUD | ≥ 0 | 1300000 | Original purchase price of the property. Informational; used to calculate historical appreciation. |
| `familyProperty.currentValue` | number | AUD | ≥ 0 | 2400000 | Current market value of the property. Updated via control input. Starting point for appreciation projections. |
| `familyProperty.ownershipShare` | number | decimal (0–1) | 0 – 1 | 0.333 | Fractional ownership (0.333 = 1/3 ownership). Updated via control input. Used to allocate debt, rent, and equity to your share. |
| `familyProperty.weeklyRent` | number | AUD | ≥ 0 | 2300 | Weekly rental income. Multiplied by 52 to get annual income. Updated via control input. Used in cash flow and retirement income projections. |
| `familyProperty.growthRate` | number | decimal (0–1) | 0 – 0.1 | 0.04 | Expected annual appreciation rate (4% = 0.04). Updated via control input. Used to project future property value. |

**Calculation Dependencies**: `familyPropertyProjection()`, `ownershipShareAllocation()`, `rentalIncomeProjection()`.

### 6.2 Loans (Mortgage & Equity)

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `familyProperty.loans.mortgage` | number | AUD | ≥ 0 | 1100000 | Outstanding mortgage balance. Updated via control input. Used in equity calculation and debt service. |
| `familyProperty.loans.equityLoan` | number | AUD | ≥ 0 | 297999 | Outstanding equity loan / HELOC balance (if any). Updated via control input. Combined with mortgage for total debt. |
| `familyProperty.loans.mortgageTerms.rate` | number | decimal (0–1) | 0 – 0.15 | 0.056 | Interest rate on mortgage (5.6% = 0.056). Updated via control input (displayed as percentage in UI). Used in repayment calculations. |
| `familyProperty.loans.mortgageTerms.totalTerm` | number | years | 5–40 | 30 | Total mortgage term in years. Updated via control input. Used to calculate remaining amortisation schedule. |
| `familyProperty.loans.mortgageTerms.ioPeriod` | number | years | 0–15 | 5 | Interest-only period duration in years (common in Australia: 5 years IO, then 25 years P&I). Updated via control input. Affects repayment profile. |
| `familyProperty.loans.mortgageTerms.mode` | string | enum | `"io-then-pi"` or `"full-pi"` | `"io-then-pi"` | Repayment mode: interest-only followed by principal-&-interest, or full P&I from start. Updated via control input. Determines payment schedule shape. |

**Calculation Dependencies**: `calcFamilyPropertyMortgage()`, `calcEquityProjection()`, `familyPropertyProjection()`.

### 6.3 Parents & Life Expectancy (Inheritance Timing)

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `familyProperty.parents.parent1Age` | number | years | 50–100 | 65 | Current age of first parent (co-owner). Updated via control input. Used to estimate when property may be inherited (triggers payoff of loans). |
| `familyProperty.parents.parent2Age` | number | years | 50–100 | 63 | Current age of second parent (co-owner). Updated via control input. Used to estimate inheritance timeline. |
| `familyProperty.parents.lifeExpectancy1` | number | years | 65–110 | 85 | Projected life expectancy of parent 1. Used to model when inheritance occurs and debt becomes solely your responsibility. |
| `familyProperty.parents.lifeExpectancy2` | number | years | 65–110 | 87 | Projected life expectancy of parent 2. Used to model when inheritance occurs. |

**Calculation Dependencies**: `inheritanceTimeline()`, `debtTransitionProjection()`.

---

## 7. Children Section

Childcare and school costs, plus years when children arrive.

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `children.count` | number | count | 0–5 | 2 | Number of children. Updated via control input. Used to scale childcare and school costs over time. |
| `children.year1` | number | year | ≥ 2026 | 2028 | Year first child arrives. Updated via control input. Marks start of childcare costs for that child (ages 0–5). |
| `children.year2` | number | year | ≥ 2027 | 2031 | Year second child arrives. Updated via control input. Marks start of childcare for second child. |
| `children.childcareCostPerYear` | number | AUD | ≥ 0 | 25000 | Annual childcare cost per child (ages 0–5). Updated via control input. Multiplied by number of children in childcare age range and scaled by leave reduction. |
| `children.schoolCostPerYear` | number | AUD | ≥ 0 | 12000 | Annual school cost per child (ages 6–18). Updated via control input. Typically includes tuition, uniforms, materials. |
| `children.leaveReduction` | number | decimal (0–1) | 0 – 1 | 0.5 | Fraction of income lost during parental leave (0.5 = 50% reduction). Updated via control input. Applied to Partner's salary during childcare years. |

**Calculation Dependencies**: `calculateChildcareCosts()`, `projectedNetIncome()`, `retirementReadiness()`.

---

## 8. Defaults Section

Global fallback assumptions used when controls are not explicitly set or for new calculations. These should mirror the editable control inputs.

| Field Path | Type | Unit | Valid Range | Default | Description |
|------------|------|------|-------------|---------|-------------|
| `defaults.returnRate` | number | percentage | 0–20 | 8.5 | Default annual return rate (%) for super and investment projections. Corresponds to control input "Super Return Rate". |
| `defaults.inflationRate` | number | percentage | 0–10 | 3.0 | Default inflation rate (%) per annum. Used to adjust retirement income target and expenses. Corresponds to control input. |
| `defaults.salaryGrowth` | number | percentage | 0–10 | 2.5 | Default annual salary growth rate (%). Applied to both user1 and user2 unless overridden. |
| `defaults.extraContrib` | number | AUD | ≥ 0 | 0 | Default extra super contributions (salary sacrifice, personal contributions) per year. Updated via control input. |
| `defaults.mortgageRate` | number | percentage | 0–15 | 6.0 | Default mortgage interest rate (%) for new mortgage calculations. Corresponds to control input. |
| `defaults.mortgageTerm` | number | years | 10–40 | 30 | Default mortgage term (years). Corresponds to control input. |
| `defaults.propertyValue` | number | AUD | ≥ 100000 | 1000000 | Default starting property value for scenarios. Corresponds to control input. |
| `defaults.propertyGrowth` | number | percentage | 0–12 | 4.0 | Default annual property appreciation rate (%). Corresponds to control input. |
| `defaults.retirementTarget` | number | AUD | ≥ 40000 | 100000 | Default target annual retirement income (AUD). Corresponds to control input. Used to assess retirement readiness. |
| `defaults.drawdownRate` | number | percentage | 2–8 | 4.0 | Default annual drawdown rate (%) from super at retirement (4% rule). Used to calculate sustainable income from super balance. |
| `defaults.targetRetAge` | number | years | 45–70 | 60 | Default target retirement age (Matty). Corresponds to control input. Used to calculate years to retirement. |
| `defaults.numChildren` | number | count | 0–5 | 2 | Default number of children. Corresponds to control input. |
| `defaults.childYear1` | number | year | ≥ 2026 | 2028 | Default year first child arrives. Corresponds to control input. |
| `defaults.childYear2` | number | year | ≥ 2027 | 2031 | Default year second child arrives. Corresponds to control input. |
| `defaults.childcareCost` | number | AUD | ≥ 0 | 25000 | Default childcare cost per child per year. Corresponds to control input. |
| `defaults.schoolCost` | number | AUD | ≥ 0 | 12000 | Default school cost per child per year. Corresponds to control input. |
| `defaults.leaveReduction` | number | percentage | 0–100 | 50 | Default leave reduction percentage (%) during parental leave. Corresponds to control input. |

**Rationale**: Defaults allow the UI to reset all controls to sensible starting values or to provide safe fallback values if a control is missing. They mirror the exact structure of editable inputs.

**Calculation Dependencies**: All calculation functions reference defaults as fallback; UI control inputs override defaults on user interaction.

---

## 9. Schema Versioning & Migration

### Current Version

**Schema Version**: 1

This reference documents the current CONFIG structure as stored in the HTML dashboard (`Retirement_Dashboard_v2.html`). The schema version is **not explicitly stored in the CONFIG object itself** in the HTML dashboard but will be added in the Next.js migration to enable future schema evolution.

### Forward Compatibility Notes

When migrating the dashboard to the Next.js app and database:

1. **Add `schemaVersion: 1`** to the root of CONFIG to track the current schema.
2. **Create a migration registry** (`/lib/configMigrations.ts`) with versioned upgrade functions. Follow the pattern in `docs/20-db-migration-runbook.md`.
3. **On config load**, check `config.schemaVersion` and apply any registered migrations in order.

Schema version 1 is current. No v2 migration is planned. Future migrations follow the pattern in `docs/20-db-migration-runbook.md`.

---

## 10. Appendix: Complete Raw CONFIG JSON

Below is the complete, valid CONFIG blob from `Retirement_Dashboard_v2.html`. This can be used as a seed/template for initialising new user configs in the Next.js app.

```json
{
  "profile": {
    "user1": {
      "name": "Matty",
      "age": 35,
      "superBalance": 155000,
      "salary": 196000,
      "superRate": 0.14,
      "bonus": 0.15,
      "futureSalary": 190000,
      "futureSuperRate": 0.125,
      "switchYear": 2028
    },
    "user2": {
      "name": "Partner",
      "age": 26,
      "superBalance": 35000,
      "salary": 86000,
      "employer": "MVF Sunshine Coast"
    },
    "currentYear": 2026,
    "projectionYears": 35,
    "preservationAge": 60,
    "contribTaxRate": 0.15,
    "concessionalCap": 30000
  },
  "debts": {
    "active": [
      { "name": "Partner's Car", "balance": 35000, "payment": 681, "rate": 0.08, "color": "#f87171" },
      { "name": "Toyota Hilux", "balance": 28000, "payment": 582, "rate": 0.08, "color": "#fb923c" },
      { "name": "Now Finance", "balance": 25000, "payment": 553, "rate": 0.12, "color": "#a78bfa" },
      { "name": "OMM/wFinance", "balance": 17000, "payment": 360, "rate": 0.12, "color": "#fbbf24" }
    ],
    "paidOff": [
      { "name": "Credit Card (Qantas)", "finalPayment": 7363, "datePaid": "Jan 2026" }
    ],
    "lumpSum": 34400,
    "lumpSumBreakdown": "$20k savings + $7.4k Stake + $4k Raiz + $3k crypto",
    "monthlySurplus": 5433
  },
  "expenses": {
    "fixed": [
      { "category": "Rent (ELP Trust)", "monthly": 3253 },
      { "category": "Partner's Car Loan", "monthly": 681 },
      { "category": "Toyota Hilux Loan", "monthly": 582 },
      { "category": "Now Finance (Personal)", "monthly": 553 },
      { "category": "OMM/wFinance (Personal)", "monthly": 360 },
      { "category": "Health Insurance (AHM)", "monthly": 298 },
      { "category": "Car Insurance (RACQ)", "monthly": 218 },
      { "category": "Phone (Telstra)", "monthly": 110 },
      { "category": "Internet (Aussie BB)", "monthly": 40 }
    ],
    "variable": [
      { "category": "Credit Card Payments (Qantas)", "monthly": 6200 },
      { "category": "Groceries & Household", "monthly": 1554 },
      { "category": "Dining & Takeaway", "monthly": 827 },
      { "category": "Shopping & Retail", "monthly": 299 },
      { "category": "Health & Wellness", "monthly": 241 },
      { "category": "Crypto (Digital Surge)", "monthly": 233 },
      { "category": "AI Tools (Claude, OpenAI, Perplexity, Cline)", "monthly": 225 },
      { "category": "Fuel", "monthly": 181 },
      { "category": "Software (Apple, Google, Microsoft, Adobe)", "monthly": 142 },
      { "category": "Streaming & Subscriptions", "monthly": 139 },
      { "category": "Clothing & Outdoors", "monthly": 109 },
      { "category": "Pets (Vet, Petstock)", "monthly": 95 },
      { "category": "Transport (Tolls, Parking, Rides)", "monthly": 48 },
      { "category": "Travel & Accommodation (Flights, Airbnb, Hipcamp)", "monthly": 100 }
    ],
    "budgetChart": {
      "categories": ["CC Payments","Rent","Car Loans","Personal Loans","Groceries","Dining","Shopping","Health","Crypto","AI Tools","Fuel","Software","Streaming","Clothing","Pets","Transport","Travel & Accom"],
      "amounts": [6200, 3253, 2009, 913, 1554, 827, 299, 539, 233, 225, 181, 142, 139, 109, 95, 48, 100],
      "colors": ["#ef4444","#f87171","#fb923c","#fbbf24","#4ade80","#2dd4bf","#c084fc","#a78bfa","#f472b6","#818cf8","#e879f9","#6366f1","#22d3ee","#94a3b8","#fb7185","#38bdf8","#34d399"],
      "monthlyTrend": {
        "months": ["Jan 2026","Feb 2026","Mar 2026"],
        "datasets": [
          { "label": "Rent", "data": [3838,2960,2960], "color": "#f87171" },
          { "label": "Loan Repayments", "data": [1412,1136,1136], "color": "#fb923c" },
          { "label": "Groceries", "data": [1193,1099,1845], "color": "#4ade80" },
          { "label": "Dining & Takeaway", "data": [504,362,659], "color": "#2dd4bf" },
          { "label": "CC Payments (Qantas)", "data": [11600,2000,5000], "color": "#ef4444" },
          { "label": "AI Tools", "data": [42,186,370], "color": "#818cf8" },
          { "label": "Software Subs", "data": [173,81,106], "color": "#6366f1" },
          { "label": "Health & Wellness", "data": [305,371,417], "color": "#a78bfa" },
          { "label": "Transport", "data": [46,81,18], "color": "#38bdf8" },
          { "label": "Travel & Accom", "data": [0,0,307], "color": "#34d399" },
          { "label": "Shopping & Retail", "data": [168,280,319], "color": "#c084fc" },
          { "label": "Pets & Other", "data": [0,67,167], "color": "#94a3b8" }
        ]
      }
    }
  },
  "property": {
    "targetPrice": 1100000,
    "stampDuty": 38000,
    "legals": 5000,
    "appreciationRate": 0.04,
    "hisaRate": 0.05
  },
  "mortgage": {
    "loanAmount": 1000000,
    "startYear": 2027,
    "rate": 0.06,
    "termYears": 30,
    "ioPeriodYears": 0,
    "mode": "pi-only",
    "propertyValue": 1000000,
    "propertyGrowth": 0.04
  },
  "familyProperty": {
    "address": "49 Gloucester St, Spring Hill, Brisbane",
    "purchasePrice": 1300000,
    "currentValue": 2400000,
    "ownershipShare": 0.333,
    "weeklyRent": 2300,
    "growthRate": 0.04,
    "loans": {
      "mortgage": 1100000,
      "equityLoan": 297999,
      "mortgageTerms": {
        "rate": 0.056,
        "totalTerm": 30,
        "ioPeriod": 5,
        "mode": "io-then-pi"
      }
    },
    "parents": {
      "parent1Age": 65,
      "parent2Age": 63,
      "lifeExpectancy1": 85,
      "lifeExpectancy2": 87
    }
  },
  "children": {
    "count": 2,
    "year1": 2028,
    "year2": 2031,
    "childcareCostPerYear": 25000,
    "schoolCostPerYear": 12000,
    "leaveReduction": 0.5
  },
  "defaults": {
    "returnRate": 8.5,
    "inflationRate": 3.0,
    "salaryGrowth": 2.5,
    "extraContrib": 0,
    "mortgageRate": 6.0,
    "mortgageTerm": 30,
    "propertyValue": 1000000,
    "propertyGrowth": 4.0,
    "retirementTarget": 100000,
    "drawdownRate": 4.0,
    "targetRetAge": 60,
    "numChildren": 2,
    "childYear1": 2028,
    "childYear2": 2031,
    "childcareCost": 25000,
    "schoolCost": 12000,
    "leaveReduction": 50
  }
}
```

---

## 11. Cross-References

For deeper context on how CONFIG is used across the application:

| Topic | Document | Notes |
|-------|----------|-------|
| Database storage (JSONB) | **02-database-schema.md** | CONFIG is serialised to JSONB `configs.config` column. |
| Component lifecycle | **03-frontend-components.md** | Components read CONFIG via Zustand `useConfig()` hook. |
| Validation rules | **05-validation-checklist.md** | Expected ranges and mandatory fields for each CONFIG section. |
| Implementation plan | **06-implementation-plan.md** | How calculation functions consume CONFIG fields. |
| Australian tax constants | `/lib/au-tax-data.ts` | Superannuation rates, tax brackets, preservation age (not in CONFIG; separate config file). |
| Financial maths | `/lib/financial-maths.ts` | Functions like `projectSuper()`, `simulateAvalanche()`, `calcMortgageSchedule()` that read CONFIG. |

---

## 12. Usage Guidelines for Next.js Implementation

### Initialising New Users

When a new user signs up via Clerk:

```typescript
const defaultConfig = {
  schemaVersion: 1,
  ...require('./config-seed.json') // Use the raw CONFIG above
};
await saveConfig(userId, defaultConfig);
```

### Loading & Merging Configs

When user logs in:

```typescript
const cloudConfig = await loadConfig(userId);
const localConfig = localStorage.getItem('dashboard-config');

// Cloud wins if newer; prompt on conflict
const merged = cloudConfig && cloudConfig.timestamp > localConfig.timestamp
  ? cloudConfig
  : localConfig;

useConfigStore.setState({ config: merged });
```

### Updating CONFIG

All updates go through Zustand:

```typescript
const { config, setConfig } = useConfig();
setConfig({
  ...config,
  profile: { ...config.profile, user1: { ...config.profile.user1, age: 36 } }
});
// Auto-saves to cloud if user is signed in (debounced 5 sec)
```

### Validation

Before saving, validate against the schema:

```typescript
function validateConfig(config: any) {
  if (!config.profile?.user1?.age) return false;
  if (typeof config.profile.user1.age !== 'number') return false;
  if (config.profile.user1.age < 18 || config.profile.user1.age > 70) return false;
  // ... check all required fields and ranges
  return true;
}
```

See **05-validation-checklist.md** for comprehensive validation rules.

---

