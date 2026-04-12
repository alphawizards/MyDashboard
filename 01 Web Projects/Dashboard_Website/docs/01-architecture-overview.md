# Architecture Overview — RetireAU Dashboard

## Project Summary

Converting a single-file HTML retirement dashboard (`Retirement_Dashboard_v2.html`) into a multi-user Australian-focused retirement planning web app. The dashboard runs entirely client-side — all financial calculations, projections, and chart rendering happen in the browser. The backend is a thin persistence layer only.

## Stack

- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript
- **Auth**: Clerk (first-party Next.js SDK)
- **Database**: PostgreSQL (Railway managed)
- **ORM**: Prisma
- **Charts**: react-chartjs-2 (wrapping Chart.js 4.x) — chosen to maximise portability from existing Chart.js configs
- **State**: Zustand with localStorage persistence
- **Excel parsing**: SheetJS (client-side only, xlsx.full.min.js)
- **Hosting**: Railway (single service, Next.js app + Postgres)
- **CDN/DNS**: Cloudflare (reverse proxy, SSL, static asset caching)
- **Styling**: Tailwind CSS with custom dark theme tokens matching existing dashboard palette

## Architecture Diagram

```
User Browser
    ↓
Cloudflare (CDN + DNS + SSL)
    ↓
Railway (single service)
    ├── Next.js App
    │   ├── /app (public)           — landing, features page
    │   ├── /app/dashboard          — main app (client-side rendering)
    │   │   ├── react-chartjs-2     (16 charts, ported from current)
    │   │   ├── Controls panel      (collapsible, same UX as current)
    │   │   ├── Config state        (Zustand → localStorage + cloud sync)
    │   │   ├── SheetJS             (client-side Excel parsing)
    │   │   └── /lib/au-tax-data.ts (SG rates, brackets, preservation age)
    │   └── /app/api
    │       ├── POST /api/config    — save config blob (authed)
    │       ├── GET  /api/config    — load config blob (authed)
    │       └── POST /api/webhooks/clerk — user sync on signup
    └── PostgreSQL
        ├── users table
        └── configs table (JSONB blob per user)
```

## Key Design Principles

### 1. Client-Side Computation

All financial mathematics (super projection, mortgage amortisation, debt avalanche, deposit comparison) runs in the browser. Zero API calls during user interaction. The backend never sees or computes financial data — it only persists and retrieves the user's configuration blob.

**Rationale**: Minimises server load, provides instant feedback to the user, and ensures the app works offline (with local persistence via localStorage).

### 2. Local-First with Optional Cloud Sync

The dashboard works immediately without sign-in (localStorage persistence). Clerk sign-in enables cross-device sync.

**Sync Strategy**:
- Cloud config loads on sign-in
- Merges with local (cloud wins if newer; prompt on conflict)
- User can choose to keep local or accept cloud version
- Auto-save on changes (debounced 5 seconds) once signed in

**Rationale**: Users aren't gated by authentication; they get immediate value. Sign-in is an upgrade, not a requirement.

### 3. Config Blob Architecture

The entire user state is one JSON object (same shape as the current `CONFIG` block in the HTML dashboard). Save/load is a single API call. No normalised relational model for financial data — JSONB gives document flexibility with SQL queryability.

// DashboardConfig is defined in docs/02-database-schema.md and src/lib/config/schema.ts

### 4. Schema Versioning

Every config blob carries a `schemaVersion` integer. Schema version 1 is current. No v2 migration exists. Future migrations follow the pattern in `docs/20-db-migration-runbook.md`.

### 5. Australian Tax Data as a Separate Layer

SG rates, tax brackets, Medicare levy, preservation age, concessional tax caps all live in `/lib/au-tax-data.ts`. Federal budget changes = one file update.

**Structure**:
```typescript
// /lib/au-tax-data.ts
export const AU_TAX_DATA = {
  superannuationGaranteeRate: 0.12, // FY2026 legislated rate
  preservationAge: 60,
  concessionalTaxRate: 0.15,
  taxBrackets: [
    { min: 0, max: 18200, rate: 0 },
    { min: 18200, max: 45000, rate: 0.21 },
    // ... etc
  ],
  medicareLevyRate: 0.02,
  medicareLevyThreshold: 27222, // FY2026 low-income threshold (~$27,222); $180,000 is the top tax bracket, not this threshold
};
```

**Rationale**: Centralises legislation-driven data, making it easy to audit and update when budgets change.

### 6. Portable Chart Configurations

