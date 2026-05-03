# NDX daily token not detected

**Symptom**: `polymarket_markets` has no row for `kind='ndx_daily'` with today's `detected_for_date`, or the dashboard shows a stale slug.

## Diagnose
1. Hit gamma API directly: `curl 'https://gamma-api.polymarket.com/markets?closed=false&limit=50' | jq '.[] | select(.slug | contains("ndx"))'`
2. Has the slug pattern changed? (e.g. new date format)
3. Check worker logs for the detection step.

## Fix
- **Slug pattern changed**: update `app/lib/sources/polymarket.ts` detection regex.
- **Market not listed yet (early morning)**: delay cron, or retry at 07:30 AEST.
- **Market closed for the day**: expected — skip.

## Manual override
Insert the correct slug + token IDs into `polymarket_markets` with today's `detected_for_date`. The next refresh will use it.
