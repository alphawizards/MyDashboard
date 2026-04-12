# Cloud Sync Flow — RetireAU Dashboard

## Summary

RetireAU uses local-first architecture with optional cloud sync for multi-device support. The Zustand store persists to localStorage on every change; when a user is signed in, changes are debounced and pushed to the cloud asynchronously. On sign-in, the app merges the cloud config with the local config using a last-write-wins strategy with user prompts on conflict. Offline changes are queued and drained on reconnect.

> **Error codes — source of truth:** every sync-related error code (`SYNC_CONFLICT`, `SYNC_STALE`, `CONFIG_SCHEMA_VERSION_MISMATCH`, etc.) is defined in `docs/25-error-taxonomy.md`. Do not invent new `SYNC_*` codes in this doc or in sync engine implementation. Follow the change-management protocol in doc 25.

---

## Design Principles

### Local-First, Cloud-Optional

The dashboard is fully functional without sign-in (localStorage only). Signing in enables cross-device sync but is not required for usability. This trade-off prioritises immediate value (users get calculations instantly) over forced authentication.

### Feature Flag: NEXT_PUBLIC_ENABLE_CLOUD_SYNC

Set `NEXT_PUBLIC_ENABLE_CLOUD_SYNC=true` in `.env.example` to enable cloud sync for v1. If `false`, the app runs in local-only mode (no Clerk, no database writes). This is useful for privacy-sensitive deployments or offline-first scenarios.

---

## Sync Trigger Points

### 1. On Login (Pull)

When a user completes sign-in, the dashboard calls GET `/api/config` to fetch the cloud version.

```typescript
// In a useEffect hook in the Dashboard component
useEffect(() => {
  const { userId, isSignedIn } = useAuth();
  
  if (isSignedIn && userId) {
    // Pull cloud config on sign-in
    fetchCloudConfig();
  }
}, [useAuth().isSignedIn]);

async function fetchCloudConfig() {
  try {
    const res = await fetch('/api/config');
    const { config: cloudConfig, timestamp: cloudTimestamp } = await res.json();
    
    if (cloudConfig) {
      mergeConfigs(cloudConfig, cloudTimestamp);
    }
  } catch (err) {
    console.error('Failed to fetch cloud config:', err);
    // Fall back to local config, allow user to retry
  }
}
```

### 2. On Config Change (Push, Debounced)

Every time the user modifies a control input (e.g., salary slider, super balance input), the Zustand store updates immediately. A debounce timer (5 seconds) waits for the user to stop typing, then sends POST `/api/config` if the user is signed in.

```typescript
// In useConfig hook (see docs/12-state-management.md)
const debouncedSave = useCallback(
  debounce((config: DashboardConfig) => {
    if (!isSignedIn) return; // Local-only mode
    
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        timestamp: Date.now(),
      }),
    }).catch(err => {
      // Queue for retry (see Offline Queue section)
      queueForRetry(config);
    });
  }, 5000),
  [isSignedIn]
);
```

### 3. On Manual "Sync Now" Button

A button in the dashboard header triggers an immediate sync (no debounce):

```typescript
// In Dashboard header component
async function handleSyncNow() {
  setIsSyncing(true);
  try {
    const res = await fetch('/api/config');
    const { config: cloudConfig, timestamp: cloudTimestamp } = await res.json();
    
    if (cloudConfig) {
      mergeConfigs(cloudConfig, cloudTimestamp);
      showToast('Synced successfully');
    }
  } catch (err) {
    showToast('Sync failed: ' + err.message);
  } finally {
    setIsSyncing(false);
  }
}
```

---

## Conflict Resolution

### Last-Write-Wins Strategy

When the local config has been modified since the last sync, and the cloud config has also been modified, a conflict is detected by comparing `updated_at` timestamps.

**Resolution rule**:
- If `cloud.updated_at > local.updated_at`: cloud config is newer → replace local with cloud
- If `local.updated_at > cloud.updated_at`: local config is newer → keep local, skip push (or push immediately)
- If timestamps are equal: server wins (deterministic tie-breaker)

### Conflict Detection and User Prompt

