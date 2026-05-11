import Link from "next/link";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { getXRefreshLogRuns } from "@/lib/x/cache";
import { RefreshLogGroups } from "./refresh-log-groups";

export const dynamic = "force-dynamic";

export default async function RefreshLogPage() {
  const [runs, authors] = await Promise.all([
    getXRefreshLogRuns(30),
    Promise.resolve(getTrackedAuthors()),
  ]);

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X tracker</p>
          <h1>Refresh Log</h1>
          <p className="subtitle">
            Recent feed refreshes by date, account, new tweets, ticker mentions, and X API status.
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/feed">
            X Tracker
          </Link>
          <Link className="nav-btn" href="/">
            Home
          </Link>
          <Link className="nav-btn" href="/watchlist">
            Watchlist
          </Link>
          <Link className="nav-btn" href="/portfolios">
            Portfolios
          </Link>
          <Link className="nav-btn" href="/feed/refresh-log">
            Logs
          </Link>
        </nav>
      </header>

      <RefreshLogGroups authors={authors} runs={runs} />
    </main>
  );
}