Using `react-chartjs-2` (thin React wrapper around Chart.js) rather than Recharts. The existing 16 Chart.js configurations port almost directly, avoiding a full rewrite.

**Rationale**: The existing HTML dashboard uses Chart.js; porting to Recharts would mean rewriting every chart config. `react-chartjs-2` lets us reuse existing configs with minimal changes.

## Auth Flow

```
User opens /dashboard
  ↓
  [LOCAL MODE]
  → Dashboard loads with default config in localStorage
  → Works immediately (all calculations client-side)
  → "Sign in to save your progress" button in header
  ↓
  [USER CLICKS SIGN IN]
  → Clerk modal opens (modal.clerk.com overlay)
  → User creates account or logs in
  ↓
  [ON SIGNUP]
  → Clerk webhook fires: POST /api/webhooks/clerk
  → Handler creates users row in Postgres with userId + email
  → returns 200 OK
  ↓
  [ON SIGN-IN COMPLETE]
  → Clerk context updates <ClerkProvider> state
  → useUser() hook returns { isSignedIn, user }
  → Dashboard component calls GET /api/config
  → Backend fetches configs row for userId from Postgres
  ↓
  [CONFIG MERGE STRATEGY]
  IF cloud config exists:
    IF cloud timestamp > local timestamp:
      Replace local with cloud (cloud wins)
    ELSE:
      Prompt user: "Your local config is newer. Upload to cloud?"
  ELSE:
    First sign-in, new user
    Create configs row with local config
  ↓
  [AUTO-SAVE]
  → Every change to Zustand store triggers debounced save (5 seconds)
  → POST /api/config with new blob + timestamp
  → Backend updates configs row in Postgres
  → User sees "Saved to cloud" toast
  ↓
  [SIGN-OUT]
  → Local config persists in localStorage
  → Cloud sync stops
  → User can still use app offline
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Zustand Store (config: DashboardConfig)                     │
│ + localStorage persistence                                  │
└─────────────────────────────────────────────────────────────┘
         ↑                                                ↓
         │                                                │
    useConfig()                                  setConfig()
         │                                                │
         ↓                                                ↑
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Page (/app/dashboard/page.tsx)                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ControlsPanel                                       │   │
│  │ • User 1 super balance input                        │   │
│  │ • Partner salary input                              │   │
│  │ • Mortgage rate slider                              │   │
│  │ → on change: setConfig({ ...config, field: value }) │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ KPIGrid                                             │   │
│  │ • Net worth = super + property - mortgage           │   │
│  │ • Monthly surplus = income - expenses               │   │
│  │ • Years to retirement target (computed on render)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SuperProjection                                     │   │
│  │ • calls projectSuper(config) (pure function)        │   │
│  │ • returns { year, user1SuperBalance, ... }[]         │   │
│  │ • feeds into line chart                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DebtPayoff                                          │   │
│  │ • calls simulateAvalanche(config.debts)             │   │
│  │ • returns payoff schedule + payoff date             │   │
│  │ • feeds into 3 charts (principal, interest, cash)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ExpenseTracker                                      │   │
│  │ • SheetJS parses Excel upload (client-side)         │   │
│  │ • merges rows into config.expenses aggregate        │   │
│  │ • setConfig({ ...config, expenses: merged })        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key pattern**: Every component reads from Zustand. When user changes an input, `setConfig()` updates the store. React re-renders only affected components. Same reactivity as the current `onchange="recalc()"` pattern but component-scoped and type-safe.

## API Endpoints

### POST /api/config

**Purpose**: Save user's config blob to cloud.

**Auth**: Requires Clerk authentication (middleware checks `req.auth.userId`).

**Request body**:
```json
{
  "config": { /* entire DashboardConfig object */ },
  "timestamp": 1712750400000
}
```

**Response**:
```json
{
  "success": true,
  "savedAt": 1712750400000
}
```

**Logic**:
- Extract `userId` from Clerk token (middleware)
- Validate config blob (schemaVersion check, required fields)
- Upsert `configs` row: `{ userId, config: JSON.stringify(config), updatedAt: NOW() }`
- Return 200 with savedAt timestamp

---

### GET /api/config

**Purpose**: Load user's saved config from cloud.

**Auth**: Requires Clerk authentication.

**Query params**: None.

**Response**:
```json
{
  "config": { /* entire DashboardConfig object */ },
  "timestamp": 1712750400000
}
```

**Logic**:
- Extract `userId` from Clerk token
- Query `configs` row for userId
- If found: return { config: JSON.parse(config), timestamp: updatedAt }
- If not found: return { config: null, timestamp: null }

---

### POST /api/webhooks/clerk

**Purpose**: Handle Clerk sign-up webhook (create user row on first sign-up).

**Auth**: Verify webhook signature against `CLERK_WEBHOOK_SECRET`.

**Request body** (Clerk format):
```json
{
  "data": {
    "id": "user_2abcdef123456",
    "email_addresses": [{ "email_address": "user@example.com" }],
    "created_at": 1712750400000
  },
  "type": "user.created",
  "timestamp_ms": 1712750400000
}
```

**Response**:
```json
{
  "success": true
}
```

**Logic**:
- Verify webhook signature (Clerk library: `verifyWebhookSignature()`)
- If event type is `user.created`:
  - Extract userId (`data.id`), email (`data.email_addresses[0].email_address`)
  - Insert `users` row: `{ userId, email, createdAt: NOW() }`
  - Return 200 OK
- If webhook is not user.created, return 200 (idempotent)

**Rationale**: Webhook is idempotent — if user already exists, upsert silently. Prevents duplicate user rows.

## Database Schema

### users table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,  -- Clerk userId
  email TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### configs table

```sql
CREATE TABLE configs (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE REFERENCES users(userId) ON DELETE CASCADE,
  config JSONB NOT NULL,  -- Entire DashboardConfig blob
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_configs_userId ON configs(userId);
```

## File Structure

```
dashboard-website/
├── app/
│   ├── layout.tsx                      — root layout, ClerkProvider
│   ├── page.tsx                        — landing page
│   ├── (public)/
│   │   ├── features/page.tsx
│   │   └── pricing/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                  — dashboard header/nav
│   │   ├── page.tsx                    — main dashboard (all components)
│   │   ├── components/
│   │   │   ├── ControlsPanel.tsx       — input panel
│   │   │   ├── KPIGrid.tsx             — key metrics
│   │   │   ├── SuperProjection.tsx     — super chart + logic
│   │   │   ├── DebtPayoff.tsx          — avalanche sim + charts
│   │   │   ├── BudgetProfile.tsx       — expense breakdown
│   │   │   ├── DepositComparison.tsx   — scenario A vs B
│   │   │   ├── FamilyProperty.tsx      — inheritance projection
│   │   │   ├── ExpenseTracker.tsx      — Excel upload
│   │   │   └── DataTables.tsx          — tabbed tables
│   │   └── hooks/
│   │       └── useConfig.ts            — Zustand hook
│   └── api/
│       ├── config/
│       │   ├── route.ts                — GET /api/config, POST /api/config
│       ├── webhooks/
│       │   └── clerk/route.ts          — POST /api/webhooks/clerk
│       └── middleware.ts               — Clerk auth checks
├── lib/
│   ├── au-tax-data.ts                  — SG rates, tax brackets, preservation age
│   ├── configMigrations.ts             — schema version handlers
│   ├── financial-maths.ts              — projectSuper(), calcMortgage(), etc.
│   ├── db.ts                           — Prisma client singleton
│   └── utils.ts                        — formatCurrency(), percentGrowth(), etc.
├── styles/
│   ├── globals.css                     — Tailwind config imports, custom tokens
│   └── dashboard.css                   — dashboard-specific styles
├── types/
│   └── index.ts                        — DashboardConfig, interfaces
├── .env.local                          — DATABASE_URL, CLERK_*
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── prisma/
│   └── schema.prisma                   — Prisma DB schema
└── docs/
    ├── 01-architecture-overview.md     — this file
    ├── 02-component-specifications.md
    ├── 03-deployment-guide.md
    └── 04-testing-strategy.md
```

## Key Implementation Notes

### 1. Zustand Store

```typescript
// hooks/useConfig.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardConfig } from '@/types';

export const useConfigStore = create<{
  config: DashboardConfig;
  setConfig: (config: DashboardConfig) => void;
  reset: () => void;
}>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      setConfig: (config) => set({ config }),
      reset: () => set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: 'dashboard-config',
      storage: typeof window !== 'undefined' ? localStorage : undefined,
    }
  )
);

