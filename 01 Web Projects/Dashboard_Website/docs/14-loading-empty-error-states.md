# Loading, Empty, and Error States — RetireAU Dashboard

## Overview

Every page and section of the RetireAU dashboard can enter one of several states: loading, empty, error, success, or partial (some data present, some missing). This document specifies the state matrix for each route/section, skeleton loader patterns, first-run onboarding flow, error boundaries, offline detection, chart-specific patterns, and a copy deck for all user-facing strings.

---

## State Matrix

Below is a comprehensive map of possible states for each route and major section. For each state, the behaviour and UI treatment is specified.

### Route: `/dashboard` (Overview)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Loading | Initial data load from cloud (if signed in) | Skeleton loader (2 KPI cards, 1 chart) | → Success or Error |
| Empty | User has no CONFIG saved (first-run) | Onboarding CTA: "Complete your profile to get started" | Click CTA → `/dashboard/profile` |
| Error | API returned 500 or network timeout | Error banner with retry button | Retry API call |
| Success | CONFIG loaded, all sections have data | Render KPIs + all charts | — |
| Partial | Some sections have data, others empty | Render available sections, show "Incomplete" badge on empty sections | User edits missing sections |

### Route: `/dashboard/budget` (Budget Profile)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Loading | Excel upload in progress (parsing) | Spinner overlay on drop zone | → Success or Error |
| Empty | No fixed/variable expenses, no budget chart data | Drop zone: "Upload CSV or Excel to load budget" | User uploads file |
| Error | Excel parsing failed (invalid format) | Error message in drop zone: "Invalid file format. Expected columns: Category, Monthly Amount" | Retry upload |
| Success | Expenses loaded, budget chart renders | Budget table + pie chart | — |
| Partial | Some expense categories present, chart data incomplete | Show expense table, chart in progress | User adds more expenses |

### Route: `/dashboard/debt` (Debt Payoff)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Loading | Calculations running (debt avalanche simulation) | Chart skeleton (2 charts, table) | → Success or Error |
| Empty | No active debts, lump sum = 0 | Hero section: "No debts to track. Add a debt to get started." | User edits → add debt |
| Error | Calculation engine error (e.g., negative balance after payoff) | Error banner: "Debt calculation failed. Check your inputs and try again." | User reviews inputs |
| Success | Debts loaded, avalanche chart + payoff table rendered | Full debt section with all charts/tables | — |

### Route: `/dashboard/super` (Super Projection)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Loading | Projection calculations running (Fixture A: 35 years × 12 months) | 3 skeleton cards (Matty balance, Partner balance, combined) + chart | → Success or Error |
| Empty | User ages exceed preservation age + projection years | Hero: "Super projection complete. All balances accessible." | Render retirement readiness instead |
| Error | Calculation engine error (invalid contribution rate) | Error banner with retry | User fixes inputs |
| Success | Projection complete, all charts render | KPI cards + multi-line chart | — |

### Route: `/dashboard/property` (Property & Deposit)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Loading | Deposit comparison calculation in progress | Scenario grid skeleton (3 columns) | → Success or Error |
| Empty | No property value or purchase scenario set | Hero: "Configure a property purchase scenario to see projections." | User edits property config |
| Error | Invalid mortgage parameters (e.g., 0% interest) | Error banner: "Check mortgage interest rate and try again." | User fixes inputs |
| Success | Deposit scenarios rendered (10%, 15%, 20% options) | Full grid with comparison metrics | — |

### Route: `/dashboard/family-property` (Family Trust Property)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Empty | No family property configured | Hero: "Configure family trust property to see projections." | User adds property |
| Success | Property value + loan balance set | Rental income chart + equity projection | — |

### Route: `/dashboard/children` (Family Planning)

| State | Condition | UI Behaviour | Next Action |
|-------|-----------|--------------|-------------|
| Empty | No children in CONFIG | Hero: "Add children to track education and childcare costs." | User adds child |
| Success | Children added, costs calculated | Table of children + annual cost timeline | — |

---

## Skeleton Loaders

