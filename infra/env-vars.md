# Environment Variables

All secrets live in Railway env vars. Never committed.

| Var | Used by | Where set | Notes |
|-----|---------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Railway + `.env.local` | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Railway + `.env.local` | Public, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | worker + API routes | Railway only | **Server only. Bypasses RLS.** |
| `X_BEARER_TOKEN` | worker | Railway only | X API v2 bearer |
| `REFRESH_SHARED_SECRET` | worker + API routes | Railway only | Guards `/api/refresh/*` |
| `SENTRY_DSN` | client + server | Railway | Optional in dev |
| `HEARTBEAT_URL` | worker | Railway | Better Stack / Cronitor ping URL |
| `AUTH_EMAIL_ALLOWLIST` | middleware + login action | Railway | Comma-separated emails. Falls back to hardcoded default if unset. |
| `NEXT_PUBLIC_SITE_URL` | login action (magic-link redirect) | Railway + `.env.local` | e.g. `https://dashboard.example.com`. Must match Supabase redirect URLs. |

## Local dev
Copy `app/.env.example` → `app/.env.local`. Never commit `.env.local`.

## Rotation
- **X bearer**: X dev portal → rotate → update Railway → trigger manual refresh to verify.
- **Supabase service role**: Supabase → Settings → API → rotate → update Railway.
- **Shared secret**: `openssl rand -hex 32` → update Railway.