export const useConfig = () => {
  const { config, setConfig } = useConfigStore();
  const debouncedSave = useCallback(
    debounce((cfg: DashboardConfig) => {
      // Only save if user is signed in
      if (user?.id) {
        fetch('/api/config', {
          method: 'POST',
          body: JSON.stringify({ config: cfg, timestamp: Date.now() }),
        });
      }
    }, 5000),
    [user?.id]
  );

  return {
    config,
    setConfig: (cfg) => {
      setConfig(cfg);
      debouncedSave(cfg);
    },
  };
};
```

### 2. Financial Math Functions

All calculation logic lives in `/lib/financial-maths.ts`. Functions are **pure** (no side effects, no API calls).

```typescript
// lib/financial-maths.ts

export function projectSuper(config: DashboardConfig, years: number) {
  const results = [];
  let user1SuperBalance = config.profile.user1.superBalance;
  let user2SuperBalance = config.profile.user2.superBalance;

  for (let year = 0; year < years; year++) {
    // Apply SG, salary growth, contributions, tax
    user1SuperBalance = user1SuperBalance * (1 + 0.06) // growth rate
                      + (config.profile.user1.salary * AU_TAX_DATA.superannuationGaranteeRate);
    // ... etc

    results.push({
      year,
      user1SuperBalance,
      user2SuperBalance,
      combinedSuperBalance: user1SuperBalance + user2SuperBalance,
    });
  }

  return results;
}

