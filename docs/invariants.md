# Invariants

Non-negotiable rules. If a change violates one of these, it corrupts data, leaks secrets, or breaks the cron pipeline silently. Every PR must leave all invariants intact.

Each invariant includes a **Why**, a **Check** (how to verify it holds), and the consequence of violating it.

---

## Data integrity

### I1. Watchlist metadata is written only by authenticated UI

**Rule**: `watchlist.catalyst`, `price_target`, `priority`, `notes`, `sort_order` are written ONLY by:
- A logged-in user via the metadata edit form (post-MVP).
- The one-shot `scripts/import-watchlist.ts --apply`.

The cron worker writes to `quotes`, `polymarket_markets` (market row updates only), `tweets`, and `refresh_runs`. It NEVER writes to `watchlist`.

**Why**: replaces the regex-preservation logic in `legacy/refresh_all.py`. That code existed because the refresh would otherwise overwrite handwritten catalyst notes and price targets. Moving metadata into its own table removes the regex and the failure mode in one step — but only if the cron never touches `watchlist`.

**Check**:
```ts
// In workers/refresh.ts and any refresh route
// There must be ZERO occurrences of:
supabase.from('watchlist').update(...)
supabase.from('watchlist').upsert(...)   // except in import-watchlist.ts
supabase.from('watchlist').insert(...)   // except in import-watchlist.ts
```

**Violation = silent data loss.** Catalyst notes disappear on the next cron run.

---

### I2. Fail hard on empty source data

**Rule**: Any refresh or import that receives zero rows throws an exception. Never proceed with an empty upsert.

**Why**: If yfinance returns nothing (network hiccup, API shape change), writing zero rows looks the same as a successful refresh. The dashboard silently freezes on yesterday's data.

**Check**:
- `fetchQuotes([])` throws.
- `import-watchlist.ts` throws if the regex parses zero tickers.
- `runRefresh('stocks')` throws if the watchlist is empty.
- Every refresh writes a row to `refresh_runs`; failures set `ok=false` and `error`.

**Violation = undetectable stale data.**

---

### I3. Row-level security is always enforced

**Rule**:
- All 5 tables have `row level security` enabled.
- `authenticated` role: `SELECT` on everything, `UPDATE` on `watchlist` metadata only.
- `anon`: no grants anywhere.
- `service_role`: bypasses RLS — used only by the cron worker and `/api/refresh/*` handlers.

**Why**: the anon key ships to every browser. Without RLS it's a public-read key for the entire database.

