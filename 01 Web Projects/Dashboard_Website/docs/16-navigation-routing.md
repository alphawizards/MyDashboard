# Navigation and Routing — RetireAU Dashboard

## Overview

RetireAU Dashboard uses Next.js 14+ App Router with separate routes per dashboard section (not tabs). This enables deep linking, route-specific code splitting, loading UI per route, and isolated error boundaries. This document specifies the route tree, layout hierarchy, navigation components, active state, prefetching, auth-protected routes, query parameters, deep linking, breadcrumbs, and 404 handling.

---

## Routing Decision: Separate Routes vs Tabs

### Chosen: Separate Routes Per Section

Each dashboard section is a distinct route under `/dashboard`. This choice provides:

1. **Deep linking**: Users can share `/dashboard/property?year=2040` and land on the property section with 2040 visible
2. **Code splitting**: Bundle only loads the `/dashboard/super` code when accessing that route
3. **Per-route loading UI**: Each route can have its own `loading.tsx` skeleton
4. **Isolated error boundaries**: Errors in the super section don't affect the budget section
5. **Browser history**: Back/forward buttons work intuitively
6. **SEO**: Each section is indexable (if public) with unique meta tags

### Alternative (Rejected): Single Route with Client-Side Tabs

A single `/dashboard` route with client-side state managing which tab is active would:
- ✗ Force loading all sections' code on first load (no splitting)
- ✗ Break deep linking (`/dashboard?tab=property` is ugly)
- ✗ Share error boundaries (bugs affect entire dashboard)
- ✗ Make 404 detection harder (all content on one route)
- ✗ Complicate preloading strategies

---

## Route Tree

Below is the complete App Router file structure for the RetireAU Dashboard.

### ASCII Tree

```
app/
├── layout.tsx                          — root layout (ClerkProvider, Toaster)
├── page.tsx                            — landing page (public, SSR)
├── error.tsx                           — global error boundary
├── not-found.tsx                       — global 404 page
├── (auth)                              — optional auth route group
│   ├── sign-in/
│   │   ├── [[...index]]
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   └── sign-up/
│       ├── [[...index]]
│       │   └── page.tsx
│       └── layout.tsx
├── (marketing)                         — optional marketing routes
│   ├── features/
│   │   └── page.tsx
│   ├── pricing/
│   │   └── page.tsx
│   └── layout.tsx
├── dashboard
│   ├── layout.tsx                      — dashboard layout (persistent nav + header)
│   ├── page.tsx                        — overview page
│   ├── loading.tsx                     — skeleton loaders for overview
│   ├── error.tsx                       — error boundary for dashboard
│   ├── not-found.tsx                   — 404 if section doesn't exist
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   ├── Breadcrumbs.tsx
│   │   └── ...
│   ├── (sections)                      — route group for section routes
│   │   ├── budget
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── debt
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── super
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── property
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── family-property
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── children
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   └── settings
│   │       ├── page.tsx
│   │       ├── loading.tsx
│   │       └── error.tsx
│   └── hooks/
│       └── useConfig.ts
├── api/
│   ├── config/
│   │   └── route.ts                    — GET, POST config (Clerk auth)
│   ├── webhooks/
│   │   └── clerk/route.ts              — Clerk user sync webhook
│   └── health/route.ts                 — health check (public)
├── lib/
│   ├── types.ts
│   ├── schemas.ts
│   ├── calculations.ts
│   └── ...
└── middleware.ts                       — Clerk auth middleware
```

### Route Details

| Route | Public? | Purpose | Auth Required |
|---|---|---|---|
| `/` | Yes | Landing page, CTA to sign in | No |
| `/features` | Yes | Feature showcase | No |
| `/pricing` | Yes | Pricing page | No |
| `/sign-in` | Yes | Clerk sign-in form | No |
| `/sign-up` | Yes | Clerk sign-up form | No |
| `/dashboard` | Optional* | Overview KPIs + quick stats | Optional* |
| `/dashboard/budget` | No | Budget profile, expense upload | Yes |
| `/dashboard/debt` | No | Debt payoff scenarios | Yes |
| `/dashboard/super` | No | Super projection | Yes |
| `/dashboard/property` | No | Property & deposit strategy | Yes |
| `/dashboard/family-property` | No | Family trust property | Yes |
| `/dashboard/children` | No | Childcare & school costs | Yes |
| `/dashboard/settings` | No | User account settings, export | Yes |

\* `/dashboard` can be accessed unauthenticated with localStorage data, but auto-sync and cloud features are disabled until sign-in.

---

## Layout Hierarchy

### Root Layout

```typescript
// app/layout.tsx

import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>RetireAU Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ClerkProvider>
          {children}
          <Toaster position="bottom-right" />
        </ClerkProvider>
      </body>
    </html>
  );
}
```

### Dashboard Layout

Persistent header and navigation across all dashboard routes:

