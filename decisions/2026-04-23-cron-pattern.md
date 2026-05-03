## Decision: Railway cron service invoking a standalone Node worker

## Context
`refresh_all.py` runs via a Windows scheduled task at 07:00 AEST daily. The web port needs the same cadence without depending on a user's local machine.

## Alternatives considered
- **Next.js API route + external scheduler** (Cloudflare Cron Triggers, cron-job.org) hitting `/api/refresh/all` with a shared secret.
- **Supabase pg_cron** calling Edge Functions.
- **Railway cron service running `node workers/refresh.ts`** as a separate Railway service.

## Reasoning
- Railway cron is first-class, lives next to the app, shares env vars, shows logs in the same place.
- Decoupling the worker from the HTTP request lifecycle means slow refreshes (yfinance hiccups, X rate limits) don't hit serverless timeouts.
- A standalone entry (`workers/refresh.ts`) can also be invoked manually for partial refreshes (`--stocks`, `--poly`, `--tweets`), preserving current UX.

## Trade-offs accepted
- UTC-only cron → 1-hour DST drift twice a year. Accepted; the dashboard is used with morning coffee, not for order execution.
- Separate Railway service adds ~$5/mo vs a single-service deploy. Acceptable.
- Manual "Refresh now" button in the UI calls the same worker via `/api/refresh/all` with the shared secret — two entry points, one implementation.
