# Phase Playbook Fix Plan

**Purpose**: remediate bugs, inconsistencies, and gaps found in `tasks/phases/` review (2026-04-25). Another agent executes each task below top-to-bottom. Each task has exact file, exact edit, and a verify step.

**Scope boundary**: do NOT rewrite phase documents wholesale. Surgical edits only. Do NOT touch scaffolded application code (`web_transition/app/**`) except where a task explicitly names a file under it.

**Branch**: continue on `phase-1-scaffold` or create `phase-playbook-fixes` from `main`. Ask human which. Commit per task group using conventional commits.

---

## Task 0 — Prerequisites

- [ ] 0.1 Confirm branch strategy with human (this branch vs new branch).
- [ ] 0.2 Read source files before editing any phase doc:
  - `tasks/phases/phase-0-decisions.md` → `phase-6-mvp-test.md`
  - `tasks/phases/README.md`
  - `tasks/todo.md`
  - `docs/invariants.md`
  - `docs/commands.md`
  - `docs/conventions.md`
  - `CLAUDE.md`
  - `web_transition/app/next.config.ts` (current committed state)
  - `web_transition/app/package.json` (current Next version)
- [ ] 0.3 Record actual Next version found in `app/package.json`. Use this version in every doc reference.

**Gate**: agent can quote Next version, current `next.config.*` extension, and `.env.example` key list before editing.

---

## Task 1 — Critical bugs (must fix first)

### 1.1 Phase 1 `next.config.js` → `next.config.ts`

**File**: `tasks/phases/phase-1-scaffold.md`, section 1.2.

**Problem**: playbook writes CommonJS `next.config.js` (`module.exports`). Repo committed state uses `next.config.ts`. Executor following playbook would overwrite committed TS file with JS version → type loss + duplicate configs.

**Edit**:
- Rename section file target to `next.config.ts`.
- Replace code block with TS-flavoured export:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- Keep TODO note: CSP added in Phase 5.

**Verify**: `web_transition/app/next.config.ts` already exists and matches (no edit to the actual file needed unless drift found — compare and reconcile).

---

### 1.2 Phase 2 `import-watchlist.ts` cwd-relative path bug

**File**: `tasks/phases/phase-2-schema.md`, section 2.3.

**Problem**: `readFileSync('legacy/morning-watchlist.html', 'utf8')` is cwd-relative. Step 2.4 runs from `web_transition/scripts/` → resolves to `scripts/legacy/...` = ENOENT. Pitfall at bottom contradicts actual code.

**Edit** — replace the `readFileSync` line in the embedded `import-watchlist.ts` code block with:

```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HTML_PATH = resolve(__dirname, '..', 'legacy', 'morning-watchlist.html');
```

And in `main()`:

```ts
const html = readFileSync(HTML_PATH, 'utf8');
```

**Also update** the "Common pitfalls" bullet at bottom of Phase 2:
- Old: "Running the script from repo root instead of `scripts/`: relative path won't resolve."
- New: "Running the script from any cwd: path is resolved relative to the script file via `import.meta.url`, so `cwd` doesn't matter. If you see ENOENT, confirm `web_transition/legacy/morning-watchlist.html` exists."

**Verify**: after edit, grep the phase-2 file for `'legacy/morning-watchlist.html'` — must show the new resolved form only.

---

### 1.3 Phase 2 nested-brace regex break

**File**: `tasks/phases/phase-2-schema.md`, section 2.3 (`parseDefaultStocks`).

**Problem**: `/"?([A-Z0-9]+)"?\s*:\s*\{([^}]*)\}/g` fails on any entry with a nested object literal. Silent partial parse can still yield >0 rows → fail-hard check at line `if (rows.length === 0)` passes incorrectly.

**Edit** — replace `parseDefaultStocks` body with a brace-balanced scan:

```ts
function parseDefaultStocks(html: string) {
  const blockMatch = html.match(/const\s+defaultStocks\s*=\s*\{/);
  if (!blockMatch) throw new Error('defaultStocks block not found in HTML');
  const start = blockMatch.index! + blockMatch[0].length;

  // Walk braces to find matching close of the outer object.
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
```

**Add a unit test** to phase playbook at new sub-step 2.3b (before 2.4 dry-run):

- Create `web_transition/scripts/tests/parse-default-stocks.test.ts` (described in-doc; not executed yet — agent only documents the test requirement in the phase playbook).
- Test cases: nested object, no matches → throws, 10 tickers known-good fixture.

**Verify**: dry-run in step 2.4 must produce 10 rows with all metadata non-null.

---

### 1.4 Phase 3 violates Invariant I5 mid-merge

**File**: `tasks/phases/phase-3-read-path.md`, section 3.4 + Phase 3 "Common pitfalls" + `tasks/phases/phase-5-auth.md` section 5.7.

**Problem**: Phase 3 ships `page.tsx` using `getServiceClient()`. Audit script in `docs/commands.md` + `docs/invariants.md` flags `getServiceClient` outside `server.ts|workers/|api/refresh/`. Between Phase 3 merge and Phase 5 merge, `main` fails audit.

**Pick resolution (ask human if unclear)**:

**Option A (preferred) — anon read with public RLS policy until Phase 5**:
- Phase 3 uses `getBrowserClient()` (or server-side anon client) with RLS policy granting `SELECT` on `watchlist`, `quotes`, `polymarket_markets` to `anon` role.
- Phase 5 revokes anon SELECT, keeps `authenticated` SELECT.
- Requires matching edits in `schema/002_rls_policies.sql` or a separate `003_anon_read.sql` → `004_revoke_anon_read.sql`.

**Option B — documented audit carve-out**:
- Add exception note in `docs/invariants.md` I5: `app/app/watchlist/page.tsx` is exempt until Phase 5 step 5.7 (dated milestone).
- Update audit grep to exclude that exact path until Phase 5 completes.
- Phase 3 gate explicitly lists the carve-out; Phase 5 gate removes it.

**Edit** (assume Option B unless human says A):

- `tasks/phases/phase-3-read-path.md` §3.4: add banner at top:

  > **⚠ Invariant I5 carve-out**: this page temporarily uses `getServiceClient()`. The audit grep in `docs/invariants.md` is updated to exempt `app/app/watchlist/page.tsx` until Phase 5 step 5.7 swaps it to `getServerClient()`. Do NOT add any other `getServiceClient` usages to the client bundle path.

- `tasks/phases/phase-3-read-path.md` Common pitfalls: add bullet explaining the temporary exemption.

- `tasks/phases/phase-5-auth.md` §5.7: add post-edit verification step:

  ```bash
  # After swapping page.tsx to getServerClient, run the I5 audit:
  grep -rn "getServiceClient\|SUPABASE_SERVICE_ROLE_KEY" app/ --include="*.tsx" --include="*.ts" \
    | grep -v "server.ts\|workers/\|api/refresh/"
  # MUST return zero lines. Carve-out expires here.
  ```

- `docs/invariants.md` I5 "Check" block: document the temporary exemption with the expiry milestone (Phase 5 §5.7).

**Verify**: after Phase 5 gate passes, invariant audit in `docs/commands.md` returns zero lines with no exemptions active.

---

### 1.5 Phase 5 middleware matcher path

**File**: `tasks/phases/phase-5-auth.md`, section 5.6.

**Problem**: matcher `['/((?!api/refresh|_next|favicon).*)']` — negative lookahead strings lack leading slash. Next middleware matcher is anchored to path start, so `api/refresh` may miss `/api/refresh/...` in some Next versions.

**Edit** — replace `config` export with explicit leading slashes + anchored form:

```ts
export const config = {
  matcher: ['/((?!api/refresh($|/)|_next/|favicon\\.).*)'],
};
```

Also add a verify step in Phase 5 §5.9 (Local verification):

```bash
# Confirm middleware DOES NOT redirect /api/refresh/all
curl -I -H "x-refresh-secret: $REFRESH_SHARED_SECRET" \
  http://localhost:3000/api/refresh/all
# Expect: 200 or 405 (route exists + secret valid). NOT 307 to /login.
```

**Verify**: live curl returns no redirect to `/login`; production hit with valid secret succeeds.

---

## Task 2 — Env drift

### 2.1 Phase 1 `.env.example` missing keys

**File**: `tasks/phases/phase-1-scaffold.md`, section 1.3.

**Edit** — append to the `.env.example` code block:

```
# Auth (Phase 5)
AUTH_EMAIL_ALLOWLIST=you@example.com
NEXT_PUBLIC_SITE_URL=https://dashboard.example.com
```

Also update the committed `web_transition/app/.env.example` file if these keys are absent.

**Verify**: `grep -E 'AUTH_EMAIL_ALLOWLIST|NEXT_PUBLIC_SITE_URL' web_transition/app/.env.example` returns both lines.

---

### 2.2 `infra/env-vars.md` sync

