import Link from "next/link";
import { autopilotPortfolios } from "../lib/static-data";
import { PortfolioTabs } from "./portfolio-tabs";

export default function PortfoliosPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Autopilot portfolios</p>
          <h1>Portfolio Tracker</h1>
          <p className="subtitle">
            Tracks Autopilot portfolios from Michael Sikand and Peter Wolff. Sikand is populated from the
            screenshots; Wolff is ready for the next data drop.
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
          <Link className="nav-btn" href="/feed/refresh-log">
            Logs
          </Link>
        </nav>
      </header>

      <PortfolioTabs portfolios={autopilotPortfolios} />
    </main>
  );
}
