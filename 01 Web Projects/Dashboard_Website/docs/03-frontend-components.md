# Frontend Components — RetireAU Dashboard

## Project Structure

```
/app
  /page.tsx                          — landing page (public, SSR)
  /layout.tsx                        — root layout with ClerkProvider
  /dashboard
    /page.tsx                        — dashboard shell (client component)
    /layout.tsx                      — dashboard layout (auth optional)
    /components
      /Header.tsx                    — app header with auth button
      /ControlsPanel.tsx             — collapsible scenario inputs
      /KPICard.tsx                   — single KPI metric card
      /KPIGrid.tsx                   — responsive grid of KPI cards
      /ChartCard.tsx                 — card wrapper for chart + title
      /AlertBox.tsx                  — info/warning notification box
      /Badge.tsx                     — coloured status badge
      /ProgressBar.tsx               — horizontal progress indicator
      /TabView.tsx                   — tabbed content switcher
      /DataTable.tsx                 — sortable data table with sticky headers
      /DropZone.tsx                  — file upload drag-and-drop area
      /sections
        /SuperProjection.tsx         — super balance projections + charts
        /RetirementReadiness.tsx     — readiness KPIs + drawdown chart
        /BudgetProfile.tsx           — income, expenses, spending charts
        /DebtPayoff.tsx              — debt avalanche model + comparison charts
        /DepositComparison.tsx       — house deposit strategy section
        /FamilyProperty.tsx          — trust property + inheritance projection
        /ExpenseTracker.tsx          — Excel upload + weekly tracker
    /hooks
      /useConfig.ts                  — Zustand store (config state + persistence)
      /useCloudSync.ts               — save/load config to/from API
      /useChartTheme.ts              — shared Chart.js dark theme options
    /lib
      /calculations.ts               — all financial maths (pure functions)
      /au-tax-data.ts                — Australian tax/super rates
      /config-migrations.ts          — schema version upgrades
      /default-config.ts             — blank Australian template
      /types.ts                      — TypeScript interfaces for config
      /formatters.ts                 — currency/percentage formatting helpers
  /api
    /config/route.ts                 — GET + POST config endpoints
    /webhooks/clerk/route.ts         — Clerk webhook handler
/lib
  /db.ts                             — Prisma client singleton
/prisma
  /schema.prisma                     — database schema
/public
  /og-image.png                      — social share image
```

## Component Specifications

### Header.tsx

**Purpose:** Primary app header with authentication state and sync status.

**Props:**
```typescript
interface HeaderProps {
  version?: string;
  lastUpdated?: Date;
}
```

**Rendering:**
- Left side: App logo + name (RetireAU Dashboard) + version badge (e.g. "v2.1.0")
- Centre: Last updated timestamp (e.g. "Last updated 2 hours ago")
- Right side: Authentication state
  - When unauthenticated: "Sign in to save" button (Clerk `<SignInButton />`)
  - When authenticated: User avatar (`<UserButton />`) + checkmark indicator ("Saved ✓")

**Styling:**
- Gradient background matching current dashboard header (slate-900 to slate-800)
- Flexbox layout with space-between justification
- Sticky position (top: 0, z-index: 40)
- Box shadow for depth

---

### ControlsPanel.tsx

**Purpose:** Collapsible input panel for scenario parameterisation.

**Props:**
```typescript
interface ControlsPanelProps {
  defaultOpen?: boolean;  // default: false (collapsed)
}
```

**Behaviour:**
- Click header to toggle expand/collapse
- Smooth height transition (CSS or Framer Motion)
- Chevron icon rotates on toggle

**Sections (in order):**

1. **Current Balances & Profile**
   - User 1 name (text input)
   - User 1 current age (number)
   - User 2 name (text input)
   - User 2 current age (number)
   - Desired retirement age (number)
   - Target income in retirement (AUD, number)

