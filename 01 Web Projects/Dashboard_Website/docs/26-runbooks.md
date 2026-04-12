# 26 — Operational Runbooks

Audience: solo operator. Terse, step-by-step. No fluff.

---

## 1. Railway Deploy Rollback

**When:** bad deploy just went out; health check failing or errors spiking.

**Preferred path — Railway dashboard:**

1. Open [railway.app](https://railway.app) → your project → **Deployments** tab.
2. Find the last known-good deployment (green status).
3. Click **⋯ → Redeploy** on that deployment.
4. Wait for status to go green (typically 60–90 s).
5. Run post-rollback smoke test (see below).

**Fallback — CLI:**

```bash
railway rollback
```

This rolls back to the previous deployment. Confirm with `railway status`.

**Post-rollback smoke test:**

```bash
curl -sf https://<your-domain>/api/health | jq .
```

Expected response:

```json
{ "status": "ok", "db": "connected", "ts": "<timestamp>" }
```

If `db` is not `"connected"`, check Railway → **Variables** → `DATABASE_URL` is still set and the Postgres service is running.

---

## 2. Prisma Migration Rollback

**When:** a migration was applied (`prisma migrate deploy`) and something broke.

**Step 1 — mark the migration as rolled back:**

```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

`<migration_name>` is the folder name under `prisma/migrations/`, e.g. `20240601120000_add_config_table`.

**Step 2 — manually revert the DDL in your database:**

Connect to Railway PostgreSQL (from Railway dashboard → **Connect**) and run the inverse SQL by hand. There is no auto-down migration.

**Step 3 — fix the migration source file, then redeploy:**

```bash
npx prisma migrate deploy
```

**Step 4 — verify schema:**

```bash
npx prisma db pull
npx prisma validate
```

> **Warning — CURRENT_SCHEMA_VERSION = 1.** No data migration exists. Rollback is DDL-only. Any column drops or renames will destroy data in that column permanently. Take a Railway backup snapshot before running any destructive migration.

---

## 3. Backup Restore Drill (Quarterly)

**Cadence:** March, June, September, December — first week of the month.

**Step 1 — download the backup:**

1. Railway dashboard → your Postgres service → **Backups** tab.
2. Click the most recent backup → **Download**.
3. Save as `backup.dump`.

**Step 2 — restore to a local or staging database:**

```bash
pg_restore -d $DATABASE_URL --clean --if-exists backup.dump
```

> Do not restore to production unless recovering from data loss. Use a staging `DATABASE_URL`.

**Step 3 — verify calculation integrity:**

```bash
node tools/verify_fixture_a.js
```

Expected output (must match exactly):

```
savingsRate : 42.65
monthlyIO   : 5,133
monthlyPI   : 6,821
```

If any value differs, the restore is incomplete or the backup predates Fixture A seed data. Do not mark the drill as passed.

**Step 4 — log the result:**

Append one line to `docs/backup-log.txt` (not committed):

```
2024-06-03 — restore OK — savingsRate 42.65 / monthlyIO 5133 / monthlyPI 6821
```

---

## 4. Secret Rotation (90-Day Cadence)

**Secrets in scope:** `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `DATABASE_URL`.

**Zero-downtime procedure (all secrets):**

1. Generate the new secret value (Clerk dashboard, Railway, or your password manager).
2. In Railway dashboard → **Variables**, add a second variable with a temp name, e.g. `CLERK_SECRET_KEY_NEW`.
3. Deploy a code change that reads the new variable name, or test manually with `railway run`.
4. Confirm the new secret works end-to-end (sign in, save config, verify DB write).
5. Rename the variable back to `CLERK_SECRET_KEY` (Railway will re-deploy).
6. Delete the old value or temp variable.

**Clerk key rotation specifically:**

1. Clerk dashboard → **API Keys** → **Create new secret key**.
2. Copy the new key.
3. Add to Railway Variables (temp name), verify signin flow.
4. Swap variable name, delete old key from Clerk dashboard.

**Rotation schedule tracker** (maintain in a private note, not in this repo):

| Secret | Last rotated | Next due |
|---|---|---|
| `CLERK_SECRET_KEY` | — | — |
| `CLERK_WEBHOOK_SECRET` | — | — |
| `DATABASE_URL` password | — | — |

---

## 5. Sentry Quota Exhaustion

**Symptom:** errors are occurring but nothing new is appearing in the Sentry issues dashboard.

**Diagnosis:**

1. Sentry dashboard → **Settings → Usage & Billing → Stats**.
2. Check if the monthly error quota is consumed (progress bar at 100%).
3. Check the "Rate Limited" events count — non-zero confirms quota drop.

**Fallback while quota is exhausted:**

Pino logger still emits structured JSON logs to Railway's log pipeline regardless of Sentry status.

1. Railway dashboard → your service → **Logs** tab.
2. Filter by `"level":"error"` or use the search field.
3. Errors are still captured; they are just not indexed in Sentry.

**Mitigations:**

- Increase filter stringency in `lib/sentry.ts` `beforeSend` callback — drop low-signal events (e.g. 4xx user errors, known bot traffic).
- Add `sampleRate` for non-error events to preserve quota for actual errors.
- Upgrade Sentry plan if base quota is routinely exhausted.

---

## 6. Incident Classification

| Level | Definition | SLA |
|---|---|---|
| **P0** | App down, data loss, or data leak | Page immediately; rollback within 15 min |
| **P1** | Critical feature broken (auth, save config, calculate) | Fix and deploy within 1 hour |
| **P2** | Non-critical bug or visual regression | Fix in next planned deploy |

**Post-mortem template (5 lines — write within 24 hours of P0/P1 resolution):**

```
What happened   : 
When            : 
Impact          : 
Root cause      : 
Prevention      : 
```

Store in `docs/incidents/YYYY-MM-DD.md` (gitignored if it contains PII).

---

## 7. Clerk Outage Fallback

**Signal:** [status.clerk.com](https://status.clerk.com) shows an active incident.

**App behaviour during Clerk outage:**

- New sign-in attempts will fail. The app displays a "Login temporarily unavailable — please try again shortly" banner (rendered server-side without calling Clerk).
- Existing sessions remain valid for the duration of the JWT TTL (default 60 s for short-lived tokens; 30 days if long-lived sessions are enabled). Users already signed in can continue using the dashboard.

**Operator actions:**

1. No code change is required.
2. Monitor [status.clerk.com](https://status.clerk.com) for resolution.
3. If the outage exceeds 30 minutes, post a status note to users via your status channel or a static maintenance page.
4. Once Clerk resolves the incident, new logins resume automatically — no redeploy needed.

**Do not** disable Clerk auth or add a bypass during an outage. P0 data security risk.

---

## 8. Financial Year Rollover (Annual — 1 July)

**What changes on 1 July:**

- Australian Superannuation Guarantee (SG) rate may increase.
- Income tax brackets may change.
- The `YearRolloverBanner` component displays to users on their first login after 30 June.

**Checklist — complete before 1 July each year:**

1. **Check ATO announcements** for new SG rate and tax bracket changes.
2. **Update `lib/au-tax-data.ts`:**
   - `SG_RATE` constant (e.g. `0.115` → `0.12`).
   - `TAX_BRACKETS` array if thresholds or rates changed.
3. **Run tests:**
   ```bash
   npm test
   npx tsc --noEmit
   ```
4. **Re-run the calculation baseline:**
   ```bash
   node tools/verify_fixture_a.js
   ```
   If Fixture A expected values change due to SG/tax changes, update `docs/10-test-fixtures.md` and flag for review before merging.
5. **Check `profile.currentYear`** in the database schema — confirm it increments correctly on `rollForward()`.
6. **Deploy to staging**, sign in, verify `YearRolloverBanner` appears and `rollForward()` runs cleanly.
7. **Deploy to production** no later than 1 July 00:00 AEST.

The banner triggers `rollForward()` client-side. No DB migration is needed for the rollover itself.
