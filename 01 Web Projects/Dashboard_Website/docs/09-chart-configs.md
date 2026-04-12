# Chart.js Configuration Reference — RetireAU Dashboard

## Overview

This document provides a comprehensive map of all Chart.js instances in the current Retirement_Dashboard_v2.html (2,665 lines), intended for porting to the React/Next.js rebuild using react-chartjs-2. Chart.js configurations are near-identical in react-chartjs-2; the primary changes are:

- Props instead of constructor parameters
- `useChartTheme()` hook instead of inline theme objects
- React lifecycle management (useEffect, key prop for re-renders)
- Dynamic data updates via React state instead of `chart.update()`

**Total charts documented:** 16 instances across 6 functional sections.

---

## Bottom Line Up Front (BLUF)

The Retirement Dashboard contains 16 Chart.js instances organised into six functional areas:

1. **Super Projection** (4 charts): Line and bar charts tracking super accumulation, net worth, retirement readiness, and drawdown longevity.
2. **Budget Profile** (2 charts): Doughnut and stacked bar charts breaking down spending by category and monthly trends.
3. **Debt Payoff** (2 charts): Line charts comparing debt payoff scenarios (minimums vs lump sum vs full strategy).
4. **Deposit Comparison** (2 charts): Line charts comparing house deposit strategies.
5. **Family Property** (3 charts): Line charts projecting property value, inheritance impact, and equity breakdown.
6. **Expense Tracker** (1 chart, dynamic): Horizontal bar chart comparing budget vs actual expenses from uploaded Excel files.

All charts use:
- **Theme colours** from the design system (04-css-design-system.md)
- **Responsive: true, maintainAspectRatio: false** for container-based sizing
- **Consistent axis formatting**: currency (AUD), percentages, and year labels
- **Custom tooltip callbacks** for financial formatting

---

## Chart Theme Constants

### Colour Palette (from 04-css-design-system.md)

| Token | Hex | Usage |
|-------|-----|-------|
| Grid | `rgba(71, 85, 105, 0.2–0.3)` | Axis grid lines |
| Tick text | `#94a3b8` (slate-400) | Axis labels, legend |
| Green (positive) | `#4ade80` | Gains, super growth, net position |
| Accent (primary) | `#38bdf8` (sky blue) | Super, primary dataset, active states |
| Red (negative) | `#f87171` | Debt, mortgage, losses |
| Orange (caution) | `#fb923c` | Warnings, interest, property value |
| Purple (inheritance) | `#a78bfa` | Future values, scenarios, equity |
| Teal (savings) | `#2dd4bf` | Savings, cumulative rent, secondary positive |
| Yellow | `#fbbf24` | Drawdown years, tertiary accent |

### useChartTheme() Hook Return Shape

```typescript
interface ChartTheme {
  responsive: boolean;                          // true
  maintainAspectRatio: boolean;                 // false
  plugins: {
    legend: {
      position?: 'right' | 'top' | 'bottom';   // varies by chart
      labels: {
        color: '#94a3b8';
        font: { size: 10–12, weight?: 400 };
        padding?: 8;
        boxWidth?: 12;
      };
    };
    tooltip?: {
      callbacks?: {
        label?: (context) => string;             // custom formatting
        afterBody?: (items) => string;           // secondary info
      };
    };
  };
  scales: {
    x: {
      ticks: { color: '#94a3b8'; font: { size: 9–10 } };
      grid: { color: 'rgba(71, 85, 105, 0.2)' };
      maxTicksLimit?: number;
      stacked?: boolean;
    };
    y: {
      ticks: {
        color: '#94a3b8';
        callback?: (value) => string;           // currency, %, etc.
        font: { size: 9–10 };
      };
      grid: { color: 'rgba(71, 85, 105, 0.2)' };
      stacked?: boolean;
      type?: 'linear' | 'logarithmic';
    };
  };
}
```

### React Port Notes

When using react-chartjs-2 with `useChartTheme()`:

```typescript
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useChartTheme } from '@/hooks/useChartTheme';

export function MyChart() {
  const chartTheme = useChartTheme();
  
  // Spread theme, then override specific sections:
  const options = {
    ...chartTheme,
    plugins: {
      ...chartTheme.plugins,
      legend: { ...chartTheme.plugins.legend, position: 'right' },
      tooltip: { callbacks: { label: (ctx) => '...' } }
    }
  };
  
  return <Line data={data} options={options} />;
}
```

**Key differences from Chart.js:**
- No `new Chart()` constructor — use the React component
- Data updates automatically when `data` prop changes
- Use `key` prop to force re-mount/reset if needed: `<Line key={resetId} data={...} />`
- Hover/click handlers via `options.plugins.tooltip.external` or event listeners on `ref`

---

## 1. SUPER PROJECTION CHARTS

### Location in UI
Super Projection tab → Main charts section (lines 1050–1174 in source)

### 1a. Super Balance Projections

**Canvas ID:** `superChart`  
**Function:** `renderSuperProjection()` (line 1050)  
**Chart type:** Line  
**Purpose:** Show individual and combined super growth from current age to retirement + 30 years.

**Data sources:**
- `mattyData.slice(0, 30).map(d => d.balance)` — Matty's annual balance
- `partnerData.slice(0, 30).map(d => d.balance)` — Partner's annual balance
- `combinedData.slice(0, 30).map(d => d.combinedSuper)` — Combined super (dashed line)

| Dataset | Colour | Fill | Dash | Label |
|---------|--------|------|------|-------|
| Matty | `#38bdf8` (accent) | `rgba(56,189,248,0.08)` | — | "Matty" |
| Partner | `#a78bfa` (purple) | `rgba(167,139,250,0.08)` | — | "Partner" |
| Combined | `#4ade80` (green) | None | `[5,5]` | "Combined" |

**Axes:**
- **X-axis:** Years (calculated labels from `combinedData`, e.g. "2026", "2027", ..., "2055")
- **Y-axis:** Amount (AUD), formatted via `chartOpts(v => '$'+(v/1e6).toFixed(1)+'M')`
  - Example: `$0.2M`, `$1.5M`, `$3.0M`

**Options:**
```javascript
{
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(71,85,105,0.2)' } },
    y: { ticks: { color: '#94a3b8', callback: v => '$'+(v/1e6).toFixed(1)+'M' }, grid: { color: 'rgba(71,85,105,0.2)' } }
  }
}
```

**Line properties:** `tension: 0.3, pointRadius: 0` (smooth curves, no dots)

---

### 1b. Net Worth Projection

**Canvas ID:** `netWorthChart`  
**Function:** `renderSuperProjection()` (line 1065)  
**Chart type:** Line  
**Purpose:** Show net worth progression including super, property equity, and mortgage balance.

**Datasets:**
| Label | Colour | Fill | Dash | Source |
|-------|--------|------|------|--------|
| Net Worth | `#4ade80` | `rgba(74,222,128,0.08)` | — | `combinedData[].netWorth` |
| Super Only | `#38bdf8` | None | `[4,4]` | `combinedData[].combinedSuper` |
| Property Value | `#fb923c` | None | `[2,2]` | `mortData[].propertyValue` |
| Mortgage | `#f87171` | None | — | `mortData[].balance` |

**Axes:**
- **Y-axis:** Currency, same format as Super chart (`$0.5M`, `$2.0M`, etc.)

---

### 1c. Retirement Readiness

**Canvas ID:** `readinessChart`  
**Function:** `renderSuperProjection()` (line 1082)  
**Chart type:** Bar  
**Purpose:** Show readiness percentage over time with colour-coded thresholds.

**Data:**
- Source: `combinedData.slice(0, 30).map(d => d.readiness * 100)` (values 0–100 or higher)

**Colouring logic (per bar):**
```javascript
backgroundColor: readinessData.map(v => 
  v >= 100 ? 'rgba(74,222,128,0.5)' :      // green if ≥100%
  v >= 70 ? 'rgba(251,146,60,0.5)' :       // orange if ≥70%
  'rgba(248,113,113,0.5)'                  // red if <70%
),
borderColor: readinessData.map(v => 
  v >= 100 ? '#4ade80' : v >= 70 ? '#fb923c' : '#f87171'
)
```

