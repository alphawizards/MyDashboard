# Edit Mode and Form Handling — RetireAU Dashboard

## Overview

Edit mode enables users to modify configuration fields without cluttering the dashboard with permanent input elements. This document specifies the edit mode pattern (per-section, not global), which fields are editable, the form library choice (react-hook-form + Zod), debounce strategy, optimistic updates, error handling, and unsaved-changes guarding.

---

## Edit Mode Pattern

### Per-Section Edit Toggle (Recommended)

Each dashboard section (Budget Profile, Debt Payoff, Super Projection, etc.) has its own independent edit toggle, controlled via the `meta.isEditMode` flag in the Zustand store. This allows the user to edit one section while viewing read-only data in others.

```typescript
// Example: Budget Profile section
interface BudgetProfileProps {}

export function BudgetProfile() {
  const isEditMode = useConfig((state) => state.meta.isEditMode);
  const [sectionEditMode, setSectionEditMode] = useState(false);

  const handleEditClick = () => {
    setSectionEditMode(true);
  };

  const handleSaveClick = () => {
    // Validate and persist (see Form Handling section)
    setSectionEditMode(false);
  };

  const handleCancelClick = () => {
    setSectionEditMode(false);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2>Budget Profile</h2>
        {!sectionEditMode && (
          <button
            onClick={handleEditClick}
            className="btn btn-secondary"
          >
            Edit
          </button>
        )}
      </div>
      {sectionEditMode ? (
        <BudgetEditForm onSave={handleSaveClick} onCancel={handleCancelClick} />
      ) : (
        <BudgetReadOnlyView />
      )}
    </div>
  );
}
```

### Why Per-Section?

1. **Reduces cognitive load**: User edits one section at a time.
2. **Independent validation**: Each form validates only its own fields.
3. **Granular unsaved-changes blocking**: Can warn when leaving a specific section with unsaved edits, not the entire app.
4. **Cleaner UX**: Sections don't toggle in and out of edit mode unpredictably.

---

## Editable vs Readonly Fields

The table below maps every top-level CONFIG path to whether it is user-editable, its input type, and validation rules. Reference `docs/07-config-reference.md` for field descriptions.