**File**: `infra/env-vars.md` (if it exists; create stub if missing per `docs/conventions.md` "Adding a new env var" §).

**Edit**: add rows for `AUTH_EMAIL_ALLOWLIST`, `NEXT_PUBLIC_SITE_URL`, `HEARTBEAT_URL`, `SENTRY_DSN` with purpose + rotation notes. Mark last two as post-MVP placeholders.

**Verify**: file lists every key present in `.env.example`, no orphans either direction.

---

## Task 3 — Inconsistencies

### 3.1 `tasks/todo.md` phase numbering mismatch

**File**: `tasks/todo.md`.

**Problem**: `todo.md` uses a 5-phase collapsed numbering (Phase 0 = pre-work, Phase 1 = scaffold+schema, Phase 2 = read path, …). Playbooks use 0..6. Two numbering schemes → executor cannot tell which phase is "active".

**Edit** — rewrite `todo.md` to mirror playbook numbering exactly:

```md
# Phase Checklist

Tracks progress against `tasks/phases/README.md`.

## Phase 0 — Decisions & Accounts
- [ ] Domain + Cloudflare access confirmed
- [ ] Railway project created
- [ ] Supabase project created
- [ ] X bearer token verified
- [ ] REFRESH_SHARED_SECRET generated
- [ ] yfinance spike: `decisions/2026-04-23-yfinance-replacement.md`
- [ ] Polymarket CORS verified

## Phase 1 — Scaffold & Deploy Empty App
- [ ] Next.js scaffold at `web_transition/app/`
- [ ] Security headers in `next.config.ts`
- [ ] `.env.example` with all MVP keys
- [ ] Vitest installed, `npm test` passes
- [ ] Railway auto-deploys on push
- [ ] `https://dashboard.<apex>` serves HTTPS
- [ ] Cloudflare proxy (orange cloud) + Full-strict TLS

## Phase 2 — Schema & Seed
- [ ] `schema/001_initial.sql` applied
- [ ] `schema/002_rls_policies.sql` applied
- [ ] `scripts/import-watchlist.ts` dry-run clean
- [ ] Seeded 10 tickers with full metadata
- [ ] AVEX exchange = NYSE
- [ ] polymarket_markets seeded (2/3 tokens populated; NDX pending)

## Phase 3 — Watchlist Read Path
- [ ] `/watchlist` renders 10 tickers
- [ ] Polymarket panel live-polls every 15s
- [ ] Session countdown accurate (ET → AEST)
- [ ] Invariant I5 carve-out documented (expires Phase 5)

## Phase 4 — Refresh Worker & Cron
- [ ] `lib/sources/yfinance.ts` + contract-ready types
- [ ] `lib/sources/polymarket.ts` with NDX auto-detect
- [ ] `workers/refresh.ts` end-to-end local run
- [ ] `/api/refresh/all` with shared-secret guard
- [ ] Railway cron service `dashboard-cron` @ `0 21 * * *`
- [ ] `refresh_runs` row on every invocation (invariant I12)
- [ ] Manual "Refresh now" button wired

## Phase 5 — Auth Gate
- [ ] Supabase magic-link auth enabled
- [ ] `lib/auth/allowlist.ts` with `isAllowed()`
- [ ] Login page + server action
- [ ] Callback handler rechecks allowlist (invariant I7)
- [ ] Middleware gate + matcher verified for `/api/refresh`
- [ ] `page.tsx` swapped to `getServerClient()` (invariant I5 audit passes)
- [ ] CSP added to `next.config.ts` with invariant I8 domains
- [ ] Logout button

## Phase 6 — MVP Test, Polish, Decommission
- [ ] Fresh-eyes walkthrough documented
- [ ] Cron fired autonomously (confirmed via `refresh_runs`)
- [ ] Top-3 friction fixes shipped
- [ ] Windows scheduled task disabled
- [ ] Parity checklist filled
- [ ] Invariant audit returns zero lines (all 4 greps)
- [ ] `tasks/lessons.md` updated
- [ ] Tag `mvp-v0.1.0`

