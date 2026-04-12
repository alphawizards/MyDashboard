# Observability — RetireAU Dashboard

## Summary

RetireAU uses Sentry for error tracking and performance monitoring on both client and server. All unhandled errors, API latency issues, sync failures, and failed authentication attempts are captured. PII is redacted before transmission to Sentry (email addresses, financial data, personal details). Structured logging (via pino on Node.js side) is used for operational visibility. Uptime monitoring is via Cloudflare or UptimeRobot health checks.

> **Error codes — source of truth:** the `error_code` tag attached to every Sentry event and structured log line is defined in `docs/25-error-taxonomy.md`. Do not log codes that don't exist in that table. Sentry alert rules keyed on codes must be updated in lockstep when codes change — see the change-management protocol in doc 25.

---

## Sentry Setup

### Installation

```bash
npm install @sentry/nextjs @sentry/tracing
npx @sentry/wizard@latest -i nextjs
```

The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` with boilerplate configuration.

### Environment Configuration

Sentry configuration varies by environment:

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  
  // In development, disable automatic error capture and PII redaction
  // so you can debug locally without noise
  enabled: !isDev || process.env.SENTRY_FORCE_ENABLED === 'true',
  
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Prisma(),
  ],
  
  tracesSampleRate: isProd ? 0.2 : 0, // Sample 20% of transactions in production, 0% in dev
  profilesSampleRate: isProd ? 0.1 : 0, // Sample 10% of profiles (CPU) in production
  
  // Capture slow transactions
  transactionNameSampleRate: 1.0,
});
```

### No-DSN Fallback (SENTRY_DSN unset)

When `SENTRY_DSN` is not set in the environment, the following behaviour is required:

- `Sentry.init()` is **not called**.
- `Sentry.captureException`, `captureMessage`, `setTag`, `addBreadcrumb` → **no-ops**.
- `beforeSend` and `reportWebVitals` → **degrade to no-ops**.
- `pino` continues emitting structured logs to stdout unchanged.
- Startup log emits: `"Sentry disabled (no DSN)"`.

Implementation requirement: **no file may import from `@sentry/nextjs` directly**. All Sentry calls must go through `lib/sentry.ts`, which checks for the DSN and exports no-op stubs when it is absent:

```typescript
// lib/sentry.ts
import type { CaptureContext } from '@sentry/types';

const hasDsn = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

let _Sentry: typeof import('@sentry/nextjs') | null = null;
if (hasDsn) {
  _Sentry = require('@sentry/nextjs');
} else {
  if (typeof window === 'undefined') {
    // server-side startup log
    console.info('Sentry disabled (no DSN)');
  }
}

export const captureException = (err: unknown, ctx?: CaptureContext) =>
  _Sentry?.captureException(err, ctx);
export const captureMessage = (msg: string, level?: string, ctx?: CaptureContext) =>
  _Sentry?.captureMessage(msg, level as any, ctx);
export const setTag = (key: string, value: string) =>
  _Sentry?.setTag(key, value);
export const addBreadcrumb = (bc: object) =>
  _Sentry?.addBreadcrumb(bc as any);
```

All files that previously imported `* as Sentry from '@sentry/nextjs'` must be updated to import from `@/lib/sentry` instead.

### Environments

| Environment | Enabled | Sample Rate | Release Tracking | Purpose |
|-------------|---------|-------------|------------------|---------|
| `development` | false | — | No | Local debugging; no Sentry noise |
| `staging` | true | 100% | Yes (optional) | Full capture for QA and testing |
| `production` | true | 20% transactions | Yes | Sampled transactions to avoid quota overrun |

### DSN Configuration

Get your Sentry DSN from https://sentry.io → select project → Settings → Client Keys.

Add to `.env.example`:

```bash
SENTRY_DSN=https://xxxxxxxxxxx@oxxxxxx.ingest.sentry.io/XXXXXX
SENTRY_ENVIRONMENT=production
```

---

## What to Capture

### Automatic Captures

Sentry auto-captures:
- All unhandled exceptions (client and server)
- All unhandled promise rejections
- HTTP errors (5xx responses from the API)
- Fetch/XHR errors

### Explicit Captures

Manually capture errors in API route handlers:

```typescript
// app/api/config/route.ts
import * as Sentry from '@sentry/nextjs';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    const config = await prisma.config.findFirst({ ... });
    return Response.json({ config });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: '/api/config', method: 'GET' },
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to load config');
  }
}
```

### Slow API Calls

Capture API calls that exceed a threshold (500ms):

