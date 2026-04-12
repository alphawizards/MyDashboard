# Validation Checklist — RetireAU Dashboard

## Purpose
This checklist documents every verification that must pass after any CONFIG change, category recategorisation, structural edit, or deployment. It was created after an audit found 10 errors in hardcoded values that had gone stale after category changes. All values must now be dynamically calculated from the CONFIG object — no hardcoded dollar amounts in rendered HTML.

## How To Use
Run through this checklist after:
- Any change to CONFIG structure or default values
- Any expense recategorisation
- Any new feature that adds fields to CONFIG
- Before every deployment
- After schema version migrations

---

## 1. Income & Take-Home Pay

- [ ] User1 fortnightly net pay correctly converts to monthly (fn × 26 ÷ 12)
- [ ] User2 fortnightly net pay correctly converts to monthly (fn × 26 ÷ 12)
- [ ] Combined monthly = user1 monthly + user2 monthly
- [ ] Combined weekly = combined monthly × 12 ÷ 52
- [ ] Combined annual = combined monthly × 12
- [ ] Income KPIs rendered dynamically (not hardcoded HTML)
- [ ] Alert text income figures match calculated values

## 2. Fixed Expenses

- [ ] All CONFIG.expenses.fixed items render in Fixed Expenses table
- [ ] Category names match CONFIG exactly
- [ ] Monthly amounts match CONFIG exactly
- [ ] Weekly = monthly × 12 ÷ 52 (not monthly ÷ 4.33)
- [ ] Annual = monthly × 12
- [ ] Fixed total = sum of all fixed items
- [ ] Percentage = item ÷ grand total × 100
- [ ] Budget KPI "Fixed Expenses" matches calculated total
- [ ] Budget tab table fixed subtotal matches

## 3. Variable Expenses

- [ ] All CONFIG.expenses.variable items render in Variable Expenses table
- [ ] Category names match CONFIG exactly
- [ ] Monthly amounts match CONFIG exactly
- [ ] Credit Card Payments excluded from spending total (treated as transfer)
- [ ] Variable total (excl CC) = sum of non-CC variable items
- [ ] Budget KPI "Variable Expenses" matches calculated total (excl CC)
- [ ] Budget tab table shows ALL categories including CC with correct amounts
- [ ] Doughnut chart categories array matches CONFIG
- [ ] Doughnut chart amounts array sums correctly

## 4. Savings Rate & Surplus

- [ ] Total spend = fixed total + variable total (excl CC)
- [ ] Monthly surplus = combined monthly income − total spend
- [ ] Savings rate = surplus ÷ income × 100
- [ ] Budget KPI "Savings Rate" displays calculated percentage
- [ ] Progress bar width matches savings rate percentage
- [ ] monthlySurplus in config state updated dynamically
- [ ] Surplus value flows correctly into deposit comparison scenarios

## 5. Debt Summary

- [ ] All CONFIG.debts.active items render in debt summary
- [ ] Balance, payment, and rate match CONFIG for each debt
- [ ] Total debt payments = sum of all active debt payments
- [ ] Total outstanding balance = sum of all active debt balances
- [ ] Debt KPI shows correct count of loans (matches array length)
- [ ] Paid-off debts render with correct final payment and date
- [ ] Debt payoff simulation uses correct interest accrual (balance × monthly rate)
- [ ] Avalanche priority: surplus applied to highest-rate debt first

## 6. House Deposit Strategy

- [ ] Property target price reads from CONFIG.property.targetPrice
- [ ] Deposit targets label shows dynamic price (not hardcoded)
- [ ] 5% deposit = targetPrice × 0.05
- [ ] 10% deposit = targetPrice × 0.10
- [ ] 20% deposit = targetPrice × 0.20
- [ ] Stamp duty reads from CONFIG.property.stampDuty
- [ ] LMI estimate calculated for 95% LVR scenario
- [ ] HISA rate reads from CONFIG.property.hisaRate
- [ ] Scenario A: lump sum applied to debts, then save at full rate (surplus + freed minimums)
- [ ] Scenario B: save immediately at surplus, pay minimums on debts
- [ ] Side-by-side table values match independent calculation
- [ ] Milestone dates (5%/10%/20%) are internally consistent

## 7. Family Trust Property

### Static KPIs
- [ ] Capital gain % = (currentValue − purchasePrice) ÷ purchasePrice × 100
- [ ] Total loans = mortgage + equityLoan
- [ ] LVR = totalLoans ÷ currentValue × 100
- [ ] Net equity = (currentValue − totalLoans) × ownershipShare
- [ ] Rental yield = (weeklyRent × 52) ÷ currentValue × 100
- [ ] Ownership % label is dynamic (reads from ownershipShare, not hardcoded)