| CONFIG Path | Editable | Input Type | Validation Rule | Notes |
|-------------|----------|-----------|-----------------|-------|
| `profile.user1.name` | Yes | Text | 1–50 chars, required | Display name only, not used in calculations |
| `profile.user1.age` | Yes | Number | 18–70, required | Cannot go below 0 or above 100 |
| `profile.user1.superBalance` | Yes | Currency | ≥ 0, required | AUD, no cents in UI (rounded to $1) |
| `profile.user1.salary` | Yes | Currency | ≥ 0, required | Gross annual, AUD |
| `profile.user1.superRate` | Yes | Percentage | 0–100%, required | Employer contribution rate (e.g., "14%") |
| `profile.user1.bonus` | Yes | Percentage | 0–100%, optional | Expected annual bonus as % of salary |
| `profile.user1.futureSalary` | Yes | Currency | ≥ 0, optional | Career change scenario |
| `profile.user1.futureSuperRate` | Yes | Percentage | 0–100%, optional | Super rate after career change |
| `profile.user1.switchYear` | Yes | Year | ≥ 2026, optional | When the change takes effect |
| `profile.user2.name` | Yes | Text | 1–50 chars, required | Display name |
| `profile.user2.age` | Yes | Number | 18–70, required | Partner's current age |
| `profile.user2.superBalance` | Yes | Currency | ≥ 0, required | AUD |
| `profile.user2.salary` | Yes | Currency | ≥ 0, required | Gross annual, AUD |
| `profile.user2.employer` | Yes | Text | 1–100 chars, optional | Employer name (informational) |
| `profile.currentYear` | Yes (fallback only) | Number | ≥ 2024 | Set at config creation. On subsequent logins, if `currentYear < thisYear`, a `YearRolloverBanner` component is shown offering a one-click `rollForward()` action. The form field is editable as a fallback only. |
| `profile.projectionYears` | Yes | Number | 10–50, required | Affects all charts |
| `profile.preservationAge` | No | — | — | Fixed at 60 per Australian law |
| `profile.contribTaxRate` | No | — | — | Fixed at 0.15 (15%) per Australian law |
| `profile.concessionalCap` | No | — | — | Fixed at $30,000 per Australian law |
| `debts.active[n].name` | Yes | Text | 1–50 chars, required | Debt name |
| `debts.active[n].balance` | Yes | Currency | ≥ 0, required | Current outstanding balance |
| `debts.active[n].payment` | Yes | Currency | ≥ 0, required | Monthly payment |
| `debts.active[n].rate` | Yes | Percentage | 0–30%, required | Annual interest rate |
| `debts.active[n].color` | Yes | Colour Picker | Valid hex, required | Chart colour for this debt |
| `debts.lumpSum` | Yes | Currency | ≥ 0, required | Available lump sum for payoff |
| `debts.lumpSumBreakdown` | Yes | Text | 0–500 chars, optional | Narrative breakdown (not calculated) |
| `debts.monthlySurplus` | No | — | — | Derived from income − expenses − payments |
| `expenses.fixed[n].category` | Yes | Text | 1–50 chars, required | Expense category name |
| `expenses.fixed[n].monthly` | Yes | Currency | ≥ 0, required | Monthly cost |
| `expenses.variable[n].category` | Yes | Text | 1–50 chars, required | Expense category name |
| `expenses.variable[n].monthly` | Yes | Currency | ≥ 0, required | Monthly budget |
| `expenses.budgetChart.*` | Yes | Chart Data | As per schema | Populated from Excel upload or manual entry |
| `property.currentValue` | Yes | Currency | ≥ 0, required | Current primary residence value |
| `property.desiredValue` | Yes | Currency | ≥ 0, optional | Target property value for purchase scenario |
| `property.purchaseYear` | Yes | Year | ≥ 2026, optional | When purchase occurs |
| `property.depositPercentage` | Yes | Percentage | 0–100%, optional | Deposit % required for purchase |
| `mortgage.currentBalance` | Yes | Currency | ≥ 0, required | Current mortgage balance |
| `mortgage.interestRate` | Yes | Percentage | 0–15%, required | Annual mortgage interest rate |
| `mortgage.monthsRemaining` | Yes | Number | ≥ 0, required | Months until loan fully repaid |
| `mortgage.monthlyPayment` | No | — | — | Derived from amortisation schedule |
| `mortgage.repaymentMode` | Yes | Select | 'interestOnly' or 'principalAndInterest' | Changes repayment behaviour |
| `mortgage.interestOnlyPeriod` | Yes | Number | 0–10 years, required | Only relevant if repaymentMode === 'interestOnly' |
| `familyProperty.value` | Yes | Currency | ≥ 0, required | Trust property value |
| `familyProperty.loanBalance` | Yes | Currency | ≥ 0, required | Loan against property |
| `familyProperty.monthlyRentalIncome` | Yes | Currency | ≥ 0, optional | Monthly rent received |
| `familyProperty.appreciationRate` | Yes | Percentage | 0–10%, optional | Expected annual appreciation |
| `familyProperty.ownershipPercentage` | Yes | Percentage | 0–100%, required | % owned (0.5 = 50%) |
| `children[n].name` | Yes | Text | 1–50 chars, required | Child's name |
| `children[n].dateOfBirth` | Yes | Date | Valid ISO 8601, required | Child's date of birth |
| `children[n].schoolCompletionAge` | Yes | Number | 15–18, required | Age when school finishes |
| `children[n].estimatedCostPerYear` | Yes | Currency | ≥ 0, optional | Annual cost for education/childcare |
| `defaults.interestRate` | Yes | Percentage | 0–20%, required | Super/investment assumption |
| `defaults.inflationRate` | Yes | Percentage | 0–10%, required | Inflation assumption |
| `defaults.taxRate` | Yes | Percentage | 0–50%, required | Personal tax rate assumption |
| `defaults.salaryGrowthRate` | Yes | Percentage | 0–10%, required | Annual salary growth assumption |

---

## Form Library: react-hook-form + Zod

### Why This Stack?

- **react-hook-form**: Minimal re-renders, flexible field registration, native HTML form integration.
- **Zod**: TypeScript-first validation, composable schemas, integrates cleanly with react-hook-form.
- **Shared schemas**: API validation (backend) and client validation use the same Zod schema, reducing duplication.

### Schema Location Strategy

All Zod schemas live in `lib/schemas.ts` and are imported by both:
1. Client-side forms (react-hook-form resolver)
2. Server-side API handlers (route.ts)

