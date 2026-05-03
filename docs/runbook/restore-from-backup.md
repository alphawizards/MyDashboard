# Restore from backup

**When**: bad refresh overwrote `quotes` incorrectly, accidental `DELETE`, or data corruption.

## Options

### 1. Supabase Point-in-Time Recovery (paid tier)
Supabase dashboard → Database → Backups → restore to a timestamp before the bad write.
Takes ~5–15 min. Creates a new branch; promote when verified.

### 2. Table-level restore from snapshot
If we have daily snapshots (see Phase 5 TODO):
```
pg_restore --table=watchlist --data-only snapshot-YYYY-MM-DD.dump
```

### 3. Re-seed from `legacy/morning-watchlist.html`
Last-resort only for `watchlist` metadata:
```
cd web_transition
npx tsx scripts/import-watchlist.ts --source=legacy/morning-watchlist.html --dry-run
# review diff, then:
npx tsx scripts/import-watchlist.ts --source=legacy/morning-watchlist.html --apply
```

## Prevent recurrence
- Refresh worker must be idempotent and transactional (see `data-flow.md` invariant).
- `watchlist` metadata never touched by cron — only UI.
- Consider adding a nightly `pg_dump` → S3 in Phase 6.