## Review (fill after each phase)
- Phase 0 review:
- Phase 1 review:
- Phase 2 review:
- Phase 3 review:
- Phase 4 review:
- Phase 5 review:
- Phase 6 review:
```

**Verify**: `grep -c '^## Phase' tasks/todo.md` returns 7 (Phase 0..6).

---

### 3.2 Next.js version alignment

**Files**: `CLAUDE.md`, all `tasks/phases/*.md`, `README.md`, `implementation_guide.md` if referenced.

**Problem**: CLAUDE.md says "Next.js 15". Commits + scaffold show Next.js 16. Memory confirms.

**Edit** — read `app/package.json` first. Take the actual installed major version. Replace "Next.js 15" → "Next.js <actual>" in:
- `CLAUDE.md` (2 occurrences expected)
- `tasks/phases/phase-1-scaffold.md` if mentioned
- `README.md` / `implementation_guide.md` if mentioned

**Verify**: `grep -rn "Next\.js 15\|Next 15" CLAUDE.md tasks/ docs/ README.md implementation_guide.md` returns zero lines.

---

### 3.3 Phase 4 cron build wasteful

**File**: `tasks/phases/phase-4-refresh-worker.md`, section 4.9.

**Problem**: cron service set to `npm ci && npm run build` (full Next build) but Start Command is `npx tsx workers/refresh.ts all` — no Next runtime needed.

**Edit** — replace Build Command in 4.9:

- Build Command: `npm ci`  (no `npm run build`)
- Ensure `tsx` lives in `dependencies`, not `devDependencies` (already noted — leave note, reinforce).

Add a "why" note:

> Build step omitted intentionally: cron service runs TS directly via `tsx`. Next build artifacts are only needed by the web service. Saves ~1–2 min per deploy and reduces cron container size.

**Verify**: after deploy, cron service container size < web service; Railway build log for cron shows only `npm ci` step.

---

### 3.4 Phase 2 NDX placeholder slug collision risk

**File**: `tasks/phases/phase-2-schema.md`, section 2.7 + `schema/001_initial.sql` if referenced.

**Problem**: placeholder `slug='placeholder-ndx-daily'` + `auto_detect=true`. P4 worker updates by `eq('kind','ndx_daily')` and sets real slug. If `slug` has UNIQUE constraint AND another row later contains the same detected slug (shouldn't, but race), update silently misses.

**Edit** — in 2.7 after the insert SQL, add:

```sql
-- Verify unique ndx_daily row; auto-detect path updates by kind, not slug.
select id, kind, slug from polymarket_markets where kind = 'ndx_daily';
-- Expect: exactly 1 row with slug='placeholder-ndx-daily'.
```

And in Phase 4 §4.4, change the update to use the row `id` captured at insert time, OR document that `kind` is the stable key:

```ts
// Uses .eq('kind', 'ndx_daily') deliberately: slug rotates daily, kind is stable.
// polymarket_markets.kind has a unique constraint (see schema/001_initial.sql).
```

Check `schema/001_initial.sql` — if `kind` lacks unique constraint, add one via a new migration `schema/003_ndx_kind_unique.sql`:

```sql
alter table polymarket_markets add constraint polymarket_markets_kind_unique unique (kind);
```

**Verify**: SQL check shows exactly 1 `ndx_daily` row; constraint exists.

---

## Task 4 — Gaps

### 4.1 Phase 6 gate: invariant audit

**File**: `tasks/phases/phase-6-mvp-test.md`, "Gate — MVP DONE" section.

**Edit** — insert before the final "tag MVP" gate item:

```md
- [ ] Run all 4 invariant audit greps from `docs/invariants.md` §"Quick audit script". Each returns zero lines.
- [ ] Run the `/api/refresh/all` live test with valid secret → 200 + new `refresh_runs` row.
- [ ] Run the same endpoint with invalid secret → 401.
```

**Verify**: executor runs the audit; copy-paste output into `tasks/lessons.md` under "MVP audit".

---

### 4.2 Phase 4 unit test coverage

**File**: `tasks/phases/phase-4-refresh-worker.md`, section 4.6.

**Edit** — expand test file to cover two more invariants:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchQuotes } from '@/lib/sources/yfinance';

describe('fetchQuotes invariants', () => {
  it('throws on empty ticker list', async () => {
    await expect(fetchQuotes([])).rejects.toThrow(/zero tickers|empty/i);
  });
});

describe('refreshStocks invariant I2', () => {
  it('throws when watchlist is empty', async () => {
    const fakeSupabase = {
      from: () => ({ select: async () => ({ data: [], error: null }) }),
    };
    const { refreshStocks } = await import('@/workers/refresh');
    // refreshStocks is not currently exported — see task 4.2b below.
    await expect(refreshStocks(fakeSupabase as any)).rejects.toThrow(/empty/i);
  });
});

describe('runRefresh invariant I12', () => {
  it('writes refresh_runs row on thrown error', async () => {
    const inserts: any[] = [];
    const fakeSupabase = {
      from: (t: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async (row: any) => { inserts.push({ t, row }); return { error: null }; },
      }),
    };
    const { runRefresh } = await import('@/workers/refresh');
    // override createClient via dep-injection shim — see task 4.2b.
    await expect(runRefresh('stocks')).rejects.toBeTruthy();
    expect(inserts.some((x) => x.t === 'refresh_runs' && x.row.ok === false)).toBe(true);
  });
});
```

**4.2b** — refactor note in playbook: `refreshStocks` + `runRefresh` must be exported, and `createClient` must be dependency-injectable (accept an optional client arg). Document the refactor as part of §4.4.

**Verify**: `npm test` green; coverage includes I2 + I12 paths.

---

### 4.3 Phase 0 X bearer curl clarity

**File**: `tasks/phases/phase-0-decisions.md`, section 0.4.

**Edit** — replace hardcoded user ID with:

```bash
# Smoke test: fetch the authenticated user's own info (any valid bearer works)
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  "https://api.x.com/2/users/me"

# OR — test against the legacy dashboard's target account (Sikand, user_id captured in legacy/refresh_all.py)
# SIKAND_USER_ID from legacy/refresh_all.py config:
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  "https://api.x.com/2/users/3007206859/tweets?max_results=5"
```

Add comment: "3007206859 = @sikand_us (confirm in `legacy/refresh_all.py`)".

**Verify**: doc reader can identify whose account the ID represents without opening legacy code.

---

### 4.4 Phase 0 spike cleanup safety

**File**: `tasks/phases/phase-0-decisions.md`, section 0.6.

**Edit** — replace the cleanup command with a scoped temp-dir pattern:

```bash
mkdir -p /tmp/yfinance-spike && cd /tmp/yfinance-spike
# write spike-yfinance.ts here, run, then:
cd - && rm -rf /tmp/yfinance-spike
```

Remove the repo-root `rm -rf` form.

**Verify**: after spike, `ls web_transition/` has no leaked `package.json` / `node_modules`.

---

## Task 5 — Minor polish

### 5.1 Phase 3 §3.4 link to I5 note

**File**: `tasks/phases/phase-3-read-path.md`, §3.4.

**Edit**: change "temporary service-client" note to explicitly link to `docs/invariants.md` I5 exemption (set in task 1.4).

---

### 5.2 `tasks/phases/README.md` phase-count sanity

**File**: `tasks/phases/README.md`.

**Edit**: verify the phase map table matches 0..6. If mismatch found (it currently shows all 7), leave. Add a one-line footer: "If `tasks/todo.md` disagrees with this file, `tasks/phases/` is the source of truth."

---

## Execution order

1. Task 0 (context).
2. Task 1 (critical bugs) — one commit per subtask, conventional commit style: `fix(phase-N): ...`.
3. Task 2 (env drift) — one commit: `chore(env): align .env.example with phase 5 keys`.
4. Task 3 (inconsistencies) — commit per subtask.
5. Task 4 (gaps) — commit per subtask.
6. Task 5 (polish) — single commit: `docs(phases): minor polish`.

After every commit: `npm run typecheck && npm run lint && npm test` from `web_transition/app/` — must stay green. Playbook edits that don't touch code skip the test run but should still lint-check any embedded code blocks manually.

## Final verification

- [ ] Re-read every edited file. No broken markdown, no orphan code fences, no stale section references.
- [ ] Run `grep -rn "next\.config\.js" tasks/ docs/ CLAUDE.md` — zero matches.
- [ ] Run `grep -rn "Phase 1 — Scaffold & schema" tasks/` — zero matches (old todo.md wording).
- [ ] Run `grep -rn "readFileSync.*legacy/morning-watchlist" tasks/` — only the new `HTML_PATH`-based form.
- [ ] Diff summary to human: list of files changed + one-line reason per file.

## Out of scope (do NOT do)

- Do NOT rewrite `implementation_guide.md` structurally.
- Do NOT execute Phase 0 steps (account creation, spikes).
- Do NOT edit `schema/001_initial.sql` beyond adding the `kind` unique constraint in task 3.4, and only if the constraint is genuinely absent.
- Do NOT touch `web_transition/app/**` source files except `next.config.ts` (reconcile only) and `.env.example` (append-only).
- Do NOT introduce new dependencies.

## Handoff

When done, comment on `tasks/lessons.md` with:
- List of files touched.
- Any decision points escalated to human (Option A vs B in task 1.4).
- Any tasks skipped with reason.

End of fix plan.
