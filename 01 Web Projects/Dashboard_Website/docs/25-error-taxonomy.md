# Error Taxonomy — RetireAU Dashboard

## BLUF

A consistent error taxonomy that maps internal exceptions → API error envelope (documented in `docs/11-api-contracts.md`) → user-facing copy in the UI. Every error the user sees is traceable back to a specific `error_code` in the format `AREA_REASON` (e.g., `AUTH_UNAUTHENTICATED`, `CONFIG_VALIDATION_FAILED`, `SYNC_CONFLICT`). The error envelope is `{ error: { code: string, message: string, details?: object, requestId: string } }`. This document defines every error code, when it fires, what the user sees, and which errors are retryable.

---

## Error Code Naming Convention

```
AREA_REASON
```

- **AREA**: Domain (AUTH, CONFIG, SYNC, RATE, FEATURE, DB, WEBHOOK, INTERNAL)
- **REASON**: Why, past tense (UNAUTHENTICATED, VALIDATION_FAILED, CONFLICT, etc.)
- **Case**: SCREAMING_SNAKE_CASE

Examples:
- `AUTH_UNAUTHENTICATED` — User not logged in.
- `CONFIG_VALIDATION_FAILED` — Request body validation failed.
- `SYNC_CONFLICT` — Local and cloud versions differ.
- `RATE_LIMITED` — Too many requests.
- `DB_UNAVAILABLE` — Database is down.

---

## Complete Error Code Table

| Code | HTTP | Trigger | User-Facing Copy | Details | Retryable | Reference |
|------|------|---------|------------------|---------|-----------|-----------|
| `AUTH_UNAUTHENTICATED` | 401 | No Clerk JWT; token expired or invalid. | "Please sign in again." | `{ reason: 'no_token' \| 'expired' \| 'invalid' }` | ✅ (sign in & retry) | docs/17-auth-middleware.md |
| `AUTH_FORBIDDEN` | 403 | User accessing another user's CONFIG (userId mismatch). | "You don't have permission to access this." | `{ userId: '...', attemptedUserId: '...' }` | ❌ | docs/17-auth-middleware.md |
| `AUTH_WEBHOOK_INVALID_SIGNATURE` | 401 | Clerk webhook has invalid HMAC-SHA256 signature. | (server-side only) | `{ expected: '...', received: '...' }` | ❌ | docs/17-auth-middleware.md |
| `CONFIG_NOT_FOUND` | 404 | User has no CONFIG in database (first-time or deleted). | "No saved configuration found. Let's create one." | `{ userId: '...' }` | ✅ (create default) | docs/02-database-schema.md |
| `CONFIG_VALIDATION_FAILED` | 422 | POST /api/config body fails Zod validation. | "Some fields were invalid. Please review and try again." | `{ fieldErrors: { user1Age: ['Must be 0-150'], ... } }` | ✅ (user fixes & retries) | docs/11-api-contracts.md |
| `CONFIG_SCHEMA_VERSION_MISMATCH` | 409 | Client CONFIG schemaVersion older than server expects. | "Your dashboard is out of date. Please refresh the page." | `{ clientVersion: 1, serverVersion: 2 }` | ✅ (refresh) | docs/02-database-schema.md |
| `SYNC_CONFLICT` | 409 | During cloud sync, local updated_at older than server. Conflict modal prompts user to choose. | "Your local and cloud versions differ. Which would you like to keep?" (modal) | `{ localUpdated: '...', serverUpdated: '...' }` | ❌ (requires user action) | docs/18-cloud-sync-flow.md |
| `SYNC_STALE` | 409 | Alias for `SYNC_CONFLICT` (same treatment). | (same) | (same) | ❌ | docs/18-cloud-sync-flow.md |
| `SYNC_MERGE_FAILED` | 500 | Server failed to merge local and cloud CONFIG (edge case). | "Something went wrong while syncing. Please try again later." | `{ reason: 'merge_error' }` | ✅ (with backoff) | docs/18-cloud-sync-flow.md |
| `SYNC_NETWORK_ERROR` | 0 (client-side) | Network request to /api/sync failed (offline or Cloudflare unreachable). | "Connection lost. Sync will retry when you're back online." | `{ originalError: 'NetworkError' }` | ✅ (auto-retry) | docs/18-cloud-sync-flow.md |
| `RATE_LIMITED` | 429 | Per-user or per-IP rate limit exceeded (30 req/5min config, 10 req/5min sync). | "Too many requests. Please wait a moment and try again." | `{ resetAt: '2026-04-10T12:34:20Z', secondsRemaining: 45 }` | ✅ (exponential backoff) | docs/11-api-contracts.md |
| `FEATURE_DISABLED` | 404 | API endpoint exists but feature flag is OFF. | "This feature isn't enabled yet." | `{ featureName: 'cloud_sync' }` | ❌ | docs/24-feature-flags.md |
| `FEATURE_PERMISSION_REQUIRED` | 403 | User lacks permission for feature (future: per-user beta flags, paid tiers). | "This feature is not available for your account." | `{ featureName: '...', reason: 'not_beta' }` | ❌ | docs/24-feature-flags.md |
| `DB_UNAVAILABLE` | 503 | PostgreSQL down, pool exhausted, or Railway deploying. | "Service temporarily unavailable. Please try again in a moment." | `{ reason: 'connection_pool_exhausted' \| 'db_down' }` | ✅ (with backoff) | docs/02-database-schema.md |
| `DB_CONSTRAINT_VIOLATION` | 409 | Unique constraint or foreign key violation (e.g., duplicate email). | "This record already exists or references an invalid parent." | `{ constraint: 'configs_userId_key' }` | ❌ | docs/02-database-schema.md |
| `INTERNAL_ERROR` | 500 | Uncaught exception, bug, or unhandled error path. | "Something went wrong on our end. Our team has been notified." | `{ errorId: 'err_xxx', timestamp: '...' }` | ✅ (with backoff) | docs/19-observability.md |
| `WEBHOOK_USER_NOT_FOUND` | 404 | Clerk webhook received but user not in database (race condition). | (server-side only) | `{ clerkUserId: '...', event: 'user.deleted' }` | ✅ (idempotent, safe) | docs/17-auth-middleware.md |
| `IMPORT_PARSE_ERROR` | 400 | HTML import: failed to parse CONFIG block from pasted HTML. | "Couldn't parse the configuration. Make sure you pasted the full HTML dashboard." | `{ reason: 'no_config_block' \| 'json_parse_error' }` | ✅ (user pastes again) | docs/24-feature-flags.md |
| `HEALTH_CHECK_FAILED` | 503 | /api/health endpoint: database connection test failed. | (server-side liveness check; user never sees) | `{ database: 'failed' }` | ✅ | docs/01-architecture-overview.md |

