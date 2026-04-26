## Decision: Next.js 15 + Supabase + Railway, fronted by Cloudflare

## Context
Porting a local Python + static HTML dashboard to a web app. Single user, daily-refresh cadence, mix of server-side API calls (X, yfinance) and live client-side calls (Polymarket CLOB).

## Alternatives considered
- **Vercel instead of Railway** — great DX but Vercel cron is limited on hobby tier and Vercel forces serverless, which complicates the long-running refresh worker.
- **Supabase Edge Functions instead of a Node worker** — adds a second runtime (Deno); not worth the split for one cron job.
- **Cloudflare Workers end-to-end** — no Node ecosystem, `yahoo-finance2` + `pg` + X SDK would all need rewriting or replacing.
- **Keep Python backend + add a React frontend** — two runtimes, two deploy pipelines. Simpler to consolidate on TS/Node.

## Reasoning
- Next.js gives SSR + API routes + client islands in one codebase — matches the existing "HTML + injected JS constants" mental model cleanly.
- Railway runs Node cron as a first-class service, not a hack.
- Supabase bundles Postgres + Auth + RLS; removes the need to build auth ourselves.
- Cloudflare is effectively free for DNS + TLS + WAF and buys a real security posture without extra code.

## Trade-offs accepted
- Vendor lock-in to Supabase Auth — migration to another auth provider would be a real project.
- Railway cron is UTC-only; DST drift accepted (1 hour twice a year) to avoid dual-cron complexity.
- No staging environment initially — accept more risk on prod deploys for lower ops cost.
