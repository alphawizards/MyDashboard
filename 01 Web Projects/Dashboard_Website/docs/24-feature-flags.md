# Feature Flags — RetireAU Dashboard

## BLUF

RetireAU v1 ships with two feature flags (`NEXT_PUBLIC_ENABLE_CLOUD_SYNC` and `NEXT_PUBLIC_ENABLE_HTML_IMPORT`) documented in `.env.example`. These gate two incomplete or risky features. This document specifies the flag taxonomy, lifecycle management, evaluation pattern, and the two v1 flags in detail. The pattern is extensible for future flags (e.g. new features in v1.1, A/B experiments post-launch).

> **Error codes — source of truth:** the `FEATURE_DISABLED` code (and any future flag-gated error codes) is defined in `docs/25-error-taxonomy.md`. Do not create per-flag error codes in this doc. Follow the change-management protocol in doc 25.

---

## Feature Flag Classification

### Release Flags

Gate features not yet ready for production but merged to `main` for integration testing.

Example: Cloud sync (Phase 5) is risky (last-write-wins, sync deadlocks). Gate with flag OFF until approved.

Lifecycle:
1. Feature developed on branch, merged to `main` with flag OFF.
2. QA testing in staging with flag ON.
3. Flag toggled ON in production after approval.
4. Once stable (2+ weeks, no incidents), flag removed and feature becomes permanent.

v1 Release Flag: `NEXT_PUBLIC_ENABLE_CLOUD_SYNC`

### Ops Flags (Kill Switches)

Turn off a feature immediately if it causes an incident.

Example: If cloud sync causes data loss, toggle `NEXT_PUBLIC_ENABLE_CLOUD_SYNC=false` in Railway env vars and redeploy. Users fall back to local-only mode instantly.

Lifecycle:
1. Feature is stable, flag normally ON.
2. Incident occurs (high error rate, data loss).
3. Flag toggled OFF; feature disabled for all users.
4. Root cause fixed.
5. Flag toggled back ON.

v1 Ops Flag: `NEXT_PUBLIC_ENABLE_CLOUD_SYNC` (dual-purpose: release + ops)

### Permission Flags (Per-User)

Enable a feature only for specific users (future).

Example: `NEXT_PUBLIC_ENABLE_BATCH_IMPORT` for power users only. Check user metadata before rendering.

v1 Status: Not needed (single-user app).

### Experiment Flags (A/B Testing)

Route traffic to variant A or B and measure outcomes (future).

Example: 50% see new "Smart Debt Payoff" algorithm, 50% see old. Measure retention.

v1 Status: Not needed (no analytics framework).

---

## Flag Storage and Evaluation

### Client-Exposed Flags

`NEXT_PUBLIC_*` environment variables baked into build at compile time.

```typescript
// lib/feature-flags.ts
export const featureFlags = {
  isCloudSyncEnabled: process.env.NEXT_PUBLIC_ENABLE_CLOUD_SYNC === 'true',
  isHtmlImportEnabled: process.env.NEXT_PUBLIC_ENABLE_HTML_IMPORT === 'true',
} as const;

// Usage in components:
if (featureFlags.isCloudSyncEnabled) {
  // Show sync button, listen for sync events, etc.
}
```

Implication: Changing a flag requires rebuild + redeployment.

### Server-Only Flags (Future)

Flags that control API behaviour can be `.env.local` (not `NEXT_PUBLIC_*`). Evaluated at request time (no rebuild needed).

v1 Status: Not implemented. All v1 flags are client-exposed.

### Hot-Toggle Flags (Future)

Flags stored in database (e.g. LaunchDarkly, Statsig) toggle without redeployment (future feature management platform).

v1 Status: Not needed.

---

## Flag Evaluation Pattern

**Rule**: Never read `process.env` directly in route handlers or components. Always use `featureFlags` module.

Bad (❌):
```typescript
if (process.env.NEXT_PUBLIC_ENABLE_CLOUD_SYNC === 'true') { // Direct env read
  // ...
}
```

Good (✅):
```typescript
import { featureFlags } from '@/lib/feature-flags';

if (!featureFlags.isCloudSyncEnabled) {
  return errorResponse(404, 'FEATURE_DISABLED', 'Cloud sync is not enabled');
}
// ...
```

