# Hosting Transition Plan

How to take the `web_transition/` Next.js project from local prototype to a publicly hosted dashboard that other users can view.

This document is the operator-facing summary for the **Next.js/Railway/Supabase transition path**. It is different from `Web_dashboard_implementation.md`, which describes hosting the current root-level static HTML dashboard as-is.

Deeper references:

- `implementation_guide.md` - full architectural plan
- `tasks/phases/` - step-by-step playbooks
- `infra/railway.md`, `infra/cloudflare-dns.md` - service config
- `docs/invariants.md` - security/data rules
- `decisions/` - ADRs

Last reviewed: 2026-04-26

## 1. Accounts, Tiers, And Real Costs

| Service | Tier | Cost | Purpose |
|---|---|---:|---|
| GitHub | Free | $0 | Source repo Railway pulls from |
| Railway | Hobby / Pro | $5+ usage-based | Hosts Next.js web + cron worker |
| Supabase | Free / Pro | $0 / $25+ | Postgres + Auth + RLS |
| Cloudflare | Free / Pro | $0 / $25+ | DNS, TLS, basic WAF, cache |
| Domain registrar | Any | ~$10-15/yr | `dashboard.<yourdomain>` |
| X Developer | Pay-per-use | variable | Timeline reads for tweet feed |

Cost reality:

- Railway Hobby is not a flat "everything for $5" plan. The $5 subscription includes $5 of usage credit; usage above that is charged. With web + cron, budget roughly $5-20/month until measured.
- Supabase Free is fine for prototypes, but Free projects can pause after low activity, built-in auth email is limited, and downloadable database backups are not available.
- X API timeline reads are not safely budgeted at $0. X currently documents pay-per-use pricing; verify current per-endpoint rates in the developer console and set a monthly spend cap before tweet refresh becomes production scope.
- Cloudflare Free is enough for DNS/TLS/basic protection, but do not assume multiple WAF/rate-limit rules are free. Treat one `/api/refresh/*` rule as the Free-plan baseline and verify limits before relying on more.

Practical budget:

- Static/manual MVP: domain + Cloudflare, near zero platform cost.
- Next/Railway MVP without X reads and without Supabase Pro: roughly $5-20/month.
- Production-ish Next/Railway with Supabase Pro or heavier Railway usage: roughly $30-75+/month before X API costs.
- X API costs are additional and usage-dependent.

## 2. Target Architecture

```text
Cloudflare DNS/TLS/cache/basic WAF
  dashboard.<yourdomain>
    -> Railway dashboard-web
         Next.js 16 App Router
         API routes
         Server actions
         Supabase client
    -> Railway dashboard-cron
         npx tsx workers/refresh.ts all
         schedule: 0 21 * * * UTC

Supabase
  Postgres
  Auth
  RLS

External data sources
  Yahoo Finance / yfinance replacement
  Polymarket CLOB/Gamma
  X API v2
```

Use a subdomain such as `dashboard.example.com`. Apex-domain hosting requires CNAME flattening and extra DNS care; keep apex out of MVP scope.

Why this split:

- Cloudflare: DNS, HTTPS, DDoS protection, cache, one baseline rate-limit rule.
- Railway: web service + cron service, Git deploys, project-level shared env vars.
- Supabase: Postgres + Auth + RLS.
- Next.js: one codebase for UI, API, and server-only refresh logic.

Alternatives:

- Vercel: natural Next.js host, but background/cron worker requirements are less direct and can become more expensive.
- Cloudflare Pages + Workers + D1: cheaper edge-first alternative, but it changes the data model away from Supabase/Postgres.
- Fly.io / Render: viable Railway alternatives, but Railway is currently the simplest fit for Git deploys + cron-service ergonomics.

See `decisions/2026-04-23-stack-choice.md` for the ADR.

## 3. Required Environment Variables

Configure at the **Railway project level** so both `dashboard-web` and `dashboard-cron` read the same values. Only placeholders go in `app/.env.example`.

```ini
# Public - safe to ship to client
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://dashboard.example.com

# Server-only - never expose to client
SUPABASE_SERVICE_ROLE_KEY=eyJ...
X_BEARER_TOKEN=AAAA...
REFRESH_SHARED_SECRET=
# generate with: openssl rand -hex 32

# Auth
AUTH_EMAIL_ALLOWLIST=you@example.com,friend@example.com

# Optional
SENTRY_DSN=
HEARTBEAT_URL=
```