```typescript
function mergeConfigs(
  cloudConfig: DashboardConfig,
  cloudTimestamp: number
) {
  const { config: localConfig, timestamp: localTimestamp } = getLocalState();
  
  if (cloudTimestamp > localTimestamp) {
    // Cloud is newer, replace local
    setConfig(cloudConfig);
    showToast('Cloud config is newer. Loaded from cloud.');
  } else if (localTimestamp > cloudTimestamp) {
    // Local is newer, show conflict modal
    showConflictModal({
      onKeepLocal: () => {
        // Push local to cloud immediately
        pushConfigToCloud(localConfig, localTimestamp);
        showToast('Kept local version. Pushed to cloud.');
      },
      onKeepCloud: () => {
        // Replace local with cloud
        setConfig(cloudConfig);
        showToast('Switched to cloud version.');
      },
      onMerge: () => {
        // Open diff view (deferred to post-v1)
        openDiffView(localConfig, cloudConfig);
      },
    });
  } else {
    // Timestamps are equal, server wins
    setConfig(cloudConfig);
  }
}
```

### User-Facing Conflict Modal

When a conflict is detected, show a modal:

```
┌────────────────────────────────────────┐
│ Configuration Conflict                 │
├────────────────────────────────────────┤
│                                        │
│ Your local changes and cloud changes   │
│ have diverged. Which version should    │
│ RetireAU use?                          │
│                                        │
│ Local:  Last edited 2 hours ago        │
│ Cloud:  Last edited 30 minutes ago     │
│                                        │
│ [ Keep Local ] [ Keep Cloud ]          │
│                                        │
└────────────────────────────────────────┘
```

---

## Version Checking and Optimistic Concurrency

### ETag / Version Token

Use `schema_version` (from `docs/02-database-schema.md`) + `updated_at` timestamp as an optimistic concurrency token.

When the client pushes a config:

```typescript
const pushPayload = {
  config: {...},
  timestamp: Date.now(),
  schemaVersion: config.schemaVersion,
  updatedAt: localTimestamp, // Client's view of cloud's last update
};
```

The server compares:
- If `client.schemaVersion !== server.schemaVersion`: schema mismatch → return 409 Conflict (client should migrate)
- If `client.updatedAt !== server.updatedAt`: concurrent edit detected → return 409 Conflict (client should pull before pushing)

**409 Conflict Response**:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Your version is out of date. Pull latest and retry.",
    "serverTimestamp": 1712750400000,
    "serverSchemaVersion": 1
  }
}
```

**Client Recovery**:

```typescript
if (response.status === 409) {
  // Pull the latest, re-merge, and prompt user
  const { config: cloudConfig, timestamp: cloudTimestamp } = await fetch('/api/config').then(r => r.json());
  mergeConfigs(cloudConfig, cloudTimestamp);
  retryPush = false; // Don't auto-retry; let user resolve manually
}
```

---

## Offline Queue

### Queueing Mechanism

If a POST `/api/config` fails (network error, 500, timeout), queue the config in localStorage under `retireau:sync_queue`:

```typescript
function queueForRetry(config: DashboardConfig, timestamp: number) {
  const queue = JSON.parse(
    localStorage.getItem('retireau:sync_queue') || '[]'
  );
  queue.push({
    config,
    timestamp,
    queuedAt: Date.now(),
    retryCount: 0,
  });
  localStorage.setItem('retireau:sync_queue', JSON.stringify(queue));
  showToast('Offline. Changes will sync when you reconnect.');
}
```

### Queue Drain on Reconnect

When the user regains connectivity (or manually clicks "Sync Now"), drain the queue in FIFO order:

```typescript
async function drainSyncQueue() {
  const queue = JSON.parse(
    localStorage.getItem('retireau:sync_queue') || '[]'
  );
  
  while (queue.length > 0) {
    const item = queue[0];
    
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({
          config: item.config,
          timestamp: item.timestamp,
        }),
      });
      
      if (res.ok) {
        queue.shift(); // Remove from queue on success
        localStorage.setItem('retireau:sync_queue', JSON.stringify(queue));
      } else if (res.status === 409) {
        // Conflict, pull and merge before retrying
        const cloudData = await fetch('/api/config').then(r => r.json());
        mergeConfigs(cloudData.config, cloudData.timestamp);
        queue.shift(); // Remove this item, let user re-edit
        localStorage.setItem('retireau:sync_queue', JSON.stringify(queue));
      } else {
        // Transient error, retry on next attempt
        item.retryCount++;
        if (item.retryCount > 4) {
          // Max retries exceeded, give up
          queue.shift();
          showToast('Sync failed after multiple retries. Manual review needed.');
        }
        break; // Exit loop, retry later
      }
    } catch (err) {
      // Network error, retry later
      break;
    }
  }
}

