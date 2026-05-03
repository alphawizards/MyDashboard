import Link from "next/link";
import { notFound } from "next/navigation";
import { buildAccountCompleteTweetMap, initialsFromName } from "@/app/lib/accounts";
import { buildTickerCounts, buildTickerOverlap } from "@/app/lib/overlap";
import { tweetsByAuthor as staticTweetsByAuthor } from "@/app/lib/static-data";
import { getAuthorBySlug, getTrackedAuthors } from "@/lib/accounts/server";
import { fetchAllTweets, isXConfigured } from "@/lib/x/server";

type AccountPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AccountPage({ params }: AccountPageProps) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);

  if (!author) {
    notFound();
  }

  const authors = getTrackedAuthors();
  let tweetsByAuthor = buildAccountCompleteTweetMap(authors, staticTweetsByAuthor);
  let dataSource: "live" | "static" = "static";

  if (isXConfigured()) {
    try {
      const live = await fetchAllTweets();
      const totalLive = Object.values(live).reduce((sum, tweets) => sum + tweets.length, 0);
      if (totalLive > 0) {
        tweetsByAuthor = buildAccountCompleteTweetMap(authors, live);
        dataSource = "live";
      }
    } catch {
      // Keep static fallback.
    }
  }

  const accountTweets = tweetsByAuthor[author.key] ?? [];
  const tickerCounts = buildTickerCounts(accountTweets);
  const colorByKey = Object.fromEntries(authors.map((item) => [item.key, item.color]));
  const overlap = buildTickerOverlap(tweetsByAuthor, colorByKey);
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
            @{author.handle} · {dataSource === "live" ? "Live X data" : "Static fallback"} · {accountTweets.length} tweets
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/feed">
            X Tracker
          </Link>
          <Link className="nav-btn" href="/">
            Home
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
