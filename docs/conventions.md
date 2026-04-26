# Conventions

Code style, file organisation, and decision defaults. Where the answer isn't here, match the nearest existing file.

---

## Server vs client components

Default to server components. Reach for client components only when unavoidable.

| Need | Component type |
|------|---------------|
| Read Supabase on page load | Server |
| Render a table/list of static or SSR data | Server |
| `useState`, `useEffect`, event handlers | Client (`'use client'`) |
| `setInterval`, `setTimeout` live updates | Client |
| Browser APIs (`location`, `navigator`, DOM) | Client |
| Form submission via server action | Server component + server action |

**Pattern**: keep the page a server component, hoist interactivity into small client islands (`RefreshButton`, `PolymarketPanel`, `SessionCountdown`). Don't mark an entire page `'use client'` just because one button needs state.

---

## Data access

| Context | Client | RLS |
|---------|--------|-----|
| Server component reading for a logged-in user | `getServerClient()` | enforced |
| Server action writing on behalf of a logged-in user | `getServerClient()` | enforced |
| Cron worker / `/api/refresh/*` | `getServiceClient()` | bypassed |
| Client component (rare) | `getBrowserClient()` | enforced |

Never use `getServiceClient()` as a shortcut when you're "pretty sure" RLS should allow it — use `getServerClient()` and fix the RLS policy if it doesn't.

---

## File organisation

```
app/
├── app/                         # App Router routes
│   ├── (auth)/                  # route group: no middleware
│   │   └── login/
│   │       ├── page.tsx
│   │       ├── login-form.tsx   # client component
│   │       └── actions.ts       # server actions
│   ├── (app)/                   # route group: middleware-gated
│   │   ├── layout.tsx
│   │   └── watchlist/
│   │       ├── page.tsx
│   │       ├── stocks-panel.tsx
│   │       ├── polymarket-panel.tsx   # client
│   │       ├── session-countdown.tsx  # client
│   │       ├── refresh-button.tsx     # client
│   │       └── logout-button.tsx      # client
│   ├── auth/callback/route.ts
│   ├── api/
│   │   ├── refresh/all/route.ts
│   │   └── watchlist/route.ts         # metadata edit (post-MVP)
│   ├── 403/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── server.ts            # getServerClient, getServiceClient
│   │   └── client.ts            # getBrowserClient
│   ├── sources/
│   │   ├── yfinance.ts
│   │   ├── polymarket.ts
│   │   └── xapi.ts              # post-MVP
│   ├── auth/
│   │   ├── allowlist.ts
│   │   └── session.ts
│   ├── observability/           # post-MVP
│   │   ├── sentry.ts
│   │   └── healthcheck.ts
│   └── types.ts
├── workers/
│   └── refresh.ts
├── middleware.ts
├── next.config.js
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    ├── contracts/
    └── fixtures/
```

Rules:
- **One source adapter per upstream.** `lib/sources/yfinance.ts` knows only about yahoo-finance2. `lib/sources/polymarket.ts` knows only about Polymarket. Don't share types across adapters.
- **Colocate client sub-components with the route that uses them.** A `polymarket-panel.tsx` lives next to its `page.tsx`, not in a global `components/` folder.
- **`lib/` is route-agnostic.** Anything shared across routes goes here. Anything single-use stays next to its consumer.

---

## Naming

- **Routes**: `page.tsx`, `route.ts`, `layout.tsx` (App Router enforced).
- **Server actions**: `actions.ts` colocated.
- **Client components**: `kebab-case.tsx` (`refresh-button.tsx`).
- **Server components**: `PascalCase.tsx` when pulled out of a page, kebab-case if colocated as sub-views.
- **TS types**:
  - Database row shapes → `snake_case` fields matching Postgres (`price_target`, `fetched_at`).
  - Everything else → `PascalCase` (`WatchlistRow`, `FetchedQuote`).
- **Env vars**:
  - Public → `NEXT_PUBLIC_*` prefix.
  - Server-only → no prefix.

---

## TypeScript

- `"strict": true`. No `any`. No `// @ts-ignore`. No `// @ts-expect-error` without a comment explaining why.
- Prefer `satisfies` over `as` when you want the compiler to narrow without widening.
- Row types in `lib/types.ts` are the single source of truth — generate from Supabase schema where possible (`supabase gen types typescript` post-MVP).

---

## Tailwind + CSS

- Utility classes directly in JSX.
- Parity-critical styles (colours, spacing matching `legacy/morning-watchlist.html`) go in `app/globals.css` under clear section comments.
- Don't fight Tailwind with custom classes unless the utility chain exceeds ~6 classes.

---

## Error handling

- **Never catch and swallow.** If you catch, either re-throw with more context or log to `console.error` + return a typed error shape.
- **User-facing errors**: server actions return `{ ok: false, error: string }`; client renders it inline.
- **Unexpected errors**: thrown → Next error boundary → Sentry (post-MVP).
- **Upstream API failures**: logged to `refresh_runs.error`, raised to the caller, monitored by heartbeat absence.

---

## Testing

| Tier | Folder | When it runs | Budget |
|------|--------|--------------|--------|
| Unit | `tests/unit/` | Every push | Unlimited, keep fast |
| Integration | `tests/integration/` | Every push | ~10 tests, ~30s total |
| E2E (Playwright) | `tests/e2e/` | Every push | **3–5 tests max** |
| Contract | `tests/contracts/` | Mondays 18:00 UTC | 1 per upstream |

E2E is for end-to-end smoke tests: auth flow, watchlist renders, metadata edit. Don't write e2e for logic already covered by unit tests.

Contract tests hit real APIs (yfinance, Polymarket, X). They run weekly to catch upstream shape drift before the cron does.

---

## Commits & branching

- **Branch per phase**: `phase-1-scaffold`, `phase-4-refresh-worker`, etc.
- **PR per phase**, merged to `main` after the phase Gate passes.
- **Commit style**: conventional. `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `docs: ...`.
- **Commit body**: explain the *why*, not the *what* (the diff shows what).
- **Never force-push** to `main` or a shared branch.
- **Every commit** should leave `npm run typecheck && npm run lint && npm test` green.

---

## Adding a new upstream data source

1. Create `lib/sources/<source>.ts` with a typed `fetch<Thing>()` function.
2. Add a contract test in `tests/contracts/<source>.contract.ts`.
3. Update `workers/refresh.ts` to call it inside the try/catch + `logRun` block.
4. Update CSP `connect-src` in `next.config.js` if the client calls it.
5. Update `docs/data-flow.md` diagram.
6. Write an ADR in `decisions/` if the source choice has trade-offs.

---

## Adding a new environment variable

1. Add to `app/.env.example` with a placeholder.
2. Add to `infra/env-vars.md` with purpose and rotation notes.
3. Add to Railway project-level Shared Variables.
4. If client-exposed → prefix `NEXT_PUBLIC_`.
5. Reference with `process.env.X!` only where you've already validated it exists (bootstrap validation is post-MVP).

---

## Before shipping any change

- [ ] Re-read every file you edited. Check imports, unused code, broken references.
- [ ] `npm run typecheck` green.
- [ ] `npm run lint` green.
- [ ] `npm test` green.
- [ ] Manual smoke on `http://localhost:3000` if UI changed.
- [ ] Invariants in `docs/invariants.md` all still hold (run the audit script).
- [ ] `docs/` or `decisions/` updated if the change affects architecture.