```typescript
// lib/api-client.ts
async function apiCall(method: string, path: string, body?: any) {
  const startTime = performance.now();
  
  try {
    const res = await fetch(path, { method, body: JSON.stringify(body) });
    const duration = performance.now() - startTime;
    
    if (duration > 500) {
      Sentry.captureMessage('Slow API call', 'warning', {
        tags: { route: path, method, duration_ms: Math.round(duration) },
      });
    }
    
    return res;
  } catch (err) {
    const duration = performance.now() - startTime;
    Sentry.captureException(err, {
      tags: { route: path, method, duration_ms: Math.round(duration) },
    });
    throw err;
  }
}
```

### Failed Sync Attempts

Capture every sync failure (see `docs/18-cloud-sync-flow.md`):

```typescript
async function pushConfigToCloud(config: DashboardConfig) {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify({ config, timestamp: Date.now() }),
    });

    if (!res.ok) {
      Sentry.captureMessage('Config sync failed', 'error', {
        tags: { status: res.status },
        extra: { response: await res.text() },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { event: 'sync_push' },
    });
  }
}
```

---

## PII Redaction (Critical for Australian Privacy Act)

RetireAU handles personal Australian household financial data. Redact all personally identifiable information before sending to Sentry.

### Redaction Scope

**ALWAYS redact** the following fields from the CONFIG blob:

| Section | Fields to Redact |
|---------|------------------|
| `profile.user1.*` | `name`, `salary`, `superBalance`, `futureSalary` |
| `profile.user2.*` | `name`, `salary`, `superBalance`, `employer` |
| `debts[*]` | Entire debt array (balance, payment, rate, name) |
| `expenses[*]` | Entire expenses array (category, amount) |
| `mortgage.*` | Mortgage balance, rate, term |
| `familyProperty.*` | Property value, mortgage details |
| `children[*]` | Entire children array (name, age) |
| User emails | All email addresses |

**SAFE to log** (non-PII):

| Data | Reason |
|------|--------|
| Field names (e.g., `profile`, `debts`, `expenses`) | Structure only, no values |
| Schema version | Version number |
| Timestamps | updatedAt, createdAt (no sensitive info) |
| Route names | `/api/config`, `/dashboard` |
| Error codes | `CONFLICT`, `UNAUTHORIZED`, `VALIDATION_FAILED` |

### Implementation: beforeSend Hook

```typescript
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Redact PII before sending to Sentry
  beforeSend(event, hint) {
    // Redact user context
    if (event.user) {
      event.user.email = '[REDACTED_EMAIL]';
      event.user.id = '[REDACTED_USER_ID]';
    }

    // Redact extra data (config blobs)
    if (event.extra) {
      if (event.extra.config) {
        event.extra.config = redactConfig(event.extra.config);
      }
    }

    // Redact breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((bc) => ({
        ...bc,
        data: bc.data ? redactConfig(bc.data) : undefined,
      }));
    }

    return event;
  },
});

function redactConfig(data: any): any {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(redactConfig);

  const redacted = { ...data };
  const PII_PATHS = [
    'profile.user1',
    'profile.user2',
    'debts',
    'expenses',
    'mortgage',
    'familyProperty',
    'children',
  ];

  for (const path of PII_PATHS) {
    const keys = path.split('.');
    let current = redacted;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]]) current = current[keys[i]];
      else break;
    }
    if (current[keys[keys.length - 1]]) {
      current[keys[keys.length - 1]] = '[REDACTED]';
    }
  }

  return redacted;
}
```

### Client-Side beforeSend

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  beforeSend(event, hint) {
    // Same redaction logic as server
    return redactSentryEvent(event);
  },
});
```

### Testing Redaction

Write a test to ensure PII is never sent to Sentry:

```typescript
// __tests__/lib/sentry.test.ts
import { redactConfig } from '@/lib/sentry';
import FIXTURE_A from '@/tools/verify_fixture_a.js';

