# State Management — RetireAU Dashboard

## Overview

RetireAU uses Zustand for client-side state management with automatic localStorage persistence. The store is organised into logical slices mirroring the CONFIG structure, enabling fine-grained subscriptions and preventing unnecessary component re-renders. This document specifies the store shape, actions, selectors, hydration flow, and anti-patterns to avoid.

---

## Why Zustand

Zustand was chosen over Redux or Context API for three reasons:

1. **Minimal boilerplate**: No action creators, reducers, or middleware — just slices with methods. Configuration is explicit without ceremony.
2. **Composition over nesting**: Slices remain flat and independently testable; no deeply nested dispatch flows.
3. **Granular subscriptions**: Components subscribe to exact selectors, not the entire state tree. Prevents re-renders when unrelated config fields change.

---

## Store Architecture — Slices

The Zustand store is split into eight logical slices, each managing one domain of the CONFIG. Each slice is a separate hook, composed together in a root `useConfig` hook.

### Slice 1: Profile

**Purpose**: Personal data, ages, salaries, super balances, projection assumptions.

**Shape**:
```typescript
interface ProfileSlice {
  profile: {
    currentYear: number;
    projectionYears: number;
    preservationAge: number;
    contribTaxRate: number;
    concessionalCap: number;
    user1: {
      name: string;
      age: number;
      superBalance: number;
      salary: number;
      superRate: number;
      bonus: number;
      futureSalary: number;
      futureSuperRate: number;
      switchYear: number;
    };
    user2: {
      name: string;
      age: number;
      superBalance: number;
      salary: number;
      employer?: string;
    };
  };
}
```

**Actions**:
```typescript
setProfile: (updates: Partial<ProfileSlice['profile']>) => void;
setUser1: (updates: Partial<ProfileSlice['profile']['user1']>) => void;
setUser2: (updates: Partial<ProfileSlice['profile']['user2']>) => void;
setProjectionYears: (years: number) => void;
setPreservationAge: (age: number) => void;
rollForward: () => void; // increments profile.currentYear by 1 — called by YearRolloverBanner
```

> **`profile.currentYear` and year rollover (Q9)**: `currentYear` is set once at config creation and is not auto-updated on subsequent logins. The state slice must expose a `rollForward()` action that increments `currentYear` by 1 (and marks `meta.isDirty`). A `useYearRollover()` hook checks `state.profile.currentYear < new Date().getFullYear()` and exposes the `rollForward()` action to the `YearRolloverBanner` component, which surfaces the one-click upgrade prompt. The banner is the primary UX path; the form field (see `docs/13-edit-mode-forms.md`) is an editable fallback only.

**Selectors** (examples):
```typescript
useUser1Age: () => number;
useUser2Age: () => number;
useProjectionYears: () => number;
useUser1NetIncome: () => number; // derived, references other slices
useTotalMonthlyIncome: () => number; // derived
```

---

### Slice 2: Debts

**Purpose**: Active loans, paid-off records, lump sum available for payoff.

**Shape**:
```typescript
interface DebtSlice {
  debts: {
    active: Array<{
      id: string; // unique identifier for add/remove operations
      name: string;
      balance: number;
      payment: number;
      rate: number;
      color: string;
    }>;
    paidOff: Array<{
      name: string;
      finalPayment: number;
      datePaid: string;
    }>;
    lumpSum: number;
    lumpSumBreakdown: string;
    monthlySurplus: number;
  };
}
```

**Actions**:
```typescript
addDebt: (debt: Omit<DebtSlice['debts']['active'][0], 'id'>) => void;
removeDebt: (id: string) => void;
updateDebt: (id: string, updates: Partial<DebtSlice['debts']['active'][0]>) => void;
setLumpSum: (amount: number) => void;
setMonthlySurplus: (amount: number) => void;
addPaidOffDebt: (debt: DebtSlice['debts']['paidOff'][0]) => void;
```

**Selectors** (examples):
```typescript
useActiveDebts: () => DebtSlice['debts']['active'];
useLumpSum: () => number;
useMonthlySurplus: () => number;
useTotalDebtBalance: () => number; // derived sum
useHighestRateDebt: () => DebtSlice['debts']['active'][0] | null; // derived
```

---

### Slice 3: Expenses

**Purpose**: Fixed and variable expenses, budget chart data for rendering.

