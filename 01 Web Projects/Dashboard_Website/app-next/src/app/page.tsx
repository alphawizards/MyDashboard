import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-dashboard-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-dashboard-text mb-3">RetireAU Dashboard</h1>
        <p className="text-dashboard-muted text-sm mb-8">
          Australian retirement planning — personalised projections for your financial future.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-dashboard-accent text-dashboard-bg font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          Open Dashboard
        </Link>
        <p className="mt-4 text-xs text-dashboard-muted">
          <Link href="/privacy" className="underline hover:text-dashboard-text transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