2. **Debt Balances**
   - Number of debts (integer, triggers dynamic rows)
   - Per debt: Name, Balance (AUD), Annual rate (%), Monthly payment (AUD)
   - Add/remove debt buttons

3. **Super & Returns**
   - User 1 super balance (AUD)
   - User 2 super balance (AUD)
   - Expected annual return (% p.a.)
   - Expected super contribution rate (% p.a.)

4. **Mortgage & Property**
   - Owner-occupied property value (AUD)
   - Mortgage balance (AUD)
   - Annual interest rate (%)
   - Mortgage mode (dropdown: "Interest Only then P&I", "Full P&I")
   - If IO mode: Interest-only period (years)

5. **Retirement**
   - Target annual income (AUD)
   - Desired preservation age buffer (years)

6. **Children**
   - Number of children (integer, 0–5)
   - Per child: Name, current age, school completion age
   - Estimated cost per child (AUD)

7. **Family Trust Property**
   - Property value (AUD)
   - Loan balance (AUD)
   - Annual rental income (AUD)
   - Expected appreciation rate (%)

**Styling:**
- Divider labels: uppercase, muted text (`text-slate-400`), `font-semibold`, margin-top
- Inputs: number with step, min, max constraints via HTML attributes
- Selects: styled dropdowns with icon
- Labels: small uppercase muted text above each control
- Grid layout: 2-col on desktop, 1-col on mobile

**State Management:**
- All inputs directly update Zustand store via `useConfig()` hook
- No local state (state lives in `useConfig`)

---

### KPICard.tsx

**Purpose:** Single metric card displaying a financial KPI.

**Props:**
```typescript
interface KPICardProps {
  label: string;           // uppercase small text (e.g. "Super Balance")
  value: string;           // large formatted number (e.g. "$1.2M")
  sub?: string;            // optional muted detail text (e.g. "at age 60")
  color?: string;          // CSS variable name (e.g. "--color-green")
  highlight?: boolean;     // if true: accent border + gradient bg
  progress?: number;       // optional 0–100; renders progress bar below value
}
```

**Rendering:**
- Rounded card container with border
- Label: small caps, muted text
- Value: large bold text (default white, or custom colour)
- Sub-label: smaller muted text below value
- Optional progress bar (horizontal bar, coloured)
- Highlight variant: accent border (`--color-primary`) + subtle gradient background

**Styling:**
- Background: `bg-slate-800` (default) or `bg-gradient-to-br from-slate-700 to-slate-900` (highlight)
- Border: `border-slate-700` (default) or `border-primary` (highlight)
- Padding: 1rem
- Min-width: 180px

---

### KPIGrid.tsx

**Purpose:** Responsive container for multiple KPI cards.

**Props:**
```typescript
interface KPIGridProps {
  cards: KPICardProps[];
  columns?: number;  // default: auto-fit
}
```

**Rendering:**
- CSS Grid layout
- Template columns: `repeat(auto-fit, minmax(200px, 1fr))`
- Gap: 1rem
- Accepts array of KPICardProps, renders `<KPICard />` for each

**Responsive:**
- Desktop (>1000px): 3–4 columns (natural wrap)
- Tablet (768–1000px): 2–3 columns
- Mobile (<768px): 1 column (full width)

---

### ChartCard.tsx

**Purpose:** Container wrapping a chart with title and metadata.

**Props:**
```typescript
interface ChartCardProps {
  title: string;           // e.g. "Super Balance Projection"
  icon?: string;           // optional icon slug (e.g. "chart-line")
  children: React.ReactNode; // the chart component
  height?: number;         // default: 300px
  subtitle?: string;       // optional muted subtitle
}
```

**Rendering:**
- Rounded card container
- Header: title + optional icon + optional subtitle
- Body: children (chart) with defined height
- Chart auto-resizes via CSS (`width: 100%`)

**Styling:**
- Background: `bg-slate-800`
- Border: `border-slate-700`
- Padding: 1.5rem
- Chart container: `position: relative; height: Xpx;`