**Shape**:
```typescript
interface ExpensesSlice {
  expenses: {
    fixed: Array<{
      category: string;
      monthly: number;
    }>;
    variable: Array<{
      category: string;
      monthly: number;
    }>;
    budgetChart: {
      categories: string[];
      amounts: number[];
      colors: string[];
      monthlyTrend: {
        months: string[];
        datasets: Array<{
          label: string;
          data: number[];
          color: string;
        }>;
      };
    };
  };
}
```

**Actions**:
```typescript
setFixedExpenses: (expenses: ExpensesSlice['expenses']['fixed']) => void;
setVariableExpenses: (expenses: ExpensesSlice['expenses']['variable']) => void;
addFixedExpense: (expense: ExpensesSlice['expenses']['fixed'][0]) => void;
removeFixedExpense: (category: string) => void;
updateFixedExpense: (category: string, updates: Partial<ExpensesSlice['expenses']['fixed'][0]>) => void;
setBudgetChart: (data: ExpensesSlice['expenses']['budgetChart']) => void;
```

**Selectors** (examples):
```typescript
useFixedExpenses: () => ExpensesSlice['expenses']['fixed'];
useVariableExpenses: () => ExpensesSlice['expenses']['variable'];
useTotalFixedExpenses: () => number; // derived sum
useTotalVariableExpenses: () => number; // derived sum
useBudgetChart: () => ExpensesSlice['expenses']['budgetChart'];
```

---

### Slice 4: Property

**Purpose**: Primary residence purchase scenario parameters.

**Shape**:
```typescript
interface PropertySlice {
  property: {
    currentValue: number;
    desiredValue: number;
    purchaseYear: number;
    depositPercentage: number;
    depositAmount: number;
    depreciationRate: number;
  };
}
```

**Actions**:
```typescript
setProperty: (updates: Partial<PropertySlice['property']>) => void;
setCurrentPropertyValue: (value: number) => void;
setDesiredPropertyValue: (value: number) => void;
```

**Selectors**:
```typescript
useProperty: () => PropertySlice['property'];
useCurrentPropertyValue: () => number;
useDesiredPropertyValue: () => number;
usePropertyDepositRequired: () => number; // derived
```

---

### Slice 5: Mortgage

**Purpose**: Loan terms, repayment schedule, interest-only period.

**Shape**:
```typescript
interface MortgageSlice {
  mortgage: {
    currentBalance: number;
    interestRate: number;
    monthsRemaining: number;
    monthlyPayment: number;
    repaymentMode: 'interestOnly' | 'principalAndInterest';
    interestOnlyPeriod: number; // years
  };
}
```

**Actions**:
```typescript
setMortgage: (updates: Partial<MortgageSlice['mortgage']>) => void;
setMortgageBalance: (balance: number) => void;
setInterestRate: (rate: number) => void;
setRepaymentMode: (mode: 'interestOnly' | 'principalAndInterest') => void;
```

**Selectors**:
```typescript
useMortgage: () => MortgageSlice['mortgage'];
useMortgagePayment: () => number;
useMortgageRemainingYears: () => number; // derived
```

---

### Slice 6: Family Property

**Purpose**: Inherited/trust property with loan and rental income.

**Shape**:
```typescript
interface FamilyPropertySlice {
  familyProperty: {
    value: number;
    loanBalance: number;
    monthlyRentalIncome: number;
    appreciationRate: number;
    ownershipPercentage: number; // 0–1
  };
}
```

**Actions**:
```typescript
setFamilyProperty: (updates: Partial<FamilyPropertySlice['familyProperty']>) => void;
setFamilyPropertyValue: (value: number) => void;
setFamilyPropertyLoanBalance: (balance: number) => void;
setMonthlyRentalIncome: (income: number) => void;
```

**Selectors**:
```typescript
useFamilyProperty: () => FamilyPropertySlice['familyProperty'];
useFamilyPropertyValue: () => number;
useMonthlyRentalIncome: () => number;
useOwnedPropertyValue: () => number; // derived (value × ownershipPercentage)
```

---

### Slice 7: Children

**Purpose**: School costs, childcare, arrival years.

**Shape**:
```typescript
interface ChildrenSlice {
  children: Array<{
    id: string;
    name: string;
    dateOfBirth: string; // ISO 8601
    schoolCompletionAge: number;
    estimatedCostPerYear: number;
  }>;
}
```

**Actions**:
```typescript
addChild: (child: Omit<ChildrenSlice['children'][0], 'id'>) => void;
removeChild: (id: string) => void;
updateChild: (id: string, updates: Partial<ChildrenSlice['children'][0]>) => void;
```