```typescript
// app/dashboard/layout.tsx

'use client';

import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <Navigation />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <OfflineBanner />
    </div>
  );
}
```

### Auth-Protected Sections

Sections requiring authentication can optionally have their own layout:

```typescript
// app/dashboard/(sections)/layout.tsx

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function SectionsLayout({ children }) {
  const { userId } = await auth();
  
  // Optional: redirect unauthenticated users to sign-in
  // if (!userId) {
  //   redirect('/sign-in');
  // }

  return children;
}
```

---

## Navigation Component

### Desktop Sidebar

```typescript
// app/dashboard/components/Navigation.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/budget', label: 'Budget', icon: '💰' },
  { href: '/dashboard/debt', label: 'Debt', icon: '💳' },
  { href: '/dashboard/super', label: 'Super', icon: '🏦' },
  { href: '/dashboard/property', label: 'Property', icon: '🏠' },
  { href: '/dashboard/family-property', label: 'Family Property', icon: '🏡' },
  { href: '/dashboard/children', label: 'Children', icon: '👨‍👩‍👧‍👦' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex flex-col w-64 bg-dashboard-surface border-r border-dashboard-border p-4 gap-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            pathname === item.href
              ? 'bg-dashboard-accent text-dashboard-bg font-semibold'
              : 'text-dashboard-muted hover:bg-dashboard-surface2'
          }`}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

### Mobile Bottom Navigation

```typescript
// app/dashboard/components/MobileNav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dashboard-surface border-t border-dashboard-border flex justify-between items-center p-2">
      {NAV_ITEMS.slice(0, 5).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
            pathname === item.href
              ? 'text-dashboard-accent font-semibold'
              : 'text-dashboard-muted'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-xs">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

### Active State Logic

`usePathname()` hook detects the current route and applies active styling. For nested sections, consider:

```typescript
// Utility to check if a route is active
function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

// Usage
className={isActiveRoute(pathname, '/dashboard/property') ? 'active' : ''}
```

---

## Prefetching Strategy

Next.js `<Link>` automatically prefetches routes when they enter the viewport (on device capable of it).

```typescript
// Default: prefetch=true for <Link>
<Link href="/dashboard/super">Super</Link>

// Disable prefetch for expensive routes
<Link href="/dashboard/property" prefetch={false}>
  Property
</Link>

// Manual prefetch via router
import { useRouter } from 'next/navigation';

export function Navigation() {
  const router = useRouter();

  const handleMouseEnter = (href: string) => {
    router.prefetch(href);
  };

  return (
    <a
      href="/dashboard/super"
      onMouseEnter={() => handleMouseEnter('/dashboard/super')}
    >
      Super
    </a>
  );
}
```

---

## Auth-Protected Routes

### Middleware-Based Protection

```typescript
// middleware.ts (at /root of app)

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/features',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    // Protect /dashboard/* routes
    auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### Route-Level Auth Check

Some routes may additionally check auth and redirect:

```typescript
// app/dashboard/(sections)/super/page.tsx

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function SuperPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?return_to=/dashboard/super');
  }

  return <SuperSection />;
}
```

---

## Query Parameters vs Path Parameters

### Path Parameters (Section Selection)

The route itself determines which section is displayed:

```
/dashboard/super          — Super Projection section
/dashboard/property       — Property section
/dashboard/settings       — Settings section
```

### Query Parameters (Filters, Options)

Filters and view options are query parameters:

```
/dashboard/super?year=2040&projection=conservative    — Filter to year 2040, conservative scenario
/dashboard/debt?sort=rate&order=desc                  — Sort debts by rate descending
/dashboard/budget?view=trends&months=12               — Show 12-month trend view
```

**Implementation**:

```typescript
// app/dashboard/(sections)/super/page.tsx

'use client';

import { useSearchParams } from 'next/navigation';

export default function SuperPage() {
  const searchParams = useSearchParams();
  const year = searchParams.get('year');
  const projection = searchParams.get('projection') || 'base';

  return (
    <div>
      {/* Filter controls */}
      <select
        value={year || ''}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set('year', e.target.value);
          window.history.pushState(null, '', `?${params.toString()}`);
        }}
      >
        <option value="">All Years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Section content filtered by query params */}
      <SuperProjectionChart year={parseInt(year) || null} projection={projection} />
    </div>
  );
}
```

---

## Deep Linking and State Restoration

When a user navigates to `/dashboard/property?year=2040`, the page should:

1. Load the property section
2. Scroll to or highlight the year 2040 value
3. Restore any filters/preferences

