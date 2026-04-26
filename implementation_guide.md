# Morning Dashboard — Web App Implementation Guide

## 1. Current State (Local)

| File | Role |
|------|------|
| `morning-watchlist.html` (1,263 LOC) | Self-contained dashboard: stocks + Polymarket odds + session countdowns |
| `sikand-feed.html` (1,059 LOC) | Static X feed for @michaelsikand & @peterjwolff |
| `refresh_all.py` (425 LOC) | Fetches yfinance + Polymarket + X data, injects into HTML via regex |
| `config.json` | Bearer token + settings (secrets) |
| `run_refresh.bat` + Task Scheduler | Runs daily at 07:00 AEST |

**Data sources:** yfinance (stocks), Polymarket CLOB `/book` (odds, live in-browser), X API v2 (server-side, baked in).
**Preservation quirk:** `refresh_all.py` uses targeted regex on a JS object literal to retain catalyst notes / price targets / priorities across refreshes. This logic must survive the port.

---

## 2. Target Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Cloudflare (DNS + proxy + WAF + cache)                       │
│    dashboard.<yourdomain>  →  Railway (Next.js)               │
└───────────────────────────────────────────────────────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
   ┌──────────────────┐          ┌──────────────────┐
   │  Next.js 15 App  │          │  Supabase        │
   │  (Railway)       │◄────────►│   - Postgres     │
   │                  │          │   - Auth         │
   │  - App Router    │          │   - Row-level    │
   │  - Server Actions│          │     security     │
   │  - API routes    │          └──────────────────┘
   │  - Cron jobs     │
   └──────────────────┘
             │
             ▼
   yfinance (via yahoo-finance2 npm) · Polymarket CLOB · X API v2
```

**Why this split:**
- **Cloudflare** — DNS, TLS, DDoS/WAF, edge caching for public GETs. Free tier is sufficient.
- **Railway** — runs the Next.js server + a scheduled worker (cron) that replaces `refresh_all.py`. Simple Git-push deploys, built-in cron, persistent env vars.
- **Supabase** — Postgres for watchlist state + preserved metadata, Auth for gating the dashboard, realtime for live UI updates (replaces file regex).
- **Next.js** — single codebase for UI + API. Server components keep the X bearer token server-only (same security posture as current Python).

---

## 3. Like-for-Like Mapping

| Local behaviour | Web equivalent |
|-----------------|----------------|
| HTML file with embedded JS constants | Next.js page reading from Supabase at request time (SSR) or via SWR |
| `refresh_all.py` scheduled task | Railway cron job → Next.js API route (or standalone Node worker) on same schedule (07:00 AEST) |
| Regex-preserved metadata (catalyst, target, priority) | Postgres columns on a `watchlist` table — edits go through an authenticated form, never overwritten by refresh |
| Polymarket live refresh in browser | Keep client-side fetch to CLOB `/book` (CORS-open) — no change |
| X tweets baked static | Cron writes tweets to `tweets` table; page reads latest 20 per user |
| `config.json` bearer token | Railway env vars + Supabase service role key (server-only) |
| CSP + `safeOpen()` allowlist | Port headers into `next.config.js` `headers()` + middleware |
| Session countdown (ET → AEST) | Same client JS, unchanged |

---

## 4. Data Model (Supabase)

```sql
-- Preserves the metadata that refresh_all.py protects today
create table watchlist (
  ticker text primary key,
  exchange text,
  catalyst text,
  price_target numeric,
  priority int,
  notes text,
  sort_order int,
  updated_at timestamptz default now()
);

create table quotes (              -- overwritten each refresh
  ticker text primary key references watchlist(ticker) on delete cascade,
  price numeric, change_pct numeric,
  volume bigint, avg_vol_10d bigint,
  market_cap numeric, day_range text,
  fetched_at timestamptz default now()
);

create table polymarket_markets (
  slug text primary key,
  title text, kind text,           -- 'ndx_daily' | 'recession_2026' | 'spx_yearend_2026'
  token_yes text, token_no text,
  auto_detect boolean default false,
  detected_for_date date
);

create table tweets (
  id text primary key,
  author_handle text, author_id text,
  posted_at timestamptz, text text,
  url text, fetched_at timestamptz default now()
);

create table refresh_runs (
  id bigserial primary key,
  kind text,                       -- 'stocks' | 'poly' | 'tweets' | 'all'
  started_at timestamptz, finished_at timestamptz,
  ok boolean, error text
);
```

RLS: authenticated-read-only on all tables; writes restricted to the service role used by the cron job.

---

## 5. Project Layout

```
apps/dashboard/
  app/
    (auth)/login/page.tsx
    (app)/
      watchlist/page.tsx            ← morning-watchlist.html equivalent
      feed/page.tsx                 ← sikand-feed.html equivalent
      layout.tsx                    ← shared nav + session countdown
    api/
      refresh/stocks/route.ts       ← POST, bearer-protected, called by cron
      refresh/polymarket/route.ts
      refresh/tweets/route.ts
      watchlist/route.ts            ← PATCH metadata (catalyst, target, priority)
  lib/
    supabase/{server,client}.ts
    sources/
      yfinance.ts                   ← yahoo-finance2 wrapper
      polymarket.ts                 ← gamma + CLOB /book
      xapi.ts                       ← X API v2, server-only
  workers/
    refresh.ts                      ← standalone entry; Railway cron invokes this
  next.config.js                    ← CSP + security headers
  middleware.ts                     ← auth gate
