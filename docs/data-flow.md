# Data Flow

## Daily refresh (07:00 AEST)

```
Railway cron fires
       │
       ▼
workers/refresh.ts
       │
       ├──► yahoo-finance2.quote([tickers])         → upsert into quotes
       ├──► Polymarket gamma API (NDX slug detect)  → update polymarket_markets
       ├──► Polymarket CLOB /book (each slug)       → (live prices fetched client-side, not here)
       ├──► X API v2 user timelines                 → upsert into tweets
       │
       ├──► insert into refresh_runs (kind='all', ok=true, finished_at=now())
       │
       └──► POST $HEARTBEAT_URL  (external monitor knows we succeeded)

On any failure:
       ├──► insert into refresh_runs (kind='...', ok=false, error=...)
       ├──► Sentry.captureException
       └──► heartbeat NOT pinged → monitor alerts after 15min grace
```

## Page load (authenticated user hits /watchlist)

```
Browser ──GET──► Cloudflare ──► Railway (Next.js SSR)
                                        │
                                        ├──► Supabase (service role) → read watchlist ⋈ quotes
                                        ├──► Supabase → read polymarket_markets
                                        │
                                        ◄── HTML with server-rendered data
Browser hydrates
       │
       ├──► Client polls Polymarket CLOB /book every 15s  (CORS-open, no proxy)
       └──► Session countdown timer runs locally          (Intl.DateTimeFormat)
```

## Metadata edit

```
User edits catalyst in UI
       │
       ▼
PATCH /api/watchlist (auth cookie) ──► Supabase (user JWT) → update watchlist
                                              │
                                              └── RLS policy "auth update watchlist metadata" passes
```

## Invariant
`watchlist.catalyst / price_target / priority / notes` is **never** written by the cron worker. Only by authenticated UI edits. This replaces the regex-preservation logic in `refresh_all.py`.
