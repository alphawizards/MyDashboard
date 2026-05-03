# Phase Checklist

Tracks progress against `tasks/phases/README.md`.

## Phase 0 — Decisions & Accounts
- [ ] Domain + Cloudflare access confirmed
- [ ] Railway project created
- [ ] Supabase project created
- [ ] X bearer token verified
- [ ] REFRESH_SHARED_SECRET generated
- [ ] yfinance spike: `decisions/2026-04-23-yfinance-replacement.md`
- [ ] Polymarket CORS verified

## Phase 1 — Scaffold & Deploy Empty App
- [x] Next.js scaffold at `web_transition/app/`
- [x] Security headers in `next.config.ts`
- [ ] `.env.example` with all MVP keys
- [x] Vitest installed, `npm test` passes
- [ ] Railway auto-deploys on push
- [ ] `https://dashboard.<apex>` serves HTTPS
- [ ] Cloudflare proxy (orange cloud) + Full-strict TLS

## Prototype Parity Track â€” Static Local Web App
- [x] Default starter page removed from `/`
- [x] Typed static data generated from current local HTML dashboards
- [x] `/feed` route renders Sikand, Wolff, Serenity, and BryzonX tweets
- [x] `/feed` includes ticker filters, search, hot filter, all-feed view, and per-author views
- [x] Multi-account overlap logic includes BryzonX and is unit-tested
- [x] `/watchlist` route renders current static watchlist data
- [x] `/portfolios` route renders Sikand Autopilot portfolio and Wolff placeholder tab
- [x] `/api/refresh/all` skeleton exists with shared-secret guard behavior
- [x] Local HTTP smoke test documented after final verification

## Phase 2 — Schema & Seed
- [ ] `schema/001_initial.sql` applied
- [ ] `schema/002_rls_policies.sql` applied
- [ ] `schema/003_ndx_kind_unique.sql` applied
- [ ] `scripts/import-watchlist.ts` dry-run clean
- [ ] Seeded 10 tickers with full metadata
- [ ] AVEX exchange = NYSE
- [ ] polymarket_markets seeded (2/3 tokens populated; NDX pending)

## Phase 3 — Watchlist Read Path
- [ ] `/watchlist` renders 10 tickers
- [ ] Polymarket panel live-polls every 15s
- [ ] Session countdown accurate (ET → AEST)
- [ ] Invariant I5 carve-out documented (expires Phase 5)

## Phase 4 — Refresh Worker & Cron
- [ ] `lib/sources/yfinance.ts` + contract-ready types
- [ ] `lib/sources/polymarket.ts` with NDX auto-detect
- [ ] `workers/refresh.ts` end-to-end local run
- [ ] `/api/refresh/all` with shared-secret guard
- [ ] Railway cron service `dashboard-cron` @ `0 21 * * *`
- [ ] `refresh_runs` row on every invocation (invariant I12)
- [ ] Manual "Refresh now" button wired

## Phase 5 — Auth Gate
- [ ] Supabase magic-link auth enabled
- [ ] `lib/auth/allowlist.ts` with `isAllowed()`
- [ ] Login page + server action
- [ ] Callback handler rechecks allowlist (invariant I7)
- [ ] Middleware gate + matcher verified for `/api/refresh`
- [ ] `page.tsx` swapped to `getServerClient()` (invariant I5 audit passes)
- [ ] CSP added to `next.config.ts` with invariant I8 domains
- [ ] Logout button

## Phase 6 — MVP Test, Polish, Decommission
- [ ] Fresh-eyes walkthrough documented
- [ ] Cron fired autonomously (confirmed via `refresh_runs`)
- [ ] Top-3 friction fixes shipped
- [ ] Windows scheduled task disabled
- [ ] Parity checklist filled
- [ ] Invariant audit returns zero lines (all 4 greps)
- [ ] `tasks/lessons.md` updated
- [ ] Tag `mvp-v0.1.0`

## Review (fill after each phase)
- Phase 0 review:
- Phase 1 review:
- Phase 2 review:
- Phase 3 review:
- Phase 4 review:
- Phase 5 review:
- Phase 6 review:
