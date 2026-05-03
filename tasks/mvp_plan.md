# MVP Plan — Working Prototype End-to-End

**Goal**: a deployed, auth-gated URL showing the watchlist with live data, refreshed daily, that you can actually open on your phone and use. Not production-polished — testable.

**Timebox**: ~4 working days, single developer.

**MVP scope = only these**:
1. `/watchlist` page: stocks panel + Polymarket panel, SSR'd from Supabase, live Polymarket updates in browser.
2. Daily cron refresh (07:00 AEST equivalent) writes `quotes` + `polymarket_markets`.
3. Manual "Refresh now" button in UI.
4. Auth: magic link + email allowlist (just your email).
5. Deployed at `dashboard.<domain>` behind Cloudflare.

**Explicitly deferred — NOT in MVP**:
- `/feed` (X tweets page) — add post-MVP.
- Inline metadata edit UI — for MVP edit catalyst/target via direct SQL.
- Pixel parity with legacy — functional, not pretty.
- Mobile polish.
- Contract tests, Sentry, heartbeat.
- Rate limits, WAF rules (beyond Cloudflare defaults).
- Staging environment.

---

## Phase 0 — Decisions & Accounts (~2h)

**Goal**: unblock all downstream work. No code written.

| Task | Verify |
|------|--------|
| Confirm Cloudflare account + target domain | DNS zone active in dashboard |
| Create Railway project, link GitHub | Empty project visible |
| Create Supabase project (free tier) | Project URL + anon key + service role in hand |
| Obtain X bearer token (reuse current one) | `curl` test returns 200 |
| Spike: `yahoo-finance2.quote(['AAPL','MU'])` returns the fields used in `refresh_all.py` | Field diff documented in `decisions/2026-04-23-yfinance-replacement.md` |
| Generate `REFRESH_SHARED_SECRET` | `openssl rand -hex 32` → saved to 1Password/keeper |

**Gate to Phase 1**: all accounts live, yfinance spike has zero field gaps, or gaps have a documented workaround.

---

## Phase 1 — Scaffold & Deploy Empty App (~4h)

**Goal**: `https://dashboard.<domain>` returns a "Hello world" Next.js page over HTTPS.

| Task | Verify |
|------|--------|
| `cd app && npx create-next-app@latest . --ts --app --tailwind --eslint` | `npm run dev` shows default page |
| Add `next.config.js` stub with security headers placeholder | Build passes |
| Commit + push to GitHub | Repo has `app/` with Next scaffold |
| Connect Railway to repo, set root dir = `web_transition/app` | Railway build succeeds |
| Set env vars in Railway: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `X_BEARER_TOKEN`, `REFRESH_SHARED_SECRET` | Vars visible in Railway UI |
| Add Cloudflare CNAME `dashboard` → Railway target, proxied | `dig dashboard.<domain>` returns Cloudflare IPs |
| Open `https://dashboard.<domain>` | Next.js default page loads over HTTPS |

**Gate to Phase 2**: URL publicly accessible, HTTPS, deployments trigger on git push.

---

## Phase 2 — Schema & Seed (~3h)

**Goal**: Supabase has the tables and current watchlist data.

| Task | Verify |
|------|--------|
| Run `schema/001_initial.sql` in Supabase SQL editor | Tables present, `refresh_runs` empty |
| Run `schema/002_rls_policies.sql` | RLS enabled on all tables |
| Write `scripts/import-watchlist.ts` — parse `legacy/morning-watchlist.html` `defaultStocks` | Dry-run prints all 10 tickers with catalyst/target/priority |
| Dry-run + diff against parent HTML by eye | Zero data loss |
| `--apply` writes to Supabase | `select count(*) from watchlist` = 10 |
| Insert 3 polymarket_markets rows manually (NDX auto-detect, recession, SPX) | 3 rows with correct `kind` |
| Anon read test: `curl` Supabase REST without JWT | 401 (RLS working) |
| Service-role read test: `curl` with service-role key | Data returned |

**Gate to Phase 3**: `watchlist` has all your tickers with catalyst notes intact.

---

## Phase 3 — Watchlist Read Path (~1 day)

**Goal**: `/watchlist` renders stocks + Polymarket panels with real data from Supabase. No auth yet (temporarily public for testability).

| Task | Verify |
|------|--------|
| `app/lib/supabase/{server,client}.ts` — typed clients | TS compiles |
| `app/app/watchlist/page.tsx` — server component, reads `watchlist ⋈ quotes` | Page renders table with tickers (prices null for now) |
| Port stocks panel CSS from `legacy/morning-watchlist.html` (copy verbatim, modularise later) | Visual structure matches legacy ±50px |
| Client island `<PolymarketPanel>` — polls CLOB `/book` every 15s | Midpoints update without page reload |
| Session countdown client component (ET → AEST) | Counter ticks, correct timezone |
| Loading + empty states | No flash of empty table |

