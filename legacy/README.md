# legacy/

Read-only copies of the current local dashboard. Reference material for the port — **do not edit**.

Source of truth remains the parent directory until Phase 5 decommission.

| File | Source | Purpose in port |
|------|--------|-----------------|
| `morning-watchlist.html` | parent dir | CSS/layout reference, `defaultStocks` data source for seed |
| `sikand-feed.html` | parent dir | CSS/layout reference for `/feed` page |
| `refresh_all.py` | parent dir | Logic reference for `app/workers/refresh.ts` |
| `context.md` | parent dir | Quirks and constraints to carry forward |

## Resync
If the parent dashboard is updated during the port:
```
cp ../refresh_all.py ../morning-watchlist.html ../sikand-feed.html ../context.md legacy/
```
Commit the refresh as its own change so the diff is auditable.