---

## Error Response Format

Matches `docs/11-api-contracts.md`:

```json
{
  "error": {
    "code": "CONFIG_VALIDATION_FAILED",
    "message": "Request body validation failed",
    "details": {
      "fieldErrors": {
        "user1Age": ["Must be between 0 and 150"],
        "salary": ["Must be non-negative"]
      }
    },
    "requestId": "req_1712750320_abc123"
  }
}
```

Fields:
- `error.code`: Machine-readable code (this doc).
- `error.message`: Human-readable summary (for logs).
- `error.details`: Error-specific data (validation fields, retry timing, etc.). Optional.
- `error.requestId`: Unique request ID for tracing (UUID or timestamp + random). Always included.

---

## Validation Error Details Shape

When Zod validation fails, `details.fieldErrors` is a flat map of field path → error message array.

Example (field-level error):

Request:
```json
{ "user1Age": 200, "mortgageRate": -0.05 }
```

Response (422):
```json
{
  "error": {
    "code": "CONFIG_VALIDATION_FAILED",
    "message": "Request body validation failed",
    "details": {
      "fieldErrors": {
        "user1Age": ["Must be between 0 and 150"],
        "mortgageRate": ["Must be non-negative"]
      }
    },
    "requestId": "req_..."
  }
}
```

Nested fields use dot notation:
```json
{
  "fieldErrors": {
    "profile.user1.age": ["Must be between 0 and 150"],
    "debts.0.rate": ["Must be between 0 and 1"]
  }
}
```

---

## Error to Sentry Tag Mapping

Every error logged to Sentry includes `error_code` tag for filtering:

```typescript
import * as Sentry from '@sentry/nextjs';

export function captureError(code: string, error: unknown, extra?: Record<string, any>) {
  Sentry.captureException(error, {
    tags: { error_code: code },
    extra,
  });
}
```

Usage in route handler:

```typescript
try {
  const config = JSON.parse(req.body);
  // ... validate & save
} catch (error) {
  captureError('CONFIG_VALIDATION_FAILED', error, { body: req.body });
  return errorResponse(422, 'CONFIG_VALIDATION_FAILED', 'Validation failed');
}
```