---

### AlertBox.tsx

**Purpose:** Inline notification box (info, warning, error).

**Props:**
```typescript
interface AlertBoxProps {
  type?: 'info' | 'warning' | 'error' | 'success'; // default: 'info'
  title?: string;
  children: React.ReactNode; // message content
  dismissible?: boolean;     // default: false
}
```

**Rendering:**
- Rounded container with left accent border
- Icon + title (optional) + message
- Close button (if dismissible)
- Colour scheme per type:
  - info: blue accent + blue border
  - warning: amber accent + amber border
  - error: red accent + red border
  - success: green accent + green border

---

### Badge.tsx

**Purpose:** Compact status indicator.

**Props:**
```typescript
interface BadgeProps {
  label: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'slate'; // default: 'slate'
  size?: 'sm' | 'md'; // default: 'md'
}
```

**Rendering:**
- Inline pill-shaped element
- Text (small caps or normal)
- Coloured background + text
- Padding: `px-2 py-1` (sm) or `px-3 py-1.5` (md)

---

### ProgressBar.tsx

**Purpose:** Horizontal progress indicator.

**Props:**
```typescript
interface ProgressBarProps {
  value: number;           // 0–100
  label?: string;          // e.g. "Progress"
  colour?: string;         // CSS colour name or var
  showPercent?: boolean;   // default: false
  height?: number;         // default: 8px
}
```

**Rendering:**
- Background track (muted)
- Foreground fill (coloured, matches value %)
- Optional label + percentage text
- Smooth transition on value change

---

### TabView.tsx

**Purpose:** Tabbed content switcher.

**Props:**
```typescript
interface TabViewProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
  defaultTab?: string;  // tab id to show on mount
  onTabChange?: (id: string) => void;
}
```

**Rendering:**
- Tab buttons (horizontal row, sticky or scrollable)
- Active tab button: accent background + white text
- Inactive: muted background
- Content area: fade-in animation on tab change
- Only the active tab's content renders (unmounted tabs save DOM)

---

### DataTable.tsx

**Purpose:** Sortable data table with sticky headers.

**Props:**
```typescript
interface DataTableProps {
  headers: Array<{
    key: string;           // column key
    label: string;         // display name
    align?: 'left' | 'right'; // default: 'left'
    sortable?: boolean;    // default: false
  }>;
  rows: Array<Record<string, any>>;
  highlightRow?: (row: any, index: number) => boolean;
  maxHeight?: number;     // default: 500px (scrollable container)
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}
```

**Rendering:**
- `<table>` structure with `<thead>` + `<tbody>`
- Sticky header (`position: sticky; top: 0;`)
- Rows rendered from `rows` array
- Optional row highlighting (alternating bg or custom)
- Horizontal scroll on mobile if table exceeds viewport width
- Cursor pointer on sortable headers

**Styling:**
- Header: `bg-slate-700`, white text
- Rows: `bg-slate-800`, alternating `bg-slate-750` for readability
- Borders: `border-b border-slate-700`
- Padding: `px-4 py-2`

---

## Section Components

### SuperProjection.tsx

**Purpose:** Display super balance projections, retirement readiness, and scenario analysis.

**Data Sources:**
- `config.profile` (ages, retirement target)
- `config.defaults` (return rates)
- `config.children` (dependency costs)

**Calculations:**
- Calls `projectSuper(config, returnRate)` from `calculations.ts`
- Three scenarios: conservative, base, optimistic

**Rendering:**

1. **KPI Grid — Retirement Summary**
   - Combined super balance at target retirement age (highlight)
   - Sustainable annual income from super
   - Shortfall to target income (if any; highlight if negative)
   - Readiness percentage (0–100%)

2. **KPI Grid — Scenario Comparison**
   - Conservative scenario: final balance, readiness %
   - Base scenario: final balance, readiness %
   - Optimistic scenario: final balance, readiness %