**Gate to Phase 4**: open the deployed URL, see all tickers, see Polymarket prices moving.

---

## Phase 4 — Refresh Worker & Cron (~1 day)

**Goal**: fresh data lands in Supabase automatically at 07:00 AEST.

| Task | Verify |
|------|--------|
| `app/lib/sources/yfinance.ts` — wraps `yahoo-finance2.quote()` | Unit test returns mapped fields |
| `app/lib/sources/polymarket.ts` — gamma auto-detect + CLOB `/book` | Returns today's NDX slug + midpoints |
| `app/workers/refresh.ts` — orchestrates all three sources, upserts Supabase, writes `refresh_runs` row | `npx tsx workers/refresh.ts` locally updates Supabase + creates row with `ok=true` |
| **Invariant test**: if yfinance returns zero rows, throw; `refresh_runs` gets `ok=false` | Unit test passes |
| `app/api/refresh/all/route.ts` — POST, guarded by `REFRESH_SHARED_SECRET` header | `curl` with secret returns 200; without returns 401 |
| Add second Railway service `dashboard-cron` running `node dist/workers/refresh.js` | Service builds + deploys |
| Railway cron schedule `0 21 * * *` UTC | Schedule visible |
| Manual "Run now" in Railway | `refresh_runs` gets new row; `quotes.fetched_at` updates; dashboard shows fresh prices |
| "Refresh now" button on `/watchlist` → POSTs to `/api/refresh/all` | Button click → new refresh_runs row |

**Gate to Phase 5**: wait one calendar day. Confirm 07:00 AEST cron auto-fired and data refreshed without manual intervention.

---

## Phase 5 — Auth Gate (~4h)

**Goal**: only you can see the dashboard.

| Task | Verify |
|------|--------|
| Enable Supabase Auth → magic link provider | Auth config saved |
| `app/lib/auth/allowlist.ts` — hardcoded `['matthewdlee335@gmail.com']` | TS compiles |
| `app/app/(auth)/login/page.tsx` — email input → Supabase `signInWithOtp` | Magic link arrives in inbox |
| `app/middleware.ts` — redirect to `/login` unless authenticated AND email in allowlist | Incognito hit to `/watchlist` → bounces to `/login` |
| Logout button in header | Click logs out, returns to `/login` |
| Allowlist reject test: sign in with a non-allowlisted email → 403 page | 403 shown, session cleared |

**Gate to Phase 6**: you on your phone → magic link → dashboard loads. Incognito → blocked.

---

## Phase 6 — MVP Test & Polish (~4h)

**Goal**: test the thing like a real user, fix what's broken, call it shipped.

| Task | Verify |
|------|--------|
| Fresh-eyes walkthrough — you, on your phone, no context | Note every friction point |
| Trigger manual refresh from the button; confirm updates on phone | Prices changed |
| Wait for the 07:00 AEST auto-refresh tomorrow morning | `refresh_runs` has an automatic row |
| Fix top 3 friction points from walkthrough | Fixed and redeployed |
| Disable the Windows scheduled task for `refresh_all.py` | Task Scheduler shows disabled |
| Fill `docs/parity-checklist.md` — mark what's parity vs deferred | Document committed |
| Update `tasks/todo.md` — Phase 1–5 boxes checked, Phase 6+ = post-MVP backlog | `todo.md` reflects reality |

**MVP is done when**:
- You can access the dashboard on your phone with a magic link.
- Stocks and Polymarket panels render with today's data.
- The cron fired on its own at 07:00 AEST and you didn't have to do anything.
- The local Windows scheduled task is off and nothing broke.

---

## Post-MVP Backlog (prioritised, do next)

1. `/feed` page with X tweets.
2. Inline metadata edit form (catalyst / target / priority).
3. Sentry + heartbeat (observability) — this is what will save you when the silent cron failure hits.
4. Contract tests running weekly.
5. CSP header + `safeOpen()` allowlist port.
6. Pixel-parity polish.
7. Mobile viewport pass.
8. Rate limits on `/api/refresh/*`.

---

## Risk Register

| Risk | Probability | Mitigation |
|------|-------------|------------|
| yfinance field drift (Yahoo silently changes shape) | Medium | Phase 0 spike + weekly contract test post-MVP |
| X API tier insufficient | Medium | Phase 0 check; fall back to static JSON for MVP |
| Polymarket CORS regression | Low | `docs/runbook/polymarket-cors-broke.md` has the fix |
| NDX token auto-detect fails | Medium | `docs/runbook/ndx-token-not-detected.md` has manual override |
| Railway cron drift | Low | DST-tolerant (already accepted) |
| Supabase free tier limits hit | Very low | Single user, ~5MB data; nowhere near 500MB cap |