Never commit secrets. `app/.env.local` is git-ignored; only `app/.env.example` should be committed.

## 4. Phase 0 - Provision Accounts

Setup tasks:

- [ ] GitHub repo created and initial safe push completed.
- [ ] Railway project created, billing/payment method added, GitHub repo connected.
- [ ] Cloudflare account created, domain added, nameservers delegated.
- [ ] Domain purchased.
- [ ] Supabase project created; URL, anon key, and service-role key captured.
- [ ] Supabase Free vs Pro decision made.
- [ ] Supabase Auth SMTP decision made before production login.
- [ ] X API usage/pricing reviewed in developer console; monthly cap documented.
- [ ] X bearer token verified with a sample timeline request.
- [ ] `REFRESH_SHARED_SECRET` generated.
- [ ] yfinance replacement decision documented.

Pre-flight checks:

- [ ] Polymarket CORS still open from browser.
- [ ] Cloudflare WAF/rate-limit rule budget decided.
- [ ] Supabase Auth production redirect settings understood.

Free-tier gotchas:

- Supabase may pause Free projects after low activity in a 7-day period. Upgrade to Pro if the dashboard must not pause.
- Supabase built-in email is best-effort/development oriented and currently limited to 2 emails/hour on email-send endpoints. Configure custom SMTP for production magic links.
- Supabase Free does not provide downloadable database backups. Use Pro/PITR for real recovery, or add a tested backup job.
- Railway Hobby includes usage credit; it is not an unlimited $5 flat fee.

## 5. Phase 1 - Deploy Empty App

### Railway

Service 1 - `dashboard-web`:

- Source: GitHub repo, root directory `app`
- Build: `npm ci && npm run build`
- Start: `npm start`
- Public domain: proxied through Cloudflare

Service 2 - `dashboard-cron`:

- Source: same GitHub repo, root directory `app`
- Build: `npm ci`
- Start: `npx tsx workers/refresh.ts all`
- Schedule: `0 21 * * *` UTC
- No public domain
- Same project-level env vars as web

Do not use `node dist/workers/refresh.js` unless a separate worker TypeScript build exists. `next build` creates `.next/`, not `dist/`.

DST note: `0 21 * * *` UTC is roughly 07:00 AEST and 08:00 AEDT. This accepts a one-hour local-time drift during daylight saving. If the dashboard must be ready by exactly 07:00 local year-round, change the scheduling strategy.

### Cloudflare

DNS:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `dashboard` | `<railway-service>.up.railway.app` | Proxied |

Security:

- SSL/TLS mode: Full (strict)
- Always Use HTTPS: On
- Automatic HTTPS Rewrites: On
- Bot Fight Mode: On
- Security Level: Medium

Rate limiting:

- Free baseline: one rule for `/api/refresh/*` at about 10 req/min/IP.
- Paid/Pro hardening: add broader `/api/*` rule if current Cloudflare plan allows it.

Caching:

- Cache static assets.
- Bypass cache for `/api/*` and authenticated pages.

Phase 1 gate:

- [ ] `https://dashboard.<yourdomain>` serves HTTPS through Cloudflare.
- [ ] `curl -I https://dashboard.<yourdomain>` shows Cloudflare proxy headers such as `cf-ray`.
- [ ] Pushing `main` triggers Railway deploys.
- [ ] CI/build is green before production deploy is trusted.
- [ ] `dashboard-web` and `dashboard-cron` both see required env vars.
- [ ] `dashboard-cron` can be manually triggered from Railway.
- [ ] `app/.env.example` lists every MVP env var.

Rollback:

- Railway dashboard -> service -> Deployments -> select previous good deploy -> Redeploy.

## 6. Allowing Other Users To View

The project starts in single-user mode. To open it up:

### Option A - Email Allowlist

Best for a small named group.

