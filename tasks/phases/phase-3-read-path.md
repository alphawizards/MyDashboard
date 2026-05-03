# Phase 3 — Watchlist Read Path

**Goal**: `/watchlist` on the deployed URL renders the stocks panel + Polymarket panel with real data from Supabase. No auth yet (page is temporarily public to simplify testing).

**Duration**: ~1 day.

---

## Prerequisites

- Phase 2 gate passed.
- Supabase has 10 watchlist rows + 3 polymarket markets.

---

## Outputs

- [ ] `https://dashboard.<apex>/watchlist` shows all tickers in a table.
- [ ] Polymarket panel shows 3 markets with live bid/ask midpoint updating every 15s.
- [ ] Session countdown visible, ET→AEST timezone correct.

---

## Steps

### 3.1 Install client libs

```bash
cd app
npm install @supabase/supabase-js @supabase/ssr
```

---

### 3.2 Create Supabase clients

`app/lib/supabase/server.ts`:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
}

// Use only in server actions / API routes. Bypasses RLS.
export function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } },
  );
}
```

`app/lib/supabase/client.ts`:

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

---

### 3.3 Shared types

`app/lib/types.ts`:

```ts
export type Watchlist = {
  ticker: string;
  exchange: string | null;
  catalyst: string | null;
  price_target: number | null;
  priority: number | null;
  notes: string | null;
  sort_order: number | null;
  updated_at: string;
};

export type Quote = {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  avg_vol_10d: number | null;
  market_cap: number | null;
  day_range: string | null;
  fetched_at: string;
};

export type PolymarketMarket = {
  slug: string;
  title: string;
  kind: 'ndx_daily' | 'recession_2026' | 'spx_yearend_2026';
  token_yes: string | null;
  token_no: string | null;
  auto_detect: boolean;
  detected_for_date: string | null;
};

export type WatchlistRow = Watchlist & { quote: Quote | null };
```

---

### 3.4 Watchlist page (server component)

**Note**: for Phase 3 we temporarily use the service role client so the page works before auth is added in Phase 5. Before merging Phase 5, switch this to `getServerClient()` so RLS applies to the signed-in user's session.

`app/app/watchlist/page.tsx`:

```tsx
import { getServiceClient } from '@/lib/supabase/server';
import type { WatchlistRow, PolymarketMarket } from '@/lib/types';
import { StocksPanel } from './stocks-panel';
import { PolymarketPanel } from './polymarket-panel';
import { SessionCountdown } from './session-countdown';

export const dynamic = 'force-dynamic'; // always fresh

