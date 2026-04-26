# Phase 0 — Decisions & Accounts

**Goal**: unblock all downstream phases. No production code written. Zero ambiguity remaining about stack, secrets, or upstream API behaviour.

**Duration**: ~2 hours.

---

## Prerequisites

- Access to the human's Cloudflare, Railway, Supabase, GitHub, and X developer accounts.
- A password manager (1Password / Bitwarden) available to store secrets.
- Node 20+ and npm installed locally.

---

## Outputs (required before Phase 1)

- [ ] Cloudflare zone for target domain is active.
- [ ] Railway project created + linked to a GitHub repo.
- [ ] Supabase project created with URL, anon key, service role key captured.
- [ ] X bearer token verified still working.
- [ ] `REFRESH_SHARED_SECRET` generated and stored.
- [ ] `decisions/2026-04-23-yfinance-replacement.md` written with spike results.

---

## Steps

### 0.1 Confirm domain + Cloudflare access

**Ask the human**: what domain to use. Assume format `dashboard.<apex>`.

**Verify**: log into Cloudflare → Websites → `<apex>` zone is listed and active.

**Record**: domain name in `infra/env-vars.md` under a new `## Domain` section.

---

### 0.2 Create Railway project

1. Go to [railway.app](https://railway.app) → New Project → "Empty project".
2. Name: `morning-dashboard`.
3. Do not add any services yet.

**Verify**: project visible in Railway dashboard, empty.

---

### 0.3 Create Supabase project

1. [supabase.com](https://supabase.com) → New project.
2. Name: `morning-dashboard`.
3. Region: closest to AEST (Sydney if available, Singapore otherwise).
4. DB password: generated 32-char, saved to password manager.
5. After provisioning: go to Settings → API.
6. Copy these to password manager:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠ bypasses RLS, server-only)

**Verify**: `curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/ -H "apikey: $ANON"` returns 200.

**Don't**: paste the service role key into any file. It never leaves the password manager → Railway env.

---

### 0.4 Verify X bearer token

Pull bearer from existing `legacy/refresh_all.py` → `config.json` (in parent folder, not committed).

```bash
# Smoke test: fetch the authenticated user's own info (any valid bearer works)
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  "https://api.x.com/2/users/me"

# OR — test against the legacy dashboard's target account
# 3007206859 = @sikand_us (confirm in `legacy/refresh_all.py`)
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  "https://api.x.com/2/users/3007206859/tweets?max_results=5"
```

**Verify**: returns JSON with `data` array. 401 = token expired; ask human to regenerate.

---

### 0.5 Generate shared secret

```bash
openssl rand -hex 32
```

Save to password manager as `REFRESH_SHARED_SECRET`.

---

### 0.6 Spike: `yahoo-finance2` parity with `yfinance`

**Purpose**: `refresh_all.py` uses these yfinance fields. Prove the Node equivalent returns the same data.

Fields used in legacy (grep `legacy/refresh_all.py` to confirm):
- `regularMarketPrice` / `currentPrice`
- `regularMarketChangePercent`
- `regularMarketVolume`
- `averageVolume10days` (fallback: `averageVolume`)
- `marketCap`
- `regularMarketDayHigh`, `regularMarketDayLow`

**Spike script** — run in an isolated tmp dir to avoid polluting the repo:

```bash
mkdir -p /tmp/yfinance-spike && cd /tmp/yfinance-spike
npm init -y && npm install yahoo-finance2 tsx
```

Create `/tmp/yfinance-spike/spike-yfinance.ts`:

```ts
import yf from 'yahoo-finance2';

const tickers = ['FLY','SPIR','SATL','SIDU','AAOI','BE','MU','ASTS','INTC','AVEX'];

for (const t of tickers) {
  const q = await yf.quote(t);
  console.log(t, {
    price: q.regularMarketPrice,
    changePct: q.regularMarketChangePercent,
    volume: q.regularMarketVolume,
    avgVol10d: q.averageDailyVolume10Day ?? q.averageDailyVolume3Month,
    marketCap: q.marketCap,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    exchange: q.fullExchangeName,
  });
}
```

Run:
```bash
npx tsx spike-yfinance.ts
```

**Verify**: every ticker prints a full row with no `undefined`.

**Write results** to `decisions/2026-04-23-yfinance-replacement.md`:

```md
## Decision: Use yahoo-finance2 npm package

## Context
Replacing Python yfinance in the cron worker. Need field parity.

## Alternatives considered
- Alpha Vantage (requires API key, rate-limited free tier)
- IEX Cloud (paid)
- Keep Python worker, expose via HTTP (two runtimes)

## Reasoning
yahoo-finance2 exposes the same Yahoo endpoint yfinance uses. Spike confirmed all 7 required fields return non-null for the current watchlist.

## Trade-offs accepted
- Unofficial API — breakage risk identical to yfinance.
- Field name mapping required (see table below).

## Field mapping (from spike)
| yfinance (Python) | yahoo-finance2 (Node) |
|---|---|
| regularMarketPrice | regularMarketPrice |
| regularMarketChangePercent | regularMarketChangePercent |
| regularMarketVolume | regularMarketVolume |
| averageVolume10days | averageDailyVolume10Day |
| marketCap | marketCap |
| ... | ... |
```

**Cleanup**:
```bash
cd - && rm -rf /tmp/yfinance-spike
```

**Verify**: `ls` in the repo root has no leaked `package.json` / `node_modules`.

---

### 0.7 Verify Polymarket CLOB still CORS-open

```bash
# NDX daily auto-detect via gamma
curl -s 'https://gamma-api.polymarket.com/markets?closed=false&limit=50' \
  | head -c 500

# CLOB book test (pick any token ID from gamma response)
curl -s 'https://clob.polymarket.com/book?token_id=<id>' \
  -H 'Origin: https://example.com' -i | head -20
```

**Verify**: `access-control-allow-origin: *` in CLOB response headers.

If CORS is closed: note in `decisions/` and plan for server-side proxy (see `docs/runbook/polymarket-cors-broke.md`).

---

## Gate to Phase 1

- [ ] Domain name recorded.
- [ ] Railway project created.
- [ ] Supabase URL + both keys in password manager.
- [ ] X bearer returns 200.
- [ ] `REFRESH_SHARED_SECRET` generated and stored.
- [ ] yfinance spike passed all 10 tickers.
- [ ] `decisions/2026-04-23-yfinance-replacement.md` committed.
- [ ] Polymarket CORS confirmed open (or alternative planned).

---

## Common pitfalls

- **Supabase service role key in a committed file**: ✗. Only password manager → Railway env.
- **Testing X bearer from the browser**: ✗ (no CORS). Use `curl` or server-side only.
- **Assuming yfinance field names are identical**: ✗. They're *close* but not the same. Spike.
