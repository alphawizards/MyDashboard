import { NextResponse } from 'next/server';

// Public route — excluded from Clerk middleware auth in Phase 6.
// Referenced by docs/26-runbooks.md §1 and docs/27-privacy.md §5.
// Phase 6 will replace db:"not_configured" with a real Prisma ping.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    db: 'not_configured',
    ts: new Date().toISOString(),
  });
}