Benefits: Single source of truth, easy overrides for testing, typed, centralised logging.

---

## Flag Lifecycle and Cleanup

### Creating a Flag

1. Add env var to `.env.example` with comment.
2. Add TODO with expiry date in code.
3. Create getter in `lib/feature-flags.ts`.
4. Wrap feature in `if (featureFlags.XXX)` block.

```typescript
// lib/feature-flags.ts
export const featureFlags = {
  // TODO: Deprecate by 2026-06-01. Remove once cloud sync is stable.
  isCloudSyncEnabled: process.env.NEXT_PUBLIC_ENABLE_CLOUD_SYNC === 'true',
} as const;
```

### Expiring a Flag

When expiry date arrives:

- **Option A (Remove)**: If stable and always on, remove flag and conditional code.
- **Option B (Make Permanent Off)**: If not needed, remove code entirely.
- **Option C (Extend)**: If still developing, update TODO with new expiry.

### Removing a Flag

1. Remove env var from `.env.example`.
2. Remove getter from `lib/feature-flags.ts`.
3. Remove all `if (featureFlags.XXX)` conditionals, keep or delete feature code.
4. Delete TODO comment.
5. Commit in one PR: "Cleanup: Remove [FLAG_NAME] feature flag"

Rule: Expired flags must be removed in next minor release (v1.1, not v1.0.x).

---

## v1 Feature Flags in Detail

### Flag 1: NEXT_PUBLIC_ENABLE_CLOUD_SYNC

Type: Release flag + Ops kill switch

Default:
- Development: `false` (test local-only by default)
- Staging: `true` (test cloud sync)
- Production: `true` (cloud sync is v1 feature)

What It Controls:

| Aspect | When ON | When OFF |
|--------|---------|----------|
| **UI** | Sync button visible. "Last synced" timestamp visible. Cloud status indicator visible. | Sync button hidden. "Local-only mode" shown. |
| **Store** | On login, load cloud config, merge with local (cloud wins if newer). Auto-save to cloud on debounced change (5 sec). | Load local config from localStorage only. No cloud operations. Sign-in not required. |
| **API** | GET /api/config, POST /api/config, POST /api/sync enabled. | API endpoints return 404 / FEATURE_DISABLED. |
| **Webhooks** | POST /api/webhooks/clerk processed. Sync on sign-up. | Webhooks ignored. |
| **Clerk** | Auth required for cloud features. Sign-in button visible. | Clerk SDK loaded (for future), sign-in optional. |

References: docs/18-cloud-sync-flow.md, docs/11-api-contracts.md, docs/17-auth-middleware.md

Lifecycle:
- Phase 5: Built with flag OFF.
- Phase 7: Staging has flag ON.
- Production launch: Flag ON.
- Post-launch (6 months): If stable, remove flag.

Testing Checklist (Flag ON):
- [ ] Sign-up creates user in Postgres + Clerk.
- [ ] First load merges cloud config with local.
- [ ] Editing field debounces and syncs in <1 sec.
- [ ] Logout clears localStorage + Clerk session.
- [ ] Login reloads cloud config.
- [ ] Sync conflict: edit locally, then pull updated data → conflict modal.
- [ ] Webhook: create user via Clerk invite → webhook fires → config row created.

Testing Checklist (Flag OFF):
- [ ] Sign-up not required (or Clerk disabled).
- [ ] Local-only mode persists to localStorage.
- [ ] No API calls (or rejected with 404).
- [ ] Sign-in button is no-op or redirects to "not available".

---

### Flag 2: NEXT_PUBLIC_ENABLE_HTML_IMPORT

Type: Release flag (incomplete/risky feature)

Default:
- Development: `true` (enable for testing)
- Staging: `true`
- Production: `true` (power feature for existing HTML users)

**Independence from CLOUD_SYNC (explicit decoupling rule):**

HTML import is a **client-side only** operation. It parses a pasted HTML file, extracts the embedded `CONFIG` JSON block, and writes the result directly into the Zustand store (which persists to localStorage via the rules in `docs/12-state-management.md`). It does not require authentication, does not call any API endpoint, and does not depend on `NEXT_PUBLIC_ENABLE_CLOUD_SYNC`.