describe('Sentry PII redaction', () => {
  it('redacts all financial data from CONFIG', () => {
    const redacted = redactConfig(FIXTURE_A);

    // Assert structure is preserved
    expect(redacted).toHaveProperty('profile');
    expect(redacted).toHaveProperty('debts');

    // Assert values are redacted
    expect(redacted.profile.user1).toBe('[REDACTED]');
    expect(redacted.debts).toBe('[REDACTED]');
    expect(redacted.expenses).toBe('[REDACTED]');

    // Assert non-PII is preserved
    expect(redacted.schemaVersion).toBeDefined();
  });
});
```

---

## Structured Logging (Server-Side)

Use `pino` for structured, JSON-formatted logs on the Node.js side.

### Installation

```bash
npm install pino pino-pretty
```

### Logger Configuration

```typescript
// lib/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
```

### Structured Log Format

Every log entry includes:

```typescript
{
  "timestamp": "2026-04-10T14:30:00Z",
  "level": "info",
  "message": "Config loaded",
  "userId": "[HASHED_USER_ID]",
  "route": "/api/config",
  "method": "GET",
  "duration_ms": 45,
  "status": 200,
  "error_code": null
}
```

### Usage in Route Handlers

```typescript
// app/api/config/route.ts
import logger from '@/lib/logger';

export async function GET(req: Request) {
  const startTime = performance.now();
  const { userId } = await auth();
  
  if (!userId) {
    logger.warn({
      message: 'Unauthorized config access attempt',
      route: '/api/config',
      method: 'GET',
      userId: hashUserId(userId),
      status: 401,
    });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await prisma.config.findFirst({
      where: { user: { clerkId: userId }, isActive: true },
    });

    const duration = performance.now() - startTime;
    logger.info({
      message: 'Config loaded',
      route: '/api/config',
      method: 'GET',
      userId: hashUserId(userId),
      duration_ms: Math.round(duration),
      status: 200,
    });

    return Response.json({
      config: config?.config ?? null,
      timestamp: config?.updatedAt.getTime() ?? null,
    });
  } catch (err) {
    const duration = performance.now() - startTime;
    logger.error({
      message: 'Config load failed',
      route: '/api/config',
      method: 'GET',
      userId: hashUserId(userId),
      duration_ms: Math.round(duration),
      status: 500,
      error_code: 'DATABASE_ERROR',
      error: err.message,
    });

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Hash user IDs to avoid logging PII
function hashUserId(userId: string): string {
  return require('crypto')
    .createHash('sha256')
    .update(userId)
    .digest('hex')
    .slice(0, 12);
}
```

### Log Levels

| Level | When to Use | Examples |
|-------|------------|----------|
| `debug` | Development only; verbose tracing | Every calculation step, cache hits |
| `info` | Normal operations | Route hit, config saved, webhook received |
| `warn` | Recoverable errors | Rate limit approached, retry queued, cache miss |
| `error` | Application errors | Database connection failed, validation error, 5xx |
| `fatal` | Process termination | Unrecoverable state, must restart |

### Correlation IDs

Attach a request ID to every log entry for tracing multi-step operations:

```typescript
// app/middleware.ts
import { v4 as uuidv4 } from 'uuid';

export default clerkMiddleware(async (auth, req) => {
  const requestId = uuidv4();
  
  // Attach to request context (e.g., via Cls or x-request-id header)
  req.headers.set('x-request-id', requestId);
  
  // Pass down to route handlers
  // In route handler: const requestId = req.headers.get('x-request-id')
});

// In route handler
export async function GET(req: Request) {
  const requestId = req.headers.get('x-request-id');
  
  logger.info({
    message: 'Config load started',
    requestId,
    route: '/api/config',
  });
  
  // ... do work ...
  
  logger.info({
    message: 'Config load finished',
    requestId,
    route: '/api/config',
    duration_ms: 45,
  });
}
```

---

## Metrics and Observability

### Metrics to Track

From `docs/18-cloud-sync-flow.md`, emit these metrics:

| Metric | Type | Labels | Example |
|--------|------|--------|---------|
| `sync_attempt` | Counter | `event_type` (pull/push) | `sync_attempt{event_type="push"}` |
| `sync_success` | Counter | `event_type` | `sync_success{event_type="push"}` |
| `sync_conflict` | Counter | — | `sync_conflict` |
| `sync_failure` | Counter | `error_code` (network, 409, 500) | `sync_failure{error_code="409"}` |
| `sync_queue_depth` | Gauge | — | `sync_queue_depth 2` |
| `sync_latency_ms` | Histogram | `event_type` | `sync_latency_ms_bucket{event_type="push"}` |
| `api_latency_ms` | Histogram | `route`, `method` | `api_latency_ms_bucket{route="/api/config",method="POST"}` |
| `api_errors_total` | Counter | `route`, `method`, `status` | `api_errors_total{route="/api/config",method="POST",status="500"}` |

### Sentry Performance Monitoring

Sentry automatically captures HTTP spans (latency) for every API call. To manually add spans:

```typescript
const transaction = Sentry.startTransaction({
  name: 'calculate_super_projection',
  op: 'calculation',
});

try {
  const result = projectSuper(config, 40);
  transaction.finish();
} catch (err) {
  transaction.finish();
  throw err;
}
```

---

## Uptime Monitoring

### Health Check Endpoint

Implement a simple `/api/health` endpoint for external monitoring:

```typescript
// app/api/health/route.ts
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return Response.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      },
      { status: 200 }
    );
  } catch (err) {
    return Response.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: err.message,
      },
      { status: 503 }
    );
  }
}
```

### External Uptime Monitoring

**Option 1: Cloudflare Health Checks** (included with Cloudflare account)

Configure a health check in Cloudflare dashboard:
- URL: `https://retire.example.com.au/api/health`
- Interval: 1 minute
- Timeout: 5 seconds
- Retries: 2