**Selectors**:
```typescript
useChildren: () => ChildrenSlice['children'];
useChildCount: () => number;
useTotalChildCosts: (year: number) => number; // derived per year
```

---

### Slice 8: Defaults & Meta

**Purpose**: Fallback assumptions, schema version, edit mode flags, sync state.

**Shape**:
```typescript
interface DefaultsSlice {
  defaults: {
    interestRate: number; // super/investment assumption
    inflationRate: number;
    taxRate: number;
    salaryGrowthRate: number;
  };
  meta: {
    schemaVersion: number;
    lastModified: string; // ISO 8601
    isEditMode: boolean;
    isDirty: boolean; // unsaved changes
    lastSyncedAt?: string;
    syncStatus: 'idle' | 'syncing' | 'error';
    syncError?: string;
  };
}
```

**Actions**:
```typescript
setDefaults: (updates: Partial<DefaultsSlice['defaults']>) => void;
setEditMode: (enabled: boolean) => void;
setDirty: (dirty: boolean) => void;
setSyncStatus: (status: 'idle' | 'syncing' | 'error', error?: string) => void;
setLastSyncedAt: (timestamp: string) => void;
```

**Selectors**:
```typescript
useDefaults: () => DefaultsSlice['defaults'];
useIsEditMode: () => boolean;
useIsDirty: () => boolean;
useSyncStatus: () => DefaultsSlice['meta']['syncStatus'];
```

---

## The useConfig Hook

The root hook composes all slices and is the primary API for components:

```typescript
import create from 'zustand';
import { persist } from 'zustand/middleware';
import { createProfileSlice, createDebtSlice, ... } from './slices';

interface ConfigStore extends
  ProfileSlice,
  DebtSlice,
  ExpensesSlice,
  PropertySlice,
  MortgageSlice,
  FamilyPropertySlice,
  ChildrenSlice,
  DefaultsSlice {}

export const useConfig = create<ConfigStore>()(
  persist(
    (set, get) => ({
      ...createProfileSlice(set, get),
      ...createDebtSlice(set, get),
      ...createExpensesSlice(set, get),
      ...createPropertySlice(set, get),
      ...createMortgageSlice(set, get),
      ...createFamilyPropertySlice(set, get),
      ...createChildrenSlice(set, get),
      ...createDefaultsSlice(set, get),
    }),
    {
      name: 'retire-au-config',
      partialize: (state) => ({
        profile: state.profile,
        debts: state.debts,
        expenses: state.expenses,
        property: state.property,
        mortgage: state.mortgage,
        familyProperty: state.familyProperty,
        children: state.children,
        defaults: state.defaults,
        // Exclude meta.isEditMode, meta.syncStatus (transient)
        meta: {
          schemaVersion: state.meta.schemaVersion,
          lastModified: state.meta.lastModified,
        },
      }),
    }
  )
);
```

**Return type contract**:
```typescript
{
  // Slices (state + actions)
  profile, setProfile, setUser1, setUser2, ...
  debts, addDebt, removeDebt, updateDebt, ...
  expenses, setFixedExpenses, ...
  // ... etc for all slices
  
  // Selectors (computed)
  useUser1Age: () => number,
  useTotalMonthlyIncome: () => number,
  // ... etc
}
```

---

## Subscription Pattern & Selectors

To avoid re-renders, components must subscribe to **specific selectors**, not the entire store:

```typescript
// ✓ Good: Subscribe only to needed value
const user1Age = useConfig((state) => state.profile.user1.age);

// ✓ Good: Use pre-built selector
const user1Age = useConfig(useUser1Age);

// ✗ Bad: Re-renders on any config change
const config = useConfig();
const user1Age = config.profile.user1.age;
```

**Pre-built selectors** are defined in `lib/selectors.ts`:

```typescript
export const useUser1Age = (state: ConfigStore) =>
  state.profile.user1.age;

export const useTotalMonthlyIncome = (state: ConfigStore) => {
  const user1Gross = state.profile.user1.salary / 12;
  const user2Gross = state.profile.user2.salary / 12;
  const totalFixed = state.expenses.fixed.reduce(
    (sum, exp) => sum + exp.monthly, 0
  );
  return user1Gross + user2Gross - totalFixed; // simplified
};

export const useTotalDebtBalance = (state: ConfigStore) =>
  state.debts.active.reduce((sum, debt) => sum + debt.balance, 0);
```

