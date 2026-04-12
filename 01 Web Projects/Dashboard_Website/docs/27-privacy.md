# 27 — Privacy Compliance Spec

Audience: solo operator / developer. Practical compliance reference — not a legal document. Consult a privacy lawyer before launch if handling large user volumes.

Governing law: Privacy Act 1988 (Cth) + Australian Privacy Principles (APPs).

---

## 1. App Scope

**RetireAU** is a public-facing, multi-user Australian retirement planning dashboard.

**Data collected per user:**

| Category | Examples |
|---|---|
| Identity | Name, email (via Clerk) |
| Demographics | Age, partner age, number of dependants |
| Financial — income | Salary, employer SG contributions |
| Financial — assets | Super balance, property values, savings |
| Financial — liabilities | Mortgage balance, personal debt, HECS-HELP |
| Financial — projections | Retirement age target, drawdown strategy |

**Classification under the Privacy Act 1988 (Cth):**

- All of the above constitutes **personal information** (s 6(1)).
- Financial information (salary, debts, asset values) qualifies as **sensitive information** in practice, although the Act's explicit sensitive categories cover health and biometric data. Treat all financial data with the same care as sensitive information regardless.

**Applicable threshold:** As a small operator (< $3M annual turnover), the Privacy Act may not apply automatically. However, because the app collects financial information voluntarily submitted by users, compliance with the APPs is adopted as a baseline regardless of threshold. If the app crosses $3M turnover, full APP compliance becomes mandatory.

---

## 2. APP 1 — Privacy Policy

**Requirement:** A privacy policy must be published before any personal information is collected from users. The policy must be freely available and easy to find.

**Deliverable:** `/privacy` page in production (see `docs/16-navigation-routing.md` for routing spec).

**Required content (minimum):**

1. What information RetireAU collects and how it is collected (signup form, dashboard inputs).
2. Why the information is collected (generating retirement projections; no other purpose).
3. How the information is stored and protected (Railway PostgreSQL, Clerk, TLS, encryption at rest).
4. Who can access it (operator only; no third-party data sharing; no advertising use).
5. How users can request access to their data (`GET /api/export`).
6. How users can request deletion of their data (`DELETE /api/user`).
7. How to contact the operator for privacy enquiries ([operator email — add before launch]).
8. Date the policy was last updated.

**Implementation note:** The `/privacy` page must be accessible to unauthenticated users (no Clerk middleware redirect). Add it to the public route list in `middleware.ts`.

---

## 3. APP 3 — Collection Notice

**Requirement:** Users must be informed about what is being collected and why before they enter personal data. This is distinct from the full privacy policy.

**Trigger:** Display on first login, before the user accesses `/dashboard`. A modal or interstitial is acceptable. Store acceptance in the database (`profile.privacyNoticeAcceptedAt`).

**Minimum collection notice text:**

> RetireAU collects financial information (income, assets, debts, super) to generate personalised retirement projections. Your data is stored on Railway (Dallas, TX, USA) and your identity is managed via Clerk (US). You can export or permanently delete your data at any time from your account settings. By continuing, you agree to our [Privacy Policy](/privacy).

**Implementation checklist:**

- [ ] `CollectionNoticeModal` component rendered server-side on first `/dashboard` load if `profile.privacyNoticeAcceptedAt` is null.
- [ ] `PATCH /api/profile` endpoint accepts `{ privacyNoticeAccepted: true }` and records timestamp.
- [ ] Modal cannot be dismissed without accepting — do not show a bare "×" close button.
- [ ] `/privacy` link in the notice opens in a new tab so the user does not lose the modal.

---

## 4. APP 8 — Cross-Border Disclosure

**Requirement:** If personal information is disclosed to overseas recipients, the operator must take reasonable steps to ensure those recipients comply with the APPs (or an equivalent standard).

**Overseas recipients in use:**

| Recipient | Location | Data transferred | Privacy URL |
|---|---|---|---|
| Railway (PostgreSQL hosting) | Dallas, TX, USA | All config/financial data | https://railway.app/legal/privacy |
| Clerk (auth provider) | USA | Name, email, session tokens | https://clerk.com/legal/privacy |

**"Reasonable steps" taken:**

- Railway has published privacy policies and maintains SOC 2 Type II compliance. Retain current policy URL above.
- Clerk has published privacy policies and maintains SOC 2 Type II compliance. Retain current policy URL above.
- Both services process data under standard contractual terms accepted at account creation.

**Disclosure to users:**

Include a "Where is my data stored?" section in the `/privacy` page, stating:

> Your retirement data is stored on Railway's PostgreSQL database, hosted in Dallas, Texas, USA. Your login identity is managed by Clerk, also US-based. Both providers maintain SOC 2 Type II compliance. We do not share your data with any other third parties.

