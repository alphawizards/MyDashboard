# X bearer token rotated

**When**: token compromised, periodic rotation, or X API 401 errors in `refresh_runs`.

## Steps
1. X developer portal → regenerate bearer token.
2. Railway → project env vars → update `X_BEARER_TOKEN`.
3. Railway will redeploy both services automatically.
4. Trigger manual refresh to verify: Railway → `dashboard-cron` → Run now.
5. Confirm new `refresh_runs` row has `ok=true` and new tweets land in `tweets` table.

## Don't
- Don't commit the old or new token.
- Don't put it in `.env.local` shared across machines.