**Y-axis:** Percentage, formatted `v+'%'`

---

### 1d. Drawdown Longevity

**Canvas ID:** `drawdownChart`  
**Function:** `renderSuperProjection()` (line 1099)  
**Chart type:** Line  
**Purpose:** Show how many years of retirement income the projected super will sustain.

**Data:**
- Source: `combinedData.slice(0, 30).map(d => d.drawdownYears)`

| Property | Value |
|----------|-------|
| Colour | `#fbbf24` (yellow) |
| Fill | `rgba(251,191,36,0.08)` |
| Y-axis format | `v+' yrs'` (e.g., "30 yrs", "40 yrs") |

---

### 1e. Salary Sacrifice Comparison (Conditional)

**Canvas ID:** `salSacChart`  
**Function:** `renderSuperProjection()` (line 1139)  
**Chart type:** Bar  
**Purpose:** Compare combined super at retirement for different annual contribution levels.

**X-axis labels:** `['$0/yr', '$5,000/yr', '$10,000/yr', '$15,000/yr', '$20,000/yr', '$27,500/yr']`

**Datasets:**
| Index | Colour | Logic |
|-------|--------|-------|
| 0 (baseline) | `rgba(148,163,184,0.4)` border `#94a3b8` | Greyed (reference) |
| 1–5 (extra contrib) | `rgba(56,189,248,0.4)` border `#38bdf8` | Accent (optimised scenarios) |

**Y-axis:** Currency format `'$'+(v/1e6).toFixed(2)+'M'`

---

### 1f. Children Cost Chart (Conditional — shown if numChildren > 0)

**Canvas ID:** `childCostChart`  
**Function:** `renderSuperProjection()` (line 1162)  
**Chart type:** Bar  
**Purpose:** Show annual child-rearing costs by year (inflation-adjusted).

**Data source:** `childData.slice(0, 30).map(d => d.cost)`

| Property | Value |
|----------|-------|
| Colour | `rgba(167,139,250,0.4)` (purple) |
| Border | `#a78bfa` |
| Y-axis format | `'$'+(v/1000).toFixed(0)+'k'` |

---

## 2. BUDGET PROFILE CHARTS

### Location in UI
Budget tab → Expense breakdown section (lines 1330–1378 in source)

### 2a. Spending Breakdown (Doughnut)

**Canvas ID:** `budgetPieChart`  
**Function:** `renderBudgetCharts()` (line 1338)  
**Chart type:** Doughnut  
**Purpose:** Show proportional breakdown of spending by category.

**Data:**
- **Labels:** `['CC Payments', 'Rent', 'Car Loans', ..., 'Travel & Accom']` (17 categories)
- **Amounts:** `[6200, 3253, 2009, ..., 100]` (monthly, AUD)
- **Colours:** `['#ef4444', '#f87171', '#fb923c', ..., '#34d399']` (pre-defined per category)

**Options:**
```javascript
{
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      position: 'right',
      labels: { color: '#94a3b8', font: { size: 10 }, padding: 8, boxWidth: 12 }
    },
    tooltip: {
      callbacks: {
        label: ctx => ' $' + ctx.parsed.toLocaleString('en-AU') + '/mo'
      }
    }
  }
}
```

**Source lines:** 1338–1355

---

### 2b. Monthly Expense Trend (Stacked Bar)

**Canvas ID:** `budgetTrendChart`  
**Function:** `renderBudgetCharts()` (line 1361)  
**Chart type:** Bar (stacked)  
**Purpose:** Show month-over-month spending trends across major categories.

**X-axis labels:** `['Jan 2026', 'Feb 2026', 'Mar 2026']`

**Datasets:** 12 categories from `CONFIG.expenses.budgetChart.monthlyTrend.datasets`:
- `{ label: 'Rent', data: [3838, 2960, 2960], color: '#f87171' }`
- `{ label: 'Loan Repayments', data: [1412, 1136, 1136], color: '#fb923c' }`
- `{ label: 'Groceries', data: [1193, 1099, 1845], color: '#4ade80' }`
- ... (9 more categories)

