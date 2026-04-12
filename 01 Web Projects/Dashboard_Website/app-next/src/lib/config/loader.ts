import { DashboardConfigSchema, CURRENT_SCHEMA_VERSION, type DashboardConfig } from './schema';

/**
 * Normalise → migrate → parse a raw unknown config blob.
 *
 * This is the ONLY entry point for untrusted config objects (localStorage,
 * API responses, legacy HTML CONFIG blobs). Never call DashboardConfigSchema.parse()
 * directly on user-supplied data — always go through parseConfig().
 *
 * Phase 1: schema is at v1, so normalization only (no migration logic yet).
 * Phase 2+: add migration steps inside migrate() before the final parse.
 *
 * See schema.ts ⚠ Migration/normalization boundary comment.
 */
export function parseConfig(raw: unknown): DashboardConfig {
  const normalised = normalise(raw);
  // Future versions: migrate(normalised) here.
  return DashboardConfigSchema.parse(normalised);
}

/**
 * Normalise a raw payload so it satisfies the strict schema.
 * Adds any fields that were introduced after the CONFIG was last persisted.
 */
function normalise(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return raw;
  }
  // structuredClone avoids mutating the caller's object reference (shallow spread does not).
  const obj = structuredClone(raw) as Record<string, unknown>;

  // Add schemaVersion if missing (legacy payloads from reference HTML).
  if (!('schemaVersion' in obj)) {
    obj['schemaVersion'] = CURRENT_SCHEMA_VERSION;
  }

  // Add privacyNoticeAcceptedAt to profile if missing (added Phase 1).
  if (typeof obj['profile'] === 'object' && obj['profile'] !== null) {
    const profile = obj['profile'] as Record<string, unknown>;
    if (!('privacyNoticeAcceptedAt' in profile)) {
      profile['privacyNoticeAcceptedAt'] = null;
    }
  }

  return obj;
}
