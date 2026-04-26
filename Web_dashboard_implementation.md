# Web Dashboard Implementation Guide

## Current Localhost State

This guide describes the dashboard as it exists right now on the local machine.

Current local test URL:

```text
http://127.0.0.1:8081/sikand-feed.html
```

Current source of truth:

```text
C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\sikand-feed.html
```

Related local files:

```text
C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\morning-watchlist.html
C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\refresh_all.py
C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\config.json
```

Important: `web_transition\app` is not the current live local dashboard. It is a separate Next.js transition project. The active dashboard being tested in the browser is the root-level static HTML file above.

Current dashboard features:

- Static HTML/CSS/JS dashboard.
- X account feed tabs for Sikand, Peter Wolff, Serenity, BryzonX, and Venu.
- Portfolio/watchlist tab with Sikand, Wolff, and Venu data.
- Overlap bubble map with shared ticker tracking.
- Data is embedded directly in the HTML.
- X/Twitter API credentials are local-only and must not be deployed.

## Recommendation

Deploy the current dashboard as a **static Cloudflare Pages site first**.

Use Railway later only if the project grows into a backend app with scheduled refresh workers, database-backed accounts, admin auth, or a Next.js/Supabase rewrite.

Why Cloudflare Pages first:

- The current dashboard is static.
- It does not need an always-running server.
- Cloudflare Pages gives HTTPS, CDN hosting, preview deploys, rollbacks, and custom domains.
- It reduces the chance of accidentally exposing local scripts or secrets.

## Canonical Deployment Shape

Do not deploy the whole dashboard root folder.

Create a deploy-only folder:

```text
C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\public\
```

Recommended public output:

```text
web_transition\public\
  index.html
  sikand-feed.html
  morning-watchlist.html
  _headers
  assets\
```

The root-level `sikand-feed.html` remains the current edit source until you intentionally move ownership into `web_transition\public`.

Recommended sync step:

```powershell
Copy-Item -LiteralPath "C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\sikand-feed.html" -Destination "C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\public\sikand-feed.html" -Force
Copy-Item -LiteralPath "C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\morning-watchlist.html" -Destination "C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\web_transition\public\morning-watchlist.html" -Force
```

Add `public\index.html` that links to or redirects to `sikand-feed.html`.

## Cloudflare Pages Setup

Recommended settings:

- Project source: GitHub repository.
- Build command: `exit 0`
- Build output directory: `public`
- Production branch: `main`
- Custom domain: for example `dashboard.yourdomain.com`

Cloudflare Pages should receive only static public output. It should not receive:

- `config.json`
- `refresh_all.py`
- `run_refresh.bat`
- local logs
- local screenshots
- raw secrets
- Python cache files
- the entire parent dashboard root

## Railway Role

Use Railway only when static hosting is no longer enough.

Good Railway use cases:

- Scheduled server-side X/Twitter refresh jobs.
- Postgres database.
- Admin API.
- Next.js app hosting.
- A persistent backend for account requests and moderation.

For the current dashboard, Railway is optional overhead.

## Account Request Feature

Do not ship account requests as an unprotected static form.

Recommended future workflow:

1. User submits X handle, reason, optional source URL, and optional email.
2. Cloudflare Pages Function validates the request.
3. Turnstile blocks spam.
4. Request is stored in Cloudflare D1.
5. Admin reviews the request behind protected admin access.
6. Approved account is added to the dashboard data.
7. Refresh job fetches profile/posts server-side.

Validation requirements:

- X handles must match `^[A-Za-z0-9_]{1,15}$`.
- Source URLs should allow only `https://x.com/` and `https://twitter.com/`.
- All user text must be length-limited and HTML-escaped.
- Reject or quarantine suspicious URLs.
- Rate-limit by IP/session.
- Do not auto-publish requested accounts.

Admin access requirement:

- Protect the review queue with Cloudflare Access, GitHub OAuth, or a signed admin session.
- Do not rely on a hidden URL.
- Do not expose raw D1 records publicly.

Privacy requirement:

- If collecting requester email, add a privacy notice.
- Define retention period.
- Provide a deletion/contact process.
- Avoid third-party form tools unless you are comfortable sharing request data with that provider.

## Automated Refresh

Current local state uses embedded static data. A production refresh job should never expose the Twitter/X bearer token to browser JavaScript.

Safe refresh options:

- GitHub Actions scheduled workflow generates updated static HTML/JSON and commits deploy output.
- Cloudflare Worker Cron fetches data and writes sanitized JSON to D1/R2/KV.
- Railway worker fetches data and writes to Postgres or static output.

Minimum refresh controls:

- Store X/Twitter bearer token in platform secrets.
- Fetch posts server-side.
- Sanitize generated JSON/HTML.
- Log refresh success/failure without logging secrets.
- Add manual approval before publishing newly requested accounts.

## Security Audit

### Critical: Secret Handling

The local dashboard root contains `config.json` with sensitive API configuration. Before any GitHub or Cloudflare deployment:

- Add `config.json` to `.gitignore`.
- Confirm it is not in the deploy output.
- Run a secret scan on the working tree.
- Check git history for committed secrets.
- If the Twitter/X bearer token was ever committed or shared, rotate it.

