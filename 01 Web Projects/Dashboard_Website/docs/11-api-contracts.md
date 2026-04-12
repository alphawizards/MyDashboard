# API Contracts — RetireAU Dashboard

## Summary

This document specifies the complete REST API contract for the RetireAU Dashboard Next.js backend. The API is minimal, with six core endpoints: three for config management (GET, POST, PUT), one for config duplication, one for sync conflict resolution, and one health check. All endpoints (except health) require Clerk authentication. Request and response bodies are validated against Zod schemas. Rate limiting is applied per user. The API enforces last-write-wins semantics with version checking for conflict resolution.

> **Error codes — source of truth:** every error code referenced in this document (`AUTH_*`, `CONFIG_*`, `SYNC_*`, `RATE_LIMITED`, etc.) is defined in `docs/25-error-taxonomy.md`. Do not invent new codes in this doc or in endpoint implementations. Follow the change-management protocol in doc 25 when adding or renaming codes.

---

## Table of Contents

1. [Authentication & Middleware](#authentication--middleware)
2. [Error Envelope Format](#error-envelope-format)
3. [Rate Limiting](#rate-limiting)
4. [Zod Validation Schemas](#zod-validation-schemas)
5. [Endpoints](#endpoints)
   - [Config CRUD](#config-crud)
   - [Config Management](#config-management)
   - [Sync & Conflict Resolution](#sync--conflict-resolution)
   - [System](#system)
6. [Idempotency & Retries](#idempotency--retries)
7. [CORS & CSRF](#cors--csrf)

---

## Authentication & Middleware

### Clerk Authentication Flow

All private API endpoints require a valid Clerk JWT token in the `Authorization` header. The token is supplied by the Clerk SDK in the browser automatically for same-origin requests.

**How userId is extracted**:
- Clerk's `auth()` server function (or middleware) extracts `userId` from the JWT token
- Verified at the request middleware level before route handlers execute
- No session cookies; stateless JWT verification only

```typescript
// app/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/features',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();  // Throws 401 if not authenticated
  }
});
```

### Route-Level Auth Check

```typescript
// app/api/config/route.ts (example)
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Clerk authentication required');
  }
  // ... proceed
}
```

---

## Error Envelope Format

All error responses follow a standard envelope structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body validation failed",
    "details": {
      "fieldName": ["error message"],
      "anotherField": ["another error"]
    }
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid Clerk token |
| `FORBIDDEN` | 403 | User attempting to access another user's resource |
| `NOT_FOUND` | 404 | Config or user not found |
| `VALIDATION_FAILED` | 422 | Request body or query params fail Zod validation |
| `CONFLICT` | 409 | Config version mismatch (local ≠ cloud during sync) |
| `RATE_LIMITED` | 429 | Too many requests from this user or IP |
| `INTERNAL_ERROR` | 500 | Server error (database, uncaught exception) |

---

## Rate Limiting

### Per-User Rate Limits

All authenticated endpoints are rate-limited per `userId`:

- **Config read/write**: 30 requests per 5 minutes per user
- **Sync endpoint**: 10 requests per 5 minutes per user
- **Webhook endpoint**: No limit (idempotent)

Rate limit headers included in all responses:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1712750460
```

### Rate Limit Response

When limit is exceeded:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded (30 requests per 5 minutes)",
    "details": {
      "resetAt": "2026-04-10T12:34:20Z"
    }
  }
}
```

Status code: **429 Too Many Requests**

**Fallback when `UPSTASH_REDIS_REST_URL` is unset:**
- Rate-limit middleware is a no-op; requests are not throttled.
- `X-RateLimit-*` response headers are omitted (not set to 0).
- Server logs emit a single startup warning: `"Rate limiting disabled (no Upstash URL)"`.
- In-memory per-replica fallback is NOT used — it is misleading and non-global.

---

## Zod Validation Schemas

All request bodies and query parameters are validated against these schemas before route logic executes. Validation errors return 422 with field-level details.

### DashboardConfig Schema

```typescript
import { z } from 'zod';

const ProfileSchema = z.object({
  user1: z.object({
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).max(150),
    superBalance: z.number().nonnegative(),
    salary: z.number().nonnegative(),
    superRate: z.number().min(0).max(1),
    bonus: z.number().min(0).max(1),
    futureSalary: z.number().nonnegative().optional(),
    futureSuperRate: z.number().min(0).max(1).optional(),
    switchYear: z.number().int().nonnegative().optional(),
  }),
  user2: z.object({
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).max(150),
    superBalance: z.number().nonnegative(),
    salary: z.number().nonnegative(),
    employer: z.string().max(100).optional(),
  }),
  currentYear: z.number().int().min(2000).max(2100),
  projectionYears: z.number().int().min(1).max(70).default(35),
  preservationAge: z.number().int().min(50).max(75).default(60),
  contribTaxRate: z.number().min(0).max(1).default(0.15),
});

const DebtSchema = z.object({
  name: z.string().min(1).max(100),
  balance: z.number().nonnegative(),
  payment: z.number().nonnegative(),
  rate: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

const DebtsSchema = z.object({
  active: z.array(DebtSchema).default([]),
  paidOff: z.array(z.object({
    name: z.string(),
    finalPayment: z.number(),
    datePaid: z.string(),
  })).default([]),
  lumpSum: z.number().nonnegative().default(0),
  lumpSumBreakdown: z.string().default(''),
  monthlySurplus: z.number().nonnegative().default(0),
});

const ExpensesSchema = z.object({
  fixed: z.array(z.object({
    category: z.string(),
    monthly: z.number().nonnegative(),
  })).default([]),
  variable: z.array(z.object({
    category: z.string(),
    monthly: z.number().nonnegative(),
  })).default([]),
  budgetChart: z.object({
    categories: z.array(z.string()).default([]),
    amounts: z.array(z.number()).default([]),
    colors: z.array(z.string()).default([]),
    monthlyTrend: z.object({
      months: z.array(z.string()).default([]),
      datasets: z.array(z.object({
        label: z.string(),
        data: z.array(z.number()),
        color: z.string(),
      })).default([]),
    }).default({}),
  }).default({}),
});

const PropertySchema = z.object({
  targetPrice: z.number().nonnegative().default(800000),
  stampDuty: z.number().nonnegative().default(0),
  legals: z.number().nonnegative().default(0),
  hisaRate: z.number().min(0).max(1).default(0.04),
  appreciationRate: z.number().min(0).max(1).default(0.03),
  propertyGrowth: z.number().min(0).max(1).default(0.03),
});

const MortgageSchema = z.object({
  loanAmount: z.number().nonnegative().default(0),
  startYear: z.number().int().min(2000).max(2100).default(2026),
  rate: z.number().min(0).max(1).default(0.06),
  term: z.number().int().min(1).max(50).default(30),
  propertyValue: z.number().nonnegative().default(0),
  propertyGrowth: z.number().min(0).max(1).default(0.03),
});

const FamilyPropertySchema = z.object({
  address: z.string().default(''),
  purchasePrice: z.number().nonnegative().default(0),
  currentValue: z.number().nonnegative().default(0),
  ownershipShare: z.number().min(0).max(1).default(0),
  weeklyRent: z.number().nonnegative().default(0),
  growthRate: z.number().min(0).max(1).default(0.03),
  loans: z.object({
    mortgage: z.number().nonnegative().default(0),
    equityLoan: z.number().nonnegative().default(0),
    mortgageTerms: z.object({
      rate: z.number().min(0).max(1),
      totalTerm: z.number().int().nonnegative(),
      ioPeriod: z.number().int().nonnegative(),
      mode: z.enum(['io-then-pi', 'full-pi']),
    }).optional(),
  }).default({}),
  parents: z.object({
    parent1Age: z.number().int().min(0).max(150).default(0),
    parent2Age: z.number().int().min(0).max(150).default(0),
    lifeExpectancy1: z.number().int().min(0).max(150).default(85),
    lifeExpectancy2: z.number().int().min(0).max(150).default(85),
  }).default({}),
});

const ChildrenSchema = z.object({
  numChildren: z.number().int().nonnegative().default(0),
  childYear1: z.number().int().nonnegative().default(0),
  childYear2: z.number().int().nonnegative().default(0),
  childcareCost: z.number().nonnegative().default(0),
  schoolCost: z.number().nonnegative().default(0),
  leaveReduction: z.number().nonnegative().default(0),
});

const DefaultsSchema = z.object({
  returnRate: z.number().min(0).max(1).default(0.06),
  salaryGrowth: z.number().min(0).max(1).default(0.02),
  extraContrib: z.number().nonnegative().default(0),
  mortgageRate: z.number().min(0).max(1).default(0.06),
  retirementTarget: z.number().nonnegative().default(100000),
  drawdownRate: z.number().min(0).max(1).default(0.04),
  targetRetAge: z.number().int().min(50).max(100).default(65),
  propertyGrowth: z.number().min(0).max(1).default(0.03),
});

export const DashboardConfigSchema = z.object({
  schemaVersion: z.literal(1),
  profile: ProfileSchema,
  debts: DebtsSchema,
  expenses: ExpensesSchema,
  property: PropertySchema,
  mortgage: MortgageSchema,
  familyProperty: FamilyPropertySchema,
  children: ChildrenSchema,
  defaults: DefaultsSchema,
});

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
```

### Request Body Schemas

```typescript
// POST /api/config
export const SaveConfigRequestSchema = z.object({
  config: DashboardConfigSchema,
  timestamp: z.number().int().positive().optional(),
});

// POST /api/config/[id]/duplicate
export const DuplicateConfigRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timestamp: z.number().int().positive().optional(),
});

// POST /api/sync
export const SyncRequestSchema = z.object({
  localConfig: DashboardConfigSchema,
  localTimestamp: z.number().int().positive(),
  localSchemaVersion: z.literal(1),
  cloudTimestamp: z.number().int().positive().optional(),
});
```

---

## Endpoints

### Config CRUD

#### GET /api/config

**Purpose**: Load user's active config blob from cloud.

**Method**: `GET`

**Auth**: Required (Clerk JWT)

**Path Parameters**: None

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeHistory` | boolean | No | If true, return paginated list of past configs. Default: false |
| `page` | integer | No | Pagination page (1-indexed) for history. Default: 1 |
| `limit` | integer | No | Records per page. Default: 10, max: 50 |

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

**Response (Success)**:

**Status**: 200 OK

**Body**:
```json
{
  "config": {
    "schemaVersion": 1,
    "profile": { /* ... */ },
    "debts": { /* ... */ },
    "expenses": { /* ... */ },
    "property": { /* ... */ },
    "mortgage": { /* ... */ },
    "familyProperty": { /* ... */ },
    "children": { /* ... */ },
    "defaults": { /* ... */ }
  },
  "timestamp": 1712750400000,
  "schemaVersion": 1,
  "configId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Not Found)** — No config yet

**Status**: 200 OK

**Body**:
```json
{
  "config": null,
  "timestamp": null,
  "schemaVersion": null,
  "configId": null
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 422 | `VALIDATION_FAILED` | Invalid query parameters (e.g., `page` not an integer) |
| 429 | `RATE_LIMITED` | Exceeded 30 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- If config exists and `schema_version` < 1, migration runs in-memory and result is returned (no DB update)
- No writes to database

**Headers**:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1712750460
Content-Type: application/json
Cache-Control: private, no-cache
```

**Example Request**:
```bash
curl -X GET https://dashboard.example.com/api/config \
  -H "Authorization: Bearer <Clerk JWT>" \
  -H "Content-Type: application/json"
```

**Example Response**:
```json
{
  "config": {
    "schemaVersion": 1,
    "profile": {
      "user1": {
        "name": "Matty",
        "age": 35,
        "superBalance": 250000,
        "salary": 120000,
        "superRate": 0.115,
        "bonus": 0.15
      },
      "user2": {
        "name": "Partner",
        "age": 33,
        "superBalance": 180000,
        "salary": 95000
      },
      "currentYear": 2026,
      "projectionYears": 35,
      "preservationAge": 60,
      "contribTaxRate": 0.15
    },
    "debts": {
      "active": [
        {
          "name": "Car Loan",
          "balance": 15000,
          "payment": 450,
          "rate": 0.065,
          "color": "#ef4444"
        }
      ],
      "paidOff": [],
      "lumpSum": 0,
      "lumpSumBreakdown": "",
      "monthlySurplus": 2500
    },
    "expenses": {
      "fixed": [
        { "category": "Housing", "monthly": 2000 },
        { "category": "Utilities", "monthly": 300 }
      ],
      "variable": [
        { "category": "Groceries", "monthly": 800 },
        { "category": "Transport", "monthly": 400 }
      ],
      "budgetChart": {}
    },
    "property": {
      "targetPrice": 850000,
      "stampDuty": 42500,
      "legals": 2500,
      "hisaRate": 0.04,
      "appreciationRate": 0.03,
      "propertyGrowth": 0.03
    },
    "mortgage": {
      "loanAmount": 680000,
      "startYear": 2028,
      "rate": 0.055,
      "term": 30,
      "propertyValue": 850000,
      "propertyGrowth": 0.03
    },
    "familyProperty": {
      "address": "",
      "purchasePrice": 0,
      "currentValue": 0,
      "ownershipShare": 0,
      "weeklyRent": 0,
      "growthRate": 0.03,
      "loans": {}
    },
    "children": {
      "numChildren": 0,
      "childYear1": 0,
      "childYear2": 0,
      "childcareCost": 0,
      "schoolCost": 0,
      "leaveReduction": 0
    },
    "defaults": {
      "returnRate": 0.06,
      "salaryGrowth": 0.02,
      "extraContrib": 0,
      "mortgageRate": 0.06,
      "retirementTarget": 100000,
      "drawdownRate": 0.04,
      "targetRetAge": 65,
      "propertyGrowth": 0.03
    }
  },
  "timestamp": 1712750400000,
  "schemaVersion": 1,
  "configId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### POST /api/config

**Purpose**: Create or update user's config blob (upsert).

**Method**: `POST`

**Auth**: Required (Clerk JWT)

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

**Request Body**:
```json
{
  "config": { /* DashboardConfig object */ },
  "timestamp": 1712750400000
}
```

**Body Schema**: `SaveConfigRequestSchema` (see [Zod Validation Schemas](#zod-validation-schemas))

**Response (Success)**:

**Status**: 200 OK (upsert, no create vs. update distinction)

**Body**:
```json
{
  "success": true,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "savedAt": 1712750420000,
  "schemaVersion": 1
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 422 | `VALIDATION_FAILED` | Config fails Zod schema validation |
| 429 | `RATE_LIMITED` | Exceeded 30 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- **DB write**: Upsert `configs` row for userId: `{ config: JSON.stringify(config), schemaVersion: 1, updatedAt: NOW(), isActive: true }`
- **Timestamp**: `savedAt` is server-side `NOW()`, not client-provided timestamp
- **One active**: If another config exists with `is_active = true` for this user, it is NOT replaced (unique constraint ensures only one active per user)

**Idempotency**: Not idempotent by default. Multiple identical requests create duplicate rows (or cause unique constraint violation if attempted within same transaction). Use request body hash or `If-None-Match` ETag for client-side deduplication.

**Headers**:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1712750460
Content-Type: application/json
ETag: "abc123def456..."
Cache-Control: private, no-cache
```

**Example Request**:
```bash
curl -X POST https://dashboard.example.com/api/config \
  -H "Authorization: Bearer <Clerk JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "config": { /* full DashboardConfig object */ },
    "timestamp": 1712750400000
  }'
```

**Example Response**:
```json
{
  "success": true,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "savedAt": 1712750420000,
  "schemaVersion": 1
}
```

---

#### PUT /api/config/[id]

**Purpose**: Update a specific config by ID (alternative to POST for explicit update semantics).

**Method**: `PUT`

**Auth**: Required (Clerk JWT)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Config ID (from GET response `configId`) |

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

**Request Body**:
```json
{
  "config": { /* DashboardConfig object */ },
  "timestamp": 1712750400000,
  "expectedVersion": 1
}
```

**Response (Success)**:

**Status**: 200 OK

**Body**:
```json
{
  "success": true,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "savedAt": 1712750420000,
  "schemaVersion": 1
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 403 | `FORBIDDEN` | Config belongs to another user |
| 404 | `NOT_FOUND` | Config ID does not exist |
| 409 | `CONFLICT` | Config has been modified (optimistic lock check) |
| 422 | `VALIDATION_FAILED` | Config fails Zod validation or malformed UUID |
| 429 | `RATE_LIMITED` | Exceeded 30 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- **DB write**: Update `configs` row: `{ config, schemaVersion: 1, updatedAt: NOW() }` where `id = :id AND user_id = :userId`
- **Ownership check**: Verify `user_id` matches authenticated user before updating
- **No cascade**: Does not affect other configs

**Optimistic Locking**: If `expectedVersion` is provided and the stored `schemaVersion` differs, return 409 Conflict

**Example Request**:
```bash
curl -X PUT https://dashboard.example.com/api/config/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <Clerk JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "config": { /* modified DashboardConfig */ },
    "timestamp": 1712750420000,
    "expectedVersion": 1
  }'
```

---

#### DELETE /api/config/[id]

**Purpose**: Mark a config as inactive (soft delete).

**Method**: `DELETE`

**Auth**: Required (Clerk JWT)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Config ID to deactivate |

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
```

**Request Body**: Empty

**Response (Success)**:

**Status**: 204 No Content

**Body**: Empty

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 403 | `FORBIDDEN` | Config belongs to another user |
| 404 | `NOT_FOUND` | Config ID does not exist |
| 429 | `RATE_LIMITED` | Exceeded 30 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- **DB write**: Set `is_active = false` on the config row
- **No hard delete**: Config remains in database (audit trail)
- **Consequences**: GET /api/config will no longer return this config (only returns `is_active = true` configs)

**Example Request**:
```bash
curl -X DELETE https://dashboard.example.com/api/config/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <Clerk JWT>"
```

---

### Config Management

#### POST /api/config/[id]/duplicate

**Purpose**: Create a copy of an existing config (snapshot/scenario branching).

**Method**: `POST`

**Auth**: Required (Clerk JWT)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Config ID to duplicate |

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

**Request Body** (optional):
```json
{
  "name": "Scenario: Early retirement",
  "timestamp": 1712750400000
}
```

**Body Schema**: `DuplicateConfigRequestSchema` (see [Zod Validation Schemas](#zod-validation-schemas))

**Response (Success)**:

**Status**: 201 Created

**Body**:
```json
{
  "success": true,
  "newConfigId": "660f9511-f30c-52e5-b827-557766551111",
  "sourceConfigId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": 1712750430000,
  "schemaVersion": 1
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 403 | `FORBIDDEN` | Source config belongs to another user |
| 404 | `NOT_FOUND` | Source config ID does not exist |
| 422 | `VALIDATION_FAILED` | Request body validation fails |
| 429 | `RATE_LIMITED` | Exceeded 30 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- **DB write**: Insert new `configs` row with `is_active = true`, `config = (copy of source config)`, `schemaVersion = 1`, `createdAt = NOW()`
- **Ownership**: New config belongs to authenticated user
- **Not marked as active**: If source was active, the duplicate is independent; only one `is_active = true` config is returned by GET /api/config

**Example Request**:
```bash
curl -X POST https://dashboard.example.com/api/config/550e8400-e29b-41d4-a716-446655440000/duplicate \
  -H "Authorization: Bearer <Clerk JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Scenario: Early retirement at 60",
    "timestamp": 1712750400000
  }'
```

**Example Response**:
```json
{
  "success": true,
  "newConfigId": "660f9511-f30c-52e5-b827-557766551111",
  "sourceConfigId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": 1712750430000,
  "schemaVersion": 1
}
```

---

### Sync & Conflict Resolution

#### POST /api/sync

**Purpose**: Synchronise local config with cloud, resolving conflicts via last-write-wins with version checking.

**Method**: `POST`

**Auth**: Required (Clerk JWT)

**Path Parameters**: None

**Request Headers**:
```
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

**Request Body**:
```json
{
  "localConfig": { /* DashboardConfig */ },
  "localTimestamp": 1712750400000,
  "localSchemaVersion": 1,
  "cloudTimestamp": 1712750380000
}
```

**Body Schema**: `SyncRequestSchema` (see [Zod Validation Schemas](#zod-validation-schemas))

**Conflict Resolution Logic**:

1. **If no cloud config exists** (first sync):
   - Cloud = local
   - Return 200 with `action: "created"`

2. **If cloud config is newer** (`cloudTimestamp > localTimestamp`):
   - Return cloud config
   - Return 200 with `action: "remote-wins"`
   - Client merges or prompts user

3. **If local config is newer** (`localTimestamp > cloudTimestamp`):
   - Update cloud to local
   - Return 200 with `action: "local-wins"`

4. **If timestamps are equal**:
   - Return 409 Conflict
   - Include both versions in response
   - Client must re-resolve

5. **If local schema_version < cloud**:
   - Run migrations on cloud config
   - Return migrated cloud config
   - Local should sync to migrated version

**Response (Success — Local Wins)**:

**Status**: 200 OK

**Body**:
```json
{
  "action": "local-wins",
  "localConfig": { /* local config as provided */ },
  "localTimestamp": 1712750400000,
  "cloudTimestamp": 1712750380000,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1
}
```

**Response (Success — Remote Wins)**:

**Status**: 200 OK

**Body**:
```json
{
  "action": "remote-wins",
  "cloudConfig": { /* cloud config blob */ },
  "cloudTimestamp": 1712750400000,
  "localTimestamp": 1712750380000,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1
}
```

**Response (Conflict)**:

**Status**: 409 Conflict

**Body**:
```json
{
  "action": "conflict",
  "localConfig": { /* local config as provided */ },
  "cloudConfig": { /* cloud config blob */ },
  "localTimestamp": 1712750400000,
  "cloudTimestamp": 1712750400000,
  "message": "Timestamps are equal. Manual resolution required.",
  "configId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Missing or invalid Clerk token |
| 422 | `VALIDATION_FAILED` | Request body validation fails |
| 429 | `RATE_LIMITED` | Exceeded 10 requests per 5 minutes |
| 500 | `INTERNAL_ERROR` | Database error |

**Side Effects**:
- **DB write** (if local wins): Update cloud config to local, set `updatedAt = NOW()`, increment version if needed
- **No write** (if remote wins): Cloud config unchanged, client re-syncs locally
- **No write** (if conflict): Both versions returned, client decides

**Idempotency**: Idempotent for remote-wins and conflict responses (no DB modification). For local-wins, multiple identical requests overwrite the same row (last write wins).

**Example Request**:
```bash
curl -X POST https://dashboard.example.com/api/sync \
  -H "Authorization: Bearer <Clerk JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "localConfig": { /* local DashboardConfig */ },
    "localTimestamp": 1712750400000,
    "localSchemaVersion": 1,
    "cloudTimestamp": 1712750380000
  }'
```

**Example Response (Local Wins)**:
```json
{
  "action": "local-wins",
  "localConfig": { /* local config */ },
  "localTimestamp": 1712750400000,
  "cloudTimestamp": 1712750380000,
  "configId": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1
}
```

---

### System

#### GET /api/health

**Purpose**: Health check endpoint (no auth required).

**Method**: `GET`

**Auth**: Not required (public)

**Response (Success)**:

**Status**: 200 OK

**Body**:
```json
{
  "status": "ok",
  "timestamp": 1712750400000,
  "version": "1.0.0",
  "database": "connected"
}
```

**Response (Database Down)**:

**Status**: 503 Service Unavailable

**Body**:
```json
{
  "status": "error",
  "timestamp": 1712750400000,
  "version": "1.0.0",
  "database": "disconnected",
  "message": "Database connection failed"
}
```

**Side Effects**: None

**Example Request**:
```bash
curl -X GET https://dashboard.example.com/api/health
```

---

### User Account

#### DELETE /api/user

Permanently deletes the authenticated user and all their data.

**Auth:** Required (Clerk session).
**Request body:** `{ "confirmation": "DELETE" }` — guard against accidental calls.
**Response 200:** `{ "deletedAt": "<ISO8601>", "clerkUserDeleted": boolean }`
**Response 400:** `{ "error": "CONFIRMATION_MISMATCH" }`

**Side effects (in order):**
1. Delete all `configs` rows for this `userId` (cascade).
2. Delete the `users` row.
3. Call Clerk Backend API to delete the Clerk user (best-effort; if it fails, log and continue — the `user.deleted` webhook will pick up stragglers).
4. Revoke all sessions via Clerk.
5. Return response; client redirects to `/` with a toast.

**Note:** The `user.deleted` Clerk webhook (see docs/17-auth-middleware.md) is defense-in-depth for deletions that bypass this endpoint.

---

#### GET /api/export

Returns the authenticated user's full config as a downloadable JSON file.

**Auth:** Required (Clerk session).
**Response 200 (application/json):**
```json
{
  "userId": "<string>",
  "createdAt": "<ISO8601>",
  "updatedAt": "<ISO8601>",
  "schemaVersion": 1,
  "config": { /* full DashboardConfig */ }
}
```
**Response headers:** `Content-Disposition: attachment; filename="retireau-export-<userId>-<timestamp>.json"`

**Trigger:** "Export my data" button on `/settings` page (required for APP 3 data portability obligation — see docs/27-privacy.md).

---

## Idempotency & Retries

### Idempotent Endpoints

- **GET /api/config**: Fully idempotent (read-only)
- **GET /api/health**: Fully idempotent (read-only)
- **POST /api/sync** (remote-wins or conflict): Idempotent (no state change)

### Non-Idempotent Endpoints

- **POST /api/config**: Not idempotent by design (each call upserts). Use request deduplication on client:
  ```typescript
  // Client-side deduplication
  const requestHash = hashObject({ config, timestamp });
  if (lastRequestHash === requestHash) {
    return cachedResponse; // Reuse response from identical request
  }
  ```

- **PUT /api/config/[id]**: Not idempotent (each call updates). Use `expectedVersion` field for optimistic locking
- **POST /api/config/[id]/duplicate**: Not idempotent (each call creates a new config)
- **DELETE /api/config/[id]**: Idempotent (subsequent deletes of inactive config return 404 or 204 idempotently)
- **POST /api/sync** (local-wins): Not idempotent; last write wins

### Retry Strategy

For non-idempotent endpoints, implement exponential backoff:

```typescript
// Pseudo-code
async function saveConfig(config: DashboardConfig) {
  let attempt = 0;
  const maxAttempts = 3;
  const baseDelay = 1000; // 1 second

  while (attempt < maxAttempts) {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, timestamp: Date.now() }),
      });

      if (response.ok || response.status === 422) {
        return response.json(); // Success or validation error (don't retry)
      }

      if (response.status === 429) {
        // Rate limited: wait longer
        const resetTime = response.headers.get('X-RateLimit-Reset');
        await sleep(resetTime - Date.now());
        continue;
      }

      if (response.status >= 500) {
        // Server error: retry
        attempt++;
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
    } catch (error) {
      // Network error: retry
      attempt++;
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## CORS & CSRF

### CORS

The API is same-origin only (Next.js frontend and backend on same domain). No cross-origin requests expected in production. CORS headers:

```
Access-Control-Allow-Origin: https://dashboard.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 3600
```

**Configured in** `next.config.js` or middleware.

### CSRF Protection

Clerk JWT tokens serve as CSRF tokens (not vulnerable to traditional form-based CSRF). Since the API uses JSON bodies and requires Authorization header, browser CSRF attacks cannot forge valid requests.

**No CSRF cookie** needed (no session cookies used).

### X-Frame-Options

```
X-Frame-Options: SAMEORIGIN
```

Prevents clickjacking; embedded iframes from other origins cannot load the dashboard.

### Content Security Policy (CSP)

Recommended CSP headers (configure in `next.config.js`):

```
default-src 'self';
script-src 'self' https://cdn.clerk.com https://cdn.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
connect-src 'self' https://api.clerk.dev;
frame-src https://modal.clerk.com;
```

---

## Webhooks

### POST /api/webhooks/clerk

**Purpose**: Receive Clerk user sign-up events and create user row in Postgres.

**Method**: `POST`

**Auth**: Clerk webhook signature verification (not Clerk JWT)

**Request Headers**:
```
Content-Type: application/json
svix-id: <message ID>
svix-signature: <HMAC-SHA256 signature>
svix-timestamp: <timestamp>
```

**Request Body** (Clerk format):
```json
{
  "data": {
    "id": "user_2abcdef123456",
    "email_addresses": [
      {
        "email_address": "user@example.com",
        "id": "idn_2abcdef123456",
        "verification": {
          "status": "verified"
        }
      }
    ],
    "created_at": 1712750400000
  },
  "object": "event",
  "type": "user.created",
  "timestamp_ms": 1712750400000
}
```

**Response (Success)**:

**Status**: 200 OK

**Body**:
```json
{
  "success": true,
  "message": "User webhook processed"
}
```

**Verification Logic**:

```typescript
import { Webhook } from 'svix';

export async function POST(req: Request) {
  const payload = await req.json();
  const headers = {
    'svix-id': req.headers.get('svix-id'),
    'svix-signature': req.headers.get('svix-signature'),
    'svix-timestamp': req.headers.get('svix-timestamp'),
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  try {
    const evt = wh.verify(JSON.stringify(payload), headers);

    if (evt.type === 'user.created') {
      const { id: clerkId, email_addresses, created_at } = evt.data;
      const email = email_addresses[0]?.email_address;

      // Upsert user
      await prisma.user.upsert({
        where: { clerkId },
        update: { email },
        create: { clerkId, email },
      });
    }

    return Response.json({ success: true, message: 'User webhook processed' }, { status: 200 });
  } catch (err) {
    return Response.json({ error: 'Webhook verification failed' }, { status: 401 });
  }
}
```

**Response Errors**:
| Status | Code | Condition |
|--------|------|-----------|
| 401 | N/A | Webhook signature verification failed |
| 500 | N/A | Database error during upsert |

**Side Effects**:
- **DB write**: Upsert `users` row: `{ clerkId, email, createdAt: NOW() }`
- **Idempotent**: If user already exists (duplicate webhook), upsert is a no-op (matching row unchanged)
- **No config created**: User row is created, but config row is created on first sign-in (when GET /api/config is called)

**Example Request**:
```bash
curl -X POST https://dashboard.example.com/api/webhooks/clerk \
  -H "Content-Type: application/json" \
  -H "svix-id: msg_2abcdef123456" \
  -H "svix-signature: v1,..." \
  -H "svix-timestamp: 1712750400" \
  -d '{
    "data": {
      "id": "user_2abcdef123456",
      "email_addresses": [{ "email_address": "user@example.com" }],
      "created_at": 1712750400000
    },
    "type": "user.created",
    "timestamp_ms": 1712750400000
  }'
```

---

## Environment Variables

```bash
# Clerk Auth
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Next.js
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NODE_ENV=production

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=300000      # 5 minutes
RATE_LIMIT_MAX_REQUESTS=30       # per user per window
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-10 | Initial API contract specification |