The truth table for the two flags is therefore fully orthogonal — all four combinations are valid and supported:

| CLOUD_SYNC | HTML_IMPORT | Behaviour |
|---|---|---|
| ON | ON | Full cloud app. Signed-in users can import HTML → store writes to localStorage → normal debounced sync pushes to Postgres. |
| ON | OFF | Full cloud app without the HTML import affordance. Power feature hidden. |
| OFF | ON | Local-only app (no auth, no API). Unauthenticated user can still import HTML → populates localStorage → app runs purely client-side. This is the "offline-first evaluation" mode. |
| OFF | OFF | Local-only app, no import. User must enter CONFIG fields manually. |

**Implementation rule:** the HTML import flow must not call `useUser()`, `auth()`, or any Clerk hook. It must not hit any `/api/*` endpoint. It must only dispatch a Zustand action (e.g. `importConfig(parsed)`) which the store handles identically whether the user is signed in or not. The downstream persistence path (localStorage only, or localStorage + cloud sync) is controlled exclusively by `NEXT_PUBLIC_ENABLE_CLOUD_SYNC`, not by the import flag.

**Regression guard:** add a test that loads the app with `NEXT_PUBLIC_ENABLE_CLOUD_SYNC=false` and `NEXT_PUBLIC_ENABLE_HTML_IMPORT=true`, performs a full import of a fixture HTML file, and asserts that (a) the store contains the imported CONFIG, (b) localStorage was written, (c) no network request was made, (d) no Clerk sign-in was triggered.

What It Controls:

| Aspect | When ON | When OFF |
|--------|---------|----------|
| **UI** | "Import from HTML Dashboard" button visible. Paste text area visible. | "Import" button hidden/disabled. Text area not shown. |
| **Functionality** | User pastes HTML dashboard source, app extracts CONFIG JSON block, writes directly to Zustand store via `importConfig()` action. No API call, no auth. | No import capability. |
| **Flow** | 1. Paste HTML. 2. App searches for `var CONFIG = {...}`. 3. Parse JSON from block. 4. Validate against Zod schema (shared with API per `docs/13-edit-mode-forms.md`). 5. Dispatch `importConfig(parsed)` to Zustand. 6. localStorage updated. 7. If CLOUD_SYNC is ON and user is signed in, normal debounced push picks up the change. 8. User reviews and adjusts. | Import disabled. |
| **Auth** | Not required regardless of CLOUD_SYNC state. | N/A |
| **Network** | No network activity. Purely client-side parse. | N/A |

Rationale for Flag:

HTML import requires robust HTML parsing. Risks:
1. If Matty changes dashboard structure, parser breaks.
2. If user pastes malformed HTML, parser errors.
3. If parser too strict, users frustrated.

Solution: Gate with flag. If post-launch issues (many failures), disable flag and debug.

Lifecycle:
- Phase 3–4: Built with flag ON. Tested by power users during dogfooding.
- Production launch: Flag ON.
- Post-launch (2 weeks): Monitor error logs. If failure rate <1%, keep ON. If >5%, disable flag and debug.

Testing Checklist (Flag ON, CLOUD_SYNC ON):
- [ ] Paste reference/Retirement_Dashboard_v2.html (or truncated version with CONFIG block) into import text area.
- [ ] Click "Import". App extracts CONFIG and pre-fills form fields.
- [ ] DevTools console: no errors.
- [ ] Edit one field and save. Confirm imported data + edit persists.
- [ ] Test with malformed HTML (remove curly brace) → expect friendly error message.

Testing Checklist (Flag ON, CLOUD_SYNC OFF — the decoupling regression):
- [ ] App loads without requiring sign-in.
- [ ] Import button is visible.
- [ ] Paste HTML → import succeeds.
- [ ] localStorage contains imported CONFIG.
- [ ] No `/api/*` requests observed in Network tab.
- [ ] No Clerk sign-in modal triggered.

Testing Checklist (Flag OFF):
- [ ] Import button / text area not visible.
- [ ] If user somehow accesses endpoint, returns error.

---

## Decision Tree: Should This Be a Flag?

```
START
  |
  v
Is the feature complete?
   /         NO       YES
  |         |
  v         v
Is it risky in prod?      Gate is useful for:
 /       \               - A/B testing
YES       NO             - Gradual rollout
|         |             - Incident response
v         v
FLAG    (No flag
        needed)
```

