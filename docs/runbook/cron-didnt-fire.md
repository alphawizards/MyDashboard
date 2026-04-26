# Cron didn't fire

**Symptom**: no heartbeat ping at 07:00 AEST, no new row in `refresh_runs`, stale `quotes.fetched_at`.

## Diagnose
1. Railway → `dashboard-cron` service → Logs. Did the process start?
2. Supabase → `refresh_runs` → last row. `ok=true` or `ok=false`?
3. If `ok=false`: read `error` column + check Sentry for stack trace.
4. If no row at all: Railway cron didn't trigger. Check service is enabled and schedule is correct (`0 21 * * *` UTC).

## Fix
- **Process crashed pre-cron**: check build logs, redeploy.
- **Upstream API down** (yfinance/X/Polymarket): wait or run partial refresh for the working sources.
- **Bearer token expired**: see `x-bearer-rotated.md`.
- **Schedule wrong**: edit in Railway UI.

## Recover data
If refresh hasn't run for N days and you need a backfill, trigger manually:
```
Railway → dashboard-cron → Run now
```
Or UI → "Refresh now" button.
