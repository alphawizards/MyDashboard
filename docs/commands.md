# Commands

Shell command reference. Run from `web_transition/app/` unless noted.

---

## Local dev

```bash
npm run dev                  # Next dev server on :3000
npm run build                # production build
npm start                    # production server (after build)
```

---

## Quality gates (run before every commit)

```bash
npm run typecheck            # tsc --noEmit
npm run lint                 # next lint
npm test                     # vitest (unit + integration)
```

Advanced:

```bash
npm test tests/unit          # unit only
npm test tests/integration   # integration only
npm test tests/contracts     # contract tests (requires X_BEARER_TOKEN set)
npx playwright test          # e2e (Phase 5+)
```

---

## Refresh worker (manual)

From `web_transition/app/`:

```bash
npx tsx workers/refresh.ts all       # full refresh
npx tsx workers/refresh.ts stocks    # stocks only
npx tsx workers/refresh.ts poly      # polymarket only
# tweets subcommand: post-MVP
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set.

---

## Import watchlist (one-shot, Phase 2)

From `web_transition/scripts/`:

```bash
npm install                          # first time only
npx tsx import-watchlist.ts          # dry-run (default) — prints rows, writes nothing
npx tsx import-watchlist.ts --apply  # writes to Supabase
```

---

## Invariant audit

From `web_transition/`:

```bash
# I5 — service-role key never in client bundle
grep -rn "getServiceClient\|SUPABASE_SERVICE_ROLE_KEY" app/ --include="*.tsx" --include="*.ts" \
  | grep -v "server.ts\|workers/\|api/refresh/"

# I9 — no hardcoded NDX slugs
grep -rn "nasdaq-100\|nasdaq100" app/ --include="*.ts"

# I10 — no Polymarket /midpoint calls
grep -rn "/midpoint" app/ --include="*.ts"

# I1 — cron never writes to watchlist
grep -rn "from('watchlist')" app/workers/ app/app/api/ \
  | grep -E "\.update\(|\.upsert\(|\.insert\("
```

All four must return zero lines.

---

## Database

Preferred: Supabase SQL Editor in the dashboard.

Via psql (for ops):

```bash
# Latest cron run status
psql "$DATABASE_URL" -c "select kind, ok, started_at, finished_at, error from refresh_runs order by started_at desc limit 5;"

# Last quote refresh timestamp
psql "$DATABASE_URL" -c "select max(fetched_at) from quotes;"

# Watchlist metadata audit
psql "$DATABASE_URL" -c "select ticker, exchange, catalyst, price_target, priority from watchlist order by sort_order;"

# RLS status
psql "$DATABASE_URL" -c "select tablename, rowsecurity from pg_tables where schemaname = 'public';"
```

`DATABASE_URL` from Supabase → Settings → Database → Connection string (direct connection, not pooler).

---

## Deploy

```bash
git push origin <branch>             # push branch
gh pr create                         # open PR (requires gh CLI)
# After merge to main: Railway auto-deploys both services (web + cron)
```

Manual deploy trigger (rare):

```bash
# Railway CLI (optional)
railway up
```

---

## Manual refresh via deployed API

Canonical production refresh endpoint: `POST /api/refresh/all`. Do not use
`/api/watchlist/refresh` unless a future migration explicitly adds that route.

```bash
curl -X POST https://dashboard.<apex>/api/refresh/all \
  -H "x-refresh-secret: $REFRESH_SHARED_SECRET"
```

Expected: `{"ok":true}` — then check Supabase `refresh_runs` for the new row.

---

## Health check

```bash
curl https://dashboard.<apex>/api/health
```

Railway and external monitors should use the web app health endpoint, never the
Postgres host or port `5432`.

---

## Secret rotation

```bash
# Generate new REFRESH_SHARED_SECRET
openssl rand -hex 32
# → paste into Railway project Shared Variables
# Railway auto-redeploys both services
```

Other secrets (Supabase service role, X bearer): rotate via the respective dashboard, then update Railway. Steps in `docs/runbook/x-bearer-rotated.md`.

---

## Git hygiene

```bash
# Start a phase branch from up-to-date main
git checkout main && git pull
git checkout -b phase-N-<slug>

# Before committing
npm run typecheck && npm run lint && npm test

# Release tag after MVP
git tag -a mvp-v0.1.0 -m "MVP — auth + watchlist + daily cron"
git push --tags
```

---

## Common bash idioms used in this project

```bash
# List files modified in last commit
git diff --name-only HEAD~1

# Count lines across all TS files under app/
find app -name "*.ts" -o -name "*.tsx" | xargs wc -l

# Check .env.local is git-ignored
git check-ignore .env.local          # should print .env.local

# Spawn a one-off node script with env loaded
npx dotenv -e .env.local -- tsx workers/refresh.ts all
```

---

## Troubleshooting

See `docs/runbook/`:
- `cron-didnt-fire.md`
- `x-bearer-rotated.md`
- `ndx-token-not-detected.md`
- `polymarket-cors-broke.md`
- `restore-from-backup.md`
