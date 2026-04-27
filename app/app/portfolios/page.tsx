import Link from "next/link";
import { autopilotPortfolios } from "../lib/static-data";
import { PortfolioTabs } from "./portfolio-tabs";

export default function PortfoliosPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tracked account portfolios</p>
          <h1>Portfolio Tracker</h1>
          <p className="subtitle">
            Tracks known holdings and watchlists from the X accounts followed on this dashboard.
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/">
            Home
          </Link>
          <Link className="nav-btn" href="/watchlist">
            Watchlist
          </Link>
          <Link className="nav-btn" href="/feed">
            X Tracker
          </Link>
        </nav>
      </header>

      <PortfolioTabs portfolios={autopilotPortfolios} />
    </main>
  );
}
