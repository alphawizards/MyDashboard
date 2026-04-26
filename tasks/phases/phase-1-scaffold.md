# Phase 1 — Scaffold & Deploy Empty App

**Goal**: `https://dashboard.<domain>` returns a Next.js page over HTTPS, deployed from GitHub via Railway, proxied through Cloudflare.

**Duration**: ~4 hours.

---

## Prerequisites

- Phase 0 gate passed.
- Fresh GitHub repo for this project (or monorepo sub-directory — confirm with human).

---

## Outputs

- [ ] Next.js scaffold at `app/`.
- [ ] Railway auto-deploys on push to `main`.
- [ ] `https://dashboard.<domain>` serves the default page.
- [ ] All env vars set in Railway.

---

## Steps

### 1.1 Scaffold Next.js

```bash
cd app
rm README.md  # replace with Next scaffold's own
npx create-next-app@latest . \
  --typescript --app --tailwind --eslint \
  --no-src-dir --import-alias "@/*"
```

When prompted: "would you like to customize the import alias" → No (use default `@/*`).

**Verify**:
```bash
npm run dev
# Open http://localhost:3000 — default Next page loads
```

Kill dev server. Restore README:
```bash
git checkout README.md
```

---

### 1.2 Add security headers stub

Edit `app/next.config.ts`:

```ts
import type { NextConfig } from 'next';

// TODO: add CSP in Phase 5 after auth settles
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Verify**: `app/next.config.ts` already exists; compare with committed file and reconcile any drift — do not overwrite if they match.

---

### 1.3 Create `.env.example`

`app/.env.example`:

```
# Public — safe to ship to client
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only — never expose to client
SUPABASE_SERVICE_ROLE_KEY=eyJ...
X_BEARER_TOKEN=AAAA...
REFRESH_SHARED_SECRET=

# Optional (Phase 5+)
SENTRY_DSN=
HEARTBEAT_URL=

# Auth (Phase 5)
AUTH_EMAIL_ALLOWLIST=you@example.com
NEXT_PUBLIC_SITE_URL=https://dashboard.example.com
```

Also create `app/.env.local` with real values from password manager. Confirm it is in `.gitignore` (Next scaffold already adds it).

**Verify**:
```bash
git check-ignore .env.local  # should print .env.local
```

---

### 1.4 Update package.json scripts

Edit `app/package.json` → `scripts`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

Install dev deps:
```bash
npm install -D vitest @types/node
```

---

### 1.5 Commit and push

From `app/`:
```bash
cd ..  # back to repo root
git add app/
git commit -m "feat: scaffold Next.js dashboard app"
git push origin main
```

---

### 1.6 Connect Railway to repo

1. Railway → `morning-dashboard` project → New Service → GitHub Repo.
2. Select the repo.
3. Settings → Root Directory → `app`.
4. Settings → Build Command → `npm ci && npm run build`.
5. Settings → Start Command → `npm start`.
6. Settings → Watch Paths → `app/**`.

**Verify**: Railway shows "Deploying". Wait for green checkmark. Open Railway-provided URL (`*.up.railway.app`) — default Next page loads.

---

### 1.7 Set Railway env vars (project-level)

Railway → project → Variables → Shared Variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from password manager |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from password manager |
| `SUPABASE_SERVICE_ROLE_KEY` | from password manager |
| `X_BEARER_TOKEN` | from password manager |
| `REFRESH_SHARED_SECRET` | from password manager |

**Verify**: service redeploys automatically; env vars visible in variable list (values hidden).

---

### 1.8 Add Cloudflare DNS record

Cloudflare → `<apex>` → DNS → Records → Add record:

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | `dashboard` |
| Target | `<railway-subdomain>.up.railway.app` |
| Proxy status | Proxied (orange cloud) |
| TTL | Auto |

SSL/TLS → Overview → set to **Full (strict)**.

**Verify**:
```bash
dig dashboard.<apex> +short
# Should return Cloudflare IPs (not Railway's directly)
```

Then in Railway → service → Settings → Networking → Custom Domain → add `dashboard.<apex>`. Railway will verify.

**Verify**: `curl -I https://dashboard.<apex>` → 200 with `server: cloudflare`.

---

### 1.9 Sanity test

Open `https://dashboard.<apex>` in a browser. Default Next page must load with valid TLS lock.

---

## Gate to Phase 2

- [ ] `https://dashboard.<apex>` publicly serves Next default page.
- [ ] HTTPS valid, no cert warnings.
- [ ] `git push` triggers auto-deploy on Railway.
- [ ] All 5 env vars set at Railway project level.
- [ ] `.env.local` present locally, git-ignored.
- [ ] `npm run typecheck` and `npm run lint` both pass locally.

---

## Common pitfalls

- **Railway root dir missing**: build fails because it runs from repo root. Must be `app`.
- **Cloudflare DNS-only (grey cloud)**: TLS won't terminate at Cloudflare → no WAF, no proxy benefit. Use Proxied.
- **SSL mode = Flexible**: mixed content / infinite redirects. Must be Full (strict).
- **`SUPABASE_SERVICE_ROLE_KEY` committed to `.env.example`**: ✗. Only placeholder values in `.env.example`.