3. **Four Charts**
   - Super balance projection (stacked line: User 1, User 2, combined)
   - Net worth projection (line chart: super + property equity + savings)
   - Retirement readiness % over time (area chart: 0–100%)
   - Drawdown longevity (line: balance over drawdown years post-retirement)

4. **Salary Sacrifice Chart** (if applicable)
   - Bar chart comparing income + super contribution scenarios

5. **Children Cost Chart** (if `numChildren > 0`)
   - Stacked bar chart: school costs per child by age

6. **Preservation Age Alert**
   - AlertBox if retirement age < preservation age
   - Highlight bridge fund required

7. **Bridge Fund Section** (if applicable)
   - Calculation of bridge amount needed to reach preservation age
   - Display monthly drawdown requirement

8. **Tabbed Tables**
   - User 1 projection (year, age, balance, contribution, return, end balance)
   - User 2 projection (same columns)
   - Combined projection
   - Mortgage balance projection (if applicable)
   - Children cost breakdown (if applicable)
   - Budget allocation (fixed / variable / debt repayment)

---

### RetirementReadiness.tsx

**Purpose:** Summary readiness metrics and drawdown analysis.

**Data Sources:**
- `config.profile` (target income, retirement age)
- Projection results from `SuperProjection.tsx`

**Rendering:**

1. **KPI Grid — Readiness Summary**
   - On-track indicator (✓ / ✗)
   - Years to target income coverage
   - Sustainable withdrawal rate (%)
   - Life expectancy gap (years)

2. **Readiness Status Card**
   - Large badge: "On Track" / "At Risk" / "Shortfall"
   - Detail: "You can retire at [age] with [income] p.a."

3. **Drawdown Chart**
   - Balance projection over 40-year retirement period
   - Horizontal line: minimum safe balance (to avoid depletion)
   - Highlight area: zone of sustainability

4. **Risk Factors Table**
   - List: market volatility, longevity risk, inflation, healthcare costs
   - Per-factor impact on readiness %

---

### BudgetProfile.tsx

**Purpose:** Display income, expense, and savings summary.

**Data Sources:**
- `config.expenses` (fixed + variable)
- `config.debts` (monthly repayments)
- `config.profile` (user incomes)

**Calculations:**
- Calls `calcBudgetKPIs(expenses, debts)` from `calculations.ts`
- Computes: fixed total, variable total, debt repayments, surplus, savings rate

**Rendering:**

1. **Alert Box — Data Source**
   - Info: "Budget based on your manual entries. Update via Controls or import from Excel."

2. **KPI Grid — Income Summary**
   - User 1 take-home (after tax)
   - User 2 take-home (after tax)
   - Combined monthly income
   - Annual savings rate (% of income)

3. **KPI Grid — Expense Summary**
   - Total monthly spending (excluding debt repayments)
   - Fixed expenses total (highlight)
   - Variable expenses total
   - Debt repayments total (highlight if high)

4. **2-Column Grid**
   - Left: Spending doughnut chart (fixed vs variable vs debt)
   - Right: Monthly trend bar chart (last 12 months, stacked)

5. **Expense Breakdown Tables**
   - Left table: Fixed expenses (rent, utilities, insurance, etc.)
   - Right table: Variable expenses (groceries, transport, entertainment, etc.)
   - Columns: Category, Monthly (AUD), Weekly (AUD), Annual (AUD), % of income

6. **Budget Tab Table**
   - Comprehensive list: all expense categories + debt categories
   - Columns: Category, Budget (AUD), Actual (AUD), Variance, % of income
   - Row highlighting if variance > 10%

---

### DebtPayoff.tsx

**Purpose:** Display debt avalanche simulation and payoff strategies.

**Data Sources:**
- `config.debts` (balances, rates, payments)

