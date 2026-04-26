# Morning Dashboard — Context & Setup

## Files
| File | Purpose |
|------|---------|
| `morning-watchlist.html` | Stock watchlist + Polymarket odds dashboard |
| `sikand-feed.html` | X tracker for @michaelsikand & @peterjwolff |
| `refresh_all.py` | Master refresh script — fetches all data and injects into HTML |
| `run_refresh.bat` | Double-click to run refresh on Windows |
| `config.json` | Credentials and settings (⚠ keep private, do not share) |
| `context.md` | This file — project reference for Claude sessions |

## How to Refresh
**Manual (double-click):** Run `run_refresh.bat`
**Partial refresh:**
  - `python refresh_all.py --stocks`  → stocks only
  - `python refresh_all.py --poly`    → Polymarket only
  - `python refresh_all.py --tweets`  → tweets only

**Requirements:** Python 3.9+ with `pip install yfinance requests`

## Stocks Tracked
FLY, SPIR, SATL, SIDU, AAOI, BE, MU, ASTS, INTC, AVEX

To add/remove stocks: edit the `"stocks"` list in `config.json`.
Catalyst notes, price targets, and priority ratings are preserved across refreshes.

## Polymarket Markets
- **NDX daily** — auto-detected each morning from gamma API (slug changes every trading day)
- **US Recession by end 2026** — static token IDs (long-dated, stable)
- **SPX year-end 2026** — static token IDs (long-dated, stable)

Live prices fetched from CLOB API (`/book` endpoint for bid/ask midpoint).
Note: `/midpoint` endpoint returns 403 — use `/book` instead.

## X API
- Bearer token stored in `config.json`
- Used server-side only (Python) — never exposed in HTML
- Fetches last 20 tweets per user via v2 API
- Users: @michaelsikand (ID: 3007206859), @peterjwolff (ID: 1588705702578511872)

## Architecture Notes
- HTML files are self-contained (no build step, open directly in browser)
- Python injects data into HTML via regex replacement of JS constant blocks
- Polymarket odds refresh live in the browser via CLOB CORS-open endpoint
- Tweet data is baked static (X API has no CORS support for browser calls)
- Session countdown timers are DST-aware (ET → AEST via Intl.DateTimeFormat)

## Known Quirks
- Polymarket `/midpoint` returns 403 — always use `/book` and compute (bestBid+bestAsk)/2
- NDX daily token IDs change every trading day — always auto-detect, never hardcode
- yfinance `averageVolume10days` key; fall back to `averageVolume` if missing
- Ticker `AAOI` was originally entered as `AAO1` (one not capital i)
- `AVEX` is AEVEX Corp (defense drones) — listed on **NYSE**, not NASDAQ (added 2026-04-22 post-IPO)
- The metadata-preservation parser in `refresh_all.py` uses targeted regex (not `json.loads`) because `defaultStocks` is a JS object literal with unquoted keys. The script aborts hard if parsing finds zero tickers — silent metadata loss is never acceptable.

## Security
- CSP headers added to both HTML files (restricts external connections)
- All `target="_blank"` links include `rel="noopener noreferrer"`
- `window.open()` replaced with `safeOpen()` helper (allowlist: x.com, finance.yahoo.com)
- ⚠ `config.json` contains the bearer token — do not commit to git or share publicly

## Scheduled Task (Windows)
A scheduled task named "MorningDashboardRefresh" runs `run_refresh.bat` at 07:00 AEST daily.
To modify: open Task Scheduler → Task Scheduler Library → MorningDashboardRefresh
