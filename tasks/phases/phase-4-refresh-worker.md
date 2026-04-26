# Phase 4 — Refresh Worker & Cron

**Goal**: data in `quotes` and `polymarket_markets` gets refreshed automatically at 07:00 AEST (21:00 UTC), and a manual "Refresh now" button also triggers it.

**Duration**: ~1 day.

---

## Prerequisites

- Phase 3 gate passed.
- yfinance spike from Phase 0 documented.
- Railway project supports cron-triggered services.

---

## Outputs

- [ ] `app/workers/refresh.ts` runs end-to-end against real upstreams.
- [ ] `/api/refresh/all` endpoint exists, guarded by shared secret.
- [ ] Second Railway service `dashboard-cron` deployed on `0 21 * * *`.
- [ ] `refresh_runs` table gets a new row per run.
- [ ] Manual "Refresh now" button on `/watchlist` works.

---

## Steps

### 4.1 Install data-source deps

```bash
cd app
npm install yahoo-finance2
```

---

### 4.2 yfinance source

`app/lib/sources/yfinance.ts`:

```ts
import yf from 'yahoo-finance2';

export type FetchedQuote = {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  avg_vol_10d: number | null;
  market_cap: number | null;
  day_range: string | null;
};

export async function fetchQuotes(tickers: string[]): Promise<FetchedQuote[]> {
  if (tickers.length === 0) throw new Error('fetchQuotes called with zero tickers');
  const results = await Promise.all(
    tickers.map(async (t) => {
      try {
        const q = await yf.quote(t);
        return {
          ticker: t,
          price: q.regularMarketPrice ?? null,
          change_pct:
            typeof q.regularMarketChangePercent === 'number'
              ? q.regularMarketChangePercent / 100
              : null,
          volume: q.regularMarketVolume ?? null,
          avg_vol_10d: q.averageDailyVolume10Day ?? q.averageDailyVolume3Month ?? null,
          market_cap: q.marketCap ?? null,
          day_range:
            q.regularMarketDayLow != null && q.regularMarketDayHigh != null
              ? `${q.regularMarketDayLow.toFixed(2)}-${q.regularMarketDayHigh.toFixed(2)}`
              : null,
        } satisfies FetchedQuote;
      } catch (e) {
        console.error(`[yfinance] ${t} failed:`, e);
        return null;
      }
    }),
  );
  const ok = results.filter((r): r is FetchedQuote => r !== null);
  if (ok.length === 0) throw new Error('Zero quotes fetched successfully — upstream likely down');
  return ok;
}
```

---

### 4.3 Polymarket source

`app/lib/sources/polymarket.ts`:

```ts
// NDX-daily slug changes every trading day — auto-detect via gamma.
// Static markets (recession/spx) keep their stored token IDs.

export type PolymarketTokens = { slug: string; token_yes: string; token_no: string };

const GAMMA = 'https://gamma-api.polymarket.com';

export async function detectNdxDaily(today = new Date()): Promise<PolymarketTokens | null> {
  const res = await fetch(`${GAMMA}/markets?closed=false&limit=100`);
  if (!res.ok) throw new Error(`gamma HTTP ${res.status}`);
  const markets: Array<any> = await res.json();

  // Heuristic: slug starts with "nasdaq-100" or contains today's ISO date.
  const iso = today.toISOString().slice(0, 10);
  const candidate =
    markets.find((m) => typeof m.slug === 'string' && m.slug.toLowerCase().includes(iso)) ??
    markets.find((m) => typeof m.slug === 'string' && /nasdaq-100.*(up|down)/i.test(m.slug));

  if (!candidate) return null;
  const tokens = Array.isArray(candidate.tokens) ? candidate.tokens : [];
  const yes = tokens.find((t: any) => /yes/i.test(t.outcome))?.token_id;
  const no = tokens.find((t: any) => /no/i.test(t.outcome))?.token_id;
  if (!yes || !no) return null;
  return { slug: candidate.slug, token_yes: yes, token_no: no };
}
```

---

### 4.4 Refresh worker entry point

`app/workers/refresh.ts`:

```ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchQuotes } from '../lib/sources/yfinance';
import { detectNdxDaily } from '../lib/sources/polymarket';

type Kind = 'stocks' | 'poly' | 'tweets' | 'all';

async function logRun(
  supabase: ReturnType<typeof createClient>,
  kind: Kind,
  started: Date,
  ok: boolean,
  error?: string,
) {
  await supabase.from('refresh_runs').insert({
    kind,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    ok,
    error,
  });
}

export async function refreshStocks(supabase: ReturnType<typeof createClient>) {
  const { data: watchlist, error } = await supabase.from('watchlist').select('ticker');
  if (error) throw error;
  const tickers = (watchlist ?? []).map((w: any) => w.ticker);
  if (tickers.length === 0) throw new Error('Watchlist empty — refusing to refresh');

  const quotes = await fetchQuotes(tickers);
  const { error: upErr } = await supabase.from('quotes').upsert(
    quotes.map((q) => ({ ...q, fetched_at: new Date().toISOString() })),
    { onConflict: 'ticker' },
  );
  if (upErr) throw upErr;
  return quotes.length;
}

async function refreshPolymarket(supabase: ReturnType<typeof createClient>) {
  const detected = await detectNdxDaily();
  if (!detected) {
    console.warn('[poly] NDX daily not detected today');
    return 0;
  }
  const { error } = await supabase
    .from('polymarket_markets')
    .update({
      slug: detected.slug,
      token_yes: detected.token_yes,
      token_no: detected.token_no,
      detected_for_date: new Date().toISOString().slice(0, 10),
    })
    // Uses .eq('kind', 'ndx_daily') deliberately: slug rotates daily, kind is stable.
    // polymarket_markets.kind has a unique constraint (see schema/003_ndx_kind_unique.sql).
    .eq('kind', 'ndx_daily');
  if (error) throw error;
  return 1;
}

export async function runRefresh(kind: Kind = 'all', client?: ReturnType<typeof createClient>) {
  const supabase = client ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const started = new Date();
  try {
    if (kind === 'all' || kind === 'stocks') await refreshStocks(supabase);
    if (kind === 'all' || kind === 'poly') await refreshPolymarket(supabase);
    // tweets: deferred to post-MVP
    await logRun(supabase, kind, started, true);
    if (process.env.HEARTBEAT_URL) await fetch(process.env.HEARTBEAT_URL).catch(() => {});
  } catch (e: any) {
    await logRun(supabase, kind, started, false, String(e?.message ?? e));
    throw e;
  }
}

// CLI entry
if (process.argv[1]?.endsWith('refresh.ts') || process.argv[1]?.endsWith('refresh.js')) {
  const arg = process.argv[2]?.replace(/^--/, '') as Kind | undefined;
  runRefresh(arg ?? 'all').then(
    () => { console.log('✓ refresh complete'); process.exit(0); },
    (e) => { console.error('✗ refresh failed:', e); process.exit(1); },
  );
}
```

---

### 4.5 API route for manual trigger

`app/app/api/refresh/all/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { runRefresh } from '@/workers/refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = req.headers.get('x-refresh-secret');
  if (!secret || secret !== process.env.REFRESH_SHARED_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await runRefresh('all');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

---

### 4.6 Unit test — invariant

`app/tests/unit/refresh-worker.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchQuotes } from '@/lib/sources/yfinance';

describe('fetchQuotes invariants', () => {
  it('throws on empty ticker list', async () => {
    await expect(fetchQuotes([])).rejects.toThrow(/zero tickers/i);
  });
});

describe('refreshStocks invariant I2', () => {
  it('throws when watchlist is empty', async () => {
    const fakeSupabase = {
      from: () => ({ select: async () => ({ data: [], error: null }) }),
    };
    // refreshStocks must be exported from workers/refresh.ts — see §4.2b below.
    const { refreshStocks } = await import('@/workers/refresh');
    await expect(refreshStocks(fakeSupabase as any)).rejects.toThrow(/empty/i);
  });
});

describe('runRefresh invariant I12', () => {
  it('writes refresh_runs row on thrown error', async () => {
    const inserts: any[] = [];
    const fakeSupabase = {
      from: (t: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async (row: any) => { inserts.push({ t, row }); return { error: null }; },
      }),
    };
    // runRefresh must accept an optional client arg for DI — see §4.2b below.
    const { runRefresh } = await import('@/workers/refresh');
    await expect(runRefresh('stocks', fakeSupabase as any)).rejects.toBeTruthy();
    expect(inserts.some((x) => x.t === 'refresh_runs' && x.row.ok === false)).toBe(true);
  });
});
```

**Testability requirement**: the `workers/refresh.ts` snippet above exports `refreshStocks` and lets `runRefresh` accept an optional second arg `client?: ReturnType<typeof createClient>`. When provided, it skips the live `createClient(...)` call so invariant I12 is testable without live Supabase.

Add `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { globals: true, environment: 'node' },
});
```

Run:
```bash
npm test
```

**Verify**: test passes.

---

### 4.7 Local end-to-end run

```bash
cd app
npx tsx workers/refresh.ts stocks
```

**Verify** in Supabase:
```sql
select ticker, price, fetched_at from quotes order by ticker;
-- All 10 tickers have a price and a recent fetched_at
select * from refresh_runs order by started_at desc limit 1;
-- kind='stocks', ok=true
```

Then the full pipeline:
```bash
npx tsx workers/refresh.ts all
```

Reload `https://dashboard.<apex>/watchlist` → stocks panel shows real prices.

