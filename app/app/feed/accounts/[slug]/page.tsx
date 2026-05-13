import Link from "next/link";
import { notFound } from "next/navigation";
import { buildAccountCompleteTweetMap, initialsFromName } from "@/app/lib/accounts";
import { buildTickerCounts, buildTickerOverlap } from "@/app/lib/overlap";
import { tweetsByAuthor as staticTweetsByAuthor } from "@/app/lib/static-data";
import { getAuthorBySlug, getTrackedAuthors } from "@/lib/accounts/server";
import { getAccountTickerCountsFromDb, getCachedTweetsByAuthor, getTickerMentionGroupsFromDb } from "@/lib/x/cache";
import {
  getAccountTickerPerformanceRows,
  getAccountTickerPerformanceRowsFromCounts,
  type AccountTickerPerformanceRow,
} from "@/lib/stocks/account-tracker";

type AccountPageProps = {
  params: Promise<{ slug: string }>;
};

function compareTweetIdsAsc(a: { id: string }, b: { id: string }): number {
  try {
    const left = BigInt(a.id);
    const right = BigInt(b.id);
    return left < right ? -1 : left > right ? 1 : 0;
  } catch {
    return a.id.localeCompare(b.id);
  }
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);

  if (!author) {
    notFound();
  }

  const authors = getTrackedAuthors();
  let tweetsByAuthor = buildAccountCompleteTweetMap(authors, staticTweetsByAuthor);
  let dataSource: "cached" | "static" = "static";

  const [cached, cachedTickerCounts, cachedMentionGroups] = await Promise.all([
    getCachedTweetsByAuthor(authors),
    getAccountTickerCountsFromDb(author.key),
    getTickerMentionGroupsFromDb(authors),
  ]);
  const totalCached = cached ? Object.values(cached).reduce((sum, tweets) => sum + tweets.length, 0) : 0;
  if (cached && totalCached > 0) {
    tweetsByAuthor = buildAccountCompleteTweetMap(authors, cached);
    dataSource = "cached";
  }

  const accountTweets = [...(tweetsByAuthor[author.key] ?? [])].sort(compareTweetIdsAsc);
  const tickerCounts = cachedTickerCounts && Object.keys(cachedTickerCounts).length
    ? cachedTickerCounts
    : buildTickerCounts(accountTweets);
  const tickerPerformanceRows = cachedTickerCounts && Object.keys(cachedTickerCounts).length
    ? await getAccountTickerPerformanceRowsFromCounts(cachedTickerCounts)
    : await getAccountTickerPerformanceRows(accountTweets);
  const colorByKey = Object.fromEntries(authors.map((item) => [item.key, item.color]));
  const hasCachedMentionGroups =
    cachedMentionGroups &&
    (cachedMentionGroups.shared.length || cachedMentionGroups.uniqueByAuthor.some((group) => group.tickers.length));
  const overlap = hasCachedMentionGroups
    ? [
        ...cachedMentionGroups.shared,
        ...cachedMentionGroups.uniqueByAuthor.flatMap((group) =>
          group.tickers.map((ticker) => ({
            ticker: ticker.ticker,
            authors: [{ who: ticker.who, count: ticker.count }],
            total: ticker.count,
            shared: false,
            color: ticker.color,
          })),
        ),
      ]
    : buildTickerOverlap(tweetsByAuthor, colorByKey);
  const sharedForAccount = overlap.filter((row) =>
    row.shared && row.authors.some((item) => item.who === author.key),
  );
  const authorByKey = Object.fromEntries(authors.map((item) => [item.key, item]));

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X account</p>
          <h1>{author.name}</h1>
          <p className="subtitle">
            @{author.handle} - {dataSource === "cached" ? "Cached X data" : "Static fallback"} - {accountTweets.length} tweets
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/feed">
            X Tracker
          </Link>
          <Link className="nav-btn" href="/">
            Home
          </Link>
          <Link className="nav-btn" href="/feed/refresh-log">
            Logs
          </Link>
        </nav>
      </header>

      <section className="account-profile" style={{ borderLeftColor: author.color }}>
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="account-avatar" src={author.avatar} alt="" />
        ) : (
          <div className="account-avatar account-avatar-fallback">{initialsFromName(author.name)}</div>
        )}
        <div className="account-profile-main">
          <h2>{author.name}</h2>
          <a href={`https://x.com/${author.handle}`} rel="noopener noreferrer" target="_blank">
            @{author.handle}
          </a>
          <p>{author.bio || "No profile bio captured yet."}</p>
        </div>
        <div className="account-metrics">
          <span>
            <strong>{author.platform ?? "X"}</strong>
            <small>platform</small>
          </span>
          <span>
            <strong>{author.winRate === undefined ? "-" : `${author.winRate}%`}</strong>
            <small>win rate</small>
          </span>
          <span>
            <strong>{author.shadowScore ?? "-"}</strong>
            <small>shadow</small>
          </span>
          <span>
            <strong>{author.followers}</strong>
            <small>followers</small>
          </span>
        </div>
      </section>

      <TickerPerformanceTable rows={tickerPerformanceRows} accountName={author.name} />

      <section className="account-layout">
        <div className="account-panel">
          <h2>Ticker Mentions</h2>
          {Object.keys(tickerCounts).length ? (
            <div className="ticker-bar account-tickers">
              {Object.entries(tickerCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([ticker, count]) => (
                  <span className="ticker-pill" key={ticker} style={{ borderColor: author.color, color: author.color }}>
                    {ticker} <span className="count">x{count}</span>
                  </span>
                ))}
            </div>
          ) : (
            <p className="empty-copy">No ticker mentions captured yet.</p>
          )}
        </div>

        <div className="account-panel">
          <h2>Shared Overlap</h2>
          {sharedForAccount.length ? (
            <div className="shared-list">
              {sharedForAccount.map((row) => (
                <div className="shared-item" key={row.ticker}>
                  <div className="shared-ticker">{row.ticker}</div>
                  <div className="shared-meta">
                    {row.authors.map((item) => {
                      const peer = authorByKey[item.who];
                      return peer ? (
                        <Link href={`/feed/accounts/${peer.slug}`} key={`${row.ticker}-${item.who}`} style={{ color: peer.color }}>
                          {peer.shortName}: {item.count}x
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No shared ticker overlap yet.</p>
          )}
        </div>
      </section>

      <section className="tweet-grid" aria-label={`${author.name} tweets`}>
        {accountTweets.length ? (
          accountTweets.map((tweet) => (
            <article className={`tweet-card ${tweet.cashtags.length ? "has-ticker" : ""}`} key={tweet.id} style={{ borderLeftColor: author.color }}>
              <div className="tweet-meta">
                <span className="author-badge" style={{ borderColor: author.color, color: author.color, background: "#101624" }}>
                  {author.shortName}
                </span>
                <span className="tweet-time">{tweet.created_at}</span>
              </div>
              <div className="tweet-text">{tweet.text}</div>
              {tweet.cashtags.length ? (
                <div className="tweet-cashtags">
                  {tweet.cashtags.map((tag, index) => (
                    <span className="cashtag-tag" key={`${tweet.id}-${tag}-${index}`} style={{ borderColor: author.color, color: author.color }}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="tweet-footer">
                <a className="tweet-link" href={tweet.url} rel="noopener noreferrer" target="_blank">
                  View on X
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">No tweets captured for this account yet.</div>
        )}
      </section>
    </main>
  );
}

function TickerPerformanceTable({
  rows,
  accountName,
}: {
  rows: readonly AccountTickerPerformanceRow[];
  accountName: string;
}) {
  return (
    <section className="ticker-performance-panel" aria-label={`${accountName} stock pick tracker`}>
      <div className="ticker-performance-title">
        <h2>Stock Pick Tracker</h2>
        <span>{rows.length} tickers</span>
      </div>
      {rows.length ? (
        <div className="ticker-performance-table" role="table">
          <div className="ticker-performance-row ticker-performance-head" role="row">
            <span>Ticker</span>
            <span>Company</span>
            <span>Theme</span>
            <span>1M %</span>
            <span>12M %</span>
            <span>Mentions</span>
          </div>
          {rows.map((row) => (
            <div className="ticker-performance-row" role="row" key={row.ticker}>
              <a
                aria-label={`Open ${row.ticker} on Yahoo Finance`}
                className="ticker-performance-symbol"
                href={row.yahooUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {row.ticker}
              </a>
              <span>{row.company}</span>
              <span>{row.theme}</span>
              <PerformanceCell value={row.perf1M} />
              <PerformanceCell value={row.perf12M} />
              <span>{row.mentions}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-copy">No ticker performance rows available yet.</p>
      )}
    </section>
  );
}

function PerformanceCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="zero">-</span>;
  }

  const className = value > 0 ? "pos" : value < 0 ? "neg" : "zero";
  const sign = value > 0 ? "+" : "";

  return <span className={className}>{sign}{value.toFixed(1)}%</span>;
}