**Check**:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- All tables: rowsecurity = true
```

**Violation = full database exposure to anyone who opens the site.**

---

### I4. Quotes/tweets/markets upsert — never delete

**Rule**: The cron overwrites existing rows by `onConflict: 'ticker'` (quotes), `onConflict: 'id'` (tweets), `onConflict: 'slug'` (markets). It never issues `DELETE`.

**Why**: `DELETE + INSERT` opens a race window where the dashboard renders with empty data. Upsert is atomic per row.

**Check**: grep `workers/refresh.ts` for `.delete(` — must return no matches.

**Violation = flicker to empty state + possible data loss on partial refresh failure.**

---

## Security

### I5. Service-role client never reaches the browser

**Rule**: `getServiceClient()` lives in `app/lib/supabase/server.ts` and is imported only by:
- `app/workers/refresh.ts`
- `app/app/api/refresh/*/route.ts`

It must never be imported into a file that contains `'use client'` at the top, or any module that gets bundled into the browser JS payload.

**Why**: the service role key bypasses RLS. If it leaks into the client bundle, any visitor can read/write every table.

**Check**:
```bash
# From web_transition/app/
grep -rn "getServiceClient\|SUPABASE_SERVICE_ROLE_KEY" --include="*.tsx" --include="*.ts" \
  | grep -v "server.ts\|workers/\|api/refresh"
# Must return zero lines.
```

**Violation = critical data breach.**

---

### I6. `/api/refresh/*` is shared-secret gated

**Rule**:
- Middleware `PUBLIC_PATHS` and matcher both exempt `/api/refresh/*` so auth does not block it.
- Each refresh route handler checks `req.headers.get('x-refresh-secret') === process.env.REFRESH_SHARED_SECRET`.
- Mismatch or missing → 401.

**Why**: the cron service and the UI "Refresh now" button both call this endpoint without a user session. The shared secret replaces auth for these callers.

**Check**: every file in `app/app/api/refresh/` starts with a secret-check block before any work.

**Violation = anyone on the internet can trigger the refresh, hammer upstream APIs, and exhaust rate limits.**

---

### I7. Email allowlist checked twice

**Rule**:
- At login-form submission (`sendMagicLink` server action) — reject before sending the email.
- At OAuth callback (`/auth/callback/route.ts`) — after `exchangeCodeForSession`, re-check and `signOut` + redirect to `/403` if the user's email is not allowlisted.

**Why**: a user could paste a magic link URL from someone else's inbox (or manipulate the callback params) to bypass the first check. Defence in depth.

**Check**:
- `grep isAllowed app/lib/auth/allowlist.ts` used in both files.
- E2E test `non-allowlisted email → 403`.

**Violation = any email holder can get in as long as they receive a magic link intended for someone else.**

---

### I8. Content-Security-Policy explicitly allows only known domains

**Rule**: `connect-src` in `next.config.ts` CSP contains:
- `'self'`
- `https://*.supabase.co`
- `https://clob.polymarket.com`
- `https://gamma-api.polymarket.com`

And nothing else without an ADR entry in `decisions/`.

**Why**: an XSS that manages to execute would still be unable to exfiltrate data to an attacker's server.

**Check**: browser devtools → Network → no blocked CSP violations on `/watchlist`.

**Violation = XSS becomes data exfiltration.**

---

## Upstream dependencies

### I9. NDX daily token IDs are auto-detected, never hardcoded

**Rule**: `detectNdxDaily()` runs every cron cycle. If it fails, the worker logs a warning and leaves yesterday's tokens in place for the UI to display stale — but does NOT fall back silently to a guessed slug.

**Why**: the NDX daily Polymarket market has a new slug every trading day. Hardcoded IDs become wrong overnight.

**Check**: grep `workers/ lib/sources/` for string literals matching Polymarket slug patterns — must return zero matches.

**Violation = prices shown are for a different day's market or no market at all.**

---

### I10. Polymarket price = `(bestBid + bestAsk) / 2` from `/book`

**Rule**: Never call `https://clob.polymarket.com/midpoint` — it returns 403. Always fetch `/book?token_id=...` and compute the midpoint from the first bid and first ask.

**Why**: documented in `legacy/context.md`. Saved future-us an hour of debugging.

**Check**: grep for `/midpoint` in `app/` and `lib/` — must return zero matches.

**Violation = HTTP 403 on every Polymarket refresh, panel shows nothing.**

---

### I11. AVEX is NYSE

**Rule**: The `watchlist.exchange` column for `AVEX` is `'NYSE'`, not `'NASDAQ'`. All other current tickers are NASDAQ.

**Why**: AVEX IPO'd on NYSE (AEVEX Corp, 2026-04-22). Defaulting to NASDAQ produces wrong deep-links from the dashboard.

**Check**:
```sql
select ticker, exchange from watchlist where ticker = 'AVEX';
-- exchange = 'NYSE'
```

**Violation = broken external links (Yahoo quote URLs that 404).**

---

## Operational

### I12. `refresh_runs` is written on every attempt, success OR failure

**Rule**: Every invocation of `runRefresh(...)` logs a row to `refresh_runs` before returning or throwing. The row captures `kind`, `started_at`, `finished_at`, `ok`, and (on failure) `error`.

**Why**: this table is the observability primitive for the cron. Without it, silent failure is indistinguishable from success.

**Check**: `runRefresh` wraps its body in try/catch; both branches write `refresh_runs`.

**Violation = impossible to know whether the cron fired or what went wrong.**

---

### I13. Heartbeat pings only on success

**Rule**: `HEARTBEAT_URL` (Better Stack / Cronitor) is pinged at the end of `runRefresh` ONLY when everything succeeded. Failure path skips the ping.

**Why**: the external monitor interprets "no ping within 15 min of expected time" as a failure. Pinging on error defeats the purpose.

**Check**: `if (HEARTBEAT_URL) fetch(...)` is inside the success branch only, after the success `logRun`.

**Violation = cron fails silently for weeks, monitor stays green.**

---

## Quick audit script

Run from `web_transition/`:

```bash
# I5 — service-role leakage
grep -rn "getServiceClient\|SUPABASE_SERVICE_ROLE_KEY" app/ --include="*.tsx" --include="*.ts" \
  | grep -v "server.ts\|workers/\|api/refresh/"

# I9 — hardcoded NDX slugs
grep -rn "nasdaq-100\|nasdaq100" app/ --include="*.ts"

# I10 — Polymarket /midpoint
grep -rn "/midpoint" app/ --include="*.ts"

# I1 — cron writing to watchlist
grep -rn "from('watchlist')" app/workers/ app/app/api/ \
  | grep -E "\.update\(|\.upsert\(|\.insert\("
```

All four commands must return zero lines for the codebase to be compliant.
