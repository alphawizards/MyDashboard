# scripts/

One-shot tooling. Not part of the runtime app.

| Script | Purpose |
|--------|---------|
| `import-watchlist.ts` | Parse `legacy/morning-watchlist.html` `defaultStocks` JS literal → Supabase `watchlist` seed. **Always dry-run first.** |
| `rollback.ts` | Export Supabase tables → JSON snapshot, or restore from snapshot. |
| `smoke-check.ts` | Post-deploy probe — verifies `/watchlist` renders and last `refresh_runs.ok=true`. |

## Conventions
- Use `tsx` (no build step): `npx tsx scripts/<name>.ts`
- Every destructive script supports `--dry-run` (default) and `--apply`.
- Importers must **fail hard on zero rows** — mirrors the invariant from `refresh_all.py`.
