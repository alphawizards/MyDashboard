import Link from "next/link";
import { authors, autopilotPortfolios, lastRefresh, stocks, tweetsByAuthor } from "./lib/static-data";
import { buildTickerOverlap } from "./lib/overlap";

export default function Home() {
  const tweetCount = Object.values(tweetsByAuthor).reduce(
    (sum, tweets) => sum + tweets.length,
    0,
  );
  const colorByKey = Object.fromEntries(authors.map((a) => [a.key, a.color]));
  const overlapCount = buildTickerOverlap(tweetsByAuthor, colorByKey).filter((row) => row.shared).length;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Local prototype</p>
          <h1>Morning Stock Dashboard</h1>
          <p className="subtitle">
            Static-data web prototype matching the local HTML dashboards. Last refresh:{" "}
            {lastRefresh}.
          </p>
        </div>
      </header>

      <section className="home-grid">
        <Link className="home-card" href="/watchlist">
          <span className="home-card-kicker">Watchlist</span>
          <strong>{stocks.length} tickers</strong>
          <span>Prices, catalysts, performance, Polymarket, and Farside sections.</span>
        </Link>
        <Link className="home-card" href="/feed">
          <span className="home-card-kicker">X Tracker</span>
          <strong>{tweetCount} tweets</strong>
          <span>
            {authors.length} accounts with ticker filters and {overlapCount} shared ticker
            overlaps.
          </span>
        </Link>
        <Link className="home-card" href="/portfolios">
          <span className="home-card-kicker">Autopilot Portfolios</span>
          <strong>{autopilotPortfolios.length} tabs</strong>
          <span>Track Sikand&apos;s Asymmetric Bets now, with Wolff ready for the next screenshots.</span>
        </Link>
      </section>
    </main>
  );
}