**Stacking:** `stack: 'a'` (all datasets in one group)

**Axes:**
```javascript
x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(71,85,105,0.2)' } },
y: { 
  stacked: true,
  ticks: { color: '#94a3b8', callback: v => '$'+(v/1000).toFixed(0)+'k' },
  grid: { color: 'rgba(71,85,105,0.2)' }
}
```

---

## 3. DEBT PAYOFF CHARTS

### Location in UI
Debt Payoff tab → Payoff simulation section (lines 1503–1570 in source)

### 3a. Debt Payoff Timeline (Multi-line)

**Canvas ID:** `debtPayoffChart`  
**Function:** `renderDebtPayoff()` (line 1503)  
**Chart type:** Line  
**Purpose:** Show each debt's balance declining over time under the avalanche strategy.

**Datasets:**
- One dataset per debt (4 in example): Partner's Car, Toyota Hilux, Now Finance, OMM/wFinance (each with its own colour from CONFIG)
- Plus a "Total Debt" dashed line in white

| Dataset | Colour | Fill | Dash | Source |
|---------|--------|------|------|--------|
| Debt 1–4 | `d.color` (stored in CONFIG) | `d.color + '15'` (15% opacity) | — | `timeline.map(t => t.balances[i])` |
| Total Debt | `#f1f5f9` (white) | None | `[5,5]` | `timeline.map(t => t.totalDebt)` |

**X-axis labels:** Month-year format, e.g., `['Apr 2026', 'May 2026', ...]`

**Y-axis:** Currency `'$'+(v/1000).toFixed(0)+'k'`

**Line properties:**
- Individual debts: `tension: 0.3, pointRadius: 2, borderWidth: 2`
- Total: `tension: 0.3, pointRadius: 0, borderWidth: 2`

**Tooltip custom:** `label: ctx => ' $' + Math.round(ctx.parsed.y).toLocaleString('en-AU')`

---

### 3b. Debt Scenario Comparison (Multi-line)

**Canvas ID:** `debtCashflowChart`  
**Function:** `renderDebtPayoff()` (line 1534)  
**Chart type:** Line  
**Purpose:** Compare three payoff strategies: minimums only, lump sum only, and full strategy (lump + monthly surplus).

**Datasets:**
| Label | Colour | Dash | Fill | Data source |
|-------|--------|------|------|-------------|
| Minimums Only | `#f87171` (red) | `[4,4]` | None | `minOnly.timeline.map(t => t.totalDebt)` |
| $34.4k Lump Only | `#fbbf24` (yellow) | `[4,4]` | None | `lumpOnly.timeline.map(t => t.totalDebt)` |
| $34.4k + $5,433/mo | `#4ade80` (green) | — | `rgba(74,222,128,0.1)` | `withSurplus.timeline.map(t => t.totalDebt)` |

**Axes:** Same as 3a.

---

## 4. DEPOSIT COMPARISON CHARTS

### Location in UI
Deposit Comparison tab → Strategy comparison section (lines 1761–1844 in source)

### 4a. Savings Balance Comparison (Multi-line)

**Canvas ID:** `depositCompareChart`  
**Function:** `renderDepositComparison()` (line 1761)  
**Chart type:** Line  
**Purpose:** Show cumulative savings for two deposit strategies (pay debt first vs. save first).

**Datasets:**
| Label | Colour | Fill | Dash | Source |
|-------|--------|------|------|--------|
| A: Debts First | `#4ade80` | `rgba(74,222,128,0.08)` | — | `scenA.map(s => s.savings)` |
| B: Save First | `#38bdf8` | `rgba(56,189,248,0.08)` | — | `scenB.map(s => s.savings)` |
| 5% Target | `#a78bfa` | None | `[4,2]` | Horizontal line (constant) |
| 10% Target | `#fbbf24` | None | `[6,3]` | Horizontal line (constant) |
| 20% Target | `#f87171` | None | `[6,3]` | Horizontal line (constant) |