- Phase 5 ships Supabase magic-link auth + `AUTH_EMAIL_ALLOWLIST`.
- Add emails to the env var and redeploy.
- Check allowlist both at magic-link submission and callback.
- Configure Supabase Auth:
  - Site URL: `https://dashboard.<yourdomain>`
  - Redirect allowlist: `https://dashboard.<yourdomain>/auth/callback`
  - Custom SMTP provider: Resend, Postmark, AWS SES, or equivalent
- Known limitation: anyone with read access to the user's email can redeem a magic link. Use GitHub OAuth or another stronger provider if the dashboard becomes higher-value.
- Removing an email from `AUTH_EMAIL_ALLOWLIST` is not immediate session revocation. Force sign-out in Supabase or rotate sessions for urgent removals.

### Option B - Public Read-Only

- Drop middleware gate on read-only dashboard pages.
- Keep write APIs and refresh APIs authenticated/secret-gated.
- Split RLS policies carefully so `anon` can only `SELECT` safe tables.
- Cloudflare WAF/cache becomes more important.

### Option C - Full Multi-User

Deferred. Requires ownership columns, per-user watchlists, expanded RLS policies, and more product design.

## 7. Work Still To Ship

| Phase | Goal | Estimate |
|---|---|---:|
| 2 | Supabase tables + RLS + seed watchlist | 3h |
| 3 | `/watchlist` renders DB data + Polymarket live | 1d |
| 4 | Refresh worker + `/api/refresh/*` | 1d |
| 5 | Magic-link auth + allowlist + middleware + CSP | 4h |
| 6 | Walkthrough, fix friction, decommission Windows task | 4h |

These estimates are optimistic. Plan 3-4 focused days plus debugging slack for first-time Railway, Supabase Auth, and Cloudflare DNS setup.

## 8. Non-Negotiable Security Rules

1. No secrets in git.
2. Watchlist metadata is preserved; cron must not overwrite catalyst, target, priority, or notes.
3. Service-role client is server-only.
4. `/api/refresh/*` requires `x-refresh-secret`.
5. Importers/refreshers fail hard on empty source data.
6. RLS stays enabled.
7. Allowlist is checked twice.
8. CSP allowlists are explicit.

Audit script from `web_transition/`:

```bash
# Windows users should run this in Git Bash or WSL.

grep -rn "getServiceClient\|SUPABASE_SERVICE_ROLE_KEY" app/ --include="*.tsx" --include="*.ts" \
  | grep -v "server.ts\|workers/\|api/refresh/"

grep -rn "nasdaq-100\|nasdaq100" app/ --include="*.ts"

grep -rn "/midpoint" app/ --include="*.ts"

grep -rn "from('watchlist')" app/workers/ app/app/api/ \
  | grep -E "\.update\(|\.upsert\(|\.insert\("
```

All four checks should return zero lines.

## 9. Operations

Manual refresh endpoint is available only after Phase 4:

```bash
curl -X POST https://dashboard.<yourdomain>/api/refresh/all \
  -H "x-refresh-secret: $REFRESH_SHARED_SECRET"
```

During debugging, repeated calls can trip the Cloudflare `/api/refresh/*` rate-limit rule. Use Railway "Run now" or temporarily disable the rule while testing.

Minimum monitoring:

- Add Better Stack or Cronitor heartbeat before relying on daily refresh.
- Ping heartbeat only after successful cron completion.
- Add Sentry when moving past MVP.

Backups:

- Supabase Free has no downloadable database backups.
- Use Supabase Pro/PITR for production recovery, or add a tested scheduled `pg_dump`.

Runbooks:

- `docs/runbook/cron-didnt-fire.md`
- `docs/runbook/x-bearer-rotated.md`
- `docs/runbook/ndx-token-not-detected.md`
- `docs/runbook/polymarket-cors-broke.md`
- `docs/runbook/restore-from-backup.md`

## 10. Recommended Next Step

1. Finish Phase 0 account provisioning and cost decisions.
2. Finish Phase 1 empty app deployment behind Cloudflare.
3. If sharing with a small named group, choose Option A and configure Supabase production auth + SMTP.
4. Proceed through Phases 2-6 in order.

Sources to re-check before spending money:

- Railway pricing and plan limits
- Supabase production checklist and Auth SMTP docs
- Cloudflare WAF/rate-limit quotas for the selected plan
- X API developer-console endpoint pricing