Sentry alerts:
- Alert if `error_code:INTERNAL_ERROR` count >5 per minute.
- Alert if `error_code:SYNC_CONFLICT` count >20 per minute (widespread sync issues).
- Alert if `error_code:DB_UNAVAILABLE` fires >1x per hour.

---

## Error Copy Guidelines

### Do's

- **Clear and non-technical**: "Some fields were invalid" not "Zod schema validation failed".
- **Actionable**: Tell user what to do. "Please wait a moment and try again" not "Rate limit exceeded".
- **Never blame user**: "Something went wrong on our end" not "You sent invalid data".
- **Honest about transient errors**: "Connection lost" so users know it's not their fault.

### Don'ts

- **Never expose stack traces** to user (log server-side).
- **Never expose API details**: "Prisma connection pool exhausted" → "Service temporarily unavailable".
- **Never use slang or jokes**: "Oops, we goofed!" is unprofessional.
- **Never suggest untested workarounds**: "Try clearing your cache" might not help.
- **Never include requestIds in user-facing copy** (put in error modal footer for debugging).

---

## Error Rendering in the UI

### Transient Errors (Toast)

Short-lived, non-blocking, auto-dismiss or quick action:

- `SYNC_NETWORK_ERROR` — "Connection lost. Sync will retry when you're back online." (auto-dismiss 5s)
- `RATE_LIMITED` — "Too many requests. Please wait a moment and try again." (auto-dismiss after reset)
- `SYNC_MERGE_FAILED` — "Something went wrong while syncing. Please try again later." (button to retry)

Implementation: Zustand store for notifications, render in toast component (top-right):

```typescript
// components/Toast.tsx
export function Toast() {
  const { notifications, removeNotification } = useNotifications();
  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <div key={n.id} className={`toast toast-${n.type}`}>
          {n.message}
          <button onClick={() => removeNotification(n.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
```

### Blocking Errors (Modal)

Requires user action; doesn't auto-dismiss:

- `SYNC_CONFLICT` — Modal with "Keep local version" / "Use cloud version" buttons.
- `CONFIG_VALIDATION_FAILED` — Modal with field errors, "Fix and retry" button.
- `AUTH_UNAUTHENTICATED` — Modal: "Your session expired. Please sign in again." → Redirect to Clerk.

Implementation: Zustand store for modal state:

```typescript
export function Modal() {
  const { modal, closeModal } = useModal();
  if (!modal) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{modal.title}</h2>
        <p>{modal.message}</p>
        {modal.buttons?.map((btn) => (
          <button key={btn.label} onClick={() => { btn.action(); closeModal(); }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Field-Level Errors (Inline)

Validation errors shown next to input field:

- `CONFIG_VALIDATION_FAILED` — Red underline + error text below field.

Implementation: Component-level state or Zustand field-error store:

```typescript
export function AgeInput({ value, onChange, error }) {
  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={error ? 'input-error' : ''}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
```

---

## Retryability Rules

### Retryable Errors (Client Can Retry)

| Code | Backoff Strategy | Max Retries |
|------|------------------|-------------|
| `AUTH_UNAUTHENTICATED` | Immediate (force sign-in, then retry) | 1 |
| `CONFIG_NOT_FOUND` | Immediate (create default, then retry) | 1 |
| `RATE_LIMITED` | Exponential: 1s → 2s → 4s → 8s | 5 |
| `DB_UNAVAILABLE` | Exponential: 2s → 4s → 8s → 16s | 3 |
| `INTERNAL_ERROR` | Exponential: 1s → 2s → 4s → 8s | 3 |
| `SYNC_NETWORK_ERROR` | Exponential: 1s → 2s → 4s → 8s (auto-retry) | ∞ |
| `SYNC_MERGE_FAILED` | Exponential: 2s → 4s → 8s | 3 |

### Non-Retryable Errors (Require User Action)

| Code | Why Not Retryable | Required Action |
|------|-------------------|-----------------|
| `AUTH_FORBIDDEN` | Authorization mismatch (programming error or attack) | Developer review. User can't retry. |
| `CONFIG_VALIDATION_FAILED` | User input invalid | User must fix field and resubmit. |
| `CONFIG_SCHEMA_VERSION_MISMATCH` | Client schema out of date | User must refresh page. |
| `SYNC_CONFLICT` | User must choose which version | User clicks "Keep local" or "Use cloud". |
| `FEATURE_DISABLED` | Feature flag intentionally OFF | Administrator must enable. User can't retry. |
| `DB_CONSTRAINT_VIOLATION` | Unique constraint violated (duplicate record) | User or developer must resolve conflict. |

---

## Error Copy Library

Centralise user-facing error copy in one file for future translation:

```typescript
// lib/error-copy.ts
export const errorCopy: Record<string, string> = {
  AUTH_UNAUTHENTICATED: 'Please sign in again.',
  AUTH_FORBIDDEN: "You don't have permission to access this.",
  CONFIG_NOT_FOUND: "No saved configuration found. Let's create one.",
  CONFIG_VALIDATION_FAILED: 'Some fields were invalid. Please review and try again.',
  CONFIG_SCHEMA_VERSION_MISMATCH: 'Your dashboard is out of date. Please refresh the page.',
  SYNC_CONFLICT: 'Your local and cloud versions differ. Which would you like to keep?',
  SYNC_NETWORK_ERROR: 'Connection lost. Sync will retry when you're back online.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  FEATURE_DISABLED: "This feature isn't enabled yet.",
  DB_UNAVAILABLE: 'Service temporarily unavailable. Please try again in a moment.',
  INTERNAL_ERROR: 'Something went wrong on our end. Our team has been notified.',
};

export function getErrorCopy(code: string): string {
  return errorCopy[code] || 'An error occurred. Please try again.';
}
```

Usage in UI:

```typescript
import { getErrorCopy } from '@/lib/error-copy';

export function ErrorToast({ code, requestId }) {
  const message = getErrorCopy(code);
  return (
    <div className="toast toast-error">
      {message}
      <small className="text-gray-500">ID: {requestId}</small>
    </div>
  );
}
```

---

## Error Code Stability Contract

Once an error code is published (in this doc or released to production), it is **immutable**. The same code always means the same thing.

If a code's meaning needs to change:

1. **Do NOT repurpose** the old code.
2. **Instead introduce** a new code (e.g., `CONFIG_VALIDATION_FAILED_V2`).
3. **Deprecate** the old code (one release cycle).
4. **Remove** after deprecation period.

Example: If `SYNC_CONFLICT` logic changes, introduce `SYNC_CONFLICT_ENHANCED`, keep `SYNC_CONFLICT` working for older clients.

---

## Testing Error Codes

Every error code must have:

1. **A test that triggers it**:
   ```typescript
   test('returns CONFIG_VALIDATION_FAILED when user1Age is out of range', async () => {
     const res = await fetch('/api/config', {
       method: 'POST',
       body: JSON.stringify({ config: { user1Age: 200 } }),
     });
     expect(res.status).toBe(422);
     const json = await res.json();
     expect(json.error.code).toBe('CONFIG_VALIDATION_FAILED');
   });
   ```

2. **User-facing copy**:
   ```typescript
   test('error copy for CONFIG_VALIDATION_FAILED is friendly', () => {
     const copy = getErrorCopy('CONFIG_VALIDATION_FAILED');
     expect(copy).not.toMatch(/Zod|schema|validation/i);
     expect(copy).toMatch(/Some fields/i);
   });
   ```

3. **Sentry filter rule** (if needs alerting):
   - Sentry → Alerts → Create Alert Rule
   - Condition: error.error_code == "SYNC_CONFLICT"
   - Actions: Slack message, PagerDuty if rate > 20/min

---

## Localization (Future)

v1 is English-only. Architecture supports future translation:

```typescript
// lib/error-copy.ts (with i18n)
import { useTranslation } from '@/lib/i18n';

export function getErrorCopy(code: string, locale: string = 'en'): string {
  const translations = {
    en: { CONFIG_VALIDATION_FAILED: 'Some fields were invalid...' },
    fr: { CONFIG_VALIDATION_FAILED: 'Certains champs n'étaient pas valides...' },
  };
  return translations[locale]?.[code] || 'An error occurred.';
}
```

Future (v2+):
- Add .yml/.json translation files per locale.
- No hardcoded strings in components; always via `getErrorCopy()`.

---

## Change-Management Protocol (Single Source of Truth Rule)

This document is the **sole source of truth** for RetireAU error codes. Other documents (11, 17, 18, 19, 22, 24) may reference codes by name and link to the relevant row in the table above, but must not redefine a code, invent a new code inline, or contradict the copy/status/retryability decisions recorded here.

**Why this matters:** error codes thread through the API layer (doc 11), the auth middleware (doc 17), the sync engine (doc 18), the observability pipeline (doc 19), the security runbook (doc 22), and the feature-flag pattern (doc 24). Uncoordinated edits across these docs cause drift where the same code means two different things in two different places — which then ships as inconsistent behaviour in production.

### Coupling matrix

| Doc | What it references | Allowed edits | Forbidden edits |
|---|---|---|---|
| `docs/11-api-contracts.md` | Error envelope shape, HTTP status mapping, Zod validation error details format | Envelope shape changes (requires update here and in every endpoint) | Introducing a new code not listed here |
| `docs/17-auth-middleware.md` | `AUTH_*` codes, webhook signature errors | Refining when a specific auth code fires | Creating new `AUTH_*` codes without updating this doc |
| `docs/18-cloud-sync-flow.md` | `SYNC_*`, `CONFIG_SCHEMA_VERSION_MISMATCH` codes | Refining sync-flow behaviour around existing codes | Inventing new sync codes inline |
| `docs/19-observability.md` | `error_code` Sentry tag, alert rules keyed on codes | Adding alert rules for existing codes | Logging codes that don't exist in the table |
| `docs/22-security-threat-model.md` | Incident response runbook entries that reference error codes (e.g. `AUTH_WEBHOOK_INVALID_SIGNATURE`) | Adding new incident scenarios | Using codes not registered here |
| `docs/24-feature-flags.md` | `FEATURE_DISABLED` code | Flag-specific behaviour | Creating per-flag error codes |

### Refactor order of operations

When a change affects error codes, follow this exact sequence. Skipping steps leaves the pack inconsistent.

1. **Propose the change in `docs/25-error-taxonomy.md` first.** Add, rename, or deprecate the row in the error code table. Record the rationale. Bump the changelog at the bottom of this doc.
2. **Update user-facing copy** in the same PR (`lib/error-copy.ts` references). Never ship a code without copy.
3. **Sweep the coupled docs in this order:** 11 → 17 → 18 → 19 → 24 → 22. Update every reference. Do not batch or skip.
4. **Grep the repo** for the old code name (if renaming) to catch any stragglers in source code, tests, comments, and commit messages.
5. **Update tests** — every code must still have a test that triggers it and asserts on the code string.
6. **Update Sentry alert rules** — rules keyed on the old code must be updated or the alerts go stale.
7. **Verify** with the pre-merge checklist below.

### Deprecation rule (stable code IDs)

Once a code ships to production, **never change its meaning**. Renames and semantic changes require a full deprecation cycle:

1. Add the new code to the table with status `active`.
2. Mark the old code `deprecated (replaced by NEW_CODE)` but leave its row intact.
3. Both codes are emitted during a transition window (at least one release).
4. After the transition window, remove the `deprecated` row in a separate PR that also bumps the changelog.
5. Never reuse a retired code name for a different meaning. Retired codes are tombstoned.

### Pre-merge checklist for any PR touching error codes

- [ ] Change originated in or is reflected in `docs/25-error-taxonomy.md`.
- [ ] Changelog section below has a dated entry describing the change.
- [ ] Every coupled doc in the matrix above has been read and updated where relevant.
- [ ] `grep -r "OLD_CODE" ` across the repo returns only intentional references.
- [ ] Tests updated for added/changed/removed codes.
- [ ] Sentry alert rules reviewed.
- [ ] User-facing copy updated in `lib/error-copy.ts`.
- [ ] PR description lists every file touched and why.

### Changelog

| Date | Code(s) | Change | Author |
|---|---|---|---|
| 2026-04-10 | (initial set) | Initial taxonomy established during handoff. | Handoff pack |

Future changes must append a row. Do not rewrite history.

---

## Acceptance Criteria for Ship

- [ ] Every error code in this table has (1) a test triggering it, (2) user-facing copy in `lib/error-copy.ts`, (3) a clear retryability decision.
- [ ] No hardcoded error messages in components; all via `getErrorCopy()`.
- [ ] Sentry tags include `error_code` on every error.
- [ ] Error rendering (toast/modal/inline) matches the specified type.
- [ ] No stack traces exposed to users in production (logged server-side only).
- [ ] All retryable errors implement exponential backoff.
- [ ] All non-retryable errors block user action or require confirmation.

---

## References

- docs/11-api-contracts.md — Error envelope format and HTTP status codes.
- docs/17-auth-middleware.md — Auth-related error codes.
- docs/18-cloud-sync-flow.md — Sync error codes and conflict resolution.
- docs/19-observability.md — Sentry integration and error tracking.
- docs/24-feature-flags.md — Feature disabled errors.
- lib/error-copy.ts — Centralized error message strings (to be created in implementation).
- DEFINITION_OF_DONE.md — Error testing acceptance (Gate 5 (API Contracts); see §Phase → Gate Traceability in docs/06-implementation-plan.md).