Skeleton loaders use Tailwind's `animate-pulse` class and approximate the final layout without blocking render. They are shown for 200–1000ms (depending on calculation complexity) before the real data loads.

### KPI Card Skeleton

```typescript
// components/KPISkeleton.tsx

export function KPISkeleton() {
  return (
    <div className="kpi animate-pulse">
      <div className="h-3 w-20 bg-slate-700 rounded mb-4" />
      <div className="h-8 w-32 bg-slate-700 rounded mb-2" />
      <div className="h-2 w-24 bg-slate-700 rounded" />
    </div>
  );
}
```

### Chart Skeleton

```typescript
// components/ChartSkeleton.tsx

export function ChartSkeleton() {
  return (
    <div className="card">
      <div className="h-4 w-40 bg-slate-700 rounded mb-6 animate-pulse" />
      <div className="h-64 bg-slate-700 rounded animate-pulse" />
    </div>
  );
}
```

### Grid Skeleton (Multiple Cards)

```typescript
// components/KPIGridSkeleton.tsx

export function KPIGridSkeleton({ count = 3 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <KPISkeleton key={i} />
      ))}
    </div>
  );
}
```

### Table Skeleton

```typescript
// components/TableSkeleton.tsx

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}>
              <div className="h-3 w-20 bg-slate-700 rounded animate-pulse" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, row) => (
          <tr key={row}>
            {Array.from({ length: cols }).map((_, col) => (
              <td key={col}>
                <div className="h-3 w-16 bg-slate-700 rounded animate-pulse" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## First-Run Empty State & Onboarding

When a new user signs up or has no CONFIG yet, they see a guided onboarding experience rather than blank charts:

```typescript
// components/OnboardingCTA.tsx

export function OnboardingCTA() {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-4">📊</div>
      <h2 className="text-xl font-bold mb-2">
        Welcome to RetireAU Dashboard
      </h2>
      <p className="text-muted mb-6 max-w-sm mx-auto">
        Complete your profile and add your financial data to see projections.
      </p>
      <Link href="/dashboard/profile" className="btn btn-primary">
        Get Started
      </Link>
    </div>
  );
}
```

**Flow**:

1. User signs up → Clerk redirects to `/dashboard`
2. `/dashboard/page.tsx` detects empty CONFIG
3. Show `<OnboardingCTA />` instead of blank KPI grid
4. User clicks "Get Started" → navigates to `/dashboard/profile`
5. User fills in profile data (name, age, salary, super balance)
6. On save, redirect back to `/dashboard` which now shows skeleton loaders while projections calculate
7. After 500–1000ms, projections render and user sees their first dashboard

---

## Partial Data States

When some sections have data and others don't (e.g., super data present, but no debts):

```typescript
// Example: Dashboard with partial data

export function DashboardOverview() {
  const hasProfile = useConfig((state) => state.profile.user1.age > 0);
  const hasDebts = useConfig((state) => state.debts.active.length > 0);
  const hasExpenses = useConfig(
    (state) =>
      state.expenses.fixed.length > 0 || state.expenses.variable.length > 0
  );

  return (
    <div>
      {hasProfile ? (
        <SuperProjectionCard />
      ) : (
        <EmptyStateCard
          title="Super Projection"
          message="Add your super balance to see projections"
          actionLabel="Edit Profile"
          actionHref="/dashboard/profile"
        />
      )}

      {hasDebts ? (
        <DebtPayoffCard />
      ) : (
        <EmptyStateCard
          title="Debt Payoff"
          message="No debts to track"
          actionLabel="Add Debt"
          actionHref="/dashboard/debt?edit=true"
        />
      )}

      {hasExpenses ? (
        <BudgetCard />
      ) : (
        <EmptyStateCard
          title="Budget Profile"
          message="Upload a CSV or add expenses to get started"
          actionLabel="Upload Budget"
          actionHref="/dashboard/budget"
        />
      )}
    </div>
  );
}
```

---

## Error Boundaries

React error boundaries catch runtime errors and display a fallback UI. Place them at route level and per-chart:

```typescript
// app/dashboard/error.tsx (Catch route-level errors)