// Trigger drain on window online event
window.addEventListener('online', drainSyncQueue);
```

### Queue Discard on Sign-Out

When a user signs out, discard the sync queue (no point queuing if not authenticated):

```typescript
function handleSignOut() {
  localStorage.removeItem('retireau:sync_queue');
  signOut();
}
```

---

## Race Conditions and Edge Cases

### Case 1: User Signs In on Device B While Device A Has Unsaved Changes

**Scenario**: 
- Device A: User editing config locally, hasn't saved to cloud yet.
- Device B: User signs in via Clerk.

**Behavior**:
1. Device B calls GET `/api/config`, pulls cloud version (which is stale, from Device A's last sync).
2. Device B loads stale config → user continues editing from stale state.
3. Device A: User saves → POST `/api/config` pushes new version.
4. Device A and Device B are now out of sync again.

**Limitation**: This is a known limitation of the last-write-wins strategy without real-time sync. Accepted for v1 (single-device use case). Post-v1, add real-time sync via WebSocket or Server-Sent Events.

### Case 2: Two Tabs Open on the Same Device Editing Different Slices

**Scenario**:
- Tab 1: User edits `profile.user1.salary`.
- Tab 2: User edits `debts[0].balance`.

**Behavior**:
1. Both tabs write to localStorage independently (Zustand store + localStorage persistence).
2. Debounce timer fires in both tabs.
3. Tab 1 POSTs config with old `debts`, Tab 2 POSTs config with old `profile`.
4. Server receives two writes, last one wins → one change is lost.

**Solution**: Use a single Zustand store shared across all tabs via localStorage event listener.

```typescript
// In useConfig hook
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'dashboard-config') {
      // Another tab updated the store, reload it
      const newConfig = JSON.parse(e.newValue);
      setConfig(newConfig);
    }
  };
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

This ensures all tabs sync localStorage updates and prevent concurrent edits within the same browser.

### Case 3: User Signs Out Before Queued Writes Drain

**Scenario**: User is offline, editing locally. Queue builds up. User signs out before reconnecting.

**Behavior**: Sign-out handler discards the queue (see Offline Queue section above).

**User Communication**: Show a warning modal before sign-out if the queue is non-empty.

```typescript
function handleSignOut() {
  const queue = JSON.parse(localStorage.getItem('retireau:sync_queue') || '[]');
  
  if (queue.length > 0) {
    showConfirmModal({
      title: 'Unsaved Changes',
      message: `You have ${queue.length} unsaved changes. Sign out anyway?`,
      onConfirm: () => {
        localStorage.removeItem('retireau:sync_queue');
        signOut();
      },
      onCancel: () => {
        // User cancels, stay signed in and let them sync first
      },
    });
  } else {
    signOut();
  }
}
```

---

## Retry Policy

### Exponential Backoff

When a push fails due to network error or 5xx, retry with exponential backoff:

```typescript
const MAX_RETRIES = 4;
const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // 1s, 2s, 4s, 8s

async function pushWithRetry(
  config: DashboardConfig,
  attempt = 0
): Promise<boolean> {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify({ config, timestamp: Date.now() }),
    });
    
    if (res.ok) return true;
    
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      // Server error, retry
      await sleep(RETRY_DELAYS[attempt]);
      return pushWithRetry(config, attempt + 1);
    }
    
    if (res.status === 409) {
      // Conflict, don't retry; let user resolve
      return false;
    }
    
    return false;
  } catch (err) {
    // Network error
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAYS[attempt]);
      return pushWithRetry(config, attempt + 1);
    }
    return false;
  }
}
```

---

## Security Notes

### Session Token Inclusion

Every sync call must include the Clerk session token (automatic in fetch calls from browser due to same-origin policy). The server re-verifies `userId` from the token before processing.

```typescript
// Browser automatically includes credentials
fetch('/api/config', {
  method: 'POST',
  body: JSON.stringify({ config }),
  // Credentials (JWT) sent automatically by Clerk SDK
});
```

### Never Trust Client-Supplied Timestamps

The client's `timestamp` and `updatedAt` fields are hints only. The server uses its own `NOW()` for the source of truth:

```typescript
// Server-side
const savedConfig = await prisma.config.update({
  where: { userId: user.id, isActive: true },
  data: {
    config,
    schemaVersion,
    // updatedAt is auto-set to NOW() by Prisma @updatedAt directive
  },
});
```