**Selector naming convention**: `use[Domain][Metric]`. Examples:
- `useUser1Age`
- `useMortgagePayment`
- `useTotalMonthlyIncome`
- `useHighestRateDebt`

---

## Persona Alias Selectors

Display aliases (`matty` / `partner`) are exposed **exclusively** via `lib/selectors/personas.ts`. No other file in the codebase references these names. The persisted schema and Zustand store always use `user1` / `user2`.

```typescript
// lib/selectors/personas.ts

import { useConfig } from '@/hooks/useConfig';

/**
 * Returns state.profile.user1 with display alias context.
 * This is the ONLY place the name "matty" appears in code.
 */
export const useMatty = () => useConfig((state) => state.profile.user1);

/**
 * Returns state.profile.user2 with display alias context.
 * This is the ONLY place the name "partner" appears in code.
 */
export const usePartner = () => useConfig((state) => state.profile.user2);
```

Rules:
- Components that need a display-friendly persona object import from `lib/selectors/personas.ts`.
- All other selectors and store references use `user1` / `user2` exclusively.
- The `name` field inside `user1` / `user2` carries the actual display name string at runtime — `useMatty()` / `usePartner()` are structural aliases only.

---

## Hydration Flow (SSR-Safe)

The store must hydrate from localStorage safely, avoiding hydration mismatches:

```typescript
// app/dashboard/layout.tsx (Server Component)
import { ConfigHydrator } from '@/components/ConfigHydrator';

export default function DashboardLayout({ children }) {
  return (
    <ConfigHydrator>
      {children}
    </ConfigHydrator>
  );
}

// components/ConfigHydrator.tsx (Client Component)
'use client';

import { useEffect, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import defaultConfig from '@/lib/default-config';

export function ConfigHydrator({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const { meta, profile, setProfile, ...store } = useConfig();

  useEffect(() => {
    // Zustand's persist middleware handles localStorage load on mount
    // But verify schemaVersion and run migrations if needed
    const storedVersion = meta.schemaVersion || 1;
    if (storedVersion < CONFIG_LATEST_SCHEMA) {
      // Trigger migration (see Schema Migration section below)
      migrateConfigSchema(storedVersion, CONFIG_LATEST_SCHEMA);
    }
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <LoadingSkeleton />; // or return children with suppressHydrationWarning
  }

  return children;
}
```

---

## Conflict Resolution: localStorage vs Cloud Config

When the user signs in with Clerk, the cloud config (from `/api/config`) may conflict with the local version:

```typescript
// hooks/useCloudSync.ts (async effect)
import { useAuth } from '@clerk/nextjs';

export function useSyncOnSignIn() {
  const { userId, isSignedIn } = useAuth();
  const {
    profile, meta, setProfile, ...store
  } = useConfig();

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const syncCloudConfig = async () => {
      try {
        store.setSyncStatus('syncing');
        const response = await fetch('/api/config', {
          headers: { Authorization: `Bearer ${await getClerkToken()}` },
        });
        const { config: cloudConfig, version: cloudVersion } = await response.json();

        const localVersion = meta.lastModified;

        // Cloud is newer: prompt user
        if (cloudVersion > localVersion) {
          const userChoice = confirm(
            'You have changes on another device. Load cloud config?'
          );
          if (userChoice) {
            // Replace local with cloud
            Object.keys(cloudConfig).forEach(key => {
              store[`set${capitalise(key)}`](cloudConfig[key]);
            });
          }
        }
        store.setSyncStatus('idle');
        store.setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        store.setSyncStatus('error', error.message);
      }
    };

    syncCloudConfig();
  }, [isSignedIn, userId]);
}
```

---

## Schema Migration Hook

When CONFIG schema evolves (new fields, renamed fields, type changes), the store must migrate on load:

```typescript
// lib/config-migrations.ts

const MIGRATIONS: Record<number, (config: any) => any> = {
  1: (config) => config, // baseline
  2: (config) => ({
    ...config,
    // Example: Added profile.user1.fortnightlyNet in v2
    profile: {
      ...config.profile,
      user1: {
        ...config.profile.user1,
        fortnightlyNet: config.profile.user1.salary / 26,
      },
    },
  }),
  3: (config) => ({
    ...config,
    // Example: Split mortgage into separate slice
    mortgage: {
      currentBalance: config.currentMortgageBalance,
      interestRate: config.mortgageInterestRate,
      monthsRemaining: config.mortgageMonthsRemaining,
      // ... etc
    },
    // Remove old top-level fields
    currentMortgageBalance: undefined,
    mortgageInterestRate: undefined,
    mortgageMonthsRemaining: undefined,
  }),
};

export function migrateConfigSchema(fromVersion: number, toVersion: number, config: any) {
  let result = config;
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    if (MIGRATIONS[v]) {
      result = MIGRATIONS[v](result);
    }
  }
  return result;
}
```