**Option 2: UptimeRobot** (free tier available)

1. Sign up at https://uptimerobot.com
2. Add new monitor: HTTP(S) type
3. URL: `https://retire.example.com.au/api/health`
4. Check interval: 5 minutes
5. Enable notifications (email, Slack, webhook)

---

## Alerting

### Sentry Alert Rules

Create alert rules in Sentry dashboard:

| Rule | Trigger | Action |
|------|---------|--------|
| High error rate | 5xx errors > 1% of requests (5-minute window) | Email + Slack notification |
| Slow API | p95 latency > 2 seconds | Email (lower severity) |
| Sync failures | More than 5 sync failures in 10 minutes | Slack notification to #alerts |

Example rule JSON:

```json
{
  "name": "High 5xx Error Rate",
  "condition": {
    "value": 0.01,
    "comparison": "gte",
    "metric": "error.rate",
    "interval": "5m"
  },
  "actions": [
    {
      "service": "slack",
      "channel": "#alerts",
      "message": "RetireAU: {count} errors in {interval}"
    }
  ]
}
```

### Cloudflare Alerts

If using Cloudflare health checks, enable notifications:
- Origin Down: immediate Slack/email
- Origin Degraded: email (less urgent)

---

## Log Retention

| Log Type | Retention | Notes |
|----------|-----------|-------|
| Sentry (free tier) | 30 days | Automatic deletion; adjust retention in dashboard |
| pino files (Railway) | 7 days | Rotate logs daily; older logs deleted |
| Cloudflare Analytics | 30 days | Built-in to Cloudflare dashboard |

### Log Rotation (Railway)

Railway's persistent filesystem is limited. Use log rotation to avoid filling disk:

```typescript
// lib/logger.ts
import pino from 'pino';
import pinoPino from 'pino-rotating-file';

const logger = pino(
  pinoPino.createStream({
    file: '/var/log/retire-au/app.log',
    size: '10M', // Rotate when file reaches 10MB
    interval: '1d', // Also rotate daily
    keep: 7, // Keep 7 days of logs
  })
);
```

---

## Privacy and Compliance

### Australian Privacy Act Consideration

RetireAU handles personal financial information subject to the Australian Privacy Act. When implementing observability:

1. **No cross-border data transfer for PII**: Sentry US operations may not be compliant. Consider:
   - Self-hosting Sentry (Sentry On-Premise)
   - Using Australian-based error tracking (e.g., Rollbar with Australian data centre)
   - Aggressive PII redaction (as documented above)

2. **Data retention limits**: Sentry's 30-day retention is reasonable under APPs. Ensure logs are deleted after 30 days.

3. **User notification**: The privacy policy should disclose that errors are logged to Sentry (even with redaction).

4. **Sensitive mode**: For production deployments handling user PII, consider disabling Sentry altogether and using only internal pino logging on Railway.

---

## Summary Checklist

- [ ] Set up Sentry account and obtain DSN
- [ ] Install `@sentry/nextjs` and run configuration wizard
- [ ] Implement `beforeSend` hook with PII redaction
- [ ] Test redaction with Fixture A config
- [ ] Implement `pino` logging with structured format
- [ ] Add correlation IDs to all log entries
- [ ] Implement `/api/health` endpoint
- [ ] Set up external uptime monitoring (Cloudflare or UptimeRobot)
- [ ] Configure Sentry alert rules (5xx rate, latency, sync failures)
- [ ] Review Privacy Act implications of error tracking
- [ ] Document error handling and logging in DEFINITION_OF_DONE.md
- [ ] Test Sentry integration locally with SENTRY_FORCE_ENABLED=true
- [ ] Verify PII is not leaked in Sentry in staging environment
