// Public route — accessible without authentication.
// Satisfies APP 1 (Privacy Policy) per docs/27-privacy.md §2.
// The /privacy link in CollectionNoticeModal must open this page in a new tab.

export default function PrivacyPage() {
  const lastUpdated = '12 April 2026';

  return (
    <main className="min-h-screen bg-dashboard-bg py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-dashboard-text mb-2">Privacy Policy</h1>
        <p className="text-xs text-dashboard-muted mb-8">Last updated: {lastUpdated}</p>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            What We Collect
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed mb-3">
            RetireAU collects information you provide when creating an account and using the
            dashboard:
          </p>
          <ul className="list-disc list-inside text-sm text-dashboard-text space-y-1 ml-2">
            <li>
              <strong>Identity:</strong> Name and email address (via Clerk authentication)
            </li>
            <li>
              <strong>Demographics:</strong> Age, partner age, number of dependants
            </li>
            <li>
              <strong>Financial — income:</strong> Salary, employer superannuation contributions
            </li>
            <li>
              <strong>Financial — assets:</strong> Super balance, property values, savings
            </li>
            <li>
              <strong>Financial — liabilities:</strong> Mortgage balance, personal debt, HECS-HELP
            </li>
            <li>
              <strong>Financial — projections:</strong> Retirement age target, drawdown strategy
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Why We Collect It
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed">
            Your financial information is collected solely to generate personalised Australian
            retirement projections. We do not use your data for advertising, profiling, or any
            purpose other than providing the dashboard service to you.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Where Your Data Is Stored
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed mb-3">
            Your retirement data is stored on Railway&apos;s PostgreSQL database, hosted in Dallas,
            Texas, USA. Your login identity is managed by Clerk, also US-based. Both providers
            maintain SOC 2 Type II compliance. We do not share your data with any other third
            parties.
          </p>
          <ul className="list-disc list-inside text-sm text-dashboard-text space-y-1 ml-2">
            <li>
              Railway (data storage):{' '}
              <a
                href="https://railway.app/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dashboard-accent underline"
              >
                railway.app/legal/privacy
              </a>
            </li>
            <li>
              Clerk (authentication):{' '}
              <a
                href="https://clerk.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dashboard-accent underline"
              >
                clerk.com/legal/privacy
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Your Rights
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed mb-3">
            Under the Australian Privacy Act 1988 (Cth) and Australian Privacy Principles:
          </p>
          <ul className="list-disc list-inside text-sm text-dashboard-text space-y-1 ml-2">
            <li>
              <strong>Access:</strong> Export all your data via Account Settings → Export Data
            </li>
            <li>
              <strong>Deletion:</strong> Permanently delete your account and all data via Account
              Settings → Delete Account (within 24 hours)
            </li>
            <li>
              <strong>Correction:</strong> Edit any field in the dashboard at any time
            </li>
            <li>
              <strong>Complaints:</strong> Escalate to the OAIC at{' '}
              <a
                href="https://www.oaic.gov.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dashboard-accent underline"
              >
                oaic.gov.au
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Security
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed">
            All data is encrypted at rest (AES-256 via Railway) and in transit (TLS 1.2+). Access
            to the API requires a valid Clerk JWT. All queries are scoped to your user ID — no
            cross-user data access is possible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-dashboard-text mb-3 pb-2 border-b border-dashboard-border">
            Contact
          </h2>
          <p className="text-sm text-dashboard-text leading-relaxed">
            For privacy enquiries, contact the operator at:{' '}
            <span className="text-dashboard-muted">[operator email — to be added before launch]</span>
            . We acknowledge access or deletion requests within 5 business days and complete them
            within 30 days.
          </p>
        </section>

        <p className="text-xs text-dashboard-muted mt-12 text-center">
          RetireAU · Governed by the Privacy Act 1988 (Cth) · Last updated {lastUpdated}
        </p>
      </div>
    </main>
  );
}