In `ConfigHydrator`, on mount:
```typescript
if (storedVersion < CONFIG_LATEST_SCHEMA) {
  const migratedConfig = migrateConfigSchema(storedVersion, CONFIG_LATEST_SCHEMA, profile);
  setProfile(migratedConfig.profile);
  // ... update other slices
  store.setMeta({ ...meta, schemaVersion: CONFIG_LATEST_SCHEMA });
}
```

---

## localStorage Persistence Rules

**Key name**: `retire-au-config`

**Debounce**: 400ms after any state mutation before writing to localStorage.

**What to persist**:
- All financial data (profile, debts, expenses, property, mortgage, familyProperty, children, defaults)
- `meta.schemaVersion` and `meta.lastModified`

**What NOT to persist** (transient, reset on app reload):
- `meta.isEditMode`
- `meta.syncStatus`
- `meta.syncError`

```typescript
// Zustand persist middleware (already shown above) handles this via partialize
```

---

## Store Reset, Import, and Empty-State Bootstrap

### Reset to Defaults

```typescript
const resetConfig = () => {
  const defaults = getDefaultConfig();
  setProfile(defaults.profile);
  setDebts(defaults.debts);
  // ... etc for all slices
  setMeta({
    schemaVersion: CONFIG_LATEST_SCHEMA,
    lastModified: new Date().toISOString(),
    isEditMode: false,
    isDirty: false,
  });
  localStorage.removeItem('retire-au-config');
};
```

### Import from JSON

```typescript
const importConfig = (jsonFile: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const imported = JSON.parse(e.target.result);
    const migrated = migrateConfigSchema(
      imported.meta.schemaVersion,
      CONFIG_LATEST_SCHEMA,
      imported
    );
    // Apply to store
    Object.entries(migrated).forEach(([key, value]) => {
      if (typeof store[`set${capitalise(key)}`] === 'function') {
        store[`set${capitalise(key)}`](value);
      }
    });
    setDirty(true);
  };
  reader.readAsText(jsonFile);
};
```

### Export to JSON

```typescript
const exportConfig = () => {
  const state = useConfig.getState();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retire-au-config-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};
```

### New User Bootstrap

When a new user signs up (no prior config):

```typescript
// app/onboarding/page.tsx
'use client';

import { useConfig } from '@/hooks/useConfig';
import { getDefaultConfig } from '@/lib/default-config';

export default function OnboardingPage() {
  const store = useConfig();

  useEffect(() => {
    // Load defaults for all slices
    const defaults = getDefaultConfig();
    store.setProfile(defaults.profile);
    store.setDebts(defaults.debts);
    // ... etc
  }, []);

  return <OnboardingForm />;
}
```

---

## TypeScript Definitions

All slice types are defined in `lib/types.ts` and re-exported from `hooks/useConfig.ts`:

```typescript
// lib/types.ts

export interface ProfileData {
  currentYear: number;
  projectionYears: number;
  preservationAge: number;
  contribTaxRate: number;
  concessionalCap: number;
  user1: {
    name: string;
    age: number;
    superBalance: number;
    salary: number;
    superRate: number;
    bonus: number;
    futureSalary: number;
    futureSuperRate: number;
    switchYear: number;
  };
  user2: {
    name: string;
    age: number;
    superBalance: number;
    salary: number;
    employer?: string;
  };
}

export interface DebtData {
  active: Array<{
    id: string;
    name: string;
    balance: number;
    payment: number;
    rate: number;
    color: string;
  }>;
  paidOff: Array<{
    name: string;
    finalPayment: number;
    datePaid: string;
  }>;
  lumpSum: number;
  lumpSumBreakdown: string;
  monthlySurplus: number;
}

// ... remaining types
```

---

## Selector Examples

### Simple Property Access

```typescript
const user1Age = useConfig((state) => state.profile.user1.age);
```

### Derived Computation

