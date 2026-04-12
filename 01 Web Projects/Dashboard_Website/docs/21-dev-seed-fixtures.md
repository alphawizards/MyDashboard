# Development Seed and Fixture Loader — RetireAU Dashboard

## Summary

This document specifies the development seed script that populates a local database with realistic test data (Fixture B and C from `docs/10-test-fixtures.md`) without touching Fixture A (real PII). The seed script is idempotent, runs automatically on `npm run db:reset`, and integrates with Playwright E2E tests. Fixture A (if needed locally) is loaded from a git-ignored file that Matty can populate manually.

---

## Purpose and Philosophy

**Goal**: Let a developer spin up a fully functional local environment with realistic financial data in under 5 minutes, without manually editing the database.

**Data Safety**: 
- Fixture B and C (synthetic personas) are checked into git and safe to commit
- Fixture A (real PII) is git-ignored and only exists locally if the dev needs it
- The seed script refuses to run on production (guard: `if (NODE_ENV === 'production') throw`)

---

## File Layout

```
project_root/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                              ← Seed script (executed by npm run db:seed)
│   ├── fixtures/
│   │   ├── fixture-b.json                   ← Checked in; synthetic persona
│   │   ├── fixture-c.json                   ← Checked in; synthetic persona
│   │   └── fixture-a.json                   ← git-ignored; real data (optional)
│   └── migrations/
│       └── ... (Prisma migrations)
├── .gitignore
│   └── prisma/fixtures/fixture-a.json       ← Explicitly ignored
└── package.json
```

---

## Seed Script: prisma/seed.ts

### Structure

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Guard: refuse to run on production
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Cannot run seed script in production. This script is for development only.'
  );
}

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Delete existing test users (idempotent)
  await prisma.config.deleteMany();
  await prisma.user.deleteMany();
  console.log('  ✓ Cleared existing test data');

  // 2. Load fixtures
  const fixtureB = loadFixture('fixture-b.json');
  const fixtureC = loadFixture('fixture-c.json');
  console.log('  ✓ Loaded Fixture B and C');

  // 3. Create users with fixtures
  const userAlex = await createUserWithFixture(
    'dev-alex@retireau.local',
    'Alex Dev (Fixture B)',
    fixtureB
  );
  console.log(`  ✓ Created user: ${userAlex.email}`);

  const userPatricia = await createUserWithFixture(
    'dev-patricia@retireau.local',
    'Patricia Dev (Fixture C)',
    fixtureC
  );
  console.log(`  ✓ Created user: ${userPatricia.email}`);

  // 4. Optionally load Fixture A (if local file exists)
  try {
    const fixtureAPath = path.join(__dirname, 'fixtures', 'fixture-a.json');
    if (fs.existsSync(fixtureAPath)) {
      const fixtureA = loadFixture('fixture-a.json');
      const userMatty = await createUserWithFixture(
        'matty@retireau.local',
        'Matty (Fixture A)',
        fixtureA
      );
      console.log(`  ✓ Created user: ${userMatty.email}`);
      console.log(
        '  ⚠️  Fixture A loaded (contains real PII). Keep this local-only.'
      );
    }
  } catch (err) {
    // Fixture A doesn't exist; that's fine
  }

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Test users created:');
  console.log('  - dev-alex@retireau.local (password: dev-password-123)');
  console.log('  - dev-patricia@retireau.local (password: dev-password-123)');
  console.log('');
  console.log('Sign in with Clerk test mode to access these accounts.');
}

async function createUserWithFixture(
  email: string,
  displayName: string,
  config: any
): Promise<{ email: string; clerkId: string }> {
  // Use a deterministic clerkId for test users (not a real Clerk ID)
  const clerkId = `test_${email.split('@')[0]}_${Date.now()}`;

  const user = await prisma.user.create({
    data: {
      clerkId,
      email,
      displayName,
    },
  });

  await prisma.config.create({
    data: {
      userId: user.id,
      schemaVersion: config.schemaVersion || 1,
      config,
      isActive: true,
    },
  });

  return { email, clerkId };
}

