# Performance Budget — RetireAU Dashboard

## BLUF

RetireAU is a solo-user web app with no SEO pressure and no search engine visibility requirements. The performance budget prioritises rapid edit-mode responsiveness and snappy chart rendering over lighthouse scores, but we maintain a high baseline (>90 desktop, >80 mobile) to future-proof for slower devices and network conditions. The app is entirely client-side computation, so network latency is the only server dependency; the browser CPU is the bottleneck for chart rendering and mortgage amortisation calculations. Core Web Vitals targets are LCP <2.5s, INP <200ms, CLS <0.1. JavaScript bundle capped at 500 KB gzipped. Calculation performance must complete in <5ms per operation (e.g. `calcMortgageSchedule` for 30 years). Edit-mode keystroke-to-visual-update must complete in <16ms (one browser frame at 60 FPS).

---

## Core Web Vitals Targets

### Desktop (Unconstrained Network & CPU)

| Metric | Good | Acceptable | Poor |
|--------|------|-----------|------|
| **LCP** (Largest Contentful Paint) | <2.5s | <4.0s | >4.0s |
| **INP** (Interaction to Next Paint) | <200ms | <500ms | >500ms |
| **CLS** (Cumulative Layout Shift) | <0.1 | <0.25 | >0.25 |

Target: All three in "Good" range.

### Mobile (Throttled 4G, Moto G4 CPU)

| Metric | Good | Acceptable |
|--------|------|-----------|
| **LCP** | <3.5s | <5.0s |
| **INP** | <200ms | <500ms |
| **CLS** | <0.1 | <0.25 |

Target: LCP in "Good", INP in "Good", CLS in "Good".

---

## JavaScript Bundle Budget

### Initial Page Load

```
Initial JS <200 KB gzipped
├── React + Next.js runtime        ~90 KB
├── Zustand                         ~2 KB
├── Zod                             ~12 KB
├── Clerk SDK                       ~40 KB
├── Chart.js (core only, dynamic)   ~20 KB
├── CSS-in-JS / Tailwind            ~15 KB
└── App code (pages + shared)       ~21 KB
────────────────────────────────────────
Total                              ~200 KB gzipped
```

### Per-Route Split

Each route must not exceed:
```
Per-route additional JS <60 KB gzipped
```

### Total Across App

```
Full app JS (all routes, minus duplicates) <500 KB gzipped
```

Verification: `npm run build && npx @next/bundle-analyzer@latest .next`

---

## Chart.js Budget and Dynamic Loading

Chart.js is ~150 KB ungzipped. Load it dynamically only on routes that render charts:

```typescript
const Chart = dynamic(() => import('react-chartjs-2'), { ssr: false });
```

Routes with charts: /dashboard, /dashboard?tab=family-property, /dashboard?tab=debt, /dashboard?tab=budget

Routes without charts: /, /features, /sign-in, /sign-up, /settings

Impact: Main dashboard loads Chart.js once, lazy-loaded after initial paint.

---

## Image and Font Budget

### Images

v1 imagery:
- Favicon (16×16, 1 KB)
- Logo (if any, SVG, <2 KB)
- No hero images, background photos, or image charts

Total: <5 KB

### Fonts

System font stack (no webfont downloads):

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Font budget: 0 KB (system fonts already on device).

Future (post-v1): Custom fonts use `font-display: swap`.

---

## Network Budget

### Initial Page Load

```
Total requests      <50
Total transfer      <1 MB uncompressed, <300 KB gzipped
```

Breakdown:
- HTML document: <50 KB
- Initial JS: <200 KB gzipped
- CSS (inline): <15 KB
- Favicon: <1 KB
- External APIs: <5 KB (Clerk, Sentry)

### Per-User API Calls

- GET /api/config on mount — 1 call
- POST /api/config on save (debounced 5 sec) — ~1 per minute of active use
- GET /api/health (optional) — 1 per session

Total for 30-min session: ~5–10 calls. Each response: <50 KB.

---

## Calculation Performance

### Mortgage Schedule Calculation

`calcMortgageSchedule(principal, rate, yearsTotal, ioYears, mode)` — 30-year table, O(n).

Target: <5ms per call.

Measurement:
```typescript
const start = performance.now();
const schedule = calcMortgageSchedule(1_100_000, 0.056, 30, 5, 'io-then-pi');
console.log(`${(performance.now() - start).toFixed(2)}ms`);
```

Acceptance: <5ms on 2019 MacBook Pro. <15ms on Moto G4.

### Super Projection Calculation

`calculateSuperProjection(user1, user2, years, returnRate)` — 35 years, O(n).

Target: <3ms per call.

### Family Property Projection

`calculateFamilyPropertyProjection(property, mortgage, years)` — 30 years.

Target: <5ms per call.

### Memoisation Rule

If calculation input hasn't changed, return cached result. Use hash of relevant config slice as key:

```typescript
const configHash = hashObject({ user1Super, user2Super, mortgageRate, ... });
if (configHash === lastMemoHash && lastResult !== null) return lastResult;
```

Impact: Reduces redundant calcs ~40% in typical edit sessions.

---

## Re-Render Budget

### Zustand Subscription Pattern

State divided into slices. Changing one field triggers <5 component re-renders:

```typescript
const superSlice = createSlice(state => ({
  user1Super: state.profile.user1.superBalance,
  user2Super: state.profile.user2.superBalance,
}));

const SuperProjectionChart = () => {
  const { user1Super, user2Super } = superSlice();
  // Only re-renders if user1Super or user2Super change
};
```

Verification: React Profiler → DevTools → record re-render → check "Components rendered" column.

---

## Edit Mode Responsiveness

### Keystroke to Visual Update

Keystroke → Zustand store update (sync) → component re-render → browser paint **<16ms** (one 60 FPS frame).

Target: Input field shows typed character before next frame tick. Charts/KPI cards update within same or next frame.

### Debounced Cloud Sync

Edit → local Zustand store instant update → debounced POST to cloud (400ms).

Rationale: Instant visual feedback, batched network requests.

---

## Build Time Budget

```
npm run build
# Expected: <60 seconds on modern machine (2019+ MacBook, 2020+ Thinkpad)
```

Verification:
```bash
time npm run build
# real 0m42s
```

Acceptance: <60s wall-clock time. If >90s, investigate missing cache, too many static pages, or slow dependencies.

---

## Test Performance

### Unit Test Suite (Vitest)

```
npm test
# Expected: <30 seconds
```

### Playwright E2E Smoke Test

```
npm run test:e2e
# Expected: <5 minutes for core user flows
```

---

## Performance Measurement and Monitoring

### Lighthouse CI in GitHub Actions

Every PR runs Lighthouse audit with minimum thresholds:
- Performance: ≥85
- Accessibility: ≥90
- Best Practices: ≥85

### Web Vitals Reporting to Sentry

App emits Core Web Vitals on every page load:

```typescript
import { reportWebVitals } from 'web-vitals';

reportWebVitals((metric) => {
  if (['LCP', 'INP', 'CLS'].includes(metric.name)) {
    Sentry.captureMessage(`Web Vital: ${metric.name} = ${metric.value.toFixed(2)}`, 'info', {
      tags: { metric: metric.name },
      measurements: { [metric.name]: metric.value },
    });
  }
});
```

Monitoring: Sentry dashboard → Metrics → filter by metric:LCP/INP/CLS. Track p75 and p95.

### Bundle Analyser

`npm run build` generates `.next/analyze/bundles.html` with per-route breakdown.

### Performance Regression Check

CI enforces bundle size regression:
```bash
# Bundle grows >10%? PR rejected.
```

---

## Optimisation Techniques to Apply

### Server Components

Use Next.js App Router server components where possible:

```typescript
// app/layout.tsx (server by default)
export const metadata = { ... };
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

Impact: Layout JS never sent to browser.

### Client Components for Interactivity

Only mark components `'use client'` if they need interactivity:

```typescript
// components/ControlPanel.tsx
'use client';
import { useConfig } from '@/lib/store';

export function ControlPanel() {
  const { config, updateField } = useConfig();
  return <input onChange={(e) => updateField(...)} />;
}
```

Impact: Static layout streamed first (fast FCP).

### Image Component

If images added post-v1, use `next/image`:

```typescript
import Image from 'next/image';
export function Logo() {
  return <Image src="/logo.svg" alt="RetireAU" width={100} height={100} />;
}
```

Benefits: Auto lazy loading, format selection (WebP), responsive sizing.

### Font Optimisation (Future)

If webfonts added, use `font-display: swap`:

```css
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap;  /* System font until custom font loads */
}
```

---

## Techniques NOT to Apply in v1 (YAGNI)

- **PWA / Service Worker**: Not needed for personal web app. Deferred to post-v1.
- **Edge Runtime**: Railway doesn't support edge. Deferred to Vercel migration (future).
- **ISR (Incremental Static Regeneration)**: All pages are per-user dynamic. Not applicable.
- **Streaming / Suspense Boundaries**: Add complexity. Simple client-side navigation suffices for v1.

---

## Acceptance Criteria for Ship

| Criterion | Target | Verification |
|-----------|--------|--------------|
| Lighthouse Performance (desktop) | >90 | `npm run lighthouse:local` |
| Lighthouse Performance (mobile) | >80 | (same) |
| LCP (desktop) | <2.5s | Lighthouse report |
| LCP (mobile, 4G) | <3.5s | DevTools Throttle 4G |
| INP (desktop) | <200ms | Core Web Vitals in Sentry |
| INP (mobile, 4G) | <200ms | (same) |
| CLS | <0.1 | (same) |
| Initial JS bundle | <200 KB gzipped | `@next/bundle-analyzer` |
| Total JS across app | <500 KB gzipped | (same) |
| Mortgage calculation | <5ms | Performance timer in test |
| Edit keystroke → visual | <16ms | React Profiler |
| Build time | <60s | `time npm run build` |
| Unit tests | <30s | `npm test` |
| E2E tests | <5 min | `npm run test:e2e` |

---

## References

- docs/01-architecture-overview.md — Stack and architecture.
- docs/08-calculation-engine.md — Calculation complexity.
- docs/09-chart-configs.md — Chart types and data flow.
- docs/12-state-management.md — Zustand slices.
- docs/13-edit-mode-forms.md — Input handling and debouncing.
- docs/19-observability.md — Web Vitals reporting.
- DEFINITION_OF_DONE.md — Performance acceptance (Gate 7).