'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry (defer to docs/19-observability.md)
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="card bg-red-900 bg-opacity-10 border border-red-700 p-6">
      <h2 className="text-red-500 font-bold mb-2">
        Something went wrong
      </h2>
      <p className="text-sm mb-4">
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={reset}
        className="btn btn-secondary text-sm"
      >
        Try Again
      </button>
    </div>
  );
}
```

```typescript
// components/ChartErrorBoundary.tsx (Per-chart error boundary)

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  chartName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`${this.props.chartName} error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm mb-2">
            {this.props.chartName} failed to load
          </p>
          <p className="text-xs text-red-500">
            {this.state.error?.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage**:
```typescript
export function SuperProjectionSection() {
  return (
    <ChartErrorBoundary chartName="Super Projection">
      <SuperProjectionChart />
    </ChartErrorBoundary>
  );
}
```

---

## Offline Detection & Banner

Detect offline state and show a non-blocking banner:

```typescript
// hooks/useOnlineStatus.ts

import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// components/OfflineBanner.tsx

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="alert alert-warn fixed bottom-4 right-4 max-w-sm">
      <span className="text-sm">
        🌐 You're offline. Changes will sync when you're back online.
      </span>
    </div>
  );
}
```

---

## Chart-Specific Loading Patterns

### Avoid Flash-of-Empty-Chart

Pre-size the canvas container so the layout doesn't shift when the chart loads:

```typescript
// components/SuperProjectionChart.tsx

export function SuperProjectionChart() {
  const isLoading = useIsCalculating('superProjection');
  const data = useSuperProjectionData();

  return (
    <ChartErrorBoundary chartName="Super Projection">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">Super Projection</h2>
        
        {/* Pre-sized container prevents layout shift */}
        <div style={{ position: 'relative', height: '300px', width: '100%' }}>
          {isLoading && <ChartSkeleton />}
          {!isLoading && data && (
            <Chart
              type="line"
              data={data}
              options={CHART_OPTIONS}
            />
          )}
        </div>
      </div>
    </ChartErrorBoundary>
  );
}
```

### Maintain Aspect Ratio

For responsive charts, use `aspect-video` or explicit ratios:

```typescript
<div className="aspect-video w-full">
  <canvas id="superChart" />
</div>
```

---

## 404 and 500 Pages

### Not Found (404)

```typescript
// app/not-found.tsx

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted mb-6">Page not found</p>
      <Link href="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
```

### Server Error (500)

```typescript
// app/error.tsx (Global error boundary)

'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-red-500 mb-2">500</h1>
      <p className="text-muted mb-6">Something went wrong</p>
      <button onClick={reset} className="btn btn-primary">
        Try Again
      </button>
    </div>
  );
}
```

---

## Toast Notifications

Use `sonner` (or `react-hot-toast`) for temporary notifications:

```typescript
// lib/toast.ts

import { toast } from 'sonner';

export function showToast(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning'
) {
  const options = {
    position: 'bottom-right' as const,
    duration: 3000,
  };

  switch (type) {
    case 'success':
      toast.success(message, options);
      break;
    case 'error':
      toast.error(message, options);
      break;
    case 'warning':
      toast.custom(
        (t) => (
          <div className="alert alert-warn">
            {message}
            <button onClick={() => toast.dismiss(t)}>✕</button>
          </div>
        ),
        options
      );
      break;
    case 'info':
    default:
      toast(message, options);
  }
}
```

**Toast types**:
- **Info**: Neutral updates (e.g., "Configuration loaded")
- **Success**: Action completed (e.g., "Debt updated")
- **Warning**: Caution needed (e.g., "High mortgage payment")
- **Error**: Failed action (e.g., "Save failed")

---

## Example State Flow: Edit & Save

User flow when editing and saving fortnightly income (from `docs/13-edit-mode-forms.md` example):

1. **Initial State**: Success — income displayed, edit button visible
2. **User clicks Edit**: Section enters edit mode, form renders with input
3. **User types value**: Debounce timer starts (400ms)
4. **Debounce completes**: API call fires, toast shows "Saving..."
5. **API Success**: Store updates optimistically, toast: "Income saved ✓"
6. **API Failure**: Store rolls back, toast: "Save failed. Retry?"
7. **User clicks Retry**: API call fires again
8. **User clicks Cancel**: Form closes, unsaved changes discarded

```typescript
// Sequence diagram (pseudo-code)