This prevents validation logic drift.

```typescript
// lib/schemas.ts

import { z } from 'zod';

export const ProfileMattySchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(18).max(100),
  superBalance: z.number().nonnegative(),
  salary: z.number().nonnegative(),
  superRate: z.number().min(0).max(1),
  bonus: z.number().min(0).max(1).optional(),
  futureSalary: z.number().nonnegative().optional(),
  futureSuperRate: z.number().min(0).max(1).optional(),
  switchYear: z.number().int().min(2026).optional(),
});

export const DebtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  balance: z.number().nonnegative(),
  payment: z.number().nonnegative(),
  rate: z.number().min(0).max(0.3),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
});

export const ExpenseSchema = z.object({
  category: z.string().min(1).max(50),
  monthly: z.number().nonnegative(),
});

export const MortgageSchema = z.object({
  currentBalance: z.number().nonnegative(),
  interestRate: z.number().min(0).max(0.15),
  monthsRemaining: z.number().nonnegative().int(),
  repaymentMode: z.enum(['interestOnly', 'principalAndInterest']),
  interestOnlyPeriod: z.number().nonnegative().int().optional(),
});

export const ChildSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  schoolCompletionAge: z.number().int().min(15).max(18),
  estimatedCostPerYear: z.number().nonnegative().optional(),
});
```

---

## Debounce Strategy

### Timing Rules

- **Text inputs**: 400ms debounce before auto-save attempt
- **Number/currency inputs**: 400ms debounce
- **Select/toggle inputs**: Immediate save (no debounce)
- **Form blur event**: Flush pending saves immediately
- **Form submission (Save button)**: Immediate save with full validation

### Implementation

```typescript
// hooks/useFormDebounce.ts

import { useCallback, useRef } from 'react';

interface UseFormDebounceOptions {
  delayMs?: number;
  onSave: (values: any) => Promise<void>;
}

export function useFormDebounce({ delayMs = 400, onSave }: UseFormDebounceOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingRef = useRef<any>(null);

  const debouncedSave = useCallback((values: any) => {
    pendingRef.current = values;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      if (pendingRef.current) {
        await onSave(pendingRef.current);
        pendingRef.current = null;
      }
    }, delayMs);
  }, [delayMs, onSave]);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (pendingRef.current) {
      await onSave(pendingRef.current);
      pendingRef.current = null;
    }
  }, [onSave]);

  return { debouncedSave, flush };
}
```

### Usage in Form

```typescript
export function DebtEditForm({ debtId, onSave, onCancel }) {
  const methods = useForm({
    resolver: zodResolver(DebtSchema),
    defaultValues: useConfig((state) =>
      state.debts.active.find((d) => d.id === debtId)
    ),
  });

  const { debouncedSave, flush } = useFormDebounce({
    delayMs: 400,
    onSave: async (values) => {
      try {
        await updateDebtAPI(debtId, values);
      } catch (err) {
        setError(err.message);
      }
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    methods.setValue(fieldName, value);
    debouncedSave(methods.getValues());
  };

  const handleBlur = async () => {
    await flush(); // Flush any pending saves
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await flush(); // Ensure all pending saves are flushed
    await methods.handleSubmit(async (values) => {
      await onSave(values);
    })(e);
  };

  return (
    <form onSubmit={handleSubmit} onBlur={handleBlur}>
      {/* fields */}
    </form>
  );
}
```

---

## Optimistic Updates

When the user submits a form, the local Zustand store updates immediately while the API call is in flight. If the API fails, the store is rolled back to the previous state.

