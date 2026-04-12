# Database Migration Runbook — RetireAU Dashboard

> **Status:** Schema version 1 is current as of 2026-04-11. No v2 migration exists or is planned. This document describes the migration *pattern* to follow when a future version is needed.

## Summary

This document covers two types of migrations: (1) Prisma schema migrations (DDL: CREATE TABLE, ALTER TABLE, ADD COLUMN) and (2) JSONB CONFIG schema migrations (bumping `schema_version` and transforming the CONFIG blob structure). Both patterns are provided with step-by-step walkthroughs, testing strategies, rollback procedures, and production safety checklists.

`CURRENT_SCHEMA_VERSION = 1`

---

## Overview: Two Migration Paths

### Path 1: Prisma Schema Migrations (DDL)

Used when the SQL table structure changes:
- Add a new column (e.g., `user.preferences JSONB`)
- Rename a column
- Create a new table (e.g., `ConfigSnapshot`)
- Drop a column (destructive)
- Add a constraint (e.g., NOT NULL)

**Workflow**: `npx prisma migrate dev` → review SQL → commit migration file → `npx prisma migrate deploy` on Railway.

### Path 2: JSONB CONFIG Schema Migrations (Versioning)

Used when the CONFIG blob structure changes without touching the table schema:
- Add a new field to CONFIG
- Restructure nested objects (e.g., flatten `expenses` array)
- Rename a CONFIG field
- Apply business logic transformation (e.g., convert salary from annual to monthly)

**Workflow**: Bump `CONFIG.schemaVersion` → write a `migrateVnToVm()` function → read-time migration → optional batch backfill.

---

## Prisma Schema Migrations (DDL)

### Workflow: Create and Deploy a Migration

#### Step 1: Update `prisma/schema.prisma`

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  clerkId   String   @unique
  email     String
  
  // NEW: Add a preferences column
  preferences Json? @default("{}") @map("preferences")
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  configs   Config[]

  @@map("users")
}
```

#### Step 2: Create the Migration

```bash
npx prisma migrate dev --name add_user_preferences
```

Prisma compares the schema to the current database and generates a migration file:

```
Created migration:
  prisma/migrations/20260410_add_user_preferences/migration.sql
```

#### Step 3: Review the Generated SQL

```sql
-- prisma/migrations/20260410_add_user_preferences/migration.sql
ALTER TABLE users
ADD COLUMN preferences JSONB DEFAULT '{}';
```

**Review checklist**:
- Does the SQL do what you intended?
- Does it lock a busy table? (Check: `ALTER TABLE ... ADD COLUMN ... DEFAULT` is non-locking in PostgreSQL if the default is immutable)
- Is there a rollback strategy?
- Are there indices needed?

#### Step 4: Commit the Migration File

```bash
git add prisma/migrations/20260410_add_user_preferences/migration.sql
git commit -m "Add preferences column to users table"
```

**Never edit migration files after creation.** If you made a mistake, create a new migration to fix it (e.g., a follow-up migration that drops the column).

#### Step 5: Deploy to Staging

```bash
git push origin feature/add-preferences
# In Railway (or CI/CD):
npx prisma migrate deploy
```

Prisma applies all pending migrations in order. Idempotent: re-running is safe.

#### Step 6: Run Tests

Run integration tests against staging to verify the migration didn't break anything:

```bash
npm run test:integration
```

#### Step 7: Deploy to Production

Same as staging:

```bash
git push origin main
# In Railway (via deploy hook or manual):
npx prisma migrate deploy
```

---

## Prisma Migration Patterns

### Pattern 1: Add a Column (Non-Destructive)

```sql
-- Very safe: non-locking, backward compatible
ALTER TABLE configs
ADD COLUMN config_backup JSON;
```

Rollback: `DROP COLUMN config_backup` (in a new migration).

### Pattern 2: Add a NOT NULL Constraint (Two Migrations)

**First migration: Add nullable column**:
```sql
ALTER TABLE users
ADD COLUMN preferences JSONB;
```

**Backfill existing rows**:
```typescript
// In a seed or one-off script
await prisma.user.updateMany({
  data: { preferences: {} },
});
```

**Second migration: Add NOT NULL**:
```sql
ALTER TABLE users
ALTER COLUMN preferences SET NOT NULL;
```

**Why two migrations**: PostgreSQL won't allow `ADD COLUMN ... NOT NULL DEFAULT ...` on populated tables without scanning every row (locks the table). Two migrations avoid the lock.

### Pattern 3: Rename a Column

```sql
ALTER TABLE configs
RENAME COLUMN config TO config_json;
```

**Also update** `prisma/schema.prisma`:

```prisma
model Config {
  ...
  config Json @map("config_json")
  ...
}
```

Rollback: Rename back (in a new migration).

### Pattern 4: Drop a Column (Destructive)

```sql
ALTER TABLE configs
DROP COLUMN config_backup;
```

**Before dropping**: Ensure no code references this column. Search the codebase for `config_backup`, `configBackup`, etc.

**Downtime**: No downtime for Postgres, but the app code must be updated before migration runs (deploy app → wait for rollout → run migration).

---

## JSONB CONFIG Schema Migrations (Versioning)

### Design Pattern

Every CONFIG blob includes a `schemaVersion` field:

```json
{
  "schemaVersion": 1,
  "profile": { ... },
  "debts": [ ... ],
  ...
}
```

When you add a feature that changes CONFIG structure, bump the version and write a migration function.

### Workflow: Add a New CONFIG Field

**Scenario (placeholder example)**: Add a `profile.riskProfile` field (e.g., `"conservative"`, `"balanced"`, `"growth"`) to capture the user's investment risk preference. This is a fictional example to illustrate the pattern — substitute the actual field when a real migration is needed.

#### Step 1: Define the New CONFIG Shape

```typescript
// types/config.ts
// Replace Vn/Vm with the actual version numbers when a real migration is needed
interface DashboardConfigVm {
  schemaVersion: /* m */;
  profile: {
    // ... existing fields ...
    riskProfile: 'conservative' | 'balanced' | 'growth'; // new field
  };
  // ... rest of CONFIG
}
```

#### Step 2: Write the Migration Function

Name the function after the actual version transition (e.g., `migrateVnToVm` → substitute real version numbers):

```typescript
// lib/configMigrations.ts
// Replace Vn/Vm with the actual version numbers
export function migrateVnToVm(config: DashboardConfigVn): DashboardConfigVm {
  return {
    ...config,
    schemaVersion: /* m */,
    profile: {
      ...config.profile,
      riskProfile: config.profile.riskProfile ?? 'balanced', // Sensible default
    },
  };
}