// 1. Initial render
Success: <IncomeCard value={3850} onEditClick={...} />

// 2. Edit click
EditMode: <IncomeEditForm defaultValue={3850} />

// 3. Input change
Input onChange → debouncedSave(3900)

// 4. Debounce timeout
showToast('Saving...', 'info')
await fetch('/api/config', { data: { fortnightlyNet: 3900 } })

// 5a. API success
updateStore(3900)
showToast('Income saved ✓', 'success')

// 5b. API error
rollbackStore(3850)
showToast('Save failed: Network error. Retry?', 'error')
```

---

## Copy Deck (User-Facing Strings)

All user-facing strings for empty, error, loading, and success states are listed below. These are hardcoded in components or pulled from a translation file.

### Empty States

| Context | String |
|---------|--------|
| First-run onboarding | "Welcome to RetireAU Dashboard. Complete your profile and add your financial data to see projections." |
| No debts | "No debts to track. Add a debt to get started." |
| No expenses | "Upload a CSV or add expenses to get started." |
| No property | "Configure a property purchase scenario to see projections." |
| No family property | "Configure family trust property to see projections." |
| No children | "Add children to track education and childcare costs." |
| Super calculation complete | "Super projection complete. All balances accessible." |

### Loading States

| Context | String |
|---------|--------|
| Initial dashboard load | "Loading dashboard..." |
| Calculating projections | "Calculating projections..." |
| Parsing Excel file | "Parsing your budget file..." |
| Cloud sync in progress | "Syncing with cloud..." |

### Success States

| Context | String |
|---------|--------|
| Income saved | "Income saved ✓" |
| Debt added | "Debt added" |
| Expense updated | "Expense updated" |
| Config imported | "Configuration imported successfully" |
| Cloud sync complete | "Synced with cloud" |

### Error States

| Context | String |
|---------|--------|
| Network error | "Network error. Check your connection and try again." |
| API error (generic) | "Something went wrong. Retry?" |
| Validation error | "Check your inputs and try again." |
| File upload error | "Invalid file format. Expected: CSV or Excel" |
| Calculation error | "Calculation failed. Review your inputs." |
| Cloud conflict | "Configuration changed on another device. Refresh and try again." |
| Offline | "You're offline. Changes will sync when you're back online." |
| Rate limited | "Too many requests. Please wait a moment." |

### Warnings

| Context | String |
|---------|--------|
| High debt ratio | "Debt payments exceed 50% of income" |
| Low super balance | "Super balance is below expected for your age" |
| Unsaved changes | "You have unsaved changes. Discard them?" |
| Deprecation warning | "Your configuration format is outdated. Upgrade?" |

### Info Messages

| Context | String |
|---------|--------|
| Preservation age milestone | "You can access your super from age 60" |
| Mortgage approaching payoff | "Your mortgage will be paid off in {years} years" |
| Children school costs starting | "{child} will start school next year" |

---

## Summary

- **State matrix** defines loading, empty, error, success, and partial states for every route/section.
- **Skeleton loaders** use `animate-pulse` and pre-sized containers to avoid layout shift.
- **First-run onboarding** shows CTA instead of blank charts; guides new users through profile setup.
- **Partial data** shows available sections and "incomplete" badges on empty sections.
- **Error boundaries** catch route-level and per-chart errors with fallback UI.
- **Offline detection** shows non-blocking banner via `navigator.onLine`.
- **Chart-specific loading** pre-sizes containers and maintains aspect ratios.
- **404/500 pages** use standard Next.js error boundaries.
- **Toast notifications** (sonner) display info/success/error/warning messages bottom-right.
- **Copy deck** provides all user-facing strings for every state.

Reference `docs/13-edit-mode-forms.md` for form error handling patterns and `docs/15-accessibility.md` for accessible error messages.