Examples:

**Deposit Comparison Scenario C**: Complete, tested, low risk. Decision: No flag. Merge and ship.

**Basiq Bank Sync Integration**: Complete, unproven in production. Decision: Release flag. Enable in staging, then production.

**LLM-powered Suggestions**: Experimental, risky (may offend users, inaccurate). Decision: Release flag + ops kill switch.

**Light/Dark Mode Toggle**: Complete, safe, low-risk. Decision: No flag. Ship immediately.

---

## Flag Testing

### Unit Tests

Every flagged feature tested for **both flag states**:

```typescript
describe('Cloud Sync Feature Flag', () => {
  describe('when ENABLE_CLOUD_SYNC=true', () => {
    test('sync button renders', () => {
      const { getByText } = render(<ControlPanel />);
      expect(getByText('Sync')).toBeInTheDocument();
    });
  });

  describe('when ENABLE_CLOUD_SYNC=false', () => {
    test('sync button does not render', () => {
      const { queryByText } = render(<ControlPanel />);
      expect(queryByText('Sync')).not.toBeInTheDocument();
    });

    test('POST /api/config returns 404 FEATURE_DISABLED', async () => {
      const res = await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({ config: {...} }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('FEATURE_DISABLED');
    });
  });
});
```

### Integration Tests

Test flag in full flow:

```typescript
describe('Cloud Sync E2E (flag ON)', () => {
  test('user can sync config to cloud', async () => {
    // 1. Sign up
    // 2. Confirm sync button visible
    // 3. Edit field
    // 4. Confirm API call to /api/config made
  });
});

describe('Cloud Sync E2E (flag OFF)', () => {
  test('user cannot see sync button', async () => {
    // Sign-up → confirm sync button not visible
  });
});
```

---

## Flag Documentation in .env.example

Every flag documented in `.env.example`:

```bash
# OPTIONAL — Enable cloud config sync. When false, app runs in local-only
# mode (loads from localStorage, no Clerk auth, no DB writes). Set to false
# in dev to test offline behaviour.
# One of: true | false. Default: false (dev), true (production)
NEXT_PUBLIC_ENABLE_CLOUD_SYNC=true

# OPTIONAL — Enable import from HTML dashboard. When false, "Import from
# local HTML dashboard" feature is disabled. Set to false if HTML parser
# is buggy and causing user complaints.
# One of: true | false. Default: true
NEXT_PUBLIC_ENABLE_HTML_IMPORT=true
```

---

## Flag Removal Protocol

When flag lifetime ends:

1. **Create PR**: Title "Cleanup: Remove [FLAG_NAME] feature flag"
2. **In PR**:
   - Remove env var from `.env.example`.
   - Remove getter from `lib/feature-flags.ts`.
   - Remove all `if (featureFlags.XXX)` conditionals.
   - Keep feature code (Option A) or delete it (Option B).
   - Update tests: remove flag-specific tests, keep feature tests.
3. **Commit message**:
   ```
   Cleanup: Remove NEXT_PUBLIC_ENABLE_CLOUD_SYNC feature flag
   
   Cloud sync has been stable for 2 months with zero incidents.
   The feature is now permanent. Removed the flag and all conditional code.
   
   Tests: removed flag-specific tests, kept feature tests.
   ```
4. **Review**: Easy to review (no logic changes, just cleanup).

---

## Acceptance Criteria

- [ ] Every flag in `.env.example` has a one-line comment.
- [ ] Flag defaults documented (dev vs staging vs prod).
- [ ] Flags evaluated via `lib/feature-flags.ts`, never direct `process.env`.
- [ ] Every flagged feature has tests for both flag states (ON and OFF).
- [ ] Flag removal executed when expiry dates arrive (no stale flags >6 months old).
- [ ] Before every production deployment, all flags reviewed to confirm their status is intentional.

---

## References

- .env.example — Feature flag definitions.
- docs/13-edit-mode-forms.md — HTML import parser.
- docs/18-cloud-sync-flow.md — Cloud sync flow.
- docs/11-api-contracts.md — API endpoints depending on flags.
- DEFINITION_OF_DONE.md — Flag acceptance (Gate 10).
