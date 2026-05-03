# Railway Setup

Two services live in one Railway project.

## Service 1: `dashboard-web`

- Source: GitHub repo
- Root Directory: `app`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Public domain: proxied behind Cloudflare (`dashboard.<yourdomain>`)

## Service 2: `dashboard-cron`

- Source: same GitHub repo
- Root Directory: `app`
- Build Command: `npm ci`
- Start Command: `npx tsx workers/refresh.ts all`
- Service Type: Cron
- Schedule: `0 21 * * *` UTC
- Public domain: none
- Env vars: same project-level variables as `dashboard-web`

Do not use `node dist/workers/refresh.js` unless a separate worker TypeScript build emits that file. `next build` produces `.next/`, not `dist/`, and Next standalone output does not automatically include arbitrary worker files.

`tsx` must be installed as a production dependency, not only a dev dependency, if the cron service starts with `npx tsx workers/refresh.ts all`.

## Shared Env Vars

Configure env vars at the Railway **project** level so both services see the same values. See [env-vars.md](./env-vars.md).

## Manual Cron Trigger

Preferred for cron-service testing:

```text
Railway dashboard -> dashboard-cron -> Run now
```

The HTTP refresh endpoint is available only after Phase 4:

```bash
curl -X POST https://dashboard.<yourdomain>/api/refresh/all \
  -H "x-refresh-secret: $REFRESH_SHARED_SECRET"
```

Repeated endpoint calls can trip Cloudflare rate limits during debugging.

## Cost Note

Railway Hobby includes monthly usage credit; it is not unlimited flat-rate hosting. Web + cron should be measured after deployment and budgeted with headroom.
