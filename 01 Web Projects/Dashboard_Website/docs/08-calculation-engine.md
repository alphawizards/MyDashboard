# Calculation Engine Reference — RetireAU Dashboard

## Executive Summary

The retirement dashboard is a comprehensive projection engine for Australian dual-income couples tracking superannuation accumulation, mortgage paydown, debt repayment, and wealth building over a 35-year horizon. All calculations execute client-side in JavaScript; no API calls occur during scenario recalculation. The engine models:

1. **Superannuation projection** — both members, with SG rate progression, concessional caps, preservation age rules, and investment returns
2. **Mortgage amortisation** — fixed-rate loans with interest-only → principal & interest transitions
3. **Debt avalanche payoff** — multi-loan paydown with lump-sum and monthly surplus allocation
4. **Budget KPIs** — net income, expense categorisation, savings rate, and debt service coverage
5. **Family property inheritance** — equity projections, rent-to-debt-paydown mechanics, and preservation age milestones
6. **Retirement readiness** — drawdown longevity simulation and income target matching

This document specifies every formula, input, output, and edge case. Use it as a contract for TypeScript port implementation.

---

## 1. Super Rate Progression (`getSuperRate`)

### Purpose
Determine the Superannuation Guarantee (SG) rate for a given financial year, accounting for scheduled increases mandated by the Superannuation Guarantee (Administration) Act.

### Function Signature
```typescript
function getSuperRate(financialYear: number): number
```

### Inputs

| Parameter | Type | Unit | Range | Notes |
|-----------|------|------|-------|-------|
| `financialYear` | number | — | 2000+ | e.g., FY 2025 = calendar year 2024–2025 boundary |

### Outputs

| Item | Type | Unit | Notes |
|------|------|------|-------|
| return | number | fraction (0.00–1.00) | Statutory SG rate as decimal |

### Formula

```
SG(FY) = {
  0.115  if FY ≤ 2025
  0.120  if FY = 2026 (current rate, effective July 1, 2025)
  [future increases TBD by legislation]
}
```

### Edge Cases

- **FY before 2000**: Return 0.115 (assume historical minimum)
- **Future rates unknown**: Maintain legislative guidance; update annually

### Worked Example

| Input FY | Output SG | Rationale |
|----------|-----------|-----------|
| 2025 | 0.115 (11.5%) | Prior rate |
| 2026 | 0.120 (12.0%) | Current rate (FY 2026, effective 2025-07-01) |

### Source Location
**Line 757–760** (`Retirement_Dashboard_v2.html`)

---

## 2. Superannuation Projection Loop

