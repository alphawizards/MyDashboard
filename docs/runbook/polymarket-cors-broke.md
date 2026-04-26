# Polymarket CORS broke

**Symptom**: browser console shows CORS errors fetching `https://clob.polymarket.com/book`, prices frozen.

## Fix
Move the fetch server-side:
1. Add `app/api/polymarket/book/route.ts` — proxies GET to CLOB with a 10s cache.
2. Update client to call `/api/polymarket/book?token=...` instead of the CLOB URL.
3. Keep CSP as-is.

Cache 10–15s aggressively — CLOB tolerates high poll rates but our Railway egress doesn't need the churn.