```typescript
// Pattern: Optimistic update with rollback

export async function handleDebtUpdate(debtId: string, formValues: any) {
  const store = useConfig.getState();
  const currentDebt = store.debts.active.find((d) => d.id === debtId);
  const previousDebts = [...store.debts.active];

  // Step 1: Optimistic update
  store.updateDebt(debtId, formValues);
  store.setDirty(true);

  try {
    // Step 2: API call
    const response = await fetch(`/api/config/debt/${debtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    // Step 3: Success — persist to cloud
    store.setDirty(false);
    showToast('Debt updated', 'success');
  } catch (error) {
    // Step 4: Rollback on error
    store.debts.active = previousDebts;
    store.setDirty(true);
    showToast(`Failed to update: ${error.message}`, 'error');
  }
}
```

---

## Error Handling

### Field-Level Errors

react-hook-form's `formState.errors` displays validation errors inline:

```typescript
export function DebtForm({ debt }) {
  const {
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(DebtSchema),
    defaultValues: debt,
  });

  return (
    <div>
      <input {...register('name')} />
      {errors.name && (
        <span className="text-red-500 text-sm">{errors.name.message}</span>
      )}

      <input {...register('balance')} type="number" />
      {errors.balance && (
        <span className="text-red-500 text-sm">{errors.balance.message}</span>
      )}
    </div>
  );
}
```

### Form-Level Errors

API errors from `docs/11-api-contracts.md` are mapped to form state:

```typescript
export async function submitDebtForm(formValues: any) {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify({ debts: formValues }),
    });

    if (!response.ok) {
      const { error } = await response.json();

      if (error.code === 'VALIDATION_FAILED') {
        // Field-level errors
        Object.entries(error.details).forEach(([field, messages]) => {
          setError(field, {
            type: 'server',
            message: messages[0],
          });
        });
      } else if (error.code === 'CONFLICT') {
        // Version conflict
        showToast(
          'Configuration changed on another device. Refresh and try again.',
          'error'
        );
      } else {
        // Generic error
        showToast(`Error: ${error.message}`, 'error');
      }
    }
  } catch (error) {
    showToast(`Network error: ${error.message}`, 'error');
  }
}
```

---

## Unsaved Changes Guard

When the user navigates away from a page with unsaved edits, the router blocks navigation and shows a confirmation dialog.

```typescript
// hooks/useUnsavedChangesGuard.ts

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useConfig } from './useConfig';

export function useUnsavedChangesGuard() {
  const router = useRouter();
  const isDirty = useConfig((state) => state.meta.isDirty);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // For Next.js router navigation
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (isDirty) {
        const confirmed = confirm(
          'You have unsaved changes. Are you sure you want to leave?'
        );
        if (!confirmed) {
          throw 'Route change cancelled';
        }
      }
    };

    // Hook into router events (if Next.js 14 App Router supports)
    // This is a simplified pattern; implementation may vary
  }, [isDirty, router]);
}
```

Usage in a form component:

```typescript
export function EditForm() {
  useUnsavedChangesGuard();
  const isDirty = useConfig((state) => state.meta.isDirty);

  return (
    <form>
      {isDirty && (
        <AlertBox type="warning">
          You have unsaved changes.
        </AlertBox>
      )}
      {/* form fields */}
    </form>
  );
}
```

---

## Keyboard Shortcuts

- **Enter** (in form): Submits the form (trigger onSubmit)
- **Escape** (in form): Cancels edit mode and discards unsaved changes

```typescript
export function EditForm({ onCancel }) {
  const methods = useForm();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Enter is handled by <form> onSubmit
  };

  return (
    <form onKeyDown={handleKeyDown} onSubmit={methods.handleSubmit(...)}>
      {/* fields */}
    </form>
  );
}
```

---

## Accessibility (Overview)

Full accessibility guidelines are in `docs/15-accessibility.md`. Form-specific touchpoints:

- **Label association**: Every input has a linked `<label htmlFor>`.
- **Error announcement**: Errors in `aria-live="polite"` regions.
- **Fieldset/legend**: Grouped inputs (e.g., debt fields) wrapped in `<fieldset><legend>`.
- **Required indication**: Asterisk or `aria-required="true"` on mandatory fields.
- **Focus management**: After save, focus moves back to the edit button.

---

## Worked Example: Editing Fortnightly Income

This example shows the complete end-to-end flow for editing Matty's fortnightly net income.

### 1. Configuration Structure

In the source dashboard (reference/Retirement_Dashboard_v2.html, line ~1876), user1's fortnightly net income is hardcoded:

```javascript
// Line 1876 (original dashboard)
const user1Fn = 3850; // user1's fortnightly net income
```

**Action**: Move this into CONFIG as editable field:

```typescript
// lib/types.ts
interface ProfileUser1 {
  // ... existing fields ...
  fortnightlyNet: number; // NEW: AUD fortnightly net income
}
```

### 2. Form Schema

```typescript
// lib/schemas.ts
export const ProfileUser1Schema = z.object({
  // ... existing fields ...
  fortnightlyNet: z.number().nonnegative().refine(
    (val) => val > 0,
    'Fortnightly income must be greater than zero'
  ),
});
```

### 3. Edit Mode Component

```typescript
// app/dashboard/components/sections/IncomeEditForm.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfig } from '@/hooks/useConfig';
import { ProfileUser1Schema } from '@/lib/schemas';
import { useFormDebounce } from '@/hooks/useFormDebounce';
import { formatCurrency } from '@/lib/formatters';

