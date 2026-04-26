## Decision: Ship single-user, defer multi-user indefinitely

## Context
The local dashboard has always been a single-user tool. Porting to the web raised the question of whether to build multi-user primitives (profiles, per-user watchlists, RBAC) up front.

## Alternatives considered
- **Multi-user from day one** with `user_id` columns + per-user RLS.
- **Single-user but "ready for multi-user"** — add `user_id` columns now, hardcode a single UUID.
- **Pure single-user** — no user concept in the schema at all.

## Reasoning
- There is no second user on the horizon. Building for one is speculative.
- The migration path if a second user ever appears is mechanical: add `user_id`, backfill with the existing user's UUID, update RLS. A day of work, not a week.
- Auth allowlist by email is enough security for a single-user dashboard. No roles, no admin screens.

## Trade-offs accepted
- If multi-user becomes a real need, a schema migration + RLS rewrite is required — not a config flip.
- Email allowlist lives in code (`app/lib/auth/allowlist.ts`), so adding/removing requires a deploy. Acceptable for a one-person tool.
