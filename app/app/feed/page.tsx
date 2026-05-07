import Link from "next/link";
import { tweetsByAuthor as staticTweetsByAuthor } from "../lib/static-data";
import { buildAccountCompleteTweetMap } from "../lib/accounts";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { FeedClient } from "./feed-client";
import { getCachedTweetsByAuthor } from "@/lib/x/cache";

// Revalidate this page at most every 30 minutes in the background.
// The Refresh button forces an immediate revalidation via /api/refresh/all.
export const revalidate = 1800;

export default async function FeedPage() {
  const authorProfiles = getTrackedAuthors();
  let tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, staticTweetsByAuthor);
  let dataSource: "cached" | "static" = "static";
  let lastRefreshTime = "Not available";

  const cached = await getCachedTweetsByAuthor(authorProfiles);
  const totalCached = cached ? Object.values(cached).reduce((sum, tweets) => sum + tweets.length, 0) : 0;
  if (cached && totalCached > 0) {
    tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, cached);
    dataSource = "cached";
    lastRefreshTime = `${new Date().toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      dateStyle: "medium",
      timeStyle: "short",
    })} AEST`;
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X tracker</p>
          <h1>Sikand Feed</h1>
          <p className="subtitle">
            {dataSource === "cached"
              ? `Cached X feed - ${authorProfiles.length} tracked accounts`
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
      <FeedClient
        authors={authorProfiles}
        tweetsByAuthor={tweetsByAuthor}
        lastRefreshTime={lastRefreshTime}
        accountCreationEnabled={!process.env.REFRESH_SHARED_SECRET}
      />
    </main>
  );
}
