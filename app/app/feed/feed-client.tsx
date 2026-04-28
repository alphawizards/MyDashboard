"use client";

import { useMemo, useState } from "react";
import { buildTickerCounts, buildTickerOverlap, colorByAuthor } from "../lib/overlap";
import type { AuthorKey, AuthorProfile, TickerOverlap, Tweet } from "../lib/types";
import { useRouter } from "next/navigation";

type Tab = "all" | AuthorKey | "overlap";
type Filter = "all" | "tickers" | "hot";

type FeedClientProps = {
  authors: readonly AuthorProfile[];
  tweetsByAuthor: Record<AuthorKey, readonly Tweet[]>;
  lastRefreshTime: string;
};

const authorNames: Record<AuthorKey, string> = {
  s: "Sikand",
  w: "Wolff",
  a: "Serenity",
  b: "BryzonX",
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

export function FeedClient({ authors, tweetsByAuthor, lastRefreshTime: initialLastRefreshTime }: FeedClientProps) {
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
    () => Object.fromEntries(authors.map((author) => [author.key, author])) as Record<AuthorKey, AuthorProfile>,
    [authors],
  );
  const allTweets = useMemo(
    () =>
      (Object.entries(tweetsByAuthor) as [AuthorKey, readonly Tweet[]][])
        .flatMap(([who, tweets]) => tweets.map((tweet) => ({ ...tweet, who })))
        .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)),
    [tweetsByAuthor],
  );
  const overlap = useMemo(() => buildTickerOverlap(tweetsByAuthor), [tweetsByAuthor]);
  const sharedOverlap = overlap.filter((row) => row.shared);
  const activeAuthor = tab !== "all" && tab !== "overlap" ? tab : null;
  const sourceTweets = activeAuthor
    ? tweetsByAuthor[activeAuthor].map((tweet) => ({ ...tweet, who: activeAuthor }))
    : allTweets;
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
  const activeTickerCounts = buildTickerCounts(activeAuthor ? tweetsByAuthor[activeAuthor] : allTweets);

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
          <article className="author-card" key={author.key} style={{ borderLeftColor: author.color }}>
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar" src={author.avatar} alt="" />
            ) : (
              <div className="avatar-fallback">BX</div>
            )}
            <div className="author-info">
              <h2>{author.name}</h2>
              <div className="handle">@{author.handle}</div>
              <div className="bio">{author.bio}</div>
            </div>
            <div className="author-stats">
              <strong>{author.followers}</strong>
              <span>followers</span>
            </div>
          </article>
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
            {author.shortName} <span className="count">{tweetsByAuthor[author.key].length}</span>
          </button>
        ))}
        <button className={`tab-btn ${tab === "overlap" ? "active" : ""}`} onClick={() => selectTab("overlap")}>
        {'Overlap '}<span className="count">{sharedOverlap.length}</span>
        </button>
      </nav>

      {tab === "overlap" ? (
        <OverlapPanel overlap={overlap} />
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
                  who={tweet.who}
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
  who,
}: {
  author: AuthorProfile;
  tweet: Tweet;
  who: AuthorKey;
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
              style={{ borderColor: colorByAuthor[who], color: colorByAuthor[who], background: "#101624" }}
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

function OverlapPanel({ overlap }: { overlap: TickerOverlap[] }) {
  const shared = overlap.filter((row) => row.shared);

  return (
    <section className="overlap-layout">
      <div className="overlap-card">
        <h2>Ticker Mention Map</h2>
        <p className="subtitle">
          Grouped by account. Gold lane = mentioned by multiple accounts; bubble size = total mentions.
        </p>
        <OverlapSvg overlap={overlap} />
      </div>
      <aside className="overlap-card">
        <h2>Shared Tickers</h2>
        <div className="shared-list">
          {shared.map((row) => (
            <div className="shared-item" key={row.ticker}>
              <div className="shared-ticker">{row.ticker}</div>
              <div className="shared-meta">
                {row.authors.map((author) => (
                  <span key={`${row.ticker}-${author.who}`} style={{ color: colorByAuthor[author.who] }}>
                    {authorNames[author.who]}: {author.count}x
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function OverlapSvg({ overlap }: { overlap: TickerOverlap[] }) {
  const lanes = ["shared", "s", "w", "a", "b"] as const;
  const labels = { shared: "Shared", s: "Sikand", w: "Wolff", a: "Serenity", b: "BryzonX" };
  const width = 1000;
  const height = 540;
  const laneWidth = width / lanes.length;
  const maxCount = Math.max(...overlap.map((row) => row.total), 1);
  const nodes = overlap.map((row, index) => {
    const lane = row.shared ? "shared" : row.authors[0].who;
    const laneIndex = lanes.indexOf(lane);
    const inLaneIndex = overlap.filter((item) => (item.shared ? "shared" : item.authors[0].who) === lane).indexOf(row);
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