**Annual review:** Confirm Railway and Clerk privacy policy URLs are still valid each July (financial year rollover checklist — see doc 26 §8).

---

## 5. APP 11 — Security of Personal Information

**Requirement:** Take reasonable steps to protect personal information from misuse, interference, loss, and unauthorised access, modification, or disclosure.

**Controls in place:**

| Layer | Control |
|---|---|
| Encryption at rest | Railway PostgreSQL: AES-256 encryption at rest (managed by Railway) |
| Encryption in transit | TLS 1.2+ enforced on all Railway and Clerk connections; HTTPS-only app |
| Authentication | Clerk JWT on all API routes; middleware blocks unauthenticated access to `/api/*` except `/api/health` |
| Authorisation | All config queries scoped to `userId` (Clerk subject); no cross-user data access |
| Secrets | All secrets in Railway environment variables; never in source code or logs |
| Logging | Pino structured logs; PII (salary, debt values) must not appear in log output — log IDs and computed values only |

**What is not in scope (v1):**

- Field-level encryption (not implemented; accepted risk for v1).
- Audit log of user data reads (not implemented; accepted risk for v1).
- IP allowlisting (not implemented; Railway-managed access).

**Incident notification (NDB scheme):**

Under the Notifiable Data Breaches (NDB) scheme, if a data breach is likely to result in serious harm to any individual, the operator must:

1. Notify the Office of the Australian Information Commissioner (OAIC) as soon as practicable.
2. Notify all affected individuals directly within 30 days of becoming aware of the breach.

Notification threshold: salary, super balance, or debt values exposed to an unauthorised third party = serious harm. Err on the side of notification.

---

## 6. Data Retention Policy

| State | Retention |
|---|---|
| Active account | Data retained indefinitely while the account exists |
| Account deletion (user-initiated) | All `Config` rows and `Profile` rows deleted within 24 hours of `DELETE /api/user` request |
| Account deletion (Clerk webhook) | `user.deleted` webhook triggers the same deletion pipeline automatically |
| Railway backups | Retained for 7 days on Railway's automated schedule; not exported or archived |
| Pino logs (Railway log viewer) | Retained per Railway's log retention policy (currently 7 days on Hobby plan) |

**Implementation note:** `DELETE /api/user` must cascade-delete all related rows (Config, Profile, any future tables). Use Prisma `onDelete: Cascade` on foreign keys, or perform explicit deletion in a transaction. Verify with a test against a staging user before launch.

**What is not deleted:** Clerk user records are deleted separately via the Clerk dashboard or the Clerk `deleteUser` API call, which should be chained in the `DELETE /api/user` handler.

---

## 7. Informal DPIA (Data Protection Impact Assessment)

A full DPIA is not legally required at v1 scale. This informal assessment is sufficient for a solo operator.

**Risk register:**

| Risk | Likelihood | Impact | Mitigation | Residual risk |
|---|---|---|---|---|
| Financial PII (salary, super, debts) stored in US | Medium | High | SOC 2 providers; TLS; Clerk JWT | Low–Medium |
| Clerk auth outage exposes dashboard data | Low | Medium | JWT TTL limits exposure window | Low |
| Railway database breach | Low | High | AES-256 at rest; no public DB endpoint | Low |
| Developer accidental PII commit | Medium | High | `.gitignore` for `reference/`, `*.local.*`; PII scanning in pre-commit | Low |
| Log leakage of financial values | Medium | Medium | Pino log policy: IDs and derived values only, never raw inputs | Low |

**Accepted risks (v1):**

- No field-level encryption.
- No audit log of data reads.
- No user-facing 2FA enforcement (Clerk handles MFA configuration per user preference).

**Review cadence:** Annually, or when a significant new feature is added that involves new data collection or a new third-party integration.

**DPIA sign-off:** [operator name] — [date before launch].

---

## 8. User Rights

Users have the following rights under the APPs and RetireAU's policy. All are exercisable from within the app or by contacting the operator.

| Right | How to exercise |
|---|---|
| Right to access | `GET /api/export` — returns a JSON blob of the user's full Config and Profile data |
| Right to deletion | `DELETE /api/user` in account settings — permanently deletes all data within 24 hours |
| Right to correct | Edit mode in the dashboard — all Config fields are editable at any time |
| Right to know what is held | `/privacy` page + `GET /api/export` |
| Right to complain | Contact operator (see below); escalate to OAIC at [oaic.gov.au](https://www.oaic.gov.au) |

**Operator contact for privacy enquiries:** [add email address before launch]

**Response time commitment:** Acknowledge access or deletion requests within 5 business days. Complete requests within 30 days.

**Out of scope (v1):** Automated subject access request portal. Requests handled manually by the operator via email.
