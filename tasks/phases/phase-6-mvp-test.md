# Phase 6 — MVP Test, Polish, Decommission Local

**Goal**: use the dashboard as a real user, fix the worst friction, turn off the local Windows scheduled task, and declare MVP done.

**Duration**: ~4 hours.

---

## Prerequisites

- Phases 0–5 gates all passed.
- It is morning in AEST (you want the 07:00 cron to have fired at least once).

---

## Outputs

- [ ] Fresh-eyes walkthrough completed and documented.
- [ ] Top 3 friction fixes shipped.
- [ ] Cron confirmed auto-fired without intervention.
- [ ] Windows scheduled task disabled.
- [ ] `tasks/todo.md` reflects MVP complete.
- [ ] Post-MVP backlog prioritised.

---

## Steps

### 6.1 Fresh-eyes walkthrough

**On your phone**, open a fresh browser (clear cookies or use incognito):

1. Navigate to `https://dashboard.<apex>`.
2. Expect: redirect to `/login`.
3. Submit your email.
4. Switch to email app, wait for magic link (< 60s).
5. Tap the link.
6. Expect: dashboard renders. All 10 tickers visible. Polymarket prices update.
7. Tap "Refresh now". Expect: button shows "Refreshing…", then page reloads with fresher `fetched_at`.
8. Tap "Sign out". Expect: back to `/login`.

**Record every friction point** in `docs/walkthrough-2026-04-23.md`:

```md
# Fresh-eyes walkthrough — 2026-04-23

## What worked
- …

## Friction
| # | Issue | Severity (blocker/major/minor) | Fix proposed |
|---|-------|-------------------------------|--------------|
| 1 | | | |

## Missing vs legacy
- …
```

---

### 6.2 Verify cron fired this morning

**Do this before fixing anything** — answers the most important question: does the thing run without you.

In Supabase SQL editor:

```sql
select kind, ok, started_at, finished_at, error
from refresh_runs
where started_at >= (now() - interval '26 hours')
order by started_at desc;
```

**Expected**: a row with `kind='all'`, `ok=true`, `started_at` near 21:00 UTC last night.

**If missing**: follow `docs/runbook/cron-didnt-fire.md`. This is a blocker — fix before shipping.

Also check `quotes.fetched_at`:
```sql
select ticker, fetched_at from quotes order by fetched_at desc limit 3;
```
Most recent `fetched_at` should be from the auto-run, not your manual trigger.

---

### 6.3 Fix top 3 friction points

Pick the 3 highest-severity items from §6.1. For each:

1. Make the change.
2. `npm run typecheck && npm run lint && npm test`.
3. Commit with message `fix(mvp): <short description>`.
4. Push → wait for Railway deploy → retest on phone.

**Resist scope creep.** Fix what's broken, not what's imperfect. Pixel-parity and mobile polish are post-MVP.

---

### 6.4 Disable the Windows scheduled task

On the user's Windows machine:

```powershell
Disable-ScheduledTask -TaskName "MorningDashboardRefresh"
# OR: open Task Scheduler → MorningDashboardRefresh → Disable
```

**Verify**:
```powershell
Get-ScheduledTask -TaskName "MorningDashboardRefresh" | Select-Object TaskName, State
# State: Disabled
```

Do NOT delete the task yet — keep it as a one-click re-enable path for 30 days in case the web cron has a latent bug.

Also in `legacy/context.md` (parent dir, not the copy) add a note:

```md
## STATUS: deprecated 2026-04-23
Replaced by web dashboard at https://dashboard.<apex>.
Windows scheduled task DISABLED (not deleted — kept for 30-day fallback).
```

---

### 6.5 Fill parity checklist

Open `docs/parity-checklist.md`. Tick every box that is genuinely at parity. Explicitly mark `DEFERRED` on:

- Feed page (X tweets) — Phase 7
- Inline metadata edit — Phase 8
- Pixel-perfect CSS match — Phase 9
- Mobile polish — Phase 9

The checklist now shows exactly what MVP covers and what's next.

---

### 6.6 Update task tracker

Edit `tasks/todo.md`:

- Check off Phase 1–5 boxes.
- Under "Review", append:
  - `Phase 1 review: scaffold clean, ~4h actual.`
  - ... one line per phase.
- Rename Phase 6 section header to `Phase 6 — MVP Test (done 2026-04-DD)`.

Then populate a new section `## Post-MVP backlog` from `mvp_plan.md`:

```md
## Post-MVP backlog (prioritised)
1. Sentry + heartbeat observability — silent cron failure is the #1 prod risk.
2. X tweets feed page (`/feed`).
3. Inline catalyst/target/priority edit form.
4. Contract tests running weekly (yfinance, polymarket, X).
5. CSP tightening + rate limits on /api/refresh.
6. Pixel parity with legacy layout.
7. Mobile viewport polish.
```

---

### 6.7 Capture lessons

Anything surprising during Phases 0–6 → one row in `tasks/lessons.md`.

Minimum expected entries (derived from common issues):
- yfinance field name drift (if the spike found one)
- Polymarket gamma slug detection heuristic (if NDX auto-detect was finicky)
- Any middleware config that took more than one deploy to get right

---

### 6.8 Final commit + tag

```bash
git add .
git commit -m "chore(mvp): walkthrough, decommission local, backlog update"
git push
git tag -a mvp-v0.1.0 -m "MVP — auth + watchlist + daily cron"
git push --tags
```

---

## Gate — MVP DONE

- [ ] Cron fired automatically this morning (verified in `refresh_runs`).
- [ ] Fresh-eyes walkthrough completed on phone via magic link.
- [ ] Top 3 friction points fixed.
- [ ] Windows scheduled task disabled (not deleted).
- [ ] Parity checklist reflects actual state + deferred items.
- [ ] Post-MVP backlog written.
- [ ] Run all 4 invariant audit greps from `docs/invariants.md` §"Quick audit script". Each returns zero lines.
- [ ] Run the `/api/refresh/all` live test with valid secret → 200 + new `refresh_runs` row.
- [ ] Run the same endpoint with invalid secret → 401.
- [ ] Release tag `mvp-v0.1.0` pushed.

If all of the above is true: MVP ships. Hand back to the human.

---

## Common pitfalls

- **Declaring done without verifying auto-cron**: the whole point of this project is that you don't touch it daily. If the cron hasn't fired without manual intervention, you don't have an MVP.
- **Scope creep during walkthrough**: "while I'm in here, let me also fix X". No — fix top 3, list the rest in the backlog.
- **Deleting the Windows task**: keep it disabled for 30 days. Web cron failure in week 1 is a real risk.
- **Forgetting to switch `page.tsx` to authenticated client in Phase 5**: silently exposes service-role-read to any browser that can guess the URL. Verify in Phase 5 §5.7.
- **Pushing without a release tag**: harder to roll back. Tag every shipped version.