**X-axis:** 48 months of labels, format: `'MMM YY'` (e.g., "Apr 26", "May 26")

**Y-axis:** `'$'+(v/1000).toFixed(0)+'k'`

**Line properties:** `tension: 0.3, pointRadius: 0`

---

### 4b. Net Position Comparison (Multi-line)

**Canvas ID:** `netPositionChart`  
**Function:** `renderDepositComparison()` (line 1810)  
**Chart type:** Line  
**Purpose:** Compare net position (savings minus debt) for each strategy, including remaining debt as negative line.

**Datasets:**
| Label | Colour | Fill | Dash |
|-------|--------|------|------|
| A: Net Position (No Debt) | `#4ade80` | None | — |
| B: Net Position (Savings − Debt) | `#38bdf8` | None | — |
| B: Remaining Debt (negative) | `#f87171` | `rgba(248,113,113,0.08)` | `[4,4]` |

**Y-axis formatting:**
```javascript
callback: v => (v < 0 ? '-' : '') + '$' + Math.abs(v/1000).toFixed(0) + 'k'
```
(Shows negative values as `-$Xk`)

---

## 5. FAMILY PROPERTY CHARTS

### Location in UI
Family Property tab → Projection section (lines 2319–2474 in source)

### 5a. Property Value + Equity Over Time

**Canvas ID:** `famPropValueChart`  
**Function:** `renderFamilyProperty()` (line 2319)  
**Chart type:** Line  
**Purpose:** Show property appreciation, your equity share, and loan balances.

**Datasets:**
| Label | Colour | Fill | Dash | Dash pattern |
|-------|--------|------|------|---------|
| Total Property Value | `#4ade80` | `rgba(74,222,128,0.1)` | — | — |
| Your 33.3% Net Equity | `#38bdf8` | `rgba(56,189,248,0.1)` | — | — |
| Loans Outstanding | `#f87171` | `rgba(248,113,113,0.08)` | — | — |
| Cumulative Rent (Your Share) | `#2dd4bf` | None | — | `[5,3]` |

**X-axis labels:** Years from `propValues` array (e.g., "2026", "2031", "2036", ...)

**Y-axis:** Custom `fmtK()` format (e.g., "$0.5M", "$2.3M")

**Tooltip custom:**
```javascript
label: ctx => ctx.dataset.label + ': ' + fmtK(ctx.raw)
```

**Hover interaction:** `interaction: { mode: 'index', intersect: false }`

---

### 5b. Inheritance Net Worth Impact

**Canvas ID:** `famPropNetWorthChart`  
**Function:** `renderFamilyProperty()` (line 2363)  
**Chart type:** Line  
**Purpose:** Show combined super projection with and without inheritance stepped in.

**Datasets:**
| Label | Colour | Fill |
|-------|--------|------|
| Super Only | `#fb923c` | `rgba(251,146,60,0.08)` |
| Super + Inheritance | `#a78bfa` | `rgba(167,139,250,0.12)` |

**Data logic:**
- Super line grows each year with returns and contributions
- At `inheritYear`, inheritance value is added to create step up in combined line

**Y-axis:** `fmtK()` format

---

### 5c. Full Breakdown (Property, Mortgage, Equity Loan, Net Equity)

**Canvas ID:** `famPropBreakdownChart`  
**Function:** `renderFamilyProperty()` (line 2386)  
**Chart type:** Line  
**Purpose:** Detailed five-line view showing all components of property equity.

**Datasets:**

| Label | Colour | Fill | Dash | Fill colour | Point style |
|-------|--------|------|------|-------------|-------------|
| Property Value | `#4ade80` | Yes | — | `rgba(74,222,128,0.08)` | Enabled |
| Trust Net Equity | `#38bdf8` | Yes | — | `rgba(56,189,248,0.12)` | Enabled |
| Your 33.3% Net Equity | `#a78bfa` | Yes | — | `rgba(167,139,250,0.15)` | Enabled |
| Mortgage Balance | `#f87171` | Yes | `[4,2]` | `rgba(248,113,113,0.1)` | Enabled |
| Equity Loan Balance | `#fb923c` | Yes | `[4,2]` | `rgba(251,146,60,0.1)` | Enabled |

