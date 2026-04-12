// docs/04-css-design-system.md §Header
// docs/03-frontend-components.md §Header
// Phase 1: static shell — Clerk auth buttons wired in Phase 6.

interface HeaderProps {
  version?: string;
  lastUpdated?: Date;
}

export default function Header({ version = 'v1.0.0', lastUpdated }: HeaderProps) {
  const lastUpdatedText = lastUpdated
    ? `Last updated ${formatRelative(lastUpdated)}`
    : null;

  return (
    <header
      className="sticky top-0 z-40 border-b border-dashboard-border px-8 py-6 flex flex-wrap items-center justify-between gap-3"
      style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}
    >
      {/* Left — app name + version */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold text-dashboard-text">RetireAU Dashboard</span>
        <span
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-dashboard-accent text-dashboard-accent bg-dashboard-surface2"
        >
          {version}
        </span>
      </div>

      {/* Centre — last updated */}
      {lastUpdatedText && (
        <p className="text-xs text-dashboard-muted hidden md:block">{lastUpdatedText}</p>
      )}

      {/* Right — auth placeholder (Phase 6 will add Clerk SignInButton / UserButton) */}
      <div className="flex items-center gap-2">
        <button
          disabled
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-dashboard-surface2 text-dashboard-muted border border-dashboard-border cursor-not-allowed opacity-60"
          title="Authentication wired in Phase 6"
        >
          Sign in to save
        </button>
      </div>
    </header>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-AU');
}
