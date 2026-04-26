# Phase 5 — Auth Gate

**Goal**: `/watchlist` (and everything under `/`) requires login via magic-link email. Only the allowlisted email(s) can access.

**Duration**: ~4 hours.

---

## Prerequisites

- Phase 4 gate passed.
- You have an inbox reachable on your phone (for magic link).

---

## Outputs

- [ ] Unauthenticated request to any path except `/login` redirects to `/login`.
- [ ] Non-allowlisted email receives a magic link but lands on a 403 page.
- [ ] Your email logs in successfully and can see `/watchlist`.
- [ ] Logout button clears session.
- [ ] `page.tsx` switched from service client to authenticated client.

---

## Steps

### 5.1 Enable magic-link auth in Supabase

Supabase → Authentication → Providers → Email → Enable. Disable "Confirm email" (magic links auto-confirm). Disable other providers for now.

Authentication → URL Configuration:
- **Site URL**: `https://dashboard.<apex>`
- **Redirect URLs**: `https://dashboard.<apex>/auth/callback`, `http://localhost:3000/auth/callback`

---

### 5.2 Allowlist module

`app/lib/auth/allowlist.ts`:

```ts
const EMAILS = (process.env.AUTH_EMAIL_ALLOWLIST ?? 'matthewdlee335@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAILS.includes(email.toLowerCase());
}
```

Set `AUTH_EMAIL_ALLOWLIST` in Railway project vars (comma-separated, lowercase). Locally add to `.env.local`.

---

### 5.3 Login page

`app/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from './login-form';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  return (
    <main className="mx-auto max-w-md p-8 mt-12 space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <LoginForm />
      <AsyncFlash sp={searchParams} />
    </main>
  );
}

async function AsyncFlash({ sp }: { sp: Promise<{ sent?: string; error?: string }> }) {
  const s = await sp;
  if (s.sent) return <p className="text-green-700">Check your email for the magic link.</p>;
  if (s.error) return <p className="text-red-700">{s.error}</p>;
  return null;
}
```

`app/app/(auth)/login/login-form.tsx`:

```tsx
'use client';
import { useTransition } from 'react';
import { sendMagicLink } from './actions';

export function LoginForm() {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(() => sendMagicLink(fd))}
      className="space-y-3"
    >
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="w-full border rounded px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
```

`app/app/(auth)/login/actions.ts`:

```ts
'use server';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { isAllowed } from '@/lib/auth/allowlist';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!isAllowed(email)) {
    redirect(`/login?error=${encodeURIComponent('That email is not allowed to access this dashboard.')}`);
  }
  const supabase = await getServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/login?sent=1');
}
```

Set `NEXT_PUBLIC_SITE_URL=https://dashboard.<apex>` in Railway project vars + `.env.local`.

---

### 5.4 Auth callback handler

`app/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/server';
import { isAllowed } from '@/lib/auth/allowlist';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', url));

  const supabase = await getServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url));

  // Final allowlist gate — belt and braces
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAllowed(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/403', url));
  }
  return NextResponse.redirect(new URL('/watchlist', url));
}
```

---

### 5.5 403 page

`app/app/403/page.tsx`:

```tsx
export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-md p-8 mt-12 text-center">
      <h1 className="text-2xl font-bold">403 — Forbidden</h1>
      <p className="mt-2 text-gray-600">Your email is not allowed to access this dashboard.</p>
      <a href="/login" className="mt-4 inline-block text-blue-600 underline">Back to sign in</a>
    </main>
  );
}
```

---

### 5.6 Middleware gate

`app/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAllowed } from '@/lib/auth/allowlist';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/403', '/api/refresh'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowed(user.email)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!api/refresh($|/)|_next/|favicon\\.).*)'],
};
```

**Note on `/api/refresh`**: already guarded by `REFRESH_SHARED_SECRET`. Middleware skips it intentionally so the cron and manual button still work without a user session.

---

### 5.7 Switch `/watchlist` from service client to user client

Edit `app/app/watchlist/page.tsx`:

```ts
// before:
import { getServiceClient } from '@/lib/supabase/server';
const supabase = getServiceClient();

// after:
import { getServerClient } from '@/lib/supabase/server';
const supabase = await getServerClient();
```

Since `authenticated` role has SELECT on all tables (per `002_rls_policies.sql`), the page renders identically.

---

### 5.8 Logout button

Add to `page.tsx` header:

```tsx
import { LogoutButton } from './logout-button';
// in header JSX:
<LogoutButton />
```

`app/app/watchlist/logout-button.tsx`:

```tsx
'use client';
import { getBrowserClient } from '@/lib/supabase/client';

export function LogoutButton() {
  return (
    <button
      className="text-sm text-gray-600 underline"
      onClick={async () => {
        await getBrowserClient().auth.signOut();
        location.href = '/login';
      }}
    >
      Sign out
    </button>
  );
}
```

---

### 5.9 Local verification

```bash
npm run dev
```

- Open `http://localhost:3000/watchlist` in incognito → redirects to `/login`.
- Enter your email → "Check your email for the magic link."
- Check inbox, click link → lands on `/watchlist` with data.
- Click "Sign out" → returns to `/login`.
- Re-enter a *non-allowlisted* email → "That email is not allowed…" (error flash, no email sent).

**Verify middleware does NOT redirect `/api/refresh/all`**:
```bash
curl -I -H "x-refresh-secret: $REFRESH_SHARED_SECRET" \
  http://localhost:3000/api/refresh/all
# Expect: 200 or 405 (route exists + secret valid). NOT 307 to /login.
```

---

### 5.10 Production test

```bash
git add app/
git commit -m "feat: magic-link auth with email allowlist"
git push
```

Wait for Railway deploy.

- `https://dashboard.<apex>/watchlist` in incognito → redirects to `/login`.
- Magic link from your phone email client → opens in browser → dashboard.
- **From a different account's email** → error message, no link sent.

---

### 5.11 Tighten the CSP

Now that the auth surface is known, add CSP to `next.config.ts`:

```ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Tailwind in dev; tighten post-MVP
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://clob.polymarket.com https://gamma-api.polymarket.com",
  "frame-ancestors 'none'",
].join('; ');

// add to headers():
{ key: 'Content-Security-Policy', value: csp }
```

Commit + deploy. Open devtools → Console → confirm no CSP violations.

---

## Gate to Phase 6

- [ ] Incognito `/watchlist` → `/login` redirect.
- [ ] Magic link delivered to your inbox within 60s.
- [ ] Clicking link lands on `/watchlist` with fresh data.
- [ ] Non-allowlisted email blocked at form submission.
- [ ] Logout button clears session, returns to `/login`.
- [ ] Cron + manual refresh still work (middleware exempts `/api/refresh`).
- [ ] No CSP violations in browser console.

---

## Common pitfalls

- **Middleware blocking `/api/refresh/*`**: cron breaks. Keep it in `PUBLIC_PATHS` + matcher exclusion.
- **Magic link redirect mismatches Supabase URL config**: link lands on an error. Both `Site URL` and `Redirect URLs` must be set.
- **Allowlist only on login form, not on callback**: user could bypass by calling callback directly with a stolen code. Always re-check allowlist server-side after `exchangeCodeForSession`.
- **Hardcoded email in `allowlist.ts` with no env override**: fine for MVP, but if you add a second user you need to redeploy. That's the accepted trade-off (see `decisions/2026-04-23-single-user-mode.md`).
- **Switching `page.tsx` to server client breaks something**: RLS policy `auth read watchlist` is keyed to `authenticated` role — if a policy mis-scope sneaks in, the page returns empty. `select auth.role()` in SQL editor as a sanity check.