**Point settings:** `pointRadius: 0, pointHoverRadius: 4`

**Tooltip custom:**
```javascript
callbacks: {
  label: ctx => ctx.dataset.label + ': ' + fmtK(ctx.raw),
  afterBody: function(items) {
    const idx = items[0].dataIndex;
    const lvr = propValues[idx] > 0 ? ((loanLine[idx] / propValues[idx]) * 100).toFixed(1) : '0.0';
    return 'LVR: ' + lvr + '%';  // Loan-to-value ratio
  }
}
```

**Legend:** `usePointStyle: true, pointStyle: 'line'` (shows line style instead of coloured boxes)

---

## 6. EXPENSE TRACKER CHART (Dynamic)

### Location in UI
Expense Tracker tab → Budget vs Actual (lines 2625–2646 in source)

### 6a. Budget vs Actual (Horizontal Bar)

**Canvas ID:** `trackerBarChart`  
**Function:** `parseAndRenderTracker()` (line 2625)  
**Chart type:** Bar (horizontal, indexed axis)  
**Purpose:** Compare budget and actual spending for variable expense categories.

**Data source:**
- Parsed from uploaded Excel file (SheetJS)
- Only variable expenses with monthly average > 0
- Labels truncated to 16 chars with ellipsis if longer

**Datasets:**
| Dataset | Colour | Logic |
|---------|--------|-------|
| Budget | `rgba(56,189,248,0.3)` border `rgba(56,189,248,0.8)` | Static (from file) |
| Actual | Conditional: `rgba(248,113,113,0.5)` if > budget, else `rgba(74,222,128,0.5)` | Red if over, green if under |

**Axes:**
```javascript
indexAxis: 'y',  // Horizontal bars
x: { 
  ticks: { color: '#94a3b8', callback: v => '$' + v.toLocaleString() },
  grid: { color: 'rgba(71,85,105,0.3)' }
},
y: {
  ticks: { color: '#f1f5f9', font: { size: 10 } },
  grid: { display: false }
}
```

**Tooltip custom:**
```javascript
label: ctx => ctx.dataset.label + ': $' + ctx.raw.toLocaleString()
```

---

## Dataset Properties Reference Table

All datasets share common properties unless overridden per chart:

| Property | Type | Example Values | Usage |
|----------|------|---------|-------|
| `label` | string | "Matty", "Combined", "Total Debt" | Legend, tooltip |
| `data` | number[] | `[150000, 160000, ...]` | Chart data points |
| `borderColor` | hex or rgb | `'#4ade80'`, `'rgba(74,222,128,0.5)'` | Line/border colour |
| `backgroundColor` | hex or rgba | `'rgba(74,222,128,0.1)'` | Fill colour (semi-transparent) |
| `fill` | boolean | `true`, `false` | Enable/disable area fill (line charts) |
| `tension` | number | `0.3` | Bezier curve smoothness (0=straight, 1=very smooth) |
| `pointRadius` | number | `0`, `2`, `4` | Dot size (0 = no dots) |
| `pointHoverRadius` | number | `4`, `6` | Dot size on hover |
| `borderWidth` | number | `1`, `2`, `3` | Line thickness |
| `borderDash` | [number, number] | `[5,5]`, `[4,4]`, `[6,3]` | Dash pattern: [dash length, gap length] |
| `stack` | string | `'a'`, `'b'` | Stacking group (multiple groups stack independently) |
| `indexAxis` | string | `'y'` | Horizontal bars (only on chart options, not dataset) |

---

## Responsive Configuration

All charts configured for responsive containers:

```javascript
{
  responsive: true,           // Redraw on window resize
  maintainAspectRatio: false, // Use container height, not fixed ratio
}
```

**Container setup (HTML/CSS):**
```html
<div class="chart-container" style="position: relative; height: 300px;">
  <canvas id="superChart"></canvas>
</div>
```

**In React:**
```typescript
<div style={{ position: 'relative', height: 300 }}>
  <Line data={data} options={options} />
</div>
```

