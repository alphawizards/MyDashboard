# Morning Dashboard — Web Transition

Port of the local HTML + Python dashboard to Next.js + Supabase + Railway, fronted by Cloudflare.

See [implementation_guide.md](./implementation_guide.md) for the full plan.

## Folder map
| Folder | Purpose |
|--------|---------|
| `app/` | Next.js project (created during Phase 1) |
| `schema/` | Supabase SQL migrations + seed |
| `scripts/` | One-shot import + rollback tooling |
| `tests/` | unit / integration / e2e / contracts / fixtures |
| `legacy/` | Read-only copies of current local dashboard (reference, not moved) |
| `decisions/` | ADRs — one file per architectural choice |
| `tasks/` | `todo.md` phase checklist, `lessons.md` corrections log |
| `infra/` | Railway + Cloudflare config + env var docs |
| `docs/runbook/` | Incident playbooks |
| `.github/workflows/` | CI — typecheck, lint, test, weekly contract tests |

## Mode
Single-user. Magic-link auth + email allowlist. Multi-user is deferred until there is a second user.

## Quick start (after Phase 1 scaffolding)
```
cd app
cp .env.example .env.local   # fill in Supabase + X bearer + refresh secret
npm install
npm run dev
```

## Deploy
Git push → Railway auto-deploy. Cloudflare proxies `dashboard.<domain>`. See `infra/`.
