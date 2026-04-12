# Security Threat Model — RetireAU Dashboard

## BLUF

RetireAU is a solo/household Australian web app holding highly sensitive personal financial data (salaries, property values, investment balances, children's dates of birth). The threat model is calibrated to a single Australian user or household unit managing their own finances, not a multi-tenant SaaS. The primary assets at risk are real personal and financial data in CONFIG, Clerk session tokens, database credentials, and API keys. Threats are mitigated through Clerk authentication, HTTPS, Prisma parameterised queries, input validation, PII redaction in logging, and deliberate omission of unnecessary features (no OAuth social login, no webhooks to external services, no mobile apps). A post-launch penetration test is recommended but not required for v1 ship.

---

## Assets Ranked by Impact

| Rank | Asset | Why Protected | Protection Mechanism |
|------|-------|---------------|----------------------|
| 1 | Real CONFIG data (Fixture A equivalent) | Salary, bank balances, property values, children's DOBs, family trust ownership share — reveals financial position and family structure | Authentication via Clerk, HTTPS, database encryption at rest (Railway managed), PII redaction in logs (Sentry integration) |
| 2 | Clerk session tokens (JWT in localStorage) | Session hijacking enables account takeover | HttpOnly cookie alternative (future), short TTL refresh flow (Clerk-managed), SameSite strict CSRF protection |
| 3 | Database credentials (DATABASE_URL, DIRECT_URL) | Full database access; exfiltration of all user configs and secrets | Stored in Railway environment vars, never in code, `.env.local` in `.gitignore`, rotate on every key exposure event |
| 4 | API keys (Clerk secret, Cloudflare API token) | Escalated access; can create users, modify records, bypass rate limits | Stored in Railway environment vars, Clerk webhook signature verification (not just raw HTTP), Cloudflare token stored in CI only (not in source) |

---

## STRIDE Threat Analysis

### S — Spoofing Identity

An attacker claims to be Matty or Partner via Clerk JWT token compromise.

Mitigations: Clerk JWT verification on every API call, HTTPS only, webhook signature verification (HMAC-SHA256).

### T — Tampering with Data

CONFIG object intercepted or modified in transit or at rest.

Mitigations: HTTPS encryption, Zod input validation on every endpoint, Prisma parameterised queries (no SQL injection), read-after-write verification on deletions.

### R — Repudiation

User denies making a CONFIG change or deletion.

Mitigations: Structured server logs with userId/timestamp/endpoint. Future: CONFIG change history table for audit trail.

### I — Information Disclosure

Sensitive data leaks via logs, error messages, or HTTP responses.

Mitigations: No CONFIG in logs, PII redaction in Sentry, no stack traces in production, `.gitignore` for reference/, localStorage clearance on logout.

### D — Denial of Service

Attacker floods API to crash server.

Mitigations: Cloudflare DDoS protection, per-user rate limits (30 req/5min config, 10 req/5min sync), Railway auto-scaling, no expensive operations.

### E — Elevation of Privilege

User accesses another user's CONFIG or admin endpoints.

Mitigations: Every DB query scoped by userId, no admin routes in v1, Clerk user context re-validation, read-then-verify on deletion.

---

## OWASP Top 10 2021 Mapping

| OWASP Rank | Threat | RetireAU Mitigation | Reference |
|------------|--------|-------------------|-----------|
| A01 | Broken Access Control | Every API query scoped by Clerk userId. No admin routes. | docs/17-auth-middleware.md |
| A02 | Cryptographic Failure | HTTPS mandatory. DB encryption at rest (Railway). Clerk RS256. | Cloudflare, Railway, Clerk docs |
| A03 | Injection | Zod validation + Prisma parameterised queries. No raw SQL. | docs/11-api-contracts.md |
| A04 | Insecure Design | Local-first design. Client-side computation. Clerk OAuth. | docs/01-architecture-overview.md |
| A05 | Security Misconfiguration | .env.local in .gitignore. Secrets in Railway only. | .env.example |
| A06 | Vulnerable & Outdated | npm audit in CI. Dependabot alerts. Exact version pinning. | Phase 6, docs/06-implementation-plan.md |
| A07 | Identification & Auth | Delegated to Clerk. No custom auth code. | docs/17-auth-middleware.md |
| A08 | Software & Data Integrity | Next.js SRI. package-lock.json in repo. No untrusted scripts. | npm-lock.json, next.config.js |
| A09 | Logging & Monitoring | Structured logs with userId/timestamp. Sentry error tracking. | docs/19-observability.md |
| A10 | SSRF | No external HTTP calls from handlers. No user-controlled redirects. | docs/01-architecture-overview.md |

---

## CSRF & XSS

**CSRF**: Clerk handles automatically. SDK injects CSRF token in POST requests.

**XSS**: React auto-escaping + Content-Security-Policy header. No dangerouslySetInnerHTML in shipped code.

---

## Secrets Management

**Dev**: .env.local (in .gitignore) contains test Clerk keys, DATABASE_URL, Upstash tokens.

**Prod**: Railway environment variables. Never commit secrets.

**Rotation**: If a secret leaks, rotate in Clerk/Railway dashboard, update env vars, redeploy.

---

## Dependency Security

**CI**: npm audit (fails on high/critical), Dependabot alerts.

**Pinning**: Critical deps pinned to exact versions (no ^ or ~).

**Monthly**: Review outdated packages, test updates, merge to main.

---

## Backup & Recovery

**Railway PostgreSQL**: Auto daily backups, retained 30 days. Recovery via Railway dashboard.

**RTO**: ~15 minutes | **RPO**: ~24 hours

---

## Incident Response Runbook

### If Database Compromised
1. Rotate DATABASE_URL, DIRECT_URL in Railway.
2. Examine Sentry logs to see accessed configs.
3. Notify all users (can't know who specifically accessed what without audit trail).
4. Restore from clean backup. Ask users to re-enter sensitive data.

### If Clerk Keys Leak
1. Rotate CLERK_SECRET_KEY in Railway and Clerk dashboard.
2. Revoke all active sessions in Clerk UI.
3. Update all deployments with new keys.
4. Monitor Clerk logs for unauthorised activity.

### If Cloudflare API Token Leaks
1. Revoke token in Cloudflare dashboard.
2. Remove from GitHub CI/CD secrets.
3. Verify no DNS/cache changes in Cloudflare Audit Logs.
4. Issue new token, update CI/CD.

### If CVE Affects Critical Dependency
1. If patch exists: Update package.json, test, deploy within 6 hours.
2. If no patch: Assess risk. Disable feature if necessary.

---

## User Deletion (Right to Be Forgotten)

Endpoint: `DELETE /api/user`

Behaviour: User confirms deletion (double opt-in) → Clerk account deleted → all CONFIG rows deleted (cascade) → all user rows deleted.

Confirmation: User signs in again → receives 401 user_not_found.

---

## Data Export (Data Portability)

Endpoint: `GET /api/export`

Response: JSON with user metadata + full CONFIG object. Suitable for spreadsheet import or regulatory compliance.

---

## Audit Trail Exemption (Solo-Scope Decision)

v1 deliberately omits a CONFIG change history table. This is a conscious scope decision for a solo/household application, not an oversight. Post-incident forensics in v1 rely on three mechanisms in order of coverage:

1. **Sentry error events** — every uncaught exception and explicit `Sentry.captureException` call is retained for 30 days, tagged with `userId` and `error_code` (see `docs/19-observability.md` and `docs/25-error-taxonomy.md`).
2. **Structured pino request logs** — every API request is logged with `timestamp`, `userId` (hashed), `route`, `method`, `status`, and `duration_ms`. Retained 7 days on Railway, sufficient to reconstruct "who called what endpoint when" but not "what the CONFIG looked like before the change".
3. **Railway automated Postgres backups** — daily snapshots retained 30 days. Allows point-in-time recovery of the previous day's CONFIG state, but not finer-grained.

**What this means in practice:** if Matty opens the dashboard on Tuesday and notices a field has an unexpected value, v1 cannot answer "which prior save changed this field and when". The best we can do is restore yesterday's backup or trust the user's memory.

### Triggers that require adding an audit trail post-v1

Revisit this exemption and add a `ConfigAuditLog` table if any of the following become true:

| Trigger | Why it matters |
|---|---|
| Second user account is added (partner or family member) | Accountability between multiple writers requires per-change attribution |
| Any regulator, employer, or accountant requests a change history | Compliance obligations cannot be met with backups alone |
| A bug is suspected where CONFIG values mutate without user action | Without an audit trail, root-cause analysis is guesswork |
| Cloud sync conflict resolution gets more sophisticated than last-write-wins | Merge strategies need a per-field history to work |
| The Australian Privacy Act or industry code introduces record-keeping requirements for personal financial tools | External mandate |
| User explicitly requests an edit history view in the UI | Feature requirement |

### Audit trail sketch (for when the trigger fires)

When the exemption ends, add a table roughly shaped:

```
ConfigAuditLog {
  id          BigInt   @id @default(autoincrement())
  userId      String   @index
  changedAt   DateTime @default(now()) @index
  path        String   // JSON pointer into CONFIG, e.g. "/debts/credit_card/balance"
  oldValue    Json?
  newValue    Json?
  source      String   // "ui-edit" | "sync-pull" | "migration" | "seed"
  requestId   String?  // correlation ID from docs/19-observability.md
}
```

Write-path: every `PUT /api/config` and sync conflict resolution should diff the old and new CONFIG against `path` granularity and append one row per leaf change. Retain for 2 years, then aggregate/purge.

Read-path: a new `GET /api/config/history?path=...` endpoint, Clerk-scoped, returning the last 100 changes for inspection. Add a simple timeline UI in settings.

Estimated effort when the trigger fires: 1–2 days including tests and UI.

---

## Penetration Testing

**v1 Ship**: Not required. Personal use case, risk is low.

**Post-Launch Recommendation**: After v1 is live (2–4 weeks), commission light pentest (~8 hours, $2–5k) covering auth bypass, authz bypass, XSS, CSRF, rate limit evasion, API logic flaws.

---

## Security Review Acceptance Criteria

- [ ] All env vars in Railway (zero secrets in code).
- [ ] .env.example documents every var, contains no real values.
- [ ] .gitignore includes reference/, fixture-a.json, .env.local, .env.production.
- [ ] Clerk webhook signature verification implemented.
- [ ] Every API endpoint validates input with Zod.
- [ ] Prisma queries are parameterised (no raw SQL except migrations).
- [ ] PII redaction enabled in Sentry.
- [ ] HTTPS enforced (Cloudflare redirects HTTP).
- [ ] No console.log in shipped code.
- [ ] No hardcoded secrets.
- [ ] npm audit passes (no high/critical vulns).
- [ ] Security checklist reviewed and signed off.

---

## References

- docs/01-architecture-overview.md — Stack and deployment.
- docs/02-database-schema.md — Database structure and cascade delete.
- docs/11-api-contracts.md — API endpoints, Zod validation, error envelopes.
- docs/17-auth-middleware.md — Clerk authentication and webhook verification.
- docs/19-observability.md — Logging, error tracking, PII redaction.
- .env.example — Environment variable template.
- DEFINITION_OF_DONE.md — Security acceptance criteria (Gate 10).
