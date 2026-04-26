# Phase 2 — Schema & Seed

**Goal**: Supabase has all tables, RLS enabled, and the current watchlist (10 tickers + catalyst notes) imported with zero data loss.

**Duration**: ~3 hours.

---

## Prerequisites

- Phase 1 gate passed.
- Access to Supabase SQL Editor for the `morning-dashboard` project.
- `legacy/morning-watchlist.html` present (copied in initial scaffold).

---

## Outputs

- [ ] All 5 tables created with RLS.
- [ ] `watchlist` seeded from legacy HTML with all metadata.
- [ ] 3 polymarket_markets rows inserted.
- [ ] `scripts/import-watchlist.ts` committed and re-runnable.

---

## Steps

### 2.1 Run initial schema

Open Supabase → SQL Editor → New query. Paste full contents of `schema/001_initial.sql`. Run.

**Verify**:
```sql
select table_name from information_schema.tables where table_schema = 'public' order by table_name;
-- Expect: polymarket_markets, quotes, refresh_runs, tweets, watchlist
```

---

### 2.2 Apply RLS policies

New query. Paste full contents of `schema/002_rls_policies.sql`. Run.

**Verify**:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- All 5 tables: rowsecurity = true
```

Anon read test:
```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/watchlist" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# Expect: [] (empty array, not 401 — authenticated role can SELECT, but anon isn't authenticated)
```

Wait — anon role by default has no grants. This returns `[]` with RLS on + `authenticated`-only policy. That's expected.

---

### 2.3 Write the import script

Create `scripts/package.json`:

```json
{
  "name": "dashboard-scripts",
  "type": "module",
  "private": true,
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

```bash
cd scripts
npm install
```

Create `scripts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Create `scripts/import-watchlist.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HTML_PATH = resolve(__dirname, '..', 'legacy', 'morning-watchlist.html');

// Parses the defaultStocks object literal from morning-watchlist.html.
// Uses brace-balanced scanning — not regex — so nested object literals
// (e.g. embedded metadata) are handled correctly. Fail hard on zero matches.
function parseDefaultStocks(html: string) {
  const blockMatch = html.match(/const\s+defaultStocks\s*=\s*\{/);
  if (!blockMatch) throw new Error('defaultStocks block not found in HTML');
  const start = blockMatch.index! + blockMatch[0].length;

  // Walk braces to find the matching close of the outer object.
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  if (depth !== 0) throw new Error('defaultStocks block: unbalanced braces');
  const body = html.slice(start, i - 1);

  // Split top-level entries by brace-balanced scan.
  const rows: Array<{
    ticker: string;
    catalyst: string | null;
    price_target: number | null;
    priority: number | null;
    notes: string | null;
  }> = [];

  const tickerRe = /"?([A-Z0-9]+)"?\s*:\s*\{/g;
  let tm;
  while ((tm = tickerRe.exec(body)) !== null) {
    const ticker = tm[1];
    let d = 1;
    let j = tm.index + tm[0].length;
    while (j < body.length && d > 0) {
      const ch = body[j];
      if (ch === '{') d++;
      else if (ch === '}') d--;
      j++;
    }
    if (d !== 0) throw new Error(`Unbalanced braces parsing ${ticker}`);
    const obj = body.slice(tm.index + tm[0].length, j - 1);

    const field = (k: string) => {
      const r = new RegExp(`\\b${k}\\s*:\\s*("([^"]*)"|'([^']*)'|(-?[0-9.]+)|null)`);
      const mm = obj.match(r);
      if (!mm) return null;
      return mm[2] ?? mm[3] ?? (mm[4] ? Number(mm[4]) : null);
    };

    rows.push({
      ticker,
      catalyst: field('catalyst') as string | null,
      price_target: field('priceTarget') as number | null,
      priority: field('priority') as number | null,
      notes: field('notes') as string | null,
    });

    tickerRe.lastIndex = j;
  }

  if (rows.length === 0) throw new Error('Zero tickers parsed — aborting (silent metadata loss is never acceptable)');
  return rows;
}

// 2.3b Unit test requirement (document only — run before 2.4 dry-run):
// Create scripts/tests/parse-default-stocks.test.ts with:
//   - happy path: 10 known-good tickers with metadata
//   - nested object entry: parses correctly (not silently skipped)
//   - no matches: throws Error matching /zero tickers/i

async function main() {
  const apply = process.argv.includes('--apply');
  const html = readFileSync(HTML_PATH, 'utf8');
  const rows = parseDefaultStocks(html);

  console.log(`Parsed ${rows.length} tickers:`);
  console.table(rows);

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to write to Supabase.');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase.from('watchlist').upsert(
    rows.map((r, i) => ({ ...r, sort_order: i, updated_at: new Date().toISOString() })),
    { onConflict: 'ticker' },
  );
  if (error) throw error;

  const { count } = await supabase.from('watchlist').select('*', { count: 'exact', head: true });
  if (count !== rows.length) throw new Error(`Expected ${rows.length} rows after upsert, got ${count}`);
  console.log(`\n✓ Wrote ${count} rows to watchlist`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Create `scripts/.env` from password manager (git-ignored):
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Add `scripts/.env` to `.gitignore` at repo root.

---

### 2.4 Dry-run the import

```bash
cd scripts
npx tsx import-watchlist.ts
```

**Verify**: prints a table with all 10 tickers (`FLY, SPIR, SATL, SIDU, AAOI, BE, MU, ASTS, INTC, AVEX`) with catalyst/target/priority present.

If any row shows `null` where legacy HTML had a value → regex missed it. Fix regex before proceeding.

---

### 2.5 Apply the import

```bash
npx tsx import-watchlist.ts --apply
```

**Verify** in Supabase SQL Editor:
```sql
select ticker, catalyst, price_target, priority, sort_order from watchlist order by sort_order;
-- 10 rows, all metadata populated
```

---

### 2.6 Set exchange column for AVEX

Per `legacy/context.md`: AVEX is NYSE, not NASDAQ.

```sql
update watchlist set exchange = 'NYSE' where ticker = 'AVEX';
update watchlist set exchange = 'NASDAQ' where exchange is null;
```

**Verify**:
```sql
select ticker, exchange from watchlist;
-- AVEX = NYSE, all others = NASDAQ
```

---

### 2.7 Seed polymarket_markets

Insert the 3 markets the legacy dashboard tracks. NDX daily auto-detected token IDs go in via the worker — here we just register the market kinds.

```sql
insert into polymarket_markets (slug, title, kind, auto_detect) values
  ('placeholder-ndx-daily', 'Nasdaq 100 daily direction', 'ndx_daily', true),
  ('us-recession-in-2026', 'US recession by end of 2026', 'recession_2026', false),
  ('spx-year-end-2026', 'S&P 500 year-end 2026', 'spx_yearend_2026', false)
on conflict (slug) do nothing;
```

Fetch real tokens for the two static markets from Polymarket gamma API and update:
```bash
curl -s 'https://gamma-api.polymarket.com/markets?slug=us-recession-in-2026' | jq '.[0].tokens'
```

Update:
```sql
update polymarket_markets set token_yes = '<yes-id>', token_no = '<no-id>' where kind = 'recession_2026';
update polymarket_markets set token_yes = '<yes-id>', token_no = '<no-id>' where kind = 'spx_yearend_2026';
```

(NDX daily tokens populated by Phase 4 worker — leave null for now.)

**Verify unique ndx_daily row** (the Phase 4 worker updates by `kind`, not `slug`):
```sql
-- auto-detect path updates by kind, not slug
select id, kind, slug from polymarket_markets where kind = 'ndx_daily';
-- Expect: exactly 1 row with slug='placeholder-ndx-daily'.
```

**Note**: `schema/003_ndx_kind_unique.sql` adds a UNIQUE constraint on `kind`. Apply it after `002_rls_policies.sql` to make the `kind` column a safe stable update key.

---

### 2.8 Commit

```bash
cd ..
git add scripts/ schema/ .gitignore
git commit -m "feat: watchlist schema + import script"
git push
```

---

## Gate to Phase 3

- [ ] `select count(*) from watchlist` = 10.
- [ ] Every ticker has non-null `catalyst` (per legacy HTML).
- [ ] `AVEX` has `exchange = 'NYSE'`.
- [ ] `polymarket_markets` has 3 rows; 2 have tokens populated.
- [ ] RLS blocks anon writes (`curl` test returns 401 on insert).
- [ ] `scripts/import-watchlist.ts` re-runnable without duplicates (upsert idempotency).

---

## Common pitfalls

- **Treating `defaultStocks` as JSON**: ✗. It's a JS object literal — use regex, not `JSON.parse`. Matches legacy Python approach for a reason.
- **Silent data loss**: the script MUST throw on zero rows parsed. Mirrors legacy invariant.
- **Service role key committed**: ✗. Only in `.env` (git-ignored) or Railway env vars.
- **Forgetting to sync the AVEX exchange override**: breaks the parity checklist later. Do it now.
- **Running the script from any cwd**: path is resolved relative to the script file via `import.meta.url`, so `cwd` doesn't matter. If you see ENOENT, confirm `legacy/morning-watchlist.html` exists.
