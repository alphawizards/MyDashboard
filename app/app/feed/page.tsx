import Link from "next/link";
import { tweetsByAuthor as staticTweetsByAuthor } from "../lib/static-data";
import { buildAccountCompleteTweetMap } from "../lib/accounts";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { FeedClient } from "./feed-client";
import { getCachedTweetsByAuthor, getLastXRefreshTime, getTickerMentionGroupsFromDb } from "@/lib/x/cache";

// Revalidate this page at most every 30 minutes in the background.
// The Refresh button forces an immediate revalidation via /api/refresh/all.
export const revalidate = 1800;

export default async function FeedPage() {
  const authorProfiles = getTrackedAuthors();
  let tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, staticTweetsByAuthor);
  let dataSource: "cached" | "static" = "static";
  let lastRefreshTime = "Not available";
  let tickerMentionGroups = null;

  const [cached, cachedLastRefreshTime, cachedMentionGroups] = await Promise.all([
    getCachedTweetsByAuthor(authorProfiles),
    getLastXRefreshTime(authorProfiles),
    getTickerMentionGroupsFromDb(authorProfiles),
  ]);
  const totalCached = cached ? Object.values(cached).reduce((sum, tweets) => sum + tweets.length, 0) : 0;
  if (cached && totalCached > 0) {
    tweetsByAuthor = buildAccountCompleteTweetMap(authorProfiles, cached);
    dataSource = "cached";
  }
  if (cachedLastRefreshTime) {
    lastRefreshTime = `${new Date(cachedLastRefreshTime).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      dateStyle: "medium",
      timeStyle: "short",
    })} AEST`;
  }
  if (cachedMentionGroups && (cachedMentionGroups.shared.length || cachedMentionGroups.uniqueByAuthor.some((group) => group.tickers.length))) {
    tickerMentionGroups = cachedMentionGroups;
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
        tickerMentionGroups={tickerMentionGroups}
        accountCreationEnabled={!process.env.REFRESH_SHARED_SECRET}
      />
    </main>
  );
}