---

## Dynamic Data Updates

### Chart.js Approach (v2 dashboard)
```javascript
if (charts.superChart) charts.superChart.destroy();
charts.superChart = new Chart($('superChart'), { type, data, options });
```

### React Approach (rebuild)
```typescript
const [data, setData] = useState(initialData);

useEffect(() => {
  // Recalculate when config changes
  const newData = computeChartData(config);
  setData(newData);
}, [config]);

return <Line data={data} options={options} key={resetKey} />;
```

**Re-render triggers:**
- When `useConfig()` state updates (via `updateProfile()`, `updateDebt()`, etc.)
- Changes propagate to chart data via recalculation functions
- React re-renders with new `data` prop, Chart.js updates internally

---

## Formatting Helpers

All charts use consistent formatting functions (from `Retirement_Dashboard_v2.html`):

```typescript
// Full dollar format
fmt(n: number): '$1,234,567'

// Compact format
fmtK(n: number): '$1.2M' / '$456k'

// Percentage
pct(n: number): '42.7%'
```

Refer to `/lib/formatters.ts` in the Next.js codebase for implementations.

---

## Source Line Numbers (Retirement_Dashboard_v2.html)

| Chart | Function | Lines | Canvas ID |
|-------|----------|-------|-----------|
| Super Balance | `renderSuperProjection()` | 1050–1061 | `superChart` |
| Net Worth | `renderSuperProjection()` | 1065–1077 | `netWorthChart` |
| Readiness | `renderSuperProjection()` | 1082–1095 | `readinessChart` |
| Drawdown | `renderSuperProjection()` | 1099–1112 | `drawdownChart` |
| Salary Sacrifice | `renderSuperProjection()` | 1139–1155 | `salSacChart` |
| Children Cost | `renderSuperProjection()` | 1162–1174 | `childCostChart` |
| Budget Pie | `renderBudgetCharts()` | 1338–1355 | `budgetPieChart` |
| Budget Trend | `renderBudgetCharts()` | 1361–1377 | `budgetTrendChart` |
| Debt Payoff | `renderDebtPayoff()` | 1503–1530 | `debtPayoffChart` |
| Debt Cashflow | `renderDebtPayoff()` | 1534–1570 | `debtCashflowChart` |
| Deposit Compare | `renderDepositComparison()` | 1761–1806 | `depositCompareChart` |
| Net Position | `renderDepositComparison()` | 1810–1844 | `netPositionChart` |
| Family Property Value | `renderFamilyProperty()` | 2319–2346 | `famPropValueChart` |
| Family Net Worth | `renderFamilyProperty()` | 2363–2383 | `famPropNetWorthChart` |
| Family Breakdown | `renderFamilyProperty()` | 2386–2474 | `famPropBreakdownChart` |
| Tracker Budget vs Actual | `parseAndRenderTracker()` | 2625–2646 | `trackerBarChart` |

---

## Implementation Checklist for React Port

- [ ] Create wrapper components for each section (e.g., `<SuperProjectionCharts />`, `<BudgetCharts />`)
- [ ] Import `useChartTheme()` hook in each component
- [ ] Use `useConfig()` to subscribe to config changes
- [ ] Recalculate data in `useEffect` when config updates
- [ ] Pass `data` and theme-merged `options` to react-chartjs-2 components
- [ ] Test responsive behaviour (container height should be fixed, width should adapt)
- [ ] Verify tooltip formatting matches original (currency, %, years, etc.)
- [ ] Add `key` prop to force re-render if static data shouldn't update
- [ ] Test all three scenarios for each chart (conservative/base/optimistic where applicable)

---

## Related Documentation

- **03-frontend-components.md:** Component structure and `useChartTheme()` hook specification
- **04-css-design-system.md:** Colour palette, typography, spacing (authority for theme values)
- **02-database-schema.ts:** `DashboardConfig` structure (chart data shape)
- **/lib/calculations.ts:** Data generation functions (source of chart data)
- **/lib/formatters.ts:** `fmt()`, `fmtK()`, `pct()` implementations
