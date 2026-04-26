import Link from "next/link";
import { authors, tweetsByAuthor } from "../lib/static-data";
import { FeedClient } from "./feed-client";

export default function FeedPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X tracker</p>
          <h1>Sikand Feed</h1>
          <p className="subtitle">
            Static prototype port of the local feed with {authors.length} tracked accounts.
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/">
            Home
          </Link>
          <Link className="nav-btn" href="/watchlist">
            Watchlist
          </Link>
          <Link className="nav-btn" href="/portfolios">
            Portfolios
          </Link>
        </nav>
      </header>
      <FeedClient authors={authors} tweetsByAuthor={tweetsByAuthor} />
    </main>
  );
}
