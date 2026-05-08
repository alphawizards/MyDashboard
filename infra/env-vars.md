# Environment Variables

All secrets live in Railway env vars. Never committed.

| Var | Used by | Where set | Notes |
|-----|---------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Railway + `.env.local` | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Railway + `.env.local` | Public, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | worker + API routes | Railway only | **Server only. Bypasses RLS.** |
| `X_BEARER_TOKEN` | worker | Railway only | X API v2 bearer |
| `TIINGO_API_TOKEN` | server + refresh | Railway + `.env.local` | Tiingo End-of-Day token. Used as a US ticker performance fallback when Yahoo chart data is unavailable. |
| `REFRESH_SHARED_SECRET` | worker + API routes | Railway only | Guards `/api/refresh/*` |
| `SENTRY_DSN` | client + server | Railway | Optional in dev |
| `HEARTBEAT_URL` | worker | Railway | Better Stack / Cronitor ping URL |
| `AUTH_EMAIL_ALLOWLIST` | middleware + login action | Railway | Comma-separated emails. Falls back to hardcoded default if unset. |
| `NEXT_PUBLIC_SITE_URL` | login action (magic-link redirect) | Railway + `.env.local` | e.g. `https://dashboard.example.com`. Must match Supabase redirect URLs. |
| `DATABASE_URL` | future/server DB code + manual ops | Railway + `.env.local` when needed | Must be `postgres://` or `postgresql://`. Inside Railway prefer the private Postgres URL, not an HTTP endpoint. |
| `DATABASE_PUBLIC_URL` | local/admin DB access only | `.env.local` or Railway when needed | Public Railway proxy URL. Do not use as an HTTP health-check target. |

The active app currently does not install a Postgres runtime client. Database
variables are audited and sanitized by the refresh endpoint so bad protocols are
visible in logs, but no database connection is opened by `/api/refresh/all`.

## Railway health checks

Configure Railway and external monitors to check the web app, ideally
`/api/health`. Never point an HTTP monitor at the Postgres host/port; that is the
most likely cause of repeated Postgres `invalid length of startup packet` logs.

## Local dev
Copy `app/.env.example` → `app/.env.local`. Never commit `.env.local`.

## Rotation
- **Tiingo API token**: Tiingo account API token -> update Railway -> trigger manual refresh to verify.
- **X bearer**: X dev portal → rotate → update Railway → trigger manual refresh to verify.
- **Supabase service role**: Supabase → Settings → API → rotate → update Railway.
- **Shared secret**: `openssl rand -hex 32` → update Railway.