Suggested checks:

```powershell
git status --short
git log --all -- config.json
git grep -n "twitter_bearer_token"
git grep -n "Bearer"
```

Use a dedicated secret scanner before making a public repository, such as GitHub secret scanning or Gitleaks.

### Critical: Deploy Folder Boundary

Only deploy `web_transition\public`.

Do not deploy:

- `C:\Users\ckr_4\OneDrive\Investing\01_1_StockDashboard\`
- `web_transition\`
- `Dashboard_Local\`

The deploy folder must be a curated output directory, not the source workspace.

### High: User-Submitted Content

Future request forms create a real attack surface.

Required before launch:

- Server-side validation.
- HTML escaping.
- Anti-spam protection.
- Rate limiting.
- Admin moderation.
- Authenticated admin review.

### High: Financial / Legal Presentation

This is a public investing-information dashboard if deployed.

Add visible public-site copy:

- Not financial advice.
- Data may be stale or inaccurate.
- Portfolio/watchlist entries are copied from public posts/screenshots.
- Users must do their own research.
- Source attribution and last-updated timestamps.

Recommended footer:

```text
This dashboard is for research and tracking only. It is not financial advice. Data may be delayed, incomplete, or manually transcribed from public sources. Verify all information before making investment decisions.
```

### Medium: CSP And Third-Party Scripts

Current dashboard uses inline JavaScript and loads D3 from cdnjs.

Short-term acceptable for private/static testing, but public deployment should prefer:

- Vendor D3 locally under `public\assets\`.
- Remove third-party script dependency or add SRI.
- Move inline JavaScript into an external file.
- Remove inline `onclick` handlers.
- Tighten CSP to avoid broad `unsafe-inline`.

Minimum first deploy headers:

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
```

### Medium: External Images

Profile images currently load from `pbs.twimg.com`.

Risk:

- Visitor IP/user-agent is shared with that third party.
- External image availability can break UI.

Options:

- Accept for first private/public beta.
- Cache avatars locally in `public\assets\avatars`.
- Proxy avatars through a backend later.

### Medium: Link Safety

The current `safeOpen()` allowlist is useful and should remain.

Keep:

- `rel="noopener noreferrer"`
- explicit origin allowlist
- URL validation before opening user-submitted links

## Deployment Checklist From Current Localhost State

1. Decide source of truth: keep root `sikand-feed.html` for now, or move it into `web_transition\public`.
2. Create `web_transition\public`.
3. Copy root `sikand-feed.html` into `web_transition\public\sikand-feed.html`.
4. Copy root `morning-watchlist.html` into `web_transition\public\morning-watchlist.html`.
5. Add `web_transition\public\index.html`.
6. Add `web_transition\public\_headers`.
7. Add financial disclaimer/footer to public pages.
8. Vendor D3 locally or document the temporary cdnjs/SRI decision.
9. Confirm `config.json` is not in `public`.
10. Confirm refresh scripts are not in `public`.
11. Run secret scan and git history scan.
12. Commit only safe deploy files.
13. Deploy Cloudflare Pages with output directory `public`.
14. Test production URL.
15. Only then add request-account backend.

## Production Data Model

When moving beyond static HTML, use structured data:

```text
accounts
  id
  handle
  display_name
  bio
  avatar_url
  follower_count
  enabled

posts
  id
  account_id
  x_post_id
  text
  created_at
  likes
  retweets
  replies
  cashtags[]

portfolios
  id
  account_id
  name
  source_url
  source_type
  last_verified_at

portfolio_holdings
  portfolio_id
  ticker
  weight
  label
  notes

account_requests
  id
  requested_handle
  requester_email
  reason
  source_url
  status
  created_at
  reviewed_at
  reviewed_by
```

## Recommended Roadmap

### Phase 1: Static Public Beta

- Publish current dashboard through Cloudflare Pages.
- Keep account requests off.
- Add disclaimer, `_headers`, and deploy-folder boundary.
- Confirm no secrets or scripts are deployed.

### Phase 2: Data Cleanup

- Split embedded data into JSON files.
- Move JavaScript and CSS out of the HTML.
- Vendor D3 or remove external dependency.
- Add last-updated/source metadata for every portfolio/watchlist.

### Phase 3: Account Requests

- Add Cloudflare Pages Function.
- Add Turnstile.
- Add D1 request storage.
- Add protected admin review.

### Phase 4: Automated Refresh

- Move X/Twitter fetch to a private scheduled job.
- Store credentials in platform secrets.
- Publish sanitized static output or JSON.

## Final Recommendation

For the current localhost dashboard, deploy a curated static copy through Cloudflare Pages first. Do not deploy the whole root folder. Do not ship account requests until admin auth, validation, rate limiting, and privacy handling exist. Use Railway later if the project needs scheduled workers, Postgres, or a full Next.js application.

Sources checked:

- Railway Static Hosting Guide: https://docs.railway.com/guides/static-hosting
- Railway Variables: https://docs.railway.com/variables
- Railway Domains CLI: https://docs.railway.com/cli/domain
- Cloudflare Pages Overview: https://developers.cloudflare.com/pages/
- Cloudflare Static HTML Guide: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
