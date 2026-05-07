# X Account Stock Pick Tracker Architecture

## Summary

The first implementation targets Serenity's account page at `/feed/accounts/serenity`.
It adds a stock-pick table with ticker, company, theme, 1 month performance,
12 month performance, and total mentions.

The refresh path owns upstream calls. Page renders read cached data and must not
call X directly. This keeps X API usage bounded to explicit refreshes and makes
page load costs predictable.

## Data Flow

1. `/api/refresh/all` runs the existing refresh workflow.
2. The X refresh resolves each tracked account to an X user id, using the cached
   `tracked_accounts.author_id` when available.
3. The refresh requests recent tweets, using the cached newest tweet id as
   `since_id` where available.
4. Returned tweets are upserted into `tweets` by X tweet id.
5. Serenity's mentioned tickers are refreshed through Yahoo Finance metadata and
   chart endpoints, then cached in `ticker_profiles` and
   `ticker_performance_snapshots`.
6. `/feed` and `/feed/accounts/[slug]` read cached tweets. If the database is not
   configured or unavailable, they fall back to the static snapshot.

## Tables

- `tracked_accounts`: account key/slug/handle/profile metadata, cached X user id,
  active flag, newest tweet id, and refresh timestamps.
- `tweets`: X tweet id, author key/handle/id, posted timestamp, text, URL,
  engagement metrics, cashtags, and fetched timestamp.
- `ticker_profiles`: ticker, company name, Yahoo sector, Yahoo industry, derived
  theme, and fetched timestamp.
- `ticker_performance_snapshots`: ticker, 1 month performance, 12 month
  performance, and fetched timestamp.

Theme is derived as `industry ?? sector ?? "Unknown"` from Yahoo Finance
metadata.

## Cost Controls

- Never call X from server-rendered pages.
- Cache X user ids after the first successful lookup.
- Use `since_id` for incremental tweet refreshes when a cached boundary exists.
- Upsert rows instead of deleting and refetching.
- Cache Yahoo Finance profile and performance data separately from tweet data.
- Revalidate only the affected feed paths after successful refresh.

## Verification

- Unit tests cover ticker aggregation, theme fallback, and table row joins.
- Integration tests cover refresh diagnostics and revalidation paths.
- E2E tests cover the Serenity table and existing account-page sections.