export function IncomeEditForm({ onSave, onCancel }) {
  const user1 = useConfig((state) => state.profile.user1);
  const { debouncedSave, flush } = useFormDebounce({
    delayMs: 400,
    onSave: async (values) => {
      // Call API to persist
      const response = await fetch('/api/config', {
        method: 'PATCH',
        body: JSON.stringify({ profile: { user1: values } }),
      });
      if (!response.ok) throw new Error('Failed to save');
    },
  });

  const methods = useForm({
    resolver: zodResolver(ProfileUser1Schema),
    defaultValues: user1,
  });

  const handleInputChange = (e) => {
    const value = parseFloat(e.target.value);
    methods.setValue('fortnightlyNet', value);
    debouncedSave(methods.getValues());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await flush();
    const values = methods.getValues();
    
    // Update Zustand store (optimistic)
    useConfig.setState((state) => ({
      profile: {
        ...state.profile,
        user1: { ...state.profile.user1, fortnightlyNet: values.fortnightlyNet },
      },
      meta: { ...state.meta, isDirty: true },
    }));

    await onSave(values);
  };

  const handleCancel = () => {
    methods.reset();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="control-group">
        <label htmlFor="fortnightlyNet" className="text-xs uppercase font-semibold">
          Fortnightly Net Income
        </label>
        <input
          id="fortnightlyNet"
          type="number"
          step="0.01"
          min="0"
          placeholder={formatCurrency(user1.fortnightlyNet)}
          onChange={handleInputChange}
          onBlur={flush}
          aria-required="true"
        />
        {methods.formState.errors.fortnightlyNet && (
          <span className="text-red-500 text-sm" role="alert">
            {methods.formState.errors.fortnightlyNet.message}
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" onClick={handleCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

### 4. State Synchronisation

Zustand store updates immediately:

```typescript
// Optimistic update
store.setUser1({
  ...user1,
  fortnightlyNet: 3900, // new value
});
```

### 5. localStorage Flush

Zustand's persist middleware automatically saves to localStorage after the state change:

```typescript
// localStorage key: 'retire-au-config'
// After update:
{
  "profile": {
    "user1": {
      // ...
      "fortnightlyNet": 3900
    }
  },
  // ... rest of state
}
```

### 6. Cloud Sync (Optional)

If the user is signed in, the API call persists to the cloud:

```typescript
POST /api/config
{
  "profile": {
    "user1": {
      "fortnightlyNet": 3900
    }
  }
}

// Response (202 Accepted)
{
  "config": { ... },
  "version": "2026-04-10T14:23:00Z"
}
```

### 7. Error Recovery

If the API fails:

```typescript
// API returns 422 Validation Failed
{
  "error": {
    "code": "VALIDATION_FAILED",
    "details": {
      "fortnightlyNet": ["Fortnightly income must be greater than zero"]
    }
  }
}

// Form displays error inline, store rolls back
showToast('Fortnightly income validation failed', 'error');
useConfig.setState((state) => ({
  profile: {
    ...state.profile,
    user1: { ...state.profile.user1, fortnightlyNet: previousValue },
  },
}));
```

---

## Summary

- **Per-section edit mode** is toggled independently, not globally.
- **Editable fields table** specifies which CONFIG paths can be modified.
- **react-hook-form + Zod** shared schemas prevent validation drift.
- **Debounce strategy** is 400ms for text/number, immediate for select/toggle.
- **Optimistic updates** modify Zustand immediately, rollback on API failure.
- **Error handling** maps API errors to form fields and toast notifications.
- **Unsaved changes guard** blocks navigation and persists via localStorage/cloud.
- **Keyboard shortcuts** (Enter to save, Esc to cancel) improve UX.
- **Worked example** walks through editing fortnightly income end-to-end.

Reference `docs/07-config-reference.md` for all CONFIG fields and `docs/11-api-contracts.md` for API error envelopes.
