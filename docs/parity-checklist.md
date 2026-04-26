# Parity Checklist

Fill in during Phase 2. Compares web app output to `legacy/morning-watchlist.html` + `legacy/sikand-feed.html`.

## Stocks panel
- [ ] All tickers from `legacy/` appear
- [ ] Price + change% match (within same-day drift)
- [ ] Volume + avg 10-day volume present
- [ ] Catalyst / target / priority metadata preserved
- [ ] Sort order preserved
- [ ] Exchange flag correct (AVEX=NYSE, others NASDAQ)

## Polymarket panel
- [ ] NDX daily market auto-detected for current trading day
- [ ] Recession 2026 static market present
- [ ] SPX year-end 2026 static market present
- [ ] Live bid/ask midpoint updates in browser (no page reload)

## X feed panel
- [x] @michaelsikand last 20 tweets available through static prototype data
- [x] @peterjwolff last 20 tweets available through static prototype data
- [x] @aleabitoreddit last 20 tweets available through static prototype data
- [x] @BryzonX latest fetched tweets available through static prototype data
- [x] Account tabs, all-feed view, stock-mention filter, hot filter, search, and ticker pills ported to `/feed`
- [x] Links open with `rel="noopener noreferrer"` and client-side origin allowlist

## Overlap map
- [x] Shared tickers are calculated across Sikand, Wolff, Serenity, and BryzonX
- [x] Current static dataset resolves 6 shared tickers: AAOI, AMD, INTC, LITE, MXL, SOI
- [x] Bubble graph uses account lanes plus a dedicated shared lane
- [x] BryzonX overlaps AMD and MXL are covered by unit tests

## Session countdown
- [ ] ET → AEST conversion correct
- [ ] DST-aware (verify across daylight transition)

## Security
- [ ] CSP header present
- [ ] X bearer never appears in page source
- [ ] `target="_blank"` sanitised

## Visual
- [ ] Layout matches legacy within ~50px tolerance
- [ ] Colour scheme matches
- [ ] Font sizes match
- [ ] Mobile viewport usable

## Prototype status
- [x] `/` route no longer renders the default Next starter page
- [x] `/feed` route exists
- [x] `/watchlist` route exists
- [x] `/portfolios` route exists with Sikand/Wolff portfolio tabs
- [x] `/api/refresh/all` route exists with shared-secret guard skeleton
- [x] Local HTTP smoke on `http://127.0.0.1:3000`: `/`, `/feed`, `/watchlist`, and `POST /api/refresh/all` returned 200
- [x] Smoke response checks confirmed dashboard home text, BryzonX/PENG feed data, AVEX watchlist data, and Farside section content

## Autopilot portfolios
- [x] Sikand's Asymmetric Bets portfolio captured from screenshots
- [x] Sikand holdings tracked: VIAV 27%, MU 17%, AVEX 16%, BE 14%, AAOI 13%, FLY 13%
- [x] Wolff portfolio tab added as a pending slot for the next screenshots/data