---

## Observability Metrics

Hook into `docs/19-observability.md` and emit the following metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `sync_attempt` | Counter | User initiated a sync (pull or push) |
| `sync_success` | Counter | Sync completed successfully |
| `sync_conflict` | Counter | Conflict detected and user prompted |
| `sync_failure` | Counter | Sync failed (network, 5xx, etc.) |
| `sync_queue_depth` | Gauge | Current number of items in offline queue |
| `sync_latency_ms` | Histogram | Time taken for a sync round-trip |

Example Sentry event:

```typescript
Sentry.captureMessage('Config sync succeeded', 'info', {
  tags: { event: 'sync_success' },
  extra: {
    latencyMs: 250,
    queueDepthBefore: 2,
    queueDepthAfter: 0,
  },
});
```

---

## Testing the Sync Flow

### Unit Tests

Test each function in isolation:

```typescript
// __tests__/lib/sync.test.ts
import { mergeConfigs } from '@/lib/sync';

describe('mergeConfigs', () => {
  it('replaces local with cloud if cloud is newer', () => {
    const cloudConfig = { schemaVersion: 1, ... };
    const cloudTimestamp = 2000;
    const localTimestamp = 1000;

    const result = mergeConfigs(cloudConfig, cloudTimestamp);
    
    expect(result).toEqual({
      mode: 'replace',
      config: cloudConfig,
    });
  });

  it('detects conflict if local is newer', () => {
    const cloudConfig = { schemaVersion: 1, ... };
    const cloudTimestamp = 1000;
    const localTimestamp = 2000;

    const result = mergeConfigs(cloudConfig, cloudTimestamp);
    
    expect(result).toEqual({
      mode: 'conflict',
      cloudConfig,
      localConfig: expect.any(Object),
    });
  });
});
```

### Integration Tests (Playwright)

Test the full flow including UI interactions:

```typescript
// e2e/sync.spec.ts
import { test, expect } from '@playwright/test';

test('sync pulls cloud config on sign-in', async ({ page, context }) => {
  // 1. Create a user in the database with a known config
  const userId = await seedUser({
    config: { profile: { matty: { salary: 200000 } } },
  });

  // 2. Sign in
  await page.goto('http://localhost:3000/sign-in');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("Sign In")');

  // 3. Wait for dashboard to load
  await page.waitForURL('http://localhost:3000/dashboard');

  // 4. Verify config loaded
  const salaryInput = await page.locator('input[name="matty-salary"]');
  await expect(salaryInput).toHaveValue('200000');
});

test('sync detects and prompts on conflict', async ({ page }) => {
  // Similar setup, but with local and cloud configs out of sync
  // Verify conflict modal appears
  // Verify user can choose "Keep Local" or "Keep Cloud"
});
```

### Offline Simulation (Playwright)

```typescript
test('queue builds during offline, drains on reconnect', async ({ page, context }) => {
  // 1. Sign in and navigate to dashboard
  // 2. Go offline
  await context.setOffline(true);
  
  // 3. Edit config
  await page.fill('input[name="matty-salary"]', '210000');
  
  // 4. Verify queue has 1 item
  const queueDepth = await page.evaluate(
    () => JSON.parse(localStorage.getItem('retireau:sync_queue') || '[]').length
  );
  expect(queueDepth).toBe(1);
  
  // 5. Come back online
  await context.setOffline(false);
  
  // 6. Trigger sync
  await page.click('button:has-text("Sync Now")');
  
  // 7. Verify queue was drained
  const newQueueDepth = await page.evaluate(
    () => JSON.parse(localStorage.getItem('retireau:sync_queue') || '[]').length
  );
  expect(newQueueDepth).toBe(0);
});
```

---

## Summary Checklist

- [ ] Implement `mergeConfigs()` function with last-write-wins logic
- [ ] Add conflict detection modal UI
- [ ] Implement debounced push on config changes
- [ ] Implement pull on sign-in
- [ ] Add "Sync Now" button to dashboard header
- [ ] Implement offline queue in localStorage (`retireau:sync_queue`)
- [ ] Implement queue drain on reconnect (window `online` event)
- [ ] Implement retry logic with exponential backoff
- [ ] Emit observability metrics (Sentry) for each sync event
- [ ] Test merge logic with Fixture A, B, C configs
- [ ] Test conflict detection and user prompts
- [ ] Test offline queue with Playwright
- [ ] Test rate limiting (429 response from server)