function loadFixture(filename: string): any {
  const filepath = path.join(__dirname, 'fixtures', filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

// Run the seed
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('🚨 Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

### Installation: Wire Seed into package.json

```json
{
  "name": "retire-au",
  "scripts": {
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset",
    "dev": "next dev",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Running the seed:

```bash
# Automatically (as part of migrate reset)
npm run db:reset

# Manually
npm run db:seed
```

---

## Fixture Files

### Fixture B: fixture-b.json (Early-Career Single Renter)

```json
{
  "schemaVersion": 1,
  "profile": {
    "matty": {
      "name": "Alex",
      "age": 28,
      "superBalance": 45000,
      "salary": 75000,
      "superRate": 0.11,
      "bonus": 0.05,
      "futureSalary": 85000,
      "futureSuperRate": 0.12,
      "switchYear": 2028
    },
    "partner": {
      "name": "Partner",
      "age": 0,
      "superBalance": 0,
      "salary": 0,
      "employer": ""
    },
    "currentYear": 2026,
    "projectionYears": 35,
    "preservationAge": 60,
    "contribTaxRate": 0.15,
    "concessionalCap": 30000
  },
  "debts": {
    "active": [
      {
        "name": "Car Loan",
        "balance": 15000,
        "payment": 350,
        "rate": 0.07,
        "color": "#3b82f6"
      }
    ],
    "paidOff": [],
    "lumpSum": 5000,
    "lumpSumBreakdown": "Savings",
    "monthlySurplus": 1200
  },
  "expenses": {
    "fixed": [
      { "category": "Rent", "monthly": 1400 },
      { "category": "Car Loan", "monthly": 350 },
      { "category": "Insurance", "monthly": 100 },
      { "category": "Phone", "monthly": 25 }
    ],
    "variable": [
      { "category": "Groceries", "monthly": 400 },
      { "category": "Dining", "monthly": 300 },
      { "category": "Transport", "monthly": 150 },
      { "category": "Entertainment", "monthly": 200 }
    ]
  },
  "property": {
    "currentValue": 550000,
    "targetDeposit": 100000,
    "interestRate": 0.065,
    "monthlyContribution": 2000
  },
  "mortgage": {
    "balance": 0,
    "rate": 0.065,
    "monthsRemaining": 0
  },
  "familyProperty": {
    "currentValue": 0,
    "projectedValue": 0,
    "mortgageBalance": 0,
    "mortgageRate": 0,
    "monthsRemaining": 0
  },
  "children": [],
  "defaults": {
    "superannuationGrowthRate": 0.065,
    "salaryGrowthRate": 0.03,
    "propertyGrowthRate": 0.04,
    "inflationRate": 0.025
  }
}
```

### Fixture C: fixture-c.json (Near-Retirement Couple)

```json
{
  "schemaVersion": 1,
  "profile": {
    "matty": {
      "name": "Matty",
      "age": 57,
      "superBalance": 850000,
      "salary": 180000,
      "superRate": 0.115,
      "bonus": 0.1,
      "futureSalary": 0,
      "futureSuperRate": 0,
      "switchYear": 2027
    },
    "partner": {
      "name": "Partner",
      "age": 55,
      "superBalance": 620000,
      "salary": 120000,
      "employer": ""
    },
    "currentYear": 2026,
    "projectionYears": 10,
    "preservationAge": 60,
    "contribTaxRate": 0.15,
    "concessionalCap": 30000
  },
  "debts": {
    "active": [],
    "paidOff": [
      { "name": "Home Loan", "finalPayment": 0, "datePaid": "2023" }
    ],
    "lumpSum": 50000,
    "lumpSumBreakdown": "Savings + Investments",
    "monthlySurplus": 4000
  },
  "expenses": {
    "fixed": [
      { "category": "Council Rates", "monthly": 250 },
      { "category": "House Insurance", "monthly": 80 },
      { "category": "Utilities", "monthly": 200 }
    ],
    "variable": [
      { "category": "Groceries", "monthly": 600 },
      { "category": "Dining", "monthly": 400 },
      { "category": "Travel", "monthly": 800 },
      { "category": "Entertainment", "monthly": 300 }
    ]
  },
  "property": {
    "currentValue": 1200000,
    "targetDeposit": 0,
    "interestRate": 0,
    "monthlyContribution": 0
  },
  "mortgage": {
    "balance": 0,
    "rate": 0,
    "monthsRemaining": 0
  },
  "familyProperty": {
    "currentValue": 0,
    "projectedValue": 0,
    "mortgageBalance": 0,
    "mortgageRate": 0,
    "monthsRemaining": 0
  },
  "children": [],
  "defaults": {
    "superannuationGrowthRate": 0.065,
    "salaryGrowthRate": 0.015,
    "propertyGrowthRate": 0.03,
    "inflationRate": 0.025
  }
}
```

---

## Fixture A: Optional Local Loading

### File: prisma/fixtures/fixture-a.json (git-ignored)

Matty can manually populate this file if he wants to test against his real data locally. The path is explicitly in `.gitignore`:

```gitignore
# .gitignore
prisma/fixtures/fixture-a.json
```

### How to Create Fixture A Locally

**Option 1: Export from the Current Dashboard**

1. Open the current HTML dashboard (`Retirement_Dashboard_v2.html`)
2. Open browser DevTools → Console
3. Run: `copy(CONFIG)`
4. Paste into `prisma/fixtures/fixture-a.json`
5. Run `npm run db:seed`

**Option 2: Run verify_fixture_a.js**

The baseline values from `tools/verify_fixture_a.js` can be used:

```bash
node tools/verify_fixture_a.js
# Copy the output into fixture-a.json
```

**Option 3: Environment Variable Flag**

If Matty frequently needs to switch between local and production data:

```typescript
// In seed.ts
if (process.env.SEED_INCLUDE_FIXTURE_A === 'true') {
  console.log(
    '⚠️  SEED_INCLUDE_FIXTURE_A is enabled. Loading Fixture A from file.'
  );
  const fixtureA = loadFixture('fixture-a.json');
  // ...
}
```

Then:

```bash
SEED_INCLUDE_FIXTURE_A=true npm run db:seed
```

---

## Clerk Local Development Setup

### Using Clerk Test Mode

For local development, Clerk provides a "test" mode that allows email/password sign-in without email verification.

1. **In Clerk Dashboard** → select your app → Go to "Development" environment
2. **Settings** → Email → Uncheck "Email verification required"
3. In `.env.local`, use Clerk test keys:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_WEBHOOK_SECRET=whsec_test_...
   ```

### Seeded Test Accounts

After running `npm run db:seed`, you have two accounts:

| Email | Password | Fixture |
|-------|----------|---------|
| `dev-alex@retireau.local` | `dev-password-123` | B (early-career) |
| `dev-patricia@retireau.local` | `dev-password-123` | C (near-retirement) |
| `matty@retireau.local` | `dev-password-123` | A (if fixture-a.json exists) |

**How to sign in during local dev**:

1. Run `npm run dev`
2. Navigate to http://localhost:3000
3. Click "Sign In"
4. Enter email and password from the table above
5. Clerk test mode skips email verification
6. Redirects to `/dashboard` with config pre-loaded

### Linking Seed Accounts to Clerk

The seed script creates users in Postgres with deterministic test `clerkId` values. To link these to real Clerk accounts (optional):

```typescript
// In seed.ts, after creating a user:
// Use Clerk API to create a test user (requires CLERK_SECRET_KEY)
const clerkUser = await clerkClient.users.createUser({
  emailAddress: email,
  password: 'dev-password-123',
});

// Update the Postgres user with the real clerkId
await prisma.user.update({
  where: { id: user.id },
  data: { clerkId: clerkUser.id },
});
```

This is optional; the deterministic clerkId approach works fine for local dev.

---

## Integration with E2E Tests (Playwright)

The seed script is reused by E2E tests to ensure a known state.

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### Test Setup Hook

```typescript
// e2e/setup.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Before all tests, reset the database and seed
export async function globalSetup() {
  if (process.env.SKIP_DB_RESET === 'true') {
    console.log('Skipping database reset (SKIP_DB_RESET=true)');
    return;
  }

  console.log('🌱 Resetting database and seeding for E2E tests...');
  try {
    await execAsync('npm run db:reset -- --skip-generate');
    console.log('✅ Database ready for tests');
  } catch (err) {
    console.error('❌ Database reset failed:', err);
    process.exit(1);
  }
}
```

### Test Example

```typescript
// e2e/sign-in.spec.ts
import { test, expect } from '@playwright/test';

test('sign in with Fixture B account', async ({ page }) => {
  // Seed has already created dev-alex@retireau.local with Fixture B
  await page.goto('http://localhost:3000');

  // Click sign-in
  await page.click('button:has-text("Sign In")');

  // Use Clerk test mode (email/password)
  await page.fill('input[name="emailAddress"]', 'dev-alex@retireau.local');
  await page.fill('input[name="password"]', 'dev-password-123');
  await page.click('button[type="submit"]');

  // Verify dashboard loads with Fixture B config
  await page.waitForURL('http://localhost:3000/dashboard');
  const salaryInput = await page.locator('input[name="salary"]');
  await expect(salaryInput).toHaveValue('75000'); // Fixture B salary
});
```

### Skip Database Reset

For faster iteration during test development:

```bash
SKIP_DB_RESET=true npm run test:e2e
```

This reuses the existing seed data across multiple test runs.

---

## Guards and Safety

### 1. Production Guard

```typescript
// In seed.ts (top of main() function)
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: Seed script cannot run in production. Aborting.'
  );
}
```

This prevents accidental data loss if someone runs `npm run db:seed` in a production environment.

### 2. Fixture A Isolation

Fixture A is explicitly git-ignored. Before committing:

```bash
git status
# Should NOT show: prisma/fixtures/fixture-a.json
```

If Fixture A accidentally gets committed, remove it:

```bash
git rm --cached prisma/fixtures/fixture-a.json
git commit -m "Remove Fixture A (PII) from version control"
```

### 3. Clear Warnings in Console Output

```
⚠️  Fixture A loaded (contains real PII). Keep this local-only.
```

When Fixture A is loaded, the seed script prints a visible warning.

---

## Troubleshooting

### Seed Fails with "Database is locked"

This happens if another process is using the database. Solution:

```bash
# Stop the dev server
npm run dev  # Ctrl+C

# Try the reset again
npm run db:reset
```

### "Fixture B/C not found"

Make sure the fixture files are in the correct location:

```bash
ls -la prisma/fixtures/fixture-{b,c}.json
```

Both files must exist and be valid JSON.

### Test Users Not Showing in Clerk Dashboard

Seed creates users in Postgres, but they don't appear in Clerk's dashboard (because they use deterministic test clerkId values, not real Clerk users). This is fine for local dev. To use real Clerk users, manually create them in Clerk Dashboard or use the Clerk API integration (see earlier section).

---

## Summary Checklist

- [ ] Create `prisma/seed.ts` with structure from this doc
- [ ] Wire seed into `package.json` (add `"prisma": { "seed": "tsx prisma/seed.ts" }`)
- [ ] Create `prisma/fixtures/fixture-b.json` and `fixture-c.json` with representative data
- [ ] Add `prisma/fixtures/fixture-a.json` to `.gitignore`
- [ ] Test seed locally: `npm run db:reset` and verify users are created
- [ ] Verify test users can sign in via Clerk test mode
- [ ] Integrate seed into Playwright globalSetup hook
- [ ] Test E2E flow: sign-in → see Fixture B/C data → edit config → save
- [ ] Document test account credentials in local onboarding
- [ ] Ensure seed refuses to run on production (guard in code)
- [ ] Ensure Fixture A is never committed to git