export default async function WatchlistPage() {
  const supabase = getServiceClient();

  const [{ data: watchlist }, { data: quotes }, { data: markets }] = await Promise.all([
    supabase.from('watchlist').select('*').order('sort_order', { ascending: true }),
    supabase.from('quotes').select('*'),
    supabase.from('polymarket_markets').select('*'),
  ]);

  const quoteByTicker = new Map((quotes ?? []).map((q) => [q.ticker, q]));
  const rows: WatchlistRow[] = (watchlist ?? []).map((w) => ({
    ...w,
    quote: quoteByTicker.get(w.ticker) ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Morning Dashboard</h1>
        <SessionCountdown />
      </header>
      <StocksPanel rows={rows} />
      <PolymarketPanel markets={(markets ?? []) as PolymarketMarket[]} />
    </main>
  );
}
```

---

### 3.5 Stocks panel (server component, presentational)

`app/app/watchlist/stocks-panel.tsx`:

```tsx
import type { WatchlistRow } from '@/lib/types';

export function StocksPanel({ rows }: { rows: WatchlistRow[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">Stocks</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Ticker</th>
              <th className="p-2">Exchange</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Chg%</th>
              <th className="p-2 text-right">Vol</th>
              <th className="p-2 text-right">Avg 10d</th>
              <th className="p-2">Catalyst</th>
              <th className="p-2 text-right">Target</th>
              <th className="p-2">Priority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="border-t">
                <td className="p-2 font-mono">{r.ticker}</td>
                <td className="p-2">{r.exchange}</td>
                <td className="p-2 text-right">{r.quote?.price?.toFixed(2) ?? '—'}</td>
                <td className={`p-2 text-right ${(r.quote?.change_pct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {r.quote?.change_pct != null ? `${(r.quote.change_pct * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="p-2 text-right">{r.quote?.volume?.toLocaleString() ?? '—'}</td>
                <td className="p-2 text-right">{r.quote?.avg_vol_10d?.toLocaleString() ?? '—'}</td>
                <td className="p-2">{r.catalyst ?? '—'}</td>
                <td className="p-2 text-right">{r.price_target ?? '—'}</td>
                <td className="p-2">{r.priority ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-gray-500 italic">No watchlist data.</p>}
    </section>
  );
}
```

**CSS polish**: copy matching styles from `legacy/morning-watchlist.html` into `app/app/globals.css`. For MVP, Tailwind above is sufficient; pixel-parity is post-MVP.

---

### 3.6 Polymarket panel (client component, live updates)

`app/app/watchlist/polymarket-panel.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { PolymarketMarket } from '@/lib/types';

type Midpoint = { yes: number | null; no: number | null };

async function fetchMidpoint(tokenId: string | null): Promise<number | null> {
  if (!tokenId) return null;
  try {
    const r = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
    if (!r.ok) return null;
    const b = await r.json();
    const bid = Number(b.bids?.[0]?.price ?? 0);
    const ask = Number(b.asks?.[0]?.price ?? 0);
    if (!bid || !ask) return null;
    return (bid + ask) / 2;
  } catch {
    return null;
  }
}

export function PolymarketPanel({ markets }: { markets: PolymarketMarket[] }) {
  const [prices, setPrices] = useState<Record<string, Midpoint>>({});

  useEffect(() => {
    let alive = true;
    async function tick() {
      const entries = await Promise.all(
        markets.map(async (m) => {
          const [yes, no] = await Promise.all([fetchMidpoint(m.token_yes), fetchMidpoint(m.token_no)]);
          return [m.slug, { yes, no }] as const;
        }),
      );
      if (alive) setPrices(Object.fromEntries(entries));
    }
    tick();
    const id = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [markets]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">Polymarket</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Market</th>
            <th className="p-2 text-right">Yes</th>
            <th className="p-2 text-right">No</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => {
            const p = prices[m.slug];
            const fmt = (v: number | null | undefined) =>
              v == null ? '—' : `${(v * 100).toFixed(1)}%`;
            return (
              <tr key={m.slug} className="border-t">
                <td className="p-2">{m.title}</td>
                <td className="p-2 text-right">{fmt(p?.yes)}</td>
                <td className="p-2 text-right">{fmt(p?.no)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

---

### 3.7 Session countdown (client component)

`app/app/watchlist/session-countdown.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';

// US market: 09:30–16:00 ET. Convert to AEST via Intl.
function nextSessionEdge(): { label: string; target: Date } {
  const now = new Date();
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const h = Number(et.find((p) => p.type === 'hour')!.value);
  const m = Number(et.find((p) => p.type === 'minute')!.value);
  const mins = h * 60 + m;

  // Build targets in ET, then let JS convert to local
  const fmt = (hh: number, mm: number) => {
    const d = new Date(now);
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const delta = now.getTime() - etNow.getTime();
    d.setHours(hh, mm, 0, 0);
    return new Date(d.getTime() + delta);
  };

  if (mins < 9 * 60 + 30) return { label: 'until open', target: fmt(9, 30) };
  if (mins < 16 * 60) return { label: 'until close', target: fmt(16, 0) };
  // After close: tomorrow's open
  const tOpen = fmt(9, 30);
  tOpen.setDate(tOpen.getDate() + 1);
  return { label: 'until open', target: tOpen };
}

export function SessionCountdown() {
  const [text, setText] = useState('—');
  useEffect(() => {
    const tick = () => {
      const { label, target } = nextSessionEdge();
      const diff = Math.max(0, target.getTime() - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setText(`${label}: ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm">{text}</span>;
}
```

---

### 3.8 Local verification

```bash
cd app
npm run typecheck
npm run dev
# Open http://localhost:3000/watchlist
```

**Verify**:
- 10 ticker rows, catalyst column populated.
- Polymarket table shows 3 rows; Yes/No % updates after ~15s.
- Countdown ticks every second and shows "until open" / "until close" per market state.

---

### 3.9 Ship

```bash
git add app/
git commit -m "feat: watchlist read path with Polymarket live updates"
git push
```

**Verify**: `https://dashboard.<apex>/watchlist` renders the same page.

---

## Gate to Phase 4

- [ ] `/watchlist` loads in production with 10 tickers.
- [ ] Polymarket prices update every 15s without page reload.
- [ ] Session countdown shows correct label + ticking time.
- [ ] `npm run typecheck` passes.
- [ ] No console errors in browser devtools on production page.

---

## Common pitfalls

- **Using service role client everywhere**: ✗. Only use `getServiceClient()` where you need to bypass RLS (the Phase 4 worker and cron API route). Switch `page.tsx` to `getServerClient()` before Phase 5 merge.
- **Forgetting `export const dynamic = 'force-dynamic'`**: page gets statically cached at build time → shows stale data.
- **CORS regression on Polymarket**: browser console shows CORS error → follow `docs/runbook/polymarket-cors-broke.md`.
- **`fetch` in a server component hitting `clob.polymarket.com`**: don't — keep CLOB fetching client-side (it's the whole point of the live update).
