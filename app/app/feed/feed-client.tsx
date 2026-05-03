"use client";

import { useMemo, useState } from "react";
import { buildTickerCounts, buildTickerOverlap } from "../lib/overlap";
import type { AuthorProfile, TickerOverlap, Tweet } from "../lib/types";
import { initialsFromName } from "../lib/accounts";
import { AddAccountForm } from "./add-account-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "all" | "overlap" | string;
type Filter = "all" | "tickers" | "hot";

type FeedClientProps = {
  authors: readonly AuthorProfile[];
  tweetsByAuthor: Record<string, readonly Tweet[]>;
  lastRefreshTime: string;
  accountCreationEnabled?: boolean;
};

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isHot(tweet: Tweet) {
  return tweet.likes >= 50 || tweet.retweets >= 5;
}

function safeOpen(url: string) {
  try {
    const parsed = new URL(url);
    if (!["https://x.com", "https://twitter.com", "https://finance.yahoo.com"].includes(parsed.origin)) {
      return;
    }
    window.open(parsed.href, "_blank", "noopener,noreferrer");
  } catch {
    // ignore invalid URLs
  }
}

function formatRefreshTime(timestamp: string) {
  return `${new Date(timestamp).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  })} AEST`;
}

export function FeedClient({ authors, tweetsByAuthor, lastRefreshTime: initialLastRefreshTime, accountCreationEnabled = false }: FeedClientProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(initialLastRefreshTime);
  const [tickerFilter, setTickerFilter] = useState<string | null>(null);

  async function handleRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh/all", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { ok?: boolean; lastRefreshTime?: string };
      if (data.ok && data.lastRefreshTime) {
        setLastRefreshTime(formatRefreshTime(data.lastRefreshTime));
        router.refresh();
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }
  const authorByKey = useMemo(
    () => Object.fromEntries(authors.map((author) => [author.key, author])) as Record<string, AuthorProfile>,
    [authors],
  );
  const colorByKey = useMemo(
    () => Object.fromEntries(authors.map((a) => [a.key, a.color])) as Record<string, string>,
    [authors],
  );
  const authorNames = useMemo(
    () => Object.fromEntries(authors.map((a) => [a.key, a.shortName])) as Record<string, string>,
    [authors],
  );
  const allTweets = useMemo(
    () =>
      (Object.entries(tweetsByAuthor) as [string, readonly Tweet[]][])
        .flatMap(([who, tweets]) => tweets.map((tweet) => ({ ...tweet, who })))
        .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)),
    [tweetsByAuthor],
  );
  const overlap = useMemo(() => buildTickerOverlap(tweetsByAuthor, colorByKey), [tweetsByAuthor, colorByKey]);
  const sharedOverlap = overlap.filter((row) => row.shared);
  const activeAuthor = tab !== "all" && tab !== "overlap" ? tab : null;
  const activeTweets = activeAuthor ? tweetsByAuthor[activeAuthor] ?? [] : allTweets;
  const sourceTweets = activeAuthor ? activeTweets.map((tweet) => ({ ...tweet, who: activeAuthor })) : allTweets;
  const visibleTweets = sourceTweets.filter((tweet) => {
    const q = search.trim().toLowerCase();
    if (filter === "tickers" && tweet.cashtags.length === 0) return false;
    if (filter === "hot" && !isHot(tweet)) return false;
    if (tickerFilter && !tweet.cashtags.includes(tickerFilter)) return false;
    if (q && !tweet.text.toLowerCase().includes(q) && !tweet.cashtags.some((tag) => tag.toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });
  const activeTickerCounts = buildTickerCounts(activeTweets);

  function selectTab(next: Tab) {
    setTab(next);
    setFilter("all");
    setSearch("");
    setTickerFilter(null);
  }

  return (
    <>
      <section className="authors-bar" aria-label="Tracked X accounts">
        {authors.map((author) => (
          <Link className="author-card" href={`/feed/accounts/${author.slug}`} key={author.key} style={{ borderLeftColor: author.color }}>
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar" src={author.avatar} alt="" />
            ) : (
              <div className="avatar-fallback">{initialsFromName(author.name)}</div>
            )}
            <div className="author-info">
              <h2>{author.name}</h2>
              <div className="handle">@{author.handle}</div>
              <div className="bio">{author.bio}</div>
            </div>
            <div className="author-stats">
              <strong>{author.shadowScore ?? author.followers}</strong>
              <span>{author.shadowScore === undefined ? "followers" : "shadow"}</span>
            </div>
          </Link>
        ))}
      </section>

      <div
        className="refresh-bar"
        style={{ display: "flex", gap: "12px", alignItems: "center", margin: "8px 0" }}
      >
        <button
          type="button"
          className="filter-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh Feed"}
        </button>
        <span style={{ color: "#8a99b3", fontSize: "0.85rem" }}>
          Last updated: {lastRefreshTime ?? "Not available"}
        </span>
      </div>

      {accountCreationEnabled && <AddAccountForm />}

      <AnalystTable authors={authors} tweetsByAuthor={tweetsByAuthor} />

      <nav className="tab-bar" aria-label="Feed tabs">
        <button className={`tab-btn ${tab === "all" ? "active" : ""}`} onClick={() => selectTab("all")}>
        {'All Feed '}<span className="count">{allTweets.length}</span>
        </button>
        {authors.map((author) => (
          <button
            className={`tab-btn ${tab === author.key ? "active" : ""}`}
            key={author.key}
            onClick={() => selectTab(author.key)}
          >
            {author.shortName} <span className="count">{tweetsByAuthor[author.key]?.length ?? 0}</span>
          </button>
        ))}
        <button className={`tab-btn ${tab === "overlap" ? "active" : ""}`} onClick={() => selectTab("overlap")}>
        {'Overlap '}<span className="count">{sharedOverlap.length}</span>
        </button>
      </nav>

      {tab === "overlap" ? (
        <OverlapPanel overlap={overlap} colorByKey={colorByKey} authorByKey={authorByKey} authorNames={authorNames} />
      ) : (
        <>
          <div className="filter-bar">
            <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            {'All'}
            </button>
            <button
              className={`filter-btn ${filter === "tickers" ? "active" : ""}`}
              onClick={() => setFilter("tickers")}
            >
              {'Stock Mentions'}
            </button>
            <button className={`filter-btn ${filter === "hot" ? "active" : ""}`} onClick={() => setFilter("hot")}>
        {'Hot'}            </button>
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search or $TICKER..."
            />
          </div>

          <TickerBar counts={activeTickerCounts} selected={tickerFilter} onSelect={setTickerFilter} />
          <section className="tweet-grid" aria-label="Tweets">
            {visibleTweets.length ? (
              visibleTweets.map((tweet) => (
                <TweetCard
                  author={authorByKey[tweet.who]}
                  key={`${tweet.who}-${tweet.id}`}
                  tweet={tweet}
                />
              ))
            ) : (
              <div className="empty-state">No tweets match your filter.</div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function AnalystTable({
  authors,
  tweetsByAuthor,
}: {
  authors: readonly AuthorProfile[];
  tweetsByAuthor: Record<string, readonly Tweet[]>;
}) {
  const rankedAuthors = [...authors].sort(
    (a, b) =>
      (b.shadowScore ?? -1) - (a.shadowScore ?? -1) ||
      (b.winRate ?? -1) - (a.winRate ?? -1) ||
      a.name.localeCompare(b.name),
  );

  return (
    <section className="analyst-panel" aria-label="Ranked X analysts">
      <div className="analyst-header">
        <span>Analyst</span>
        <span>Platform</span>
        <span>Win Rate</span>
        <span>Shadow Score</span>
        <span>Tweets</span>
      </div>
      {rankedAuthors.map((author) => (
        <Link className="analyst-row" href={`/feed/accounts/${author.slug}`} key={author.key}>
          <span className="analyst-name-cell">
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="analyst-avatar" src={author.avatar} alt="" />
            ) : (
              <span className="analyst-avatar analyst-avatar-fallback">{initialsFromName(author.name)}</span>
            )}
            <span>
              <strong>{author.name}</strong>
              <small>@{author.handle}</small>
            </span>
          </span>
          <span>{author.platform ?? "X"}</span>
          <span>{author.winRate === undefined ? "-" : `${author.winRate}%`}</span>
          <span className="shadow-score">{author.shadowScore ?? "-"}</span>
          <span>{tweetsByAuthor[author.key]?.length ?? 0}</span>
        </Link>
      ))}
    </section>
  );
}

function TickerBar({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (ticker: string | null) => void;
}) {
  const tickers = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!tickers.length) return null;

  return (
    <div className="ticker-bar">
      <span className="bar-label">Tickers</span>
      {tickers.map(([ticker, count]) => (
        <button
          className={`ticker-pill ${selected === ticker ? "active" : ""}`}
          key={ticker}
          onClick={() => onSelect(selected === ticker ? null : ticker)}
          style={{ borderColor: "#3a4a6a", color: "#c8d4e3", background: "#101624" }}
        >
          {ticker} <span className="count">x{count}</span>
        </button>
      ))}
    </div>
  );
}

function TweetCard({
  author,
  tweet,
}: {
  author: AuthorProfile;
  tweet: Tweet;
}) {
  const hot = tweet.likes >= 100 || tweet.retweets >= 10;
  const hasTicker = tweet.cashtags.length > 0;

  return (
    <article
      className={`tweet-card ${hot ? "hot" : ""} ${hasTicker ? "has-ticker" : ""}`}
      onClick={() => safeOpen(tweet.url)}
      style={{ borderLeftColor: hasTicker ? author.color : undefined }}
    >
      <div className="tweet-meta">
        <div>
          <span
            className="author-badge"
            style={{ borderColor: author.color, color: author.color, background: "#101624" }}
          >
            {author.shortName}
          </span>{" "}
          <span className="tweet-time">{tweet.created_at}</span>
        </div>
        <div className="eng-row">
          <span>♥ {tweet.likes.toLocaleString()}</span>
          <span>↻ {tweet.retweets}</span>
          <span>💬 {tweet.replies}</span>
        </div>
      </div>
      <div className="tweet-text">{decodeEntities(tweet.text)}</div>
      {tweet.cashtags.length ? (
        <div className="tweet-cashtags">
          {tweet.cashtags.map((tag, index) => (
            <span
              className="cashtag-tag"
              key={`${tweet.id}-${tag}-${index}`}
              style={{ borderColor: author.color, color: author.color, background: "#101624" }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="tweet-footer">
        <a
          className="tweet-link"
          href={tweet.url}
          rel="noopener noreferrer"
          target="_blank"
          onClick={(event) => event.stopPropagation()}
        >
          View on X ↗
        </a>
      </div>
    </article>
  );
}

function OverlapPanel({
  overlap,
  colorByKey,
  authorByKey,
  authorNames,
}: {
  overlap: TickerOverlap[];
  colorByKey: Record<string, string>;
  authorByKey: Record<string, AuthorProfile>;
  authorNames: Record<string, string>;
}) {
  const shared = overlap.filter((row) => row.shared);
  const tableRows = overlap.slice(0, 24);

  return (
    <section className="overlap-layout">
      <div className="overlap-card">
        <h2>Ticker Mention Map</h2>
        <p className="subtitle">
          Top shared tickers stay in the chart; the table keeps the full account set readable.
        </p>
        <OverlapSvg overlap={overlap} authorNames={authorNames} />
        <div className="overlap-table" role="table" aria-label="Ticker overlap details">
          <div className="overlap-table-row overlap-table-head" role="row">
            <span>Ticker</span>
            <span>Total</span>
            <span>Accounts</span>
          </div>
          {tableRows.map((row) => (
            <div className="overlap-table-row" role="row" key={row.ticker}>
              <span className="shared-ticker">{row.ticker}</span>
              <span>{row.total}</span>
              <span className="shared-meta">
                {row.authors.map((author) => {
                  const profile = authorByKey[author.who];
                  const label = authorNames[author.who] ?? author.who;
                  return profile ? (
                    <Link key={`${row.ticker}-${author.who}`} href={`/feed/accounts/${profile.slug}`} style={{ color: colorByKey[author.who] ?? "#94a3b8" }}>
                      {label}: {author.count}x
                    </Link>
                  ) : (
                    <span key={`${row.ticker}-${author.who}`} style={{ color: colorByKey[author.who] ?? "#94a3b8" }}>
                      {label}: {author.count}x
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
      <aside className="overlap-card">
        <h2>Shared Tickers</h2>
        <div className="shared-list">
          {shared.map((row) => (
            <div className="shared-item" key={row.ticker}>
              <div className="shared-ticker">{row.ticker}</div>
              <div className="shared-meta">
                {row.authors.map((author) => {
                  const profile = authorByKey[author.who];
                  const label = authorNames[author.who] ?? author.who;
                  return profile ? (
                    <Link key={`${row.ticker}-${author.who}`} href={`/feed/accounts/${profile.slug}`} style={{ color: colorByKey[author.who] ?? "#94a3b8" }}>
                      {label}: {author.count}x
                    </Link>
                  ) : (
                    <span key={`${row.ticker}-${author.who}`} style={{ color: colorByKey[author.who] ?? "#94a3b8" }}>
                      {label}: {author.count}x
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function OverlapSvg({ overlap, authorNames }: { overlap: TickerOverlap[]; authorNames: Record<string, string> }) {
  const chartRows = overlap.filter((row) => row.shared).slice(0, 18);
  const activeAuthorKeys = Array.from(
    new Set(chartRows.flatMap((row) => row.authors.map((author) => author.who))),
  );
  const lanes = ["shared", ...activeAuthorKeys.slice(0, 8)];
  const labels: Record<string, string> = { shared: "Shared", ...authorNames };
  const width = 1000;
  const height = 540;
  const laneWidth = width / lanes.length;
  const maxCount = Math.max(...chartRows.map((row) => row.total), 1);
  const nodes = chartRows.map((row, index) => {
    const lane = row.shared ? "shared" : row.authors[0].who;
    const laneIndex = lanes.indexOf(lane);
    const inLaneIndex = chartRows.filter((item) => (item.shared ? "shared" : item.authors[0].who) === lane).indexOf(row);
    const radius = Math.max(25, Math.sqrt(row.total / maxCount) * 54);
    const x = laneIndex * laneWidth + laneWidth / 2 + ((inLaneIndex % 2) - 0.5) * Math.min(40, radius);
    const y = 118 + Math.floor(inLaneIndex / 2) * 92 + (index % 3) * 7;
    return { ...row, lane, radius, x, y: Math.min(y, height - radius - 20) };
  });

  return (
    <svg className="bubble-svg" role="img" viewBox={`0 0 ${width} ${height}`}>
      <title>Ticker overlap bubble chart</title>
      {lanes.map((lane, index) => (
        <g key={lane}>
          <rect className="bubble-lane-bg" x={index * laneWidth + 10} y={48} width={laneWidth - 20} height={470} rx={10} />
          <text className="bubble-lane-label" textAnchor="middle" x={index * laneWidth + laneWidth / 2} y={28}>
            {labels[lane]} ({nodes.filter((node) => node.lane === lane).length})
          </text>
        </g>
      ))}
      {nodes.map((node) => {
        const symbol = node.ticker.replace("$", "");
        const title = `${node.ticker} - ${node.authors.map((author) => `${authorNames[author.who]} ${author.count}x`).join(" | ")}`;
        return (
          <g key={node.ticker} transform={`translate(${node.x},${node.y})`}>
            <title>{title}</title>
            <circle
              fill={node.color}
              fillOpacity={node.shared ? 0.92 : 0.78}
              r={node.radius}
              stroke={node.shared ? "#ffd166" : node.color}
              strokeWidth={node.shared ? 3 : 1.5}
            />
            <text
              fill="#08111f"
              fontFamily="monospace"
              fontSize={node.radius > 42 ? 15 : 12}
              fontWeight="900"
              textAnchor="middle"
              y={node.total > 1 ? -2 : 5}
            >
              {symbol}
            </text>
            {node.total > 1 ? (
              <text fill="rgba(8,17,31,0.7)" fontSize="10" fontWeight="800" textAnchor="middle" y="16">
                {node.total} mentions
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
