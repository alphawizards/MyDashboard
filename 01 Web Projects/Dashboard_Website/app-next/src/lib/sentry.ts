// Phase 1 no-op Sentry wrapper (Fix 2.7).
//
// Nothing in the codebase imports @sentry/nextjs directly — all Sentry calls
// go through this file. To enable real Sentry in production:
//   1. Install @sentry/nextjs
//   2. Add SENTRY_DSN to .env.local and Railway environment
//   3. Replace the no-op functions below with real Sentry calls
//   4. Follow https://docs.sentry.io/platforms/javascript/guides/nextjs/

export function captureException(_err: unknown, _context?: Record<string, unknown>): void {
  // no-op in Phase 1
}

export function captureMessage(
  _message: string,
  _level?: 'info' | 'warning' | 'error',
): void {
  // no-op in Phase 1
}

export function setUser(_user: { id: string; email?: string } | null): void {
  // no-op in Phase 1
}