```typescript
const useTotalMonthlyIncome = () =>
  useConfig((state) => {
    const user1Monthly = state.profile.user1.salary / 12;
    const user2Monthly = state.profile.user2.salary / 12;
    return user1Monthly + user2Monthly;
  });
```

### Array Filtering

```typescript
const useHighestRateDebt = () =>
  useConfig((state) =>
    state.debts.active.reduce((highest, current) =>
      current.rate > highest.rate ? current : highest
    ) || null
  );
```

### Cross-Slice Reference

```typescript
const useMortgageAffordability = () =>
  useConfig((state) => {
    const monthlyIncome = state.profile.user1.salary / 12 + state.profile.user2.salary / 12;
    const monthlyPayment = state.mortgage.monthlyPayment;
    return monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 0;
  });
```

---

## Anti-Patterns to Avoid

### 1. Storing Derived Values

❌ **Bad**: Calculate in render, store result
```typescript
const store = useConfig();
const totalDebts = store.debts.active.reduce((sum, d) => sum + d.balance, 0);
store.setTotalDebts(totalDebts); // Don't do this
```

✓ **Good**: Compute on read via selector
```typescript
const useTotalDebtBalance = () =>
  useConfig((state) =>
    state.debts.active.reduce((sum, d) => sum + d.balance, 0)
  );
```

### 2. Over-Subscribing

❌ **Bad**: Component re-renders on any config change
```typescript
export function BudgetCard() {
  const config = useConfig(); // Subscribes to entire store
  return <div>{config.profile.user1.salary}</div>;
}
```

✓ **Good**: Subscribe to specific value
```typescript
export function BudgetCard() {
  const salary = useConfig((state) => state.profile.user1.salary);
  return <div>{salary}</div>;
}
```

### 3. Closures Over Stale State

❌ **Bad**: Capturing state in async without dependency array
```typescript
const handleSave = async () => {
  const config = useConfig.getState();
  setTimeout(() => {
    // config is stale after 1s
    saveToCloud(config);
  }, 1000);
};
```

✓ **Good**: Read state at call time
```typescript
const handleSave = async () => {
  setTimeout(async () => {
    const freshConfig = useConfig.getState();
    saveToCloud(freshConfig);
  }, 1000);
};
```

---

## Testing Zustand Slices

Testing is done with Vitest and the `immer` middleware (optional):

```typescript
// __tests__/store.test.ts

import { renderHook, act } from '@testing-library/react';
import { useConfig } from '@/hooks/useConfig';
import { fixtureA } from '@/tests/fixtures/fixture-a';

describe('useConfig store', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useConfig.setState(fixtureA);
  });

  it('updates user1 age', () => {
    const { result } = renderHook(() => useConfig());
    
    act(() => {
      result.current.setUser1({ age: 40 });
    });

    expect(result.current.profile.user1.age).toBe(40);
  });

  it('adds a debt', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.addDebt({
        name: 'New Car',
        balance: 50000,
        payment: 500,
        rate: 0.07,
        color: '#f87171',
      });
    });

    expect(result.current.debts.active).toHaveLength(3); // 2 existing + 1 new
  });

  it('computes total monthly income correctly', () => {
    const { result } = renderHook(() => useConfig(
      (state) => state.profile.user1.salary + state.profile.user2.salary
    ));

    expect(result.current).toBe(fixtureA.profile.user1.salary + fixtureA.profile.user2.salary);
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('retire-au-config', JSON.stringify(fixtureA));
    
    const { result } = renderHook(() => useConfig());
    
    expect(result.current.profile.user1.age).toBe(fixtureA.profile.user1.age);
  });
});
```

---

## Summary

- **Eight logical slices** divide CONFIG into independent domains (Profile, Debts, Expenses, Property, Mortgage, FamilyProperty, Children, Defaults).
- **useConfig hook** composes slices and provides both state and actions.
- **Selectors** ensure fine-grained subscriptions and prevent unnecessary re-renders.
- **localStorage persistence** is automatic via Zustand's persist middleware, debounced 400ms, excluding transient meta fields.
- **Schema migrations** run on hydration to upgrade old CONFIG versions.
- **Cloud sync** merges local and cloud config with conflict detection on sign-in.
- **Anti-patterns** (storing derived values, over-subscribing, stale closures) must be avoided.
- **Testing** uses Vitest with renderHook and acts to verify slice behaviour.

Reference `docs/07-config-reference.md` for the complete CONFIG structure. Reference `docs/11-api-contracts.md` for the cloud sync payload shape.
