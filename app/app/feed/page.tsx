import Link from "next/link";
import { tweetsByAuthor as staticTweetsByAuthor } from "../lib/static-data";
import { buildAccountCompleteTweetMap } from "../lib/accounts";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { FeedClient } from "./feed-client";
import { fetchAllTweets, isXConfigured } from "@/lib/x/server";

// Revalidate this page at most every 30 minutes in the background.
// The Refresh button forces an immediate revalidation via /api/refresh/all.
export const revalidate = 1800;

export default async function FeedPage() {
  const authorProfiles = getTrackedAuthors();

  // Use live X API data when the bearer token is present; otherwise
  // fall back gracefully to the static snapshot so the page always renders.
  let tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, staticTweetsByAuthor);
  let dataSource: "live" | "static" = "static";
    let lastRefreshTime = 'Not available';

  if (isXConfigured()) {
    try {
      const live = await fetchAllTweets();
      // Only swap to live data if we actually got tweets back
      const totalLive = Object.values(live).reduce((s, arr) => s + arr.length, 0);
      if (totalLive > 0) {
        tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, live);
        dataSource = "live";
    lastRefreshTime = new Date().toLocaleString('en-AU', {    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' AEST';
      }
    } catch {
      // fetchAllTweets failed — keep static fallback silently
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X tracker</p>
          <h1>Sikand Feed</h1>
          <p className="subtitle">
            {dataSource === "live"
              ? `Live feed — ${authorProfiles.length} tracked accounts`
              : `Static prototype port of the local feed with ${authorProfiles.length} tracked accounts.`}
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
      <FeedClient authors={authorProfiles} tweetsByAuthor={tweetsByAuthor} lastRefreshTime={lastRefreshTime}
        accountCreationEnabled={!process.env.REFRESH_SHARED_SECRET} />
    </main>
  );
}