export function simulateAvalanche(debts: DashboardConfig['debts']) {
  // Debt avalanche algorithm (highest rate first)
  // Returns { payoffDate, totalInterest, schedule: [...] }
}

export function calcMortgageSchedule(principal: number, rate: number, months: number) {
  // Amortisation schedule (interest-only to principal-and-interest transition)
  // Returns [{ month, payment, principal, interest, balance }, ...]
}
```

### 3. Clerk Middleware

```typescript
// app/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/features',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Clerk applies auth to all routes except public ones
  // For /api routes, Clerk sets req.auth.userId
});

// app/api/middleware.ts (route-level auth check)
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... proceed
}
```

### 4. Chart Configuration (react-chartjs-2)

Existing Chart.js configs adapt directly:

```typescript
// components/SuperProjection.tsx
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend);

export function SuperProjection({ config }: { config: DashboardConfig }) {
  const projections = projectSuper(config, 40);
  
  const data = {
    labels: projections.map(p => `Year ${p.year}`),
    datasets: [
      {
        label: 'Matty Super',
        data: projections.map(p => p.user1SuperBalance),
        borderColor: '#3b82f6',
        fill: false,
      },
      {
        label: 'Partner Super',
        data: projections.map(p => p.user2SuperBalance),
        borderColor: '#ef4444',
        fill: false,
      },
    ],
  };

  return <Line data={data} options={{ responsive: true }} />;
}
```

### 5. Excel Parsing (SheetJS)

```typescript
// components/ExpenseTracker.tsx
import * as XLSX from 'xlsx';

export function ExpenseTracker() {
  const { config, setConfig } = useConfig();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target?.result, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      // Aggregate expenses by category
      const aggregated = rows.reduce((acc, row) => ({
        housing: acc.housing + (row.housing || 0),
        utilities: acc.utilities + (row.utilities || 0),
        // ...
      }), {});

      setConfig({ ...config, expenses: aggregated });
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
    </div>
  );
}
```

## Deployment

### Prerequisites

- Railway account (postgres database created)
- Cloudflare account (domain configured)
- Clerk account (application created, webhook URL noted)

### Environment Variables

```bash
# .env.local

# Clerk
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Next.js
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NODE_ENV=production
```

### Railway Deployment

1. Push repo to GitHub
2. Create Railway service → connect GitHub repo
3. Add PostgreSQL plugin via Railway dashboard
4. Set environment variables (DATABASE_URL auto-populated, add Clerk keys)
5. Deploy: Railway watches main branch, auto-deploys on push
6. Get Railway URL (e.g., `retireaudashboard.railway.app`)

### Cloudflare Configuration

1. Add domain to Cloudflare (update nameservers)
2. DNS → Add A record: `dashboard.example.com` → Railway URL
3. SSL/TLS → Full (strict)
4. Page Rules: Cache on, cache level Aggressive (for static assets)
5. Redirects: `www.example.com` → `dashboard.example.com`

### Clerk Webhook Setup

1. Clerk Dashboard → Webhooks → Add endpoint
2. Endpoint URL: `https://dashboard.example.com/api/webhooks/clerk`
3. Events: `user.created` (minimum)
4. Copy webhook secret → `CLERK_WEBHOOK_SECRET` env var

## Feature Parity with Local Dashboard