```

---

## 6. Cron / Refresh Strategy

Two viable patterns — pick one:

**A. Railway cron service (recommended).** Separate Railway service, `node workers/refresh.ts`, scheduled `0 21 * * *` UTC (07:00 AEST non-DST). Same process can be triggered manually for partial refreshes (`--stocks`, `--poly`, `--tweets`) via CLI flags, mirroring current UX.

**B. Next.js API route + external scheduler.** `/api/refresh/all` protected by a shared secret, called by Cloudflare Cron Triggers or Railway cron `curl`. Simpler but couples scheduling to HTTP.

The **metadata-preservation invariant from `refresh_all.py` moves into the database**: the refresh writes only to `quotes` / `tweets` / market prices. `watchlist.catalyst/target/priority/notes` is never touched by the cron — only by the authenticated edit form. This eliminates the regex-parser failure mode entirely.

---

## 7. Security Port

| Current | Web port |
|---------|----------|
| `config.json` secrets | Railway env vars (`X_BEARER_TOKEN`, `SUPABASE_SERVICE_ROLE`, `REFRESH_SHARED_SECRET`) |
| CSP in `<meta>` | `Content-Security-Policy` header in `next.config.js` |
| `rel="noopener noreferrer"` | Lint rule + shared `<ExternalLink>` component |
| `safeOpen()` allowlist | Same helper, ported to TS |
| Private dashboard | Supabase Auth (magic link or GitHub OAuth) + middleware redirect |
| Bearer never in HTML | X API only called from server components / API routes |

Cloudflare adds: TLS, bot fight mode, rate limit on `/api/refresh/*`, country allowlist if desired.

---

## 8. Phased Rollout

**Phase 1 — Scaffold & schema (1 day)**
- `create-next-app`, push to GitHub, connect Railway.
- Create Supabase project, run schema, seed `watchlist` from current `config.json` + HTML regex dump.
- Cloudflare DNS: `dashboard.<domain>` → Railway; enable proxy.

**Phase 2 — Read path (1–2 days)**
- Port `morning-watchlist.html` UI to `/watchlist` (server component reads Supabase, client island handles live Polymarket + countdown).
- Port `sikand-feed.html` to `/feed`.
- Visual parity pass — pixel-match the current layout (copy CSS from existing HTML verbatim, then modularise).

**Phase 3 — Write path (1 day)**
- Port `refresh_all.py` to `workers/refresh.ts` (yahoo-finance2, Polymarket gamma + CLOB, X API).
- Wire Railway cron, verify 07:00 AEST fires.
- Add manual "Refresh now" button (auth-gated) hitting the same worker.

**Phase 4 — Auth & hardening (0.5 day)**
- Supabase Auth, middleware gate, CSP header, `/api/refresh/*` shared-secret guard.
- Metadata edit form on `/watchlist` (inline edit catalyst / target / priority).

**Phase 5 — Decommission (0.5 day)**
- Disable Windows scheduled task.
- Keep local HTML as offline fallback; archive `refresh_all.py` in repo under `legacy/`.

---

## 9. Key Decisions to Confirm Before Build

1. **Auth model** — single-user (just you) or shared with collaborators? Drives Supabase Auth config.
2. **Railway vs Supabase Edge Functions for cron** — Railway cron is simpler and matches "one Node process"; Supabase Edge Functions work but add a second runtime.
3. **yfinance replacement** — `yahoo-finance2` npm package is the closest equivalent; confirm the fields used (`averageVolume10days` fallback) are all available.
4. **X API cost** — current script uses v2 user timeline; confirm the tier on your bearer token supports the daily poll volume at the new URL.
5. **DST handling for cron** — Railway cron is UTC-only. Either set to `21:00 UTC` and accept 1-hour drift across AEST DST, or run twice and no-op the second.

---

## 10. Risks / Gotchas to Carry Forward

- **NDX daily token IDs rotate** — auto-detect must run before CLOB fetch each day. Port the gamma-API detection logic as-is.
- **Polymarket `/midpoint` returns 403** — keep using `/book` and compute `(bestBid+bestAsk)/2`.
- **`AVEX` is NYSE-listed** — exchange column in `watchlist` must be populated, not inferred.
- **yfinance rate limits** — space out ticker fetches or batch via `yahoo-finance2.quote([...tickers])`.
- **CORS for Polymarket in browser** — confirmed open today; if it regresses, move the fetch server-side and poll via SWR against our own API.
- **Do not lose the "fail hard on zero tickers parsed" behaviour** — port as a DB transaction: refresh aborts if `quotes` upsert would produce zero rows.
