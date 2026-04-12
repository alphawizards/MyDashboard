import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Phase 6 will replace this with clerkMiddleware(). See docs/06-implementation-plan.md §Phase 6.
// Empty matcher means no routes are intercepted in Phases 1–5.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: [] };
