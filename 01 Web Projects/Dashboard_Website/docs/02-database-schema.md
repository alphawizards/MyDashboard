# Database Schema — RetireAU Dashboard

## Overview

Two tables. The config blob does the heavy lifting — all financial data lives in a single JSONB column per user. No normalised relational model for debts, expenses, or property. This keeps the API surface tiny (save/load one blob) and matches the current single-file dashboard architecture.

## Tables

### users

Synced from Clerk webhooks. Created on first sign-up.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id      TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_clerk_id ON users(clerk_id);
```

### configs

One active config per user. The `config` JSONB column stores the full dashboard state.

```sql
CREATE TABLE configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  config          JSONB NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_configs_user_active ON configs(user_id) WHERE is_active = true;
CREATE INDEX idx_configs_user_id ON configs(user_id);
```

The partial unique index `WHERE is_active = true` ensures only one active config per user at the database level.

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(uuid()) @db.Uuid
  clerkId     String   @unique @map("clerk_id")
  email       String
  displayName String?  @map("display_name")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  configs     Config[]

  @@map("users")
}

model Config {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  schemaVersion Int      @default(1) @map("schema_version")
  config        Json
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, isActive])
  @@index([userId])
  @@map("configs")
}
```

## Config JSONB Structure (schema_version: 1)

This is the exact shape of the JSONB blob stored in `configs.config`. It mirrors the current dashboard's CONFIG object.

```typescript
interface DashboardConfig {
  schemaVersion: 1;
  
  profile: {
    user1: {
      name: string;
      age: number;
      superBalance: number;
      salary: number;
      superRate: number;       // e.g. 0.14 for 14%
      bonus: number;           // e.g. 0.15 for 15%
      futureSalary?: number;
      futureSuperRate?: number;
      switchYear?: number;
    };
    user2: {
      name: string;
      age: number;
      superBalance: number;
      salary: number;
      employer?: string;
    };
    currentYear: number;
    projectionYears: number;   // default 35
    preservationAge: number;   // default 60
    contribTaxRate: number;    // default 0.15
  };

  debts: {
    active: Array<{
      name: string;
      balance: number;
      payment: number;        // monthly
      rate: number;           // annual, e.g. 0.08
      color: string;          // hex
    }>;
    paidOff: Array<{
      name: string;
      finalPayment: number;
      datePaid: string;
    }>;
    lumpSum: number;
    lumpSumBreakdown: string;
    monthlySurplus: number;
  };

  expenses: {
    fixed: Array<{
      category: string;
      monthly: number;
    }>;
    variable: Array<{
      category: string;
      monthly: number;
    }>;
    budgetChart: {
      categories: string[];
      amounts: number[];
      colors: string[];
      monthlyTrend: {
        months: string[];
        datasets: Array<{
          label: string;
          data: number[];
          color: string;
        }>;
      };
    };
  };

  property: {
    targetPrice: number;
    stampDuty: number;
    legals: number;
    hisaRate: number;
    appreciationRate: number;
    propertyGrowth: number;
  };

  mortgage: {
    loanAmount: number;
    startYear: number;
    rate: number;
    term: number;
    propertyValue: number;
    propertyGrowth: number;
  };

  familyProperty: {
    address: string;
    purchasePrice: number;
    currentValue: number;
    ownershipShare: number;    // e.g. 0.333
    weeklyRent: number;
    growthRate: number;
    loans: {
      mortgage: number;
      equityLoan: number;
      mortgageTerms: {
        rate: number;
        totalTerm: number;
        ioPeriod: number;
        mode: 'io-then-pi' | 'full-pi';
      };
    };
    parents: {
      parent1Age: number;
      parent2Age: number;
      lifeExpectancy1: number;
      lifeExpectancy2: number;
    };
  };

  children: {
    numChildren: number;
    childYear1: number;
    childYear2: number;
    childcareCost: number;
    schoolCost: number;
    leaveReduction: number;
  };

  defaults: {
    returnRate: number;
    salaryGrowth: number;
    extraContrib: number;
    mortgageRate: number;
    retirementTarget: number;
    drawdownRate: number;
    targetRetAge: number;
    propertyGrowth: number;
  };
}
```

## Schema Migration Strategy

Every config blob has a `schemaVersion` field. When a new feature requires schema changes:

1. Bump the schema version constant in `/lib/config-migrations.ts`
2. Write a migration function: `migrateV1toV2(config: V1Config): V2Config`
3. The migration adds new fields with sensible defaults
4. On config load (both from localStorage and cloud), run migrations if version < current
5. Chain migrations: v1 → v2 → v3 (never skip versions)

```typescript
// /lib/config-migrations.ts
const CURRENT_SCHEMA_VERSION = 1;

function migrateConfig(config: any): DashboardConfig {
  let version = config.schemaVersion || 1;
  
  // Future: chain migrations
  // if (version === 1) { config = migrateV1toV2(config); version = 2; }
  // if (version === 2) { config = migrateV2toV3(config); version = 3; }
  
  config.schemaVersion = CURRENT_SCHEMA_VERSION;
  return config as DashboardConfig;
}
```

## Default Config Template

New users receive a blank Australian-focused template with:
- Profile: empty names, age 30, $0 super balances, $0 salaries
- No debts, no expenses (user fills these in)
- Property: $800,000 target (Australian median), QLD stamp duty
- Australian defaults: preservation age 60, 15% concessional tax, current SG rate
- Family property: all zeros (disabled until user fills in)
- Children: 0

This is stored in `/lib/default-config.ts` and returned when a new user signs in with no saved config.

## API Endpoints

### GET /api/config

- Auth: required (Clerk)
- Returns: user's active config blob, or null if none exists
- If config schema_version < current: migrate, save migrated version, return migrated

### POST /api/config

- Auth: required (Clerk)
- Body: `{ config: DashboardConfig }`
- Upserts: if active config exists, update it. If not, create one.
- Sets updated_at to now()

### POST /api/webhooks/clerk

- Auth: Clerk webhook signature verification
- Handles: user.created event
- Creates: users row with clerk_id, email, display_name