// Chain of migrations (apply all required in sequence)
export function migrateToLatestVersion(config: any): DashboardConfigVLatest {
  let migrated = config;

  // Add one block per version step
  if (migrated.schemaVersion < /* m */) {
    migrated = migrateVnToVm(migrated);
  }

  // Future: if (migrated.schemaVersion < /* m+1 */) { migrated = migrateVmToVp(migrated); }

  return migrated;
}
```

#### Step 3: Apply at Read Time

Whenever the dashboard loads a CONFIG, apply the migration chain:

```typescript
// app/api/config/route.ts
import { migrateToLatestVersion } from '@/lib/configMigrations';

export async function GET(req: Request) {
  const { userId } = await auth();
  const config = await prisma.config.findFirst({
    where: { user: { clerkId: userId }, isActive: true },
  });

  if (!config) {
    return Response.json({ config: null, timestamp: null });
  }

  // Apply migrations to old configs
  const migratedConfig = migrateToLatestVersion(config.config);

  return Response.json({
    config: migratedConfig,
    timestamp: config.updatedAt.getTime(),
  });
}
```

The app can then:
- Auto-upgrade old configs on read
- Save new configs at the latest version
- Require no schema change (same JSONB column)

#### Step 4: Optional Batch Backfill

If you want to persist the migrations (instead of applying on every read), run a one-off backfill script:

```typescript
// scripts/backfill-config-vN.ts
import { prisma } from '@/lib/db';
import { migrateToLatestVersion } from '@/lib/configMigrations';

const TARGET_VERSION = 2; // Update for each migration

async function backfillConfigs() {
  const configs = await prisma.config.findMany({
    where: { schemaVersion: { lt: TARGET_VERSION } },
  });

  for (const config of configs) {
    const migrated = migrateToLatestVersion(config.config);

    await prisma.config.update({
      where: { id: config.id },
      data: {
        config: migrated,
        schemaVersion: TARGET_VERSION,
      },
    });
  }

  console.log(`Migrated ${configs.length} configs to v${TARGET_VERSION}`);
}

backfillConfigs();
```

Run locally or on Railway via SSH:

```bash
npx ts-node scripts/backfill-config-vN.ts
```

---

## Migration Testing

### Unit Test for a Migration Function

```typescript
// __tests__/lib/configMigrations.test.ts
// Replace migrateVnToVm with the actual function name when a real migration is added
import { migrateVnToVm } from '@/lib/configMigrations';

describe('Config migrations', () => {
  it('migrates vN to vM and adds the new field with default', () => {
    const vnConfig = { schemaVersion: /* n */, profile: { name: 'Test' } };

    const vmConfig = migrateVnToVm(vnConfig);

    expect(vmConfig.schemaVersion).toBe(/* m */);
    expect(vmConfig.profile.riskProfile).toBe('balanced'); // Default
    expect(vmConfig.profile.name).toBe('Test'); // Unchanged
  });

  it('preserves an existing value when already present', () => {
    const vnConfig = {
      schemaVersion: /* n */,
      profile: { name: 'Test', riskProfile: 'growth' },
    };

    const vmConfig = migrateVnToVm(vnConfig);

    expect(vmConfig.profile.riskProfile).toBe('growth');
  });
});
```

### Integration Test (Prisma + Migration)

```typescript
// __tests__/integration/config-migration.test.ts
import { prisma } from '@/lib/db';
import { migrateToLatestVersion } from '@/lib/configMigrations';