### Mortgage Amortisation
- [ ] IO payment = principal × annualRate ÷ 12 (monthly)
- [ ] IO phase: balance unchanged for ioPeriod years
- [ ] P&I payment uses standard annuity formula: P × (r(1+r)^n) / ((1+r)^n − 1)
- [ ] P&I phase: balance reduces to $0 by end of term
- [ ] Mode toggle "Full P&I" recalculates from year 1
- [ ] Mortgage KPI shows current payment and transition amount

### Equity Loan Paydown
- [ ] Operating expenses = 15% of gross rent
- [ ] Surplus = gross rent − mortgage payment − opex
- [ ] Equity loan serviced from surplus
- [ ] Equity loan balance tracked independently from mortgage

### Projection
- [ ] Projection years = max(parent life expectancy − parent age) + 10
- [ ] Property growth compounds at CONFIG growthRate per year
- [ ] 3% annual rent escalation applied
- [ ] Inheritance year calculated from surviving parent's life expectancy
- [ ] All 3 charts render with correct data arrays
- [ ] Table shows IO/P&I phase labels per row

## 8. Superannuation Projection

- [ ] User1 and User2 super balances read from editable inputs
- [ ] Super guarantee rate applied correctly per fiscal year
- [ ] 15% contributions tax deducted from concessional contributions
- [ ] Salary growth rate applies from CONFIG.defaults
- [ ] Future salary switch applied at correct year (if configured)
- [ ] Parental leave reduction applied when children config is active
- [ ] Preservation age = 60 used for access badge logic
- [ ] Drawdown rate and retirement target produce correct sustainable income
- [ ] Three return scenarios (conservative/base/optimistic) use correct rates

## 9. Cross-Cutting & Rendering

### Dynamic Rendering
- [ ] All KPIs generated dynamically from CONFIG (no hardcoded HTML dollar amounts)
- [ ] Budget tab table generated dynamically from CONFIG arrays
- [ ] Expense detail tables generated dynamically
- [ ] Debt summary cards generated dynamically
- [ ] Family property KPIs and labels generated dynamically
- [ ] No hardcoded percentage labels (e.g. "33%" must come from ownershipShare)

### Editable Controls → Recalculation
- [ ] Changing super balances triggers projection recalculation
- [ ] Changing salaries triggers projection recalculation
- [ ] Changing debt balances triggers debt + deposit recalculation
- [ ] Changing mortgage rate/term/IO/mode triggers family property recalculation
- [ ] Changing property value/rent/growth triggers family property recalculation
- [ ] Changing parent ages triggers inheritance projection recalculation

### State Persistence
- [ ] Config saves to localStorage on every change
- [ ] Config loads from localStorage on page mount
- [ ] Cloud save (if authenticated) debounced at 5 seconds
- [ ] Schema migration runs on config load if version < current
- [ ] Default config provided for new users with no saved state

## 10. Historical Errors (Regression Prevention)

These bugs were found during the April 2026 audit. Each must be tested against:

| # | Error | Root Cause | Regression Test |
|---|-------|-----------|-----------------|
| 1 | Fixed expenses KPI showed $6,287 instead of $6,095 | Hardcoded HTML went stale | Verify fixed KPI = sum of CONFIG.expenses.fixed |
| 2 | Variable expenses KPI showed $6,237 | Stale from before CC recategorisation | Verify variable KPI = sum minus CC items |
| 3 | Total spend showed $12,523 instead of $10,288 | Sum of wrong sub-totals | Verify total = fixed + variable (excl CC) |
| 4 | Debt repayments showed $2,369 / "3 loans" | Old amount, wrong count | Verify = sum of CONFIG.debts.active payments |
| 5 | Savings rate showed 30.3% instead of 42.7% | Based on wrong expense totals | Verify rate = surplus ÷ income |
| 6 | Budget tab had phantom categories | Old raw bank categories never updated | Verify table generates from CONFIG only |
| 7 | "33%" ownership hardcoded throughout | Static text not from config | Verify all ownership labels read from config |
| 8 | Deposit target said "$1.1M" hardcoded | Static text in template | Verify reads from CONFIG.property.targetPrice |
| 9 | Mortgage used 60%-of-rent approximation | Placeholder model | Verify calcMortgageSchedule() used |
| 10 | modeLabel referenced before initialisation | Variables defined after KPI HTML | Verify no ReferenceError on page load |