### Purpose
Project both members' superannuation balances, contributions, and investment returns across 35 years, accounting for:
- Employer contributions (SG rate + any additional)
- Concessional cap compliance
- Contribution tax (15% ATO tax on concessional contributions)
- Investment returns on balance and in-year contributions
- Salary growth and role changes (e.g., Matty's career transition in 2028)
- Preservation age eligibility

### Inputs

| Parameter | Type | Unit | Source | Notes |
|-----------|------|------|--------|-------|
| `initialBalance` | number | AUD | CONFIG.profile.user1/user2.superBalance | Opening balance, current year |
| `salary` | number | AUD/yr | CONFIG.profile.user1/user2.salary | Gross annual salary |
| `salaryGrowth` | number | fraction | UI input (e.g., 0.025) | Annual escalation rate |
| `superRate` | number | fraction | getSuperRate(FY) or CONFIG profile | Employer SG % or override |
| `extraContrib` | number | AUD/yr | UI input | Split 50/50 between members |
| `returnRate` | number | fraction | UI input (e.g., 0.085) | Annual investment return |
| `concessionalCap` | number | AUD/yr | CONFIG.profile.concessionalCap | Current: AUD 30,000 (FY 2025–26) |
| `contribTaxRate` | number | fraction | CONFIG.profile.contribTaxRate | 0.15 (15% ATO tax) |
| `preservationAge` | number | age (years) | CONFIG.profile.preservationAge | Currently 60 for all |
| `projectionYears` | number | — | CONFIG.profile.projectionYears | 35 years |
| `currentYear` | number | — | CONFIG.profile.currentYear | 2026 |

### Outputs

**For each member (mattyData, partnerData):**

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `year` | number | calendar year | 2026, 2027, … |
| `age` | number | years | Matty: 35→70, Partner: 26→61 |
| `salary` | number | AUD | Inflated by salaryGrowth each year |
| `superRate` | number | fraction | Statutory or negotiated rate |
| `grossContrib` | number | AUD | Employer + personal, capped at concessionalCap |
| `contribTax` | number | AUD | Deducted from gross contribution |
| `netContrib` | number | AUD | Gross × (1 − 0.15) |
| `growth` | number | AUD | Investment return on opening balance + contributions |
| `balance` | number | AUD | Balance after netContrib + growth |

### Formula

**Annual Contribution:**
```
GrossContrib(y) = min( EmployerSG + PersonalExtra, ConcessionalCap )
NetContrib(y) = GrossContrib(y) × (1 − 0.15)
```

**Investment Growth:**
```
Growth(y) = OpeningBalance(y) × ReturnRate + NetContrib(y) × ReturnRate × 0.5
```

The `0.5` factor assumes contributions arrive mid-year on average (rough approximation).

**Balance Evolution:**
```
Balance(y) = Balance(y−1) + NetContrib(y) + Growth(y)
```

### Edge Cases

1. **Concessional cap exceeded**: Truncate `GrossContrib` to cap; excess subject to additional tax (not modelled here; simplified to cap enforcement)
2. **Negative balance**: Cannot occur (net contributions always positive), but guard with `Math.max(balance, 0)`
3. **Preservation age reached**: Flag member as eligible for access; no balance modification (pension rules apply post-retirement, out of scope)
4. **Salary reduction (e.g., leave)**: Partner's salary reduced by `leaveReduction` % in child-birth years

### Worked Example

**Scenario**: Matty, FY 2026 (age 35)
- Opening balance: AUD 155,000
- Salary: AUD 196,000
- SG rate: 12.0% (FY 2026)
- Extra contrib: AUD 0
- Return rate: 8.5% p.a.

| Calculation | Value |
|-------------|-------|
| Employer SG | 196,000 × 0.12 = 23,520 |
| Gross contrib | min(23,520, 30,000) = 23,520 |
| Contrib tax | 23,520 × 0.15 = 3,528 |
| Net contrib | 23,520 × 0.85 = 19,992 |
| Growth | (155,000 × 0.085) + (19,992 × 0.085 × 0.5) = 13,175 + 850 = 14,025 |
| **Year-end balance** | 155,000 + 19,992 + 14,025 = **189,017** |

### Source Location
**Lines 825–850** (User 1), **Lines 851–867** (User 2) — `Retirement_Dashboard_v2.html`

---

## 3. Mortgage Amortisation (`calcMortgageSchedule`)

### Purpose
Generate a year-by-year mortgage schedule supporting two modes:
- **Full P&I**: Principal & interest from day 1
- **Interest-only → P&I**: Fixed IO period (e.g., 5 years) followed by P&I repayment

Used for both owner-occupied primary mortgage and family trust rental property mortgage.

### Function Signature
```typescript
function calcMortgageSchedule(
  principal: number,
  annualRate: number,
  totalTerm: number,
  ioPeriod: number,
  mode: 'io-then-pi' | 'full-pi'
): MortgageScheduleEntry[]

interface MortgageScheduleEntry {
  year: number;
  payment: number;      // AUD, annual
  interest: number;     // AUD, annual
  principal: number;    // AUD, annual
  balance: number;      // AUD, end-of-year
}
```

### Inputs

| Parameter | Type | Unit | Notes |
|-----------|------|------|-------|
| `principal` | number | AUD | Loan amount |
| `annualRate` | number | fraction | e.g., 0.06 for 6% p.a. |
| `totalTerm` | number | years | e.g., 30 |
| `ioPeriod` | number | years | e.g., 5 (ignored if mode = 'full-pi') |
| `mode` | string | — | 'io-then-pi' or 'full-pi' |

### Outputs

Array of schedule entries, one per year, with cumulative principal, interest, and remaining balance.

### Formula

**Monthly rate:**
```
r = annualRate / 12
```

**Interest-only years (1 to ioPeriod, if mode = 'io-then-pi'):**
```
MonthlyIO = Balance × r
YearlyInterest = MonthlyIO × 12
YearlyPrincipal = 0
YearlyPayment = YearlyInterest
Balance remains unchanged until P&I phase
```

**Principal & interest years (ioPeriod + 1 to totalTerm):**
```
MonthsRemaining = (totalTerm − ioPeriod) × 12

MonthlyP&I = Balance × [r × (1 + r)^MonthsRemaining] / [(1 + r)^MonthsRemaining − 1]

For each month m in [1, 12]:
  InterestPart = Balance × r
  PrincipalPart = min(MonthlyP&I − InterestPart, Balance)
  YearlyInterest += InterestPart
  YearlyPrincipal += PrincipalPart
  Balance -= PrincipalPart
  
YearlyPayment = YearlyInterest + YearlyPrincipal
```

### Edge Cases

1. **ioPeriod = 0 with mode = 'io-then-pi'**: Treated as full P&I from year 1
2. **Balance ≤ 0 before term end**: Pad remaining schedule with zero entries
3. **Rate = 0**: No interest; straight principal amortisation
4. **Term = 0**: Empty schedule

### Worked Example

**Scenario**: AUD 1,000,000 loan, 5.6% p.a., 30-year term, 5-year IO then P&I

**Year 1 (IO phase):**
- Balance: AUD 1,000,000
- Monthly IO: 1,000,000 × (0.056 / 12) = 4,667
- Yearly interest: 4,667 × 12 = 56,000
- Yearly principal: 0
- Year-end balance: 1,000,000

**Year 6 (P&I phase, first year):**
- Balance at start: AUD 1,000,000
- Months remaining in PI: (30 − 5) × 12 = 300
- Monthly P&I: 1,000,000 × [0.00467 × 1.00467^300] / [1.00467^300 − 1] ≈ 5,688
- Over 12 months, interest + principal amortise; typical split ~2/3 interest, 1/3 principal
- Approximate year 6 payment: 68,256 (interest ~56,000, principal ~12,256)

### Source Location
**Lines 2108–2157** — `Retirement_Dashboard_v2.html`

---

## 4. Owner-Occupied Mortgage Paydown

### Purpose
Project mortgage balance, interest, and equity for owner-occupied primary residence across 35 years.

### Inputs

| Parameter | Type | Unit | Source |
|-----------|------|------|--------|
| `mortgageAmount` | number | AUD | CONFIG.mortgage.amount |
| `mortgageRate` | number | fraction | UI input (e.g., 0.06) |
| `mortgageTerm` | number | years | UI input (30) |
| `mortStartYear` | number | — | CONFIG.mortgage.startYear (2027) |
| `propertyValue` | number | AUD | UI input (e.g., 1,000,000) |
| `propertyGrowth` | number | fraction | UI input (e.g., 0.04) |
| `currentYear` | number | — | CONFIG.profile.currentYear (2026) |

### Outputs

**For each year in mortData:**

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `balance` | number | AUD | Remaining principal |
| `principalPaid` | number | AUD | Principal repaid in this year (last 12 months) |
| `interestPaid` | number | AUD | Interest accrued in this year (last 12 months) |
| `equity` | number | AUD | Principal paid down since origination |
| `propertyValue` | number | AUD | Current estimated value |

### Formula

**Before mortgage start year:**
```
mortBalance = 0
propertyValue = 0
(property not yet owned)
```

**From mortgage start year onward:**
```
yearsIn = currentYear − mortStartYear + 1
monthsElapsed = min(yearsIn × 12, nPay)

Simulate month-by-month:
  for m in [0, monthsElapsed):
    interest = balance × monthlyRate
    principal = monthlyPayment − interest
    balance -= principal
    
    if m in [monthsElapsed − 12, monthsElapsed):
      yearInterest += interest
      yearPrincipal += principal

balance = max(balance, 0)
equity = principal_at_origination − balance

propertyValue = initialValue × (1 + propertyGrowth)^(yearsIn)
```

### Edge Cases

1. **mortStartYear > currentYear**: Property not yet acquired; all values zero
2. **Loan fully repaid before year-end**: Balance clamps to 0; pad remaining months with zero interest/principal
3. **Interest rate = 0**: Straight amortisation; all payment reduces principal

### Worked Example

**Scenario**: AUD 1,000,000 loan at 6.0% p.a., 30 years, starting 2027
- Current year: 2026 (year 0 of projection)
- Years in = 1 (2027 is year 1)
- Monthly payment = 1,000,000 × [0.005 × 1.005^360] / [1.005^360 − 1] = 5,995.51

**Year 1 (2027):**
- Month 1: Interest = 1,000,000 × 0.005 = 5,000; Principal = 5,995.51 − 5,000 = 995.51; Balance = 999,004.49
- Month 12: Interest ≈ 4,996; Principal ≈ 999.51; Balance ≈ 999,010 (net decline ~990)
- Year interest: ~59,940 (mostly interest in first year)
- Year principal: ~11,950
- Year-end balance: ≈ 988,050

### Source Location
**Lines 869–891** — `Retirement_Dashboard_v2.html`

---

## 5. Debt Avalanche Payoff Simulation

### Purpose
Model multi-loan payoff using a lump-sum injection and monthly surplus, employing an avalanche (priority-based) strategy. Tracks debt-free milestones and interest saved.

### Function Signature
```typescript
function simulateDebtPayoff(
  debts: DebtDefinition[],
  lumpSum: number,
  extraMonthly: number
): {
  timeline: TimelineEntry[];
  events: [month, debtName][];
  totalInterest: number;
}

interface DebtDefinition {
  name: string;
  startBal: number;
  pmt: number;           // minimum monthly payment
  r: number;             // monthly rate (annual / 12)
  color: string;         // UI rendering only
}

interface TimelineEntry {
  month: number;
  date: Date;
  balances: number[];    // per debt
  totalDebt: number;
}
```

### Inputs

| Parameter | Type | Unit | Notes |
|-----------|------|------|-------|
| `debts` | array | — | Up to 4 debts (Partner Car, Toyota, Now Finance, OMM/wFinance) |
| `lumpSum` | number | AUD | Savings/investments to deploy |
| `extraMonthly` | number | AUD | Monthly surplus after expenses & debt minimums |

### Outputs

| Item | Type | Notes |
|------|------|-------|
| `timeline` | array | Month-by-month balances (up to 60 months or debt-free) |
| `events` | array | [month, debtName] tuples for payoff milestones |
| `totalInterest` | number | Total interest accrued across all debts |

### Algorithm

1. **Lump-sum allocation**: Apply lump sum to debts in priority order (first debt first, overflow to next)
2. **Monthly loop** (months 0 to 60):
   a. Record current balances
   b. Accrue interest on all active debts: `balance += balance × monthlyRate`
   c. Pay minimums on all active debts; if debt fully paid, free up that payment for extra allocation
   d. Allocate extra (monthly + freed minimums) to highest-priority remaining debt
   e. If all debts ≤ 0, break (debt-free)

### Edge Cases

1. **Lump sum > total debt**: First debt cleared immediately; lump overflows to next
2. **Monthly surplus = 0**: Debts only decline by freed minimums after payoff
3. **Negative balance**: Clamp to 0; don't reverse

### Worked Example

**Scenario**:
- Partner's Car: AUD 35,000 @ 8% p.a., AUD 681/mo minimum
- Toyota: AUD 28,000 @ 8% p.a., AUD 582/mo minimum
- Lump sum: AUD 34,400
- Extra monthly: AUD 5,433

| Month | Partner Car | Toyota | Action |
|-------|-------------|--------|--------|
| 0 (before lump) | 35,000 | 28,000 | Start |
| 0 (after lump) | 400 | 28,000 | Lump of 34,400: pay down Car to 400, Toyota unchanged |
| 1 | 0 | 27,500 | Accrue interest on remaining; pay minimums. Car reaches 0 mid-month; freed payment (681) allocated to Toyota |
| 2 | 0 | 25,800 | Toyota now receiving 582 + 681 + 5,433 = 6,696/mo |
| Payoff month | — | 0 | Toyota cleared (~5 months total); event logged |

### Source Location
**Lines 1396–1444** — `Retirement_Dashboard_v2.html`

---

## 6. Budget KPI Calculation

### Purpose
Synthesise income, expenses, debt service, and savings rate from CONFIG and bank statements.

### Function Signature
```typescript
function calculateBudgetKPIs() {
  return {
    mattyFortnightly: number;
    partnerFortnightly: number;
    combinedMonthly: number;
    combinedWeekly: number;
    combinedYearly: number;
    
    fixedExpenses: number;
    variableExpenses: number;
    totalSpending: number;
    
    debtPayments: number;
    monthlySurplus: number;
    savingsRate: number;
  };
}
```

### Inputs

| Parameter | Type | Source | Notes |
|-----------|------|--------|-------|
| Matty fortnightly net | number | Hardcoded: 5,298 | Bank statement average (Jan–Mar 2026) |
| Partner fortnightly net | number | Hardcoded: 2,982 | Bank statement average |
| Fixed expenses | array | CONFIG.expenses.fixed | Rent, loans, insurance, utilities |
| Variable expenses | array | CONFIG.expenses.variable | Groceries, dining, shopping, etc. |
| Credit card payments | number | Filtered from variable | Transferred from CC; not true "spend" |
| Debt payments | number | CONFIG.debts.active[] | Sum of minimums for active loans |

### Outputs

| Metric | Formula | Unit |
|--------|---------|------|
| **Matty monthly net** | 5,298 × 26 / 12 | AUD |
| **Partner monthly net** | 2,982 × 26 / 12 | AUD |
| **Combined monthly net** | sum of above | AUD |
| **Combined weekly net** | combined monthly × 12 / 52 | AUD |
| **Combined yearly net** | combined monthly × 12 | AUD |
| **Fixed expenses** | sum(CONFIG.expenses.fixed[].monthly) | AUD |
| **Variable expenses** | sum(CONFIG.expenses.variable[].monthly) − CC payments | AUD |
| **Total spending** | fixed + variable | AUD |
| **Total debt payments** | sum(CONFIG.debts.active[].payment) | AUD |
| **Monthly surplus** | combined monthly − total spending | AUD |
| **Savings rate** | (surplus / combined monthly) × 100 | % |

### Edge Cases

1. **Credit card payment > actual spending**: CC is a liability transfer, not cash spend; exclude from budget calculation
2. **Negative surplus**: Continue calculation; highlight as unsustainable
3. **Partner on unpaid leave**: Income reduced by `leaveReduction %` that year; recalculate via project()

### Worked Example

**Monthly KPIs (as of Mar 2026):**

| Item | Value |
|------|-------|
| Matty fn net | 5,298 |
| Partner fn net | 2,982 |
| Matty monthly | 5,298 × 26 / 12 = 11,481 |
| Partner monthly | 2,982 × 26 / 12 = 6,473 |
| **Combined monthly** | **17,954** |
| Fixed expenses | 3,253 (rent) + 1,263 (loans) + 666 (insurance/utilities) = 5,182 |
| Variable expenses | 1,554 (groceries) + 827 (dining) + 233 (crypto) + ... − 6,200 (CC) = 2,339 |
| **Total spending** | 5,182 + 2,339 = 7,521 |
| Debt payments (minimums) | 681 + 582 + 553 + 360 = 2,176 |
| **Surplus** | 17,954 − 7,521 = 10,433 |
| **Savings rate** | (10,433 / 17,954) × 100 = **58.1%** |

### Source Location
**Lines 1876–1960** — `Retirement_Dashboard_v2.html`

---

## 7. Retirement Readiness Index

### Purpose
Assess whether superannuation balance and drawdown strategy can sustain target retirement income.

### Formula

```
SustainableIncome(year) = SuperBalance(year) × DrawdownRate

InflatedTarget(year) = RetirementTarget × (1 + Inflation)^year

Readiness(year) = SustainableIncome(year) / InflatedTarget(year)

  Readiness < 1.0  →  Shortfall (cannot retire yet)
  Readiness = 1.0  →  On track (can retire next year)
  Readiness > 1.0  →  Excess capacity (could retire now, comfortable surplus)
```

**Drawdown longevity** (how many years super lasts at target spend level):
```
SimBalance = SuperBalance(retirementYear)
for year in [0, 50):
  AnnualSpend = InflatedTarget × (1 + Inflation)^year
  SimBalance = SimBalance × (1 + ReturnRate) − AnnualSpend
  if SimBalance ≤ 0:
    DrawdownYears = year
    break
```

### Inputs

| Parameter | Type | Unit | Notes |
|-----------|------|------|-------|
| `combinedSuper` | number | AUD | profile.user1.superBalance + profile.user2.superBalance |
| `retirementTarget` | number | AUD/yr | UI input, e.g. 100,000 |
| `drawdownRate` | number | fraction | UI input, e.g. 0.04 (4% SWR) |
| `inflationRate` | number | fraction | UI input, e.g. 0.03 |
| `returnRate` | number | fraction | Assumed post-retirement, usually same as accumulation rate |

### Outputs

| Metric | Type | Unit | Notes |
|--------|------|------|-------|
| `sustainableIncome` | number | AUD/yr | What the portfolio can safely yield |
| `readiness` | number | ratio | 0.0–2.0+ |
| `drawdownYears` | number | years | 0–50 |

### Edge Cases

1. **Zero super**: Readiness = 0; drawdownYears = 0
2. **Drawdown rate = 0**: Portfolio never depleted; drawdownYears = 50
3. **Readiness threshold logic**: UI displays "Retirement ready" at age-specific milestones if readiness ≥ 1.0

### Worked Example

**Year 10 (2036), Matty age 45, combined super AUD 680,000:**
- Inflation rate: 3% p.a.
- Retirement target (current dollars): AUD 100,000
- Inflated target year 10: 100,000 × 1.03^10 = 134,392
- Drawdown rate: 4%
- Sustainable income: 680,000 × 0.04 = 27,200
- **Readiness: 27,200 / 134,392 = 0.20** → Cannot retire (need 5× more super)

**Year 25 (2051), Matty age 60, combined super AUD 2,150,000:**
- Inflated target year 25: 100,000 × 1.03^25 = 209,378
- Sustainable income: 2,150,000 × 0.04 = 86,000
- **Readiness: 86,000 / 209,378 = 0.41** → Still short, but preservaton age reached

### Source Location
**Lines 897–909** — `Retirement_Dashboard_v2.html`

---

## 8. Family Property Projections

### Purpose
Model equity accumulation, loan paydown, and wealth projection for a family trust property with co-ownership and rental income.

### Function Signature
```typescript
function calculateFamilyPropertyProjection(
  currentValue: number,
  purchasePrice: number,
  growthRate: number,
  weeklyRent: number,
  ownershipShare: number,
  mortgageSchedule: MortgageScheduleEntry[],
  equityLoan: number,
  ioPeriod: number,
  mode: string,
  parent1Age: number,
  parent1LifeExpectancy: number,
  parent2Age: number,
  parent2LifeExpectancy: number,
  currentYear: number,
  mattyAge0: number
): FamilyPropertyProjection
```

### Inputs

| Parameter | Type | Unit | Notes |
|-----------|------|------|-------|
| `currentValue` | number | AUD | Current valuation (e.g., AUD 2.4M) |
| `purchasePrice` | number | AUD | Original cost (e.g., AUD 1.3M) |
| `growthRate` | number | fraction | Annual appreciation (e.g., 0.04) |
| `weeklyRent` | number | AUD | Gross weekly rental income (e.g., AUD 2,300) |
| `ownershipShare` | number | fraction | Your proportion of property (e.g., 0.333) |
| `mortgageSchedule` | array | — | From calcMortgageSchedule() |
| `equityLoan` | number | AUD | Personal loan against equity (e.g., AUD 297,999) |
| `ioPeriod` | number | years | Mortgage IO period (e.g., 5) |
| `mode` | string | — | 'io-then-pi' or 'full-pi' |
| Parent ages & life expectancy | numbers | years | Used to estimate inheritance timing |
| `currentYear` | number | — | CONFIG.profile.currentYear (2026) |
| `mattyAge0` | number | years | Matty's age at projection start (35) |

### Outputs

**Projection over 25+ years:**

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `year` | number | — | Calendar year |
| `propertyValue` | number | AUD | Current year valuation |
| `totalLoans` | number | AUD | Mortgage + equity loan outstanding |
| `mortgageBalance` | number | AUD | From amortisation schedule |
| `equityLoanBalance` | number | AUD | Declining via rent-surplus paydown |
| `netEquity` | number | AUD | (propertyValue − totalLoans) × ownershipShare |
| `annualRent` | number | AUD | Projected gross rent (3% annual escalation) |
| `yourRentShare` | number | AUD | annualRent × ownershipShare |
| `cumulativeRent` | number | AUD | Sum of rent received to date (your share) |
| `mortgagePayment` | number | AUD | Annual payment (IO or P&I depending on year) |
| `operatingExpenses` | number | AUD | 15% of annual rent (estimated) |
| `rentSurplus` | number | AUD | Rent − mortgage − opex; applied to equity loan paydown |

### Formula

**Property value appreciation:**
```
PropertyValue(y) = CurrentValue × (1 + GrowthRate)^y
```

**Annual rent (with 3% escalation):**
```
AnnualRent(y) = WeeklyRent × 52 × (1.03)^y
```

**Operating expenses (management, maintenance, insurance):**
```
OpEx = AnnualRent × 0.15
```

**Rent surplus allocated to equity loan paydown:**
```
Surplus = max(0, AnnualRent − MortgagePayment − OpEx)
EquityLoanPayment = min(EquityLoanBalance, Surplus)
EquityLoanBalance(y) = EquityLoanBalance(y−1) − EquityLoanPayment
```

**Net equity (your share):**
```
NetPropertyValue = PropertyValue − MortgageBalance − EquityLoanBalance
YourNetEquity = NetPropertyValue × OwnershipShare
```

**Inheritance timing:**
```
InheritanceYears = max(LifeExpectancy1 − Parent1Age, LifeExpectancy2 − Parent2Age)
InheritanceYear = CurrentYear + InheritanceYears
InheritanceValue = PropertyValue(inheritanceYear) × OwnershipShare
```

### Edge Cases

1. **Equity loan fully repaid before inheritance**: Rent surplus reverts to trust (or could be modelled as additional savings, out of scope)
2. **Property value insufficient to cover loans**: Net equity clamps to 0
3. **Rent < operating expenses**: Surplus is zero; equity loan does not decline
4. **Inheritance occurs before loan repayment**: Assume loans paid from inheritance proceeds

### Worked Example

**Year 0 (2026, Current):**
- Property value: AUD 2,400,000
- Mortgage: AUD 1,100,000
- Equity loan: AUD 297,999
- Weekly rent: AUD 2,300
- Your share: 33.3%

| Metric | Calculation | Value |
|--------|-------------|-------|
| Annual rent (gross) | 2,300 × 52 | 119,600 |
| Operating expenses | 119,600 × 0.15 | 17,940 |
| Year 1 mortgage payment | (from schedule) | ~63,000 (IO phase) |
| Rent surplus | max(0, 119,600 − 63,000 − 17,940) | 38,660 |
| Equity loan payment | min(297,999, 38,660) | 38,660 |
| Year 1 equity balance | 297,999 − 38,660 | 259,339 |
| Total loans outstanding | 1,100,000 + 259,339 | 1,359,339 |
| Net property value | 2,400,000 − 1,359,339 | 1,040,661 |
| Your net equity | 1,040,661 × 0.333 | 346,540 |
| Your annual rent share | 119,600 × 0.333 | 39,812 |

**Year 6 (2032, P&I phase begins):**
- Property value: 2,400,000 × 1.04^6 = 3,036,488
- Annual rent: 119,600 × 1.03^6 = 142,738
- Mortgage payment (P&I year 1): ~70,000 (more principal than year 1)
- Surplus and equity decline accelerate

### Source Location
**Lines 2160–2314** — `Retirement_Dashboard_v2.html`

---

## 9. Children Cost Projection

### Purpose
Model childcare and school costs across 35-year horizon, accounting for:
- Staggered child arrivals
- Age-based transitions (childcare 0–5, school 6–18, independent 18+)
- Partner income reduction during parental leave
- Cost inflation (3% p.a.)

### Inputs

| Parameter | Type | Unit | Notes |
|-----------|------|------|-------|
| `numChildren` | number | — | 0, 1, or 2 |
| `childYear1` | number | — | Calendar year first child born (e.g., 2028) |
| `childYear2` | number | — | Calendar year second child born (e.g., 2031) |
| `childcareCost` | number | AUD/yr | Annual cost ages 0–5 (inflated annually) |
| `schoolCost` | number | AUD/yr | Annual cost ages 6–18 (inflated annually) |
| `leaveReduction` | number | fraction | Income reduction during leave (e.g., 0.5 = 50%) |
| `inflationRate` | number | fraction | Cost escalation (3% assumed) |

### Outputs

**For each year in childData:**

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `year` | number | — | Calendar year |
| `cost` | number | AUD | Total child costs that year (both children) |
| `childAges` | array | years | Ages of each child |

### Formula

**For each child (if numChildren ≥ 1, child arrives in childYear1):**
```
ChildAge(year) = year − childYear1

if ChildAge in [0, 5]:
  AnnualCost = ChildcareCost × (1 + Inflation)^yearsElapsed
  
else if ChildAge in [6, 18]:
  AnnualCost = SchoolCost × (1 + Inflation)^yearsElapsed
  
else:
  AnnualCost = 0  (independent or off-books)
```

**Partner income reduction (parental leave):**
```
if ChildAge = 0:
  PartnerIncomeReduction = LeaveReduction
  PartnerSalary(year) = BaseSalary × (1 − LeaveReduction)
else:
  PartnerIncomeReduction = 0
  PartnerSalary(year) = BaseSalary
```

### Edge Cases

1. **Second child born same year as first turns 6**: Both costs apply (childcare + school for staggered ages)
2. **No children**: All costs zero; partner income unaffected
3. **Cost caps/subsidies**: Not modelled; full cost assumed

### Worked Example

**Scenario**: 2 children
- Child 1 born 2028 (age 0)
- Child 2 born 2031 (age 0)
- Childcare: AUD 25,000/yr, School: AUD 12,000/yr
- Inflation: 3% p.a.

| Year | Matty Age | Child 1 Age | Child 2 Age | Childcare Cost | School Cost | **Total** | Partner Income |
|------|-----------|------------|------------|----------------|-------------|----------|-----------------|
| 2028 | 37 | 0 | — | 25,000 | 0 | 25,000 | 50% reduction |
| 2029 | 38 | 1 | — | 25,750 | 0 | 25,750 | Full |
| 2031 | 40 | 3 | 0 | 28,325 + 25,000 | 0 | 53,325 | 50% reduction |
| 2032 | 41 | 4 | 1 | 29,175 + 25,750 | 0 | 54,925 | Full |
| 2036 | 45 | 8 | 5 | 0 + 33,660 | 14,049 | 47,709 | Full |
| 2046 | 55 | 18 | 15 | 0 | 0 + 15,036 | 15,036 | Full |

### Source Location
**Lines 806–823** — `Retirement_Dashboard_v2.html`

---

## 10. Regression Test Scenarios

Use these end-to-end test cases to validate TypeScript implementation against the original HTML engine.

### Scenario A: Base Case (Conservative Returns, 35-Year Horizon)

**Setup:**
```json
{
  "profile": {
    "user1": { "age": 35, "superBalance": 155000, "salary": 196000, "superRate": 0.14 },
    "user2": { "age": 26, "superBalance": 35000, "salary": 86000 },
    "currentYear": 2026,
    "preservationAge": 60,
    "contribTaxRate": 0.15,
    "concessionalCap": 30000
  },
  "mortgage": { "amount": 1000000, "startYear": 2027, "rate": 0.06, "term": 30 }
}

Input controls:
  returnRate: 6.0%
  inflationRate: 3.0%
  salaryGrowth: 2.5%
  extraContrib: 0
  mortgageRate: 6.0%
  mortgageTerm: 30
  propertyValue: 1000000
  propertyGrowth: 4.0%
  retirementTarget: 100000
  drawdownRate: 4.0%
  numChildren: 0
```

**Expected Key Outputs (Year 10, 2036):**

| Metric | Expected Range | Notes |
|--------|-----------------|-------|
| Matty super | 280k–300k | Conservative growth, 6% return |
| Partner super | 90k–110k | Younger, started lower balance |
| Combined super | 370k–410k | Both members accumulating |
| Mortgage balance | 850k–870k | 9 years into 30-year loan |
| Property value | 1,480k–1,510k | 4% annual growth |
| Readiness ratio | 0.15–0.25 | Well below retirement; target 1.0+ |
| Monthly surplus | 10k–11k | Stable income, moderate spending |

### Scenario B: Growth Returns, 2 Children, Inheritance Milestone

**Setup:**
```json
{
  "profile": { /* same as A */ },
  "children": { "count": 2, "year1": 2028, "year2": 2031, "childcareCost": 25000, "schoolCost": 12000, "leaveReduction": 0.5 },
  "familyProperty": { "currentValue": 2400000, "growthRate": 0.04, "weeklyRent": 2300, "ownershipShare": 0.333, "loans": { "mortgage": 1100000, "equityLoan": 297999, "mortgageTerms": { "rate": 0.056, "totalTerm": 30, "ioPeriod": 5, "mode": "io-then-pi" } }, "parents": { "parent1Age": 65, "parent2Age": 63, "lifeExpectancy1": 85, "lifeExpectancy2": 87 } }
}

Input controls:
  returnRate: 8.5%
  inflationRate: 3.0%
  salaryGrowth: 2.5%
  numChildren: 2
  childYear1: 2028
  childYear2: 2031
  leaveReduction: 50%
```

**Expected Key Outputs (Year 20, 2046):**

| Metric | Expected Range | Notes |
|--------|-----------------|-------|
| Matty super | 650k–750k | Growth 8.5% compounding, children costs reduce contributions |
| Partner super | 220k–250k | Income reduction during leaves recovers |
| Combined super | 870k–1,000k | Both benefit from higher return assumption |
| Mortgage balance (primary) | 600k–650k | 19 years into 30-year loan; P&I phase accelerating |
| Family property value | 3,960k–4,020k | 2.4M × 1.04^20 ≈ 3.99M |
| Your net equity (family property) | 580k–650k | (Property − loans) × 0.333; equity loan now ~80k (mostly paid) |
| Cumulative family rent (your share) | 320k–380k | 20 years of rent at 33.3% ownership, 3% escalation |
| Child costs (year 20) | 27k–35k | Both children now in school; no childcare |
| Readiness ratio | 0.35–0.50 | Better position, but still 2–3 years away from retirement at 60 |
| Inheritance year | 2051 (25 years) | Max(85−65, 87−63) = 22 years; will occur around Matty age 60 |
| Inheritance value (your share) | 1.5M–1.65M | Projected property value ~4.8M × 0.333 |

### Scenario C: Debt Payoff with Lump Sum & Surplus

**Setup:**
```json
{
  "debts": {
    "active": [
      { "name": "Partner's Car", "balance": 35000, "payment": 681, "rate": 0.08 },
      { "name": "Toyota Hilux", "balance": 28000, "payment": 582, "rate": 0.08 },
      { "name": "Now Finance", "balance": 25000, "payment": 553, "rate": 0.12 },
      { "name": "OMM/wFinance", "balance": 17000, "payment": 360, "rate": 0.12 }
    ],
    "lumpSum": 34400,
    "monthlySurplus": 5433
  }
}
```

**Expected Outputs:**

| Metric | Expected Value | Notes |
|--------|-----------------|-------|
| Partner's Car payoff month | 1–3 months | Lump sum > balance; cleared immediately after interest accrual |
| Toyota Hilux payoff month | 5–7 months | Receives lump overflow + accumulated freed payment + surplus |
| All debts cleared month | 11–14 months | Total debt 105k; lump 34.4k; surplus 5.4k/mo covers remaining |
| Interest saved (vs. minimums only) | 8k–12k | Lump + surplus accelerate repayment; minimums-only scenario runs 24+ months |
| Total interest paid (with strategy) | 4k–6k | Much lower than minimums-only path |

---

## 11. Australian-Specific Tax & Compliance Notes

### Superannuation Guarantee (SG)

- **Prior rate (FY 2025)**: 11.5% (effective 1 July 2024)
- **Current rate (FY 2026)**: 12.0% (effective 1 July 2025)
- **Future increases**: 12.5% (2026), 13% (2027), 13.5% (2028), 14% (2029) — coded as incremental increases in `getSuperRate()`

### Concessional Contribution Cap

- **Current (FY 2025–26)**: AUD 30,000 p.a.
- **Applies to**: Employer SG + voluntary contributions (capped together)
- **Excess**: Subject to marginal tax rate + 15% cap on excess (not modelled; simplified to cap enforcement)

### Contribution Tax

- **Rate**: 15% ATO tax on concessional contributions
- **Applied to**: Gross employer + personal contributions capped at concessional limit
- **Net contribution formula**: `GrossContrib × (1 − 0.15)`

### Preservation Age

- **Current rule**: Age 60 (all members)
- **Member can access**: Super from age 60 onwards (in retirement phase)
- **Dashboard flags**: `mattyCanAccess`, `partnerCanAccess` — boolean per year

### Mortgage Interest Deductibility

- **Investment property (family trust rental)**: Mortgage interest is tax-deductible to the trust
- **Owner-occupied (primary residence)**: No deduction (not modelled)
- **Model simplification**: Family property rent is gross; actual net rent yield depends on trust tax position (out of scope)

### Capital Gains Tax (CGT)

- **Applies to**: Family property sale or non-principal private residence
- **Modelled**: No CGT calculation; inheritance assumes debt repaid first, net value transferred
- **Future enhancement**: Could add 50% discount for trust CGT if property sold post-inheritance

---

## 12. Implementation Notes for TypeScript Port

### 1. Type Definitions

All calculations expect numeric precision. Use:
```typescript
type AUD = number;           // All currency in Australian Dollars
type Fraction = number;       // 0.0 to 1.0 for rates and percentages
type CalendarYear = number;   // e.g., 2026
```

### 2. Rounding

- **Currency (AUD)**: Round to 2 decimals for display; preserve full precision internally
- **Percentages**: 1 decimal place for rates (e.g., `6.5%`)
- **Balances in tables**: Round to nearest dollar for readability
- **Interest accrual**: Full precision; round only on output

### 3. Array vs. Iteration

- Superannuation projections: Generate full 35-year array upfront; no lazy evaluation
- Mortgage schedule: Cache schedule in state; recalculate only on input change
- Debt payoff: Simulate to month 60 or debt-free (whichever first)

### 4. Error Handling

- **Zero rates**: Guard against division by zero in mortgage formulas
- **Negative balances**: Clamp to 0; log warning if unexpected
- **Missing CONFIG fields**: Provide sensible defaults (e.g., 0 for optional loans)

### 5. Performance

- All calculations should complete in <100ms even on 35-year horizons
- Memoize scenario comparisons (conservative, balanced, growth) to avoid triple recalc
- Debounce recalc() on rapid input changes (e.g., slider drag)

### 6. State Management (Zustand)

Store:
- `config`: Full CONFIG object (shape matches HTML)
- `projectionData`: Cached results (mattyData, partnerData, mortData, childData, combinedData)
- `scenarioResults`: Cached conservative/balanced/growth scenarios
- `debtPayoffData`: Timeline and events from last simulation
- `familyPropertyProjection`: 25+ year family property table

Selectors for derived values:
- `getCurrentYearReadiness()`: Find year where readiness ≥ 1.0
- `getDebtFreeMonth()`: First month in debt payoff timeline where totalDebt ≤ 0
- `getInheritanceValue()`: Projected value at inheritance year

---

## 13. Bibliography & References

1. **Australian Taxation Office (ATO)**
   - Superannuation Guarantee rates & legislative changes
   - Concessional contribution cap updates
   - https://www.ato.gov.au/super

2. **ASIC MoneySmart**
   - Retirement income strategies & drawdown rates
   - https://www.moneysmart.gov.au

3. **Financial Standard (AIST)**
   - Industry super guides & preservation age rules
   - https://www.aist.asn.au

4. **Dashboard Source**
   - Retirement_Dashboard_v2.html (original implementation)
   - Bank statement analysis (Jan–Mar 2026 for income averaging)
   - Family property deed (ownership structure & loan terms)

---

**Document Version**: 1.0  
**Last Updated**: 10 April 2026  
**Author**: Handoff documentation for Next.js porting project  
**Status**: Ready for implementation