describe('Config migration in database', () => {
  it('loads a vN config and auto-migrates on read', async () => {
    const user = await prisma.user.create({
      data: { clerkId: 'test_vn_user', email: 'test@example.com' },
    });

    const vnConfig = { schemaVersion: /* n */, profile: { name: 'Test' } };

    await prisma.config.create({
      data: {
        userId: user.id,
        schemaVersion: /* n */,
        config: vnConfig,
      },
    });

    const config = await prisma.config.findFirst({
      where: { userId: user.id },
    });

    const migrated = migrateToLatestVersion(config.config);

    expect(migrated.schemaVersion).toBe(/* m — latest version */); // Latest version
    expect(migrated.profile.riskProfile).toBeDefined();
  });
});
```

---

## Rollback Strategy for JSONB

### Snapshot Before Migration

Before running a batch migration, snapshot the CONFIG blob:

```typescript
// Add a config_snapshot table for safety
model ConfigSnapshot {
  id        String   @id @default(uuid()) @db.Uuid
  configId  String   @map("config_id") @db.Uuid
  config    Json     // Blob of the config before migration
  reason    String?  // e.g., "v1_to_v2_migration"
  createdAt DateTime @default(now()) @map("created_at")

  @@map("config_snapshots")
}
```

Before backfilling:

```typescript
async function backfillWithSnapshot(targetVersion: number, reason: string) {
  const configs = await prisma.config.findMany({
    where: { schemaVersion: { lt: targetVersion } },
  });

  for (const config of configs) {
    // Create snapshot of original
    await prisma.configSnapshot.create({
      data: {
        configId: config.id,
        config: config.config,
        reason,
      },
    });

    // Migrate
    const migrated = migrateToLatestVersion(config.config);
    await prisma.config.update({
      where: { id: config.id },
      data: { config: migrated, schemaVersion: targetVersion },
    });
  }
}
```

### Rollback Procedure

If a migration goes wrong, restore from snapshots:

```typescript
async function rollbackMigration(reason: string, rollbackToVersion: number) {
  const snapshots = await prisma.configSnapshot.findMany({
    where: { reason },
  });

  for (const snapshot of snapshots) {
    await prisma.config.update({
      where: { id: snapshot.configId },
      data: {
        config: snapshot.config,
        schemaVersion: rollbackToVersion,
      },
    });
  }

  await prisma.configSnapshot.deleteMany({ where: { reason } });

  console.log(`Rolled back ${snapshots.length} configs to v${rollbackToVersion}`);
}
```

---

## Production Deployment Checklist

Before running ANY migration (DDL or JSONB) on production:

### Pre-Migration (1 hour before)

- [ ] Notify team in Slack (#releases)
- [ ] Take a full database backup (Railway → Backups → Create Backup)
- [ ] Run the migration on staging first and verify app still works
- [ ] Prepare rollback script and test it locally
- [ ] Clear browser cache (Cloudflare → Caching → Purge Cache)

### Destructive Migration Only: Maintenance Mode

If dropping a column or making other destructive changes:

- [ ] Deploy updated app code (that no longer references the old column) to production
- [ ] Wait 5 minutes for all instances to roll out
- [ ] Verify in Railway that all instances are healthy
- [ ] THEN run the migration

### Running the Migration

```bash
# SSH into Railway instance (or use Railway CLI)
railway run npx prisma migrate deploy

# Verify success
railway run npx prisma migrate status
```

Expected output:
```
Migrations to apply:
  20260410_add_user_preferences

# After running:
Migrations are up to date.
```

### Post-Migration

- [ ] Monitor error logs (Sentry) for 15 minutes
- [ ] Check database query performance (slow queries in Railway dashboard)
- [ ] Run smoke test: sign-up new user → save config → verify it persists
- [ ] Announce completion in Slack

---

## Downtime Budget

For v1 (single-user, low-volume app):

| Operation | Max Downtime | Rationale |
|-----------|--------------|-----------|
| Add column | 0 seconds | Non-locking in Postgres |
| Add index | 0 seconds | CONCURRENTLY flag prevents lock |
| Drop column | 5 minutes | Requires maintenance mode + app redeploy |
| JSONB backfill | 10 seconds per 1000 rows | Async batch update |

---

## Prisma Migration Files Structure

```
prisma/migrations/
├── 20260410_add_user_preferences/
│   └── migration.sql
├── 20260411_add_config_snapshot_table/
│   └── migration.sql
└── _migration_lock.toml
```

Every migration is a timestamped folder with `migration.sql` inside. Prisma tracks applied migrations in a `_prisma_migrations` system table.

---

## Summary Checklist

- [ ] Review migration checklist before running on production
- [ ] Understand the difference between Prisma migrations (DDL) and CONFIG migrations (versioning)
- [ ] Write unit tests for all CONFIG migration functions
- [ ] Use snapshots for destructive migrations
- [ ] Apply CONFIG migrations at read-time (no batch writes needed initially)
- [ ] For non-locking migrations (ADD COLUMN), deploy directly
- [ ] For destructive migrations (DROP COLUMN), use maintenance mode + app redeploy first
- [ ] Take database backup before production migrations
- [ ] Test on staging environment first
- [ ] Monitor logs and errors for 15 minutes post-migration
- [ ] Document the migration rationale in the commit message
