# Tests

| Folder | Scope | Runs |
|--------|-------|------|
| `unit/` | Pure functions — parsers, field mappers, invariant checks | Every CI run |
| `integration/` | Supabase writes + RLS behaviour against a local Supabase | Every CI run |
| `e2e/` | Playwright — auth + watchlist render + metadata edit | Every CI run |
| `contracts/` | Real HTTP calls to yfinance / Polymarket / X | **Weekly** (Monday 18:00 UTC) |
| `fixtures/` | JSON samples for unit + integration tests | n/a |

## Target budget
- Unit: unlimited, keep fast.
- Integration: ~10 tests, ~30s total.
- E2E: **3–5 tests max**. This is a single-user dashboard.
- Contracts: one per upstream API. Failure = upstream changed; update worker.

## Running
```
cd app
npm test                    # unit + integration + e2e
npm test tests/contracts    # contracts only (requires X_BEARER_TOKEN)
```