**Calculations:**
- Calls `simulateDebtPayoff(debts, lumpSum, extraMonthly)` for current + recommended strategy
- Computes: months to debt-free, total interest paid, payoff date

**Rendering:**

1. **Alert Box — Strategy Summary**
   - Current payoff method + timeline
   - Recommended lump-sum or extra monthly suggestion

2. **KPI Grid — Payoff Targets**
   - Months to debt-free (current strategy; highlight)
   - Total interest to be paid (current strategy)
   - Projected debt-free date

3. **Debt Summary Cards** (mini-cards per debt)
   - Debt name + balance
   - Interest rate
   - Monthly payment
   - Months to payoff (this debt)

4. **Two Charts**
   - Debt payoff timeline (line chart: each debt's balance over time)
   - Scenario comparison (bar chart: total interest paid for 3 scenarios)

5. **Milestone Track**
   - Visual timeline of payoff events
   - Boxes for each debt elimination date
   - Highlight next milestone

6. **Debt Summary Table**
   - Columns: Debt name, Balance, Rate, Monthly payment, Interest paid (to date), Months remaining
   - Row totals at bottom

---

### DepositComparison.tsx

**Purpose:** Compare house deposit strategies (pay debt first vs save first).

**Data Sources:**
- `config.debts` (balances, rates, payments)
- `config.property` (target price, current savings)

**Calculations:**
- Simulates Scenario A: eliminate debt first, then save for deposit
- Simulates Scenario B: save for deposit while servicing debt
- Identifies breakeven point and recommend strategy

**Rendering:**

1. **Section Title**
   - "House Deposit Strategy" + property target price (dynamic, from config)

2. **Alert Box — Scenario Descriptions**
   - Scenario A: Eliminate [debt list], then save for deposit
   - Scenario B: Save for deposit while maintaining debt payments
   - Analysis: "Scenario [X] reaches 20% deposit in [Y] months"

3. **KPI Grid — Deposit Milestones**
   - Scenario A: 5% deposit date, 10% deposit date, 20% deposit date
   - Scenario B: 5% deposit date, 10% deposit date, 20% deposit date
   - Recommended scenario (highlight)

4. **Two Charts**
   - Savings comparison (dual-line: Scenario A savings, Scenario B savings)
   - Net position comparison (dual-bar: Scenario A net worth, Scenario B net worth)

5. **Side-by-Side Comparison Table**
   - Columns: Milestone, Scenario A (months & balance), Scenario B (months & balance)
   - Rows: every 3 months up to 20% deposit milestone

---

### FamilyProperty.tsx

**Purpose:** Project family trust property value, equity, and inheritance impact.

**Data Sources:**
- `config.familyProperty` (value, loan, rental income, appreciation rate)
- `config.profile` (user age, life expectancy)

**Calculations:**
- Calls `calcMortgageSchedule(...)` for trust property loan
- Calls `projectFamilyProperty(...)` for 40-year projection
- Computes: equity growth, inheritance net worth, family wealth transfer

**Rendering:**

1. **Alert Box — Property Summary**
   - "Family trust property: [address]. Current value [AUD], loan [AUD], estimated inheritance [AUD]."

2. **KPI Grid — Property Snapshot**
   - Property value (current)
   - Outstanding loan balance
   - Net equity (value − loan)
   - Rental yield (annual income / value, %)
   - Estimated inheritance value at user's life expectancy
   - Annual mortgage repayment (P&I phase)

3. **Year-by-Year Projection Table**
   - Columns: Year, Age, Property value, Loan balance, Net equity, Rental income, Repayment
   - Rows: every 5 years until life expectancy
   - Phase labels: "IO phase" vs "P&I phase" in Repayment column

4. **Three Charts**
   - Property value + equity (dual-line: property value, net equity over time)
   - Inheritance net worth impact (stacked area: user's net worth with and without inherited property)
   - Full breakdown (5-line stacked: super, owner-occupied property equity, family property equity, savings, debt)

---

### ExpenseTracker.tsx

**Purpose:** Import and analyse weekly expense data from Excel.

**Data Sources:**
- User uploads .xlsx file with expense data

**Workflow:**
1. DropZone accepts .xlsx file drag/drop or click to select
2. Client-side parsing via SheetJS (no server upload, privacy-preserving)
3. Extracts pre-defined ranges:
   - Fixed expenses: rows 6–14, columns B–C (category, amount)
   - Variable expenses: rows 18–31, columns B–C
   - Totals: row 32 (total income), row 33 (total expenses), row 34 (surplus)
4. Compute variance vs prior month (if available)

**Rendering:**

1. **DropZone Component**
   - Dashed border, drag-and-drop area with icon
   - Text: "Drag .xlsx file here or click to upload"
   - File name displayed after upload

2. **KPI Summary** (post-upload)
   - Monthly income
   - Total monthly expenses
   - Monthly surplus / (deficit)
   - Variance vs previous month (% change)

3. **Stacked Bar Chart**
   - X-axis: last 4 weeks (or 12 months if data available)
   - Y-axis: amount (AUD)
   - Stacks: fixed, variable, surplus
   - Actual vs budget comparison (if budget columns present in file)

4. **Variance Table**
   - Columns: Category, Actual, Budget, Variance (AUD), Variance (%)
   - Rows: all expense categories from file
   - Highlight rows where variance > 10%

**State Management:**
- Data stored in component state (not persisted to config or cloud)
- Ephemeral per-session (resets on page refresh)
- User can re-upload to update

---

## Hooks

### useConfig.ts (Zustand Store)

**Purpose:** Global state management for dashboard configuration.

**Store Shape:**
```typescript
interface DashboardStore {
  config: DashboardConfig;
  
  // Single-field updates
  updateProfile: (path: string, value: any) => void;
  updateDebt: (index: number, field: string, value: any) => void;
  updateExpense: (type: 'fixed' | 'variable', index: number, field: string, value: any) => void;
  updateFamilyProperty: (path: string, value: any) => void;
  updateDefaults: (field: string, value: any) => void;
  
  // Batch operations
  setFullConfig: (config: DashboardConfig) => void;
  resetToDefault: () => void;
  
  // Persistence
  hydrate: () => void;
}
```

**Persistence:**
- LocalStorage middleware: persists entire `config` object on every change
- Key: `retireAU-config`
- Serialisation: JSON
- Hydration: SSR-safe with Zustand's `skipHydration` flag (manual `hydrate()` on mount)

**Usage:**
```typescript
const { config, updateProfile } = useConfig();
updateProfile('profile.user1.age', 45);
```

---

### useCloudSync.ts

**Purpose:** Cloud sync for authenticated users (save/load config via API).

**Hook Returns:**
```typescript
interface CloudSync {
  isSynced: boolean;           // config matches cloud
  lastSaved: Date | null;
  isSaving: boolean;           // API call in progress
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<DashboardConfig | null>;
  syncOnSignIn: () => Promise<void>;  // merge logic on Clerk auth
}
```

**Behaviour:**
- **Auto-save:** Debounced 5 seconds after last config change (only when authenticated)
- **Sign-in sync:** On Clerk authentication, merge local config + cloud config (user's choice: local, cloud, or merge)
- **Manual save:** Call `saveToCloud()` to sync immediately
- **Load:** Call `loadFromCloud()` to fetch latest from server

**API Endpoints Used:**
- `POST /api/config` — save config
- `GET /api/config` — load config
- Returns `{ id, userId, config, updatedAt }`

**Error Handling:**
- Network error: log to console, retry on next debounce cycle
- Auth error (401): sign out user, revert to local state
- Validation error (400): reject update, flag to user

---

### useChartTheme.ts

**Purpose:** Centralised Chart.js configuration matching the dark theme.

**Hook Returns:**
```typescript
interface ChartTheme {
  gridColor: string;
  tickColor: string;
  legendColor: string;
  tooltipBg: string;
  tooltipText: string;
  fontFamily: string;
  responsive: boolean;
  maintainAspectRatio: boolean;
  [key: string]: any;
}
```

**Configuration:**
```javascript
{
  gridColor: 'rgba(71, 85, 105, 0.3)',    // slate-600 at 30% opacity
  tickColor: '#94a3b8',                   // slate-400
  legendColor: '#94a3b8',                 // slate-400
  tooltipBg: 'rgba(15, 23, 42, 0.95)',    // slate-900 at 95% opacity
  tooltipText: '#e2e8f0',                 // slate-200
  fontFamily: '"system-ui", sans-serif',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { size: 12 }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(71, 85, 105, 0.3)' },
      ticks: { color: '#94a3b8' }
    },
    y: {
      grid: { color: 'rgba(71, 85, 105, 0.3)' },
      ticks: { color: '#94a3b8' }
    }
  }
}
```

**Usage:**
```typescript
const chartTheme = useChartTheme();
<Line data={data} options={{ ...chartTheme, ...customOptions }} />
```

---

## Calculation Library (/lib/calculations.ts)

All functions are pure TypeScript (no side effects). Extracted from the current dashboard's `<script>` block.

### projectSuper()

```typescript
function projectSuper(
  config: DashboardConfig,
  returnRate: number,
  scenarioName: 'conservative' | 'base' | 'optimistic'
): ProjectionResult;

interface ProjectionResult {
  yearlyProjections: Array<{
    year: number;
    age: number;
    user1Balance: number;
    user2Balance: number;
    combinedBalance: number;
    contribution: number;
    return: number;
  }>;
  balanceAtRetirement: number;
  sustainableIncome: number;
  readinessPercent: number;
  drawdownYears: number;
}
```

**Inputs:**
- `config.profile.user1.age`, `user2.age`, `retirementAge`, `targetIncome`
- `config.defaults.returnRate`
- `config.superContributionRate`
- `returnRate` parameter (override global)

**Outputs:**
- Year-by-year breakdown to retirement + 40 years drawdown
- Terminal values (balance at retirement, sustainable withdrawal)
- Readiness metric (% of target income achieved)

---

### simulateDebtPayoff()

```typescript
function simulateDebtPayoff(
  debts: Debt[],
  lumpSum: number = 0,
  extraMonthly: number = 0
): SimulationResult;

interface SimulationResult {
  monthlySchedule: Array<{
    month: number;
    totalBalance: number;
    interestPaid: number;
    principalPaid: number;
  }>;
  debtFreeMonth: number;
  totalInterestPaid: number;
  payoffDate: Date;
}
```

**Inputs:**
- Array of debts: `{ name, balance, annualRate, monthlyPayment }`
- Optional lump-sum payment (applied in month 1)
- Optional extra monthly payment (applied each month)

**Outputs:**
- Month-by-month debt balance
- Total interest paid over life of debt
- Estimated payoff date

**Algorithm:**
- Avalanche method: extra payments applied to highest-rate debt first
- Recalculates each month after payment application

---

### calcMortgageSchedule()

```typescript
function calcMortgageSchedule(
  principal: number,
  annualRate: number,
  totalYears: number,
  ioYears: number,
  mode: 'io-then-pi' | 'full-pi'
): MortgageScheduleEntry[];

interface MortgageScheduleEntry {
  month: number;
  balance: number;
  payment: number;
  principal: number;
  interest: number;
  phase: 'IO' | 'P&I';
}
```

**Inputs:**
- Loan principal (AUD)
- Annual interest rate (%)
- Total loan term (years)
- Interest-only period (years)
- Mode: "IO then P&I" or "Full P&I"

**Outputs:**
- Month-by-month amortisation schedule
- Phase labels (IO vs P&I)

---

### simulateDepositScenarios()

```typescript
function simulateDepositScenarios(
  debts: Debt[],
  property: PropertyConfig,
  monthlySpareIncome: number
): {
  scenarioA: ScenarioEntry[];
  scenarioB: ScenarioEntry[];
};

interface ScenarioEntry {
  month: number;
  savingsBalance: number;
  totalDebt: number;
  netPosition: number;
}
```

**Scenario A:** Eliminate all debt first (redirect debt payments to savings), then save for deposit.
**Scenario B:** Maintain minimum debt payments, save surplus for deposit.

**Outputs:**
- Month-by-month tracking of savings, debt, and net position
- Identifies when 5%, 10%, 20% deposit milestones are reached

---

### calcBudgetKPIs()

```typescript
function calcBudgetKPIs(
  expenses: ExpenseConfig,
  debts: Debt[]
): BudgetKPIs;

interface BudgetKPIs {
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalDebtRepayment: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsRate: number; // % of income
}
```

**Inputs:**
- Fixed expenses array (rent, utilities, insurance, etc.)
- Variable expenses array (groceries, transport, entertainment, etc.)
- Debts array (monthly repayments)

**Outputs:**
- Aggregated totals
- Surplus calculation
- Savings rate as % of gross household income

---

### projectFamilyProperty()

```typescript
function projectFamilyProperty(
  config: FamilyPropertyConfig,
  currentYear: number,
  userAge: number,
  lifeExpectancy: number = 90
): FamilyProjectionResult;

interface FamilyProjectionResult {
  yearlyProjections: Array<{
    year: number;
    age: number;
    propertyValue: number;
    loanBalance: number;
    netEquity: number;
    rentalIncome: number;
    repayment: number;
  }>;
  inheritanceValue: number;
  inheritanceYear: number;
}
```

**Inputs:**
- Property value, loan balance, annual rental income, appreciation rate
- Current user age, life expectancy (default 90)

**Outputs:**
- Year-by-year property growth, loan paydown, equity
- Projected inheritance value and year

---

## Formatting Helpers (/lib/formatters.ts)

All functions return AUD-formatted strings.

### fmt(n: number): string

**Purpose:** Full dollar format with thousands separator.

**Examples:**
```
fmt(1234567) → "$1,234,567"
fmt(12345.67) → "$12,345.67"
fmt(-5000) → "−$5,000"
```

---

### fmtK(n: number): string

**Purpose:** Compact format for large numbers (millions/thousands).

**Examples:**
```
fmtK(1234567) → "$1.2M"
fmtK(456789) → "$456K"
fmtK(12345) → "$12K"
fmtK(500) → "$500"
```

---

### pct(n: number): string

**Purpose:** Percentage format with one decimal place.

**Examples:**
```
pct(0.427) → "42.7%"
pct(1.05) → "105.0%"
pct(-0.15) → "−15.0%"
```

---

## Responsive Breakpoints

**Desktop (>1000px)**
- KPI grids: 3–4 columns (natural wrap)
- Chart grids: 2-column layouts (side-by-side)
- Controls panel: 2-column input grid

**Tablet (768px–1000px)**
- KPI grids: 2–3 columns
- Chart grids: 2-column (occasionally stack to 1-col for very wide charts)
- Controls panel: 2-column input grid (may reduce to 1-col on smaller tablets)

**Mobile (<768px)**
- KPI grids: 1 column (full width, card-like)
- Chart grids: 1 column (stacked)
- Controls panel: 1 column (full width)
- DataTable: horizontal scroll (touch-friendly)
- DropZone: full width

**Chart Responsiveness**
- All charts configured with `responsive: true`
- Container height fixed; width auto-scales
- Axes and labels reduce on smaller screens (Chart.js native support)

**Touch Interactions**
- Buttons: minimum 44px × 44px tap target
- Inputs: full-width on mobile for easy interaction
- Selects: native mobile input (type-aware keyboards)