---

### 4.8 "Refresh now" button

Edit `app/app/watchlist/page.tsx` to pass a flag to a new client button. Simplest approach — a server action:

`app/app/watchlist/refresh-button.tsx`:

```tsx
'use client';
import { useTransition } from 'react';

export function RefreshButton({ onClick }: { onClick: () => Promise<{ ok: boolean; error?: string }> }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
      disabled={pending}
      onClick={() => start(async () => { await onClick(); location.reload(); })}
    >
      {pending ? 'Refreshing…' : 'Refresh now'}
    </button>
  );
}
```

Add server action + wire to page. In `app/app/watchlist/page.tsx` add:

```tsx
import { RefreshButton } from './refresh-button';

async function refreshAction() {
  'use server';
  const { runRefresh } = await import('@/workers/refresh');
  try { await runRefresh('all'); return { ok: true }; }
  catch (e: any) { return { ok: false, error: String(e?.message ?? e) }; }
}
```

Render in header:
```tsx
<div className="flex items-center gap-3">
  <SessionCountdown />
  <RefreshButton onClick={refreshAction} />
</div>
```

**Note**: server action runs on Railway web service. For long refreshes (>30s) this could time out — acceptable for MVP since quote fetching is fast; move to API route + polling if needed post-MVP.

---

### 4.9 Add Railway cron service

Railway → project → New Service → empty service → name `dashboard-cron`.

Settings:
- **Source**: same GitHub repo.
- **Root Directory**: `app`.
- **Build Command**: `npm ci`.
  > Build step omitted intentionally: cron service runs TS directly via `tsx`. Next build artifacts are only needed by the web service. Saves ~1–2 min per deploy and reduces cron container size.
- **Start Command**: `npx tsx workers/refresh.ts all`
- **Install `tsx` in dependencies** (not devDependencies): `npm install tsx`

Do not use `node dist/workers/refresh.js` or `.next/standalone/workers/refresh.js` unless a separate worker build explicitly emits that file. `next build` does not create either path for this worker.
- **Service Type**: Cron.
- **Schedule**: `0 21 * * *` (UTC).

Env vars are inherited from project-level shared variables (set in Phase 1).

---

### 4.10 Trigger cron manually

Railway → `dashboard-cron` → "Run now".

**Verify**:
```sql
select kind, ok, started_at, finished_at, error from refresh_runs order by started_at desc limit 3;
-- Latest row: kind='all', ok=true, no error
```

Dashboard shows fresh prices.

---

### 4.11 Commit

```bash
git add app/
git commit -m "feat: refresh worker + cron + manual trigger"
git push
```

---

## Gate to Phase 5

- [ ] Local `npx tsx workers/refresh.ts all` succeeds and writes to Supabase.
- [ ] `/api/refresh/all` returns 401 without secret, 200 with secret.
- [ ] "Refresh now" button on `/watchlist` triggers a refresh and data updates.
- [ ] Railway cron service shows next scheduled run at ~21:00 UTC tomorrow.
- [ ] After manual "Run now" in Railway: `refresh_runs` has a new `ok=true` row.
- [ ] Unit test passes.

---

## Common pitfalls

- **Service role key shipped to client**: ✗. `getServiceClient()` / `createClient(..., SERVICE_ROLE)` must only run on the server. Never in a file that imports from `'use client'` components.
- **Server action timeout on slow upstream**: if yfinance is slow, 30s Next server action limit may hit. Move to `/api/refresh/all` + client polling post-MVP.
- **Cron service without env vars**: uses project-level shared variables — verify Railway shows them on the cron service too.
- **Running `npx tsx workers/refresh.ts` with no `.env.local`**: Supabase client fails silently. Either set vars in shell or run through `dotenv`.
- **NDX auto-detect regex too strict**: if the gamma slug format changes, the worker logs a warning and returns 0. Check `docs/runbook/ndx-token-not-detected.md`.