The web app must replicate all features from `Retirement_Dashboard_v2.html`:

| Feature | Implementation | Status |
|---------|----------------|--------|
| **Super Projection** | `SuperProjection.tsx` + `projectSuper()` | ✓ Client-side |
| **Net Worth Trajectory** | `KPIGrid.tsx` computed from config | ✓ Client-side |
| **Retirement Readiness** | `KPIGrid.tsx` (target vs sustainable income) | ✓ Client-side |
| **Budget & Spending** | `BudgetProfile.tsx` + expense aggregate | ✓ Client-side |
| **Debt Payoff (Avalanche)** | `DebtPayoff.tsx` + `simulateAvalanche()` | ✓ Client-side |
| **Debt Payoff (Lump Sum)** | `DebtPayoff.tsx` multiple scenarios | ✓ Client-side |
| **House Deposit (Scenario A vs B)** | `DepositComparison.tsx` side-by-side | ✓ Client-side |
| **Family Trust Property** | `FamilyProperty.tsx` + `calcMortgageSchedule()` | ✓ Client-side |
| **Weekly Expense Tracker (Excel)** | `ExpenseTracker.tsx` + SheetJS | ✓ Client-side |
| **Editable Controls Panel** | `ControlsPanel.tsx` with bound inputs | ✓ Client-side |
| **Tabbed Data Tables** | `DataTables.tsx` (Matty, Partner, Combined, Mortgage, Children, Budget) | ✓ Client-side |
| **Australian Tax Logic** | `/lib/au-tax-data.ts` (SG rates, brackets, preservation age 60, concessional 15%) | ✓ Config file |
| **Cloud Sync (Optional)** | POST/GET `/api/config` + Zustand | ✓ API |
| **User Authentication** | Clerk modal + webhook | ✓ OAuth |

---

## Performance Targets

- **Dashboard load**: < 2 seconds (after sign-in, config loaded)
- **Calculation latency**: < 100 ms (projectSuper 40-year simulation)
- **Chart re-render**: < 200 ms on input change
- **Network save**: debounced 5 seconds, no perceived lag
- **Bundle size**: < 500 KB (Next.js + React + Chart.js + Tailwind)

---

## Security Notes

1. **Auth**: Clerk handles OAuth (Google, GitHub, email). No password storage needed.
2. **HTTPS only**: Cloudflare enforces SSL. No HTTP fallback.
3. **CORS**: API endpoints use Clerk's `userId` from JWT token (no session cookies). CORS not needed for same-origin requests.
4. **Data**: Config blob is per-user (JSONB in Postgres). No cross-user data leakage.
5. **Webhook verification**: Clerk webhook signature verified server-side before processing.
6. **PII**: No personal identifiable information stored except email (required by Clerk). Financial data (balances, salaries) stored only in user's config blob, never logged or transmitted in plaintext.

---

## Testing Strategy

See `04-testing-strategy.md` for detailed test plan.

**Layers**:
- **Unit tests**: Financial maths functions (`projectSuper`, `simulateAvalanche`, `calcMortgage`)
- **Component tests**: Controls, KPI grid, charts (React Testing Library + Vitest)
- **Integration tests**: Config save/load flow, auth flow (Playwright)
- **E2E tests**: Full user journey (sign-up → enter data → save → sign-out → re-load)

---

## Maintenance & Future Enhancements

### Known Limitations (MVP)

1. No real-time collaboration (multi-device sync on refresh only)
2. No data import/export (only Excel for expense tracking)
3. No mobile app (responsive web only)
4. No advanced reporting (no PDF export)

### Planned Features (Post-MVP)

1. Multi-currency support (USD, GBP, SGD)
2. Scenario sharing (generate shareable links)
3. Historical data export (CSV snapshots)
4. Advanced tax scenario modelling (HELP debt, salary sacrifice)
5. Inflation adjustments (CPI indexing)

---

## Glossary

| Term | Definition |
|------|-----------|
| **SG** | Superannuation Guarantee (employer contribution, 12.0% in FY2026 (legislated)) |
| **Config Blob** | Entire user state serialised as single JSON object (stored in JSONB column) |
| **Avalanche** | Debt payoff strategy: highest interest rate first |
| **Preservation Age** | Age at which super can be accessed (60 in Australia) |
| **JSONB** | PostgreSQL binary JSON type (indexed, queryable) |
| **Debounce** | Delay function execution until user stops typing (5 sec for auto-save) |
| **Concessional** | Super contributions taxed at 15% (concessional rate) |