```typescript
// app/dashboard/(sections)/property/page.tsx

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PropertyPage() {
  const searchParams = useSearchParams();
  const year = parseInt(searchParams.get('year') || '0');
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (year && chartRef.current) {
      // Scroll to the element or highlight the specific year
      const yearElement = chartRef.current.querySelector(
        `[data-year="${year}"]`
      );
      if (yearElement) {
        yearElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        yearElement.classList.add('ring-2', 'ring-dashboard-accent');
      }
    }
  }, [year]);

  return (
    <div>
      <h1>Property & Deposit Strategy</h1>
      <div ref={chartRef}>
        {/* Property chart with data-year attributes */}
        {years.map((y) => (
          <div key={y} data-year={y} className="year-row">
            {/* Year data */}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Breadcrumbs

Breadcrumbs show the current location and allow one-click navigation back:

```typescript
// app/dashboard/components/Breadcrumbs.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BREADCRUMB_MAP: Record<string, string> = {
  'dashboard': 'Dashboard',
  'budget': 'Budget',
  'debt': 'Debt',
  'super': 'Super',
  'property': 'Property',
  'family-property': 'Family Property',
  'children': 'Children',
  'settings': 'Settings',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="text-sm text-dashboard-muted mb-4" aria-label="Breadcrumbs">
      <ol className="flex gap-2">
        <li>
          <Link href="/dashboard" className="hover:text-dashboard-text">
            Dashboard
          </Link>
        </li>
        {segments.slice(1).map((segment, idx) => (
          <li key={segment} className="flex gap-2">
            <span>/</span>
            <Link
              href={`/dashboard/${segments.slice(1, idx + 2).join('/')}`}
              className="hover:text-dashboard-text"
            >
              {BREADCRUMB_MAP[segment] || segment}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

**Usage**:
```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <>
      <Header />
      <div className="px-6 py-4">
        <Breadcrumbs />
      </div>
      {/* ... */}
    </>
  );
}
```

---

## Loading UI Per Route

Each route can have its own skeleton loader:

```typescript
// app/dashboard/(sections)/super/loading.tsx

import { KPIGridSkeleton } from '@/components/KPISkeleton';
import { ChartSkeleton } from '@/components/ChartSkeleton';

export default function SuperLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Super Projection</h1>
      <KPIGridSkeleton count={3} />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}
```

---

## 404 Handling

### Route-Specific 404

```typescript
// app/dashboard/not-found.tsx

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h1 className="text-3xl font-bold mb-2">404</h1>
      <p className="text-dashboard-muted mb-6">Section not found</p>
      <Link href="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
```

### Global 404

```typescript
// app/not-found.tsx

export default function GlobalNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted mb-6">Page not found</p>
      <a href="/" className="btn btn-primary">
        Home
      </a>
    </div>
  );
}
```

---

## Route Transition & Focus Management

When the user navigates to a new section, focus should move to the main heading:

```typescript
// hooks/useFocusOnRouteChange.ts

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function useFocusOnRouteChange() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector('main h1');
    if (main instanceof HTMLElement) {
      main.focus();
      main.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pathname]);
}

// Usage in page components
export default function PropertyPage() {
  useFocusOnRouteChange();
  return <h1>Property</h1>;
}
```

---

## Search Param Utilities

Helper functions for managing query params:

```typescript
// lib/search-params.ts

import { useRouter, useSearchParams } from 'next/navigation';

export function useQueryParam(key: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const set = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const get = () => searchParams.get(key);

  return { get: get(), set };
}

// Usage
export function SuperFilter() {
  const { get: year, set: setYear } = useQueryParam('year');

  return (
    <select value={year || ''} onChange={(e) => setYear(e.target.value)}>
      <option value="">All Years</option>
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
```

---

## Metadata & Head Tags

Each route can have custom meta tags:

```typescript
// app/dashboard/(sections)/super/page.tsx

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Super Projection — RetireAU Dashboard',
  description: 'Detailed superannuation projections for retirement planning',
};

export default function SuperPage() {
  return <SuperSection />;
}
```

---

## Summary

- **Separate routes per section**: Enables deep linking, code splitting, per-route loading UI, isolated errors.
- **Route tree**: `/dashboard` overview, 8 subsections, plus auth routes and marketing pages.
- **Layout hierarchy**: Root layout with ClerkProvider, dashboard layout with persistent nav/header.
- **Navigation**: Desktop sidebar + mobile bottom bar, active state via `usePathname()`.
- **Prefetching**: Automatic via `<Link>`, manual via `router.prefetch()`.
- **Auth protection**: Middleware-based (Clerk) + optional route-level checks.
- **Query params**: Filters and options (`?year=2040&sort=rate`), not section selection.
- **Deep linking**: Restore filters/state when user navigates to a URL directly.
- **Breadcrumbs**: Show path, enable one-click navigation.
- **Loading UI**: Per-route skeleton loaders in `loading.tsx`.
- **404 handling**: Route-specific and global not-found pages.
- **Focus management**: Move focus to main heading on route change.
- **Metadata**: Dynamic page titles and descriptions.

Reference `docs/01-architecture-overview.md` for auth flow and `docs/14-loading-empty-error-states.md` for loading/error UI patterns.
