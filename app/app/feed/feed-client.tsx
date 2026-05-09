"use client";

import { useMemo, useState, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import { buildTickerCounts, buildTickerMentionGroups } from "../lib/overlap";
import type { AccountUniqueTickerGroup, AuthorProfile, TickerOverlap, Tweet } from "../lib/types";
import { initialsFromName } from "../lib/accounts";
import { useResizeObserver } from "../lib/use-resize-observer";
import { AddAccountForm } from "./add-account-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "all" | "overlap" | string;
type Filter = "all" | "tickers" | "hot";

type FeedClientProps = {
  authors: readonly AuthorProfile[];
  tweetsByAuthor: Record<string, readonly Tweet[]>;
  lastRefreshTime: string;
  tickerMentionGroups?: ReturnType<typeof buildTickerMentionGroups> | null;
  accountCreationEnabled?: boolean;
};

type RefreshAuditAccount = {
  authorKey: string;
  handle: string;
  newTweetCount: number;
  newTweetIds: string[];
  newTickers: string[];
  status: "updated" | "no_new_tweets" | "failed" | "skipped";
  error?: string;
};

type RefreshAuditSummary = {
  runId: number | null;
  triggeredBy: "button" | "cron" | "unknown";
  totalNewTweets: number;
  accounts: RefreshAuditAccount[];
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

function normalizeTicker(ticker: string) {
  return ticker.trim().replace(/^\$/, "");
}

function getYahooFinanceUrl(ticker: string) {
  const normalized = normalizeTicker(ticker);

  return normalized ? `https://finance.yahoo.com/quote/${encodeURIComponent(normalized)}` : null;
}

function TickerLink({
  ticker,
  children,
  className,
  onClick,
  style,
}: {
  ticker: string;
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  style?: CSSProperties;
}) {
  const href = getYahooFinanceUrl(ticker);

  if (!href) {
    return <span className={className} style={style}>{children ?? ticker}</span>;
  }

  const label = normalizeTicker(ticker);

  return (
    <a
      aria-label={`Open ${label} on Yahoo Finance`}
      className={className}
      href={href}
      onClick={onClick}
      rel="noopener noreferrer"
      style={style}
      target="_blank"
    >
      {children ?? ticker}
    </a>
  );
}

export function FeedClient({
  authors,
  tweetsByAuthor,
  lastRefreshTime: initialLastRefreshTime,
  tickerMentionGroups: initialTickerMentionGroups = null,
  accountCreationEnabled = false,
}: FeedClientProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(initialLastRefreshTime);
  const [refreshAudit, setRefreshAudit] = useState<RefreshAuditSummary | null>(null);
  const [tickerFilter, setTickerFilter] = useState<string | null>(null);

  async function handleRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh/all", {
        method: "POST",
        headers: { "x-refresh-trigger": "button" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { ok?: boolean; lastRefreshTime?: string; audit?: RefreshAuditSummary };
      setRefreshAudit(data.audit ?? null);
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
  const fallbackTickerGroups = useMemo(() => buildTickerMentionGroups(tweetsByAuthor, colorByKey), [tweetsByAuthor, colorByKey]);
  const tickerGroups = initialTickerMentionGroups ?? fallbackTickerGroups;
  const sharedOverlap = tickerGroups.shared;
  const activeAuthor = tab !== "all" && tab !== "overlap" ? tab : null;
  const activeTweets = useMemo(
    () => (activeAuthor ? tweetsByAuthor[activeAuthor] ?? [] : allTweets),
    [activeAuthor, allTweets, tweetsByAuthor],
  );
  const sourceTweets = useMemo(
    () => (activeAuthor ? activeTweets.map((tweet) => ({ ...tweet, who: activeAuthor })) : allTweets),
    [activeAuthor, activeTweets, allTweets],
  );
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
  const activeTickerCounts = useMemo(() => {
    if (!initialTickerMentionGroups) return buildTickerCounts(activeTweets);

    if (!activeAuthor) {
      return Object.fromEntries([
        ...tickerGroups.shared.map((row) => [row.ticker, row.total] as const),
        ...tickerGroups.uniqueByAuthor.flatMap((group) =>
          group.tickers.map((ticker) => [ticker.ticker, ticker.count] as const),
        ),
      ]);
    }

    const counts: Record<string, number> = {};
    for (const row of tickerGroups.shared) {
      const author = row.authors.find((item) => item.who === activeAuthor);
      if (author) counts[row.ticker] = author.count;
    }
    const uniqueGroup = tickerGroups.uniqueByAuthor.find((group) => group.who === activeAuthor);
    for (const ticker of uniqueGroup?.tickers ?? []) {
      counts[ticker.ticker] = ticker.count;
    }
    return counts;
  }, [activeAuthor, activeTweets, initialTickerMentionGroups, tickerGroups]);

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

      {refreshAudit ? <RefreshAuditPanel audit={refreshAudit} authorByKey={authorByKey} /> : null}

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
        <OverlapPanel shared={tickerGroups.shared} uniqueByAuthor={tickerGroups.uniqueByAuthor} colorByKey={colorByKey} authorByKey={authorByKey} authorNames={authorNames} />
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

function RefreshAuditPanel({
  audit,
  authorByKey,
}: {
  audit: RefreshAuditSummary;
  authorByKey: Record<string, AuthorProfile>;
}) {
  const updatedAccounts = audit.accounts.filter((account) => account.newTweetCount > 0);
  const failedAccounts = audit.accounts.filter((account) => account.status === "failed");
  const summary = [
    `${audit.totalNewTweets} new tweet${audit.totalNewTweets === 1 ? "" : "s"}`,
    `${updatedAccounts.length} account${updatedAccounts.length === 1 ? "" : "s"} updated`,
    failedAccounts.length ? `${failedAccounts.length} failed` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="refresh-state" aria-live="polite">
      <strong>Refresh summary</strong>{" "}
      <Link href="/feed/refresh-log">View full log</Link>
      <span>{summary}</span>
      <div className="refresh-audit-list">
        {audit.accounts.map((account) => {
          const author = authorByKey[account.authorKey];
          const label = author?.shortName ?? account.handle;
          const tickers = account.newTickers.length ? ` · ${account.newTickers.join(", ")}` : "";
          const error = account.error ? ` · ${account.error}` : "";

          return (
            <span key={account.authorKey}>
              {label}: {account.newTweetCount} new{tickers}{error}
            </span>
          );
        })}
      </div>
    </section>
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
        <span
          className={`ticker-pill ${selected === ticker ? "active" : ""}`}
          key={ticker}
          style={{ borderColor: "#3a4a6a", color: "#c8d4e3", background: "#101624" }}
        >
          <TickerLink
            className="ticker-symbol-link"
            ticker={ticker}
          />
          <button
            aria-label={`${selected === ticker ? "Clear" : "Filter by"} ${ticker} mentions`}
            className="ticker-filter-count"
            onClick={() => onSelect(selected === ticker ? null : ticker)}
            type="button"
          >
            x{count}
          </button>
        </span>
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
            <TickerLink
              className="cashtag-tag"
              key={`${tweet.id}-${tag}-${index}`}
              onClick={(event) => event.stopPropagation()}
              style={{ borderColor: author.color, color: author.color, background: "#101624" }}
              ticker={tag}
            />
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
  shared,
  uniqueByAuthor,
  colorByKey,
  authorByKey,
  authorNames,
}: {
  shared: TickerOverlap[];
  uniqueByAuthor: AccountUniqueTickerGroup[];
  colorByKey: Record<string, string>;
  authorByKey: Record<string, AuthorProfile>;
  authorNames: Record<string, string>;
}) {
  return (
    <section className="overlap-layout">
      <div className="overlap-card">
        <h2>Shared Ticker Mention Map</h2>
        <p className="subtitle">
          Sorted by total mentions · bubble size reflects mention count
        </p>
        <OverlapSvg shared={shared} authorNames={authorNames} />
        <UniqueTickerTable
          uniqueByAuthor={uniqueByAuthor}
          colorByKey={colorByKey}
          authorByKey={authorByKey}
        />
      </div>
    </section>
  );
}

function UniqueTickerTable({
  uniqueByAuthor,
  colorByKey,
  authorByKey,
}: {
  uniqueByAuthor: AccountUniqueTickerGroup[];
  colorByKey: Record<string, string>;
  authorByKey: Record<string, AuthorProfile>;
}) {
  return (
    <div className="overlap-table" role="table" aria-label="Unique ticker mentions by account">
      <div className="overlap-table-row overlap-table-head unique-ticker-row" role="row">
        <span>Account</span>
        <span>Handle</span>
        <span>Unique tickers</span>
      </div>
      {uniqueByAuthor.map((group) => {
        const profile = authorByKey[group.who];
        const color = colorByKey[group.who] ?? "#94a3b8";
        return (
          <div className="overlap-table-row unique-ticker-row" role="row" key={group.who}>
            <span className="shared-ticker" style={{ color }}>
              {profile ? (
                <Link href={`/feed/accounts/${profile.slug}`}>{profile.shortName}</Link>
              ) : (
                group.who
              )}
            </span>
            <span className="shared-meta">
              {profile ? `@${profile.handle}` : "-"}
            </span>
            <span className="shared-meta">
              {group.tickers.length ? (
                group.tickers.map((ticker) => (
                  <TickerLink
                    className="ticker-pill"
                    key={`${group.who}-${ticker.ticker}`}
                    style={{ borderColor: color, color }}
                    ticker={ticker.ticker}
                  >
                    {ticker.ticker} <span className="count">x{ticker.count}</span>
                  </TickerLink>
                ))
              ) : (
                <span>No unique tickers</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OverlapSvg({ shared, authorNames }: { shared: TickerOverlap[]; authorNames: Record<string, string> }) {
  const [frameRef, frameSize] = useResizeObserver<HTMLDivElement>();
  const width = Math.max(frameSize.width || 720, 320);
  const { height, nodes } = useMemo(() => buildBubbleLayout(shared, authorNames, width), [authorNames, shared, width]);

  return (
    <div className="chart-frame" ref={frameRef}>
      <svg className="bubble-svg" role="img" height={height} viewBox={`0 0 ${width} ${height}`}>
        <title>Shared ticker overlap bubble chart</title>
        {nodes.map((node) => {
          const symbol = node.ticker.replace("$", "");
          const showCountInside = node.radius >= 48;
          const href = getYahooFinanceUrl(node.ticker);
          const bubbleContent = (
            <>
              <title>{node.label}</title>
              <circle
                fill={node.color}
                fillOpacity={node.shared ? 0.92 : 0.78}
                r={node.radius}
                stroke={node.shared ? "#ffd166" : node.color}
                strokeWidth={node.shared ? 3 : 1.5}
              />
              <text
                className="bubble-symbol"
                fill="#08111f"
                fontFamily="monospace"
                fontSize={showCountInside ? 16 : 13}
                fontWeight="900"
                textAnchor="middle"
                y={showCountInside ? -4 : 5}
              >
                {symbol}
              </text>
              {showCountInside ? (
                <text fill="rgba(8,17,31,0.72)" fontSize="11" fontWeight="800" textAnchor="middle" y="17">
                  {node.total} mentions
                </text>
              ) : null}
              {!showCountInside ? (
                <text className="bubble-count-label" textAnchor="middle" y={node.radius + 17}>
                  {node.total} mentions
                </text>
              ) : null}
            </>
          );

          return (
            <g className="bubble-node" key={node.ticker} transform={`translate(${node.x},${node.y})`}>
              {href ? (
                <a
                  aria-label={`Open ${symbol} on Yahoo Finance`}
                  href={href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {bubbleContent}
                </a>
              ) : bubbleContent}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type BubbleNode = TickerOverlap & {
  radius: number;
  x: number;
  y: number;
  label: string;
};

const BUBBLE_MIN_RADIUS = 28;
const BUBBLE_MAX_RADIUS = 60;
const BUBBLE_GAP = 18;
const BUBBLE_TOP_BOTTOM_PADDING = 20;
const BUBBLE_SIDE_PADDING = 8;
const BUBBLE_SMALL_LABEL_HEIGHT = 18;

function buildBubbleLayout(
  shared: TickerOverlap[],
  authorNames: Record<string, string>,
  width: number,
): { height: number; nodes: BubbleNode[] } {
  const sorted = [...shared].sort((a, b) => b.total - a.total || a.ticker.localeCompare(b.ticker));
  const maxMentions = Math.max(...sorted.map((row) => row.total), 1);
  const drawableWidth = Math.max(width - BUBBLE_SIDE_PADDING * 2, BUBBLE_MAX_RADIUS * 2);
  const nodes: BubbleNode[] = sorted.map((row) => ({
    ...row,
    radius: BUBBLE_MIN_RADIUS + Math.sqrt(row.total / maxMentions) * (BUBBLE_MAX_RADIUS - BUBBLE_MIN_RADIUS),
    x: 0,
    y: 0,
    label: `${row.ticker} - ${row.authors.map((author) => `${authorNames[author.who] ?? author.who} ${author.count}x`).join(" | ")}`,
  }));

  let row: BubbleNode[] = [];
  let cursorX = BUBBLE_SIDE_PADDING;
  let cursorY = BUBBLE_TOP_BOTTOM_PADDING;

  function flushRow() {
    if (!row.length) return;

    const rowRadius = Math.max(...row.map((node) => node.radius));
    const rowLabelHeight = row.some((node) => node.radius < 48) ? BUBBLE_SMALL_LABEL_HEIGHT : 0;
    const rowCenterY = cursorY + rowRadius;

    row.forEach((node) => {
      node.y = rowCenterY;
    });

    cursorY += rowRadius * 2 + rowLabelHeight + BUBBLE_GAP;
    row = [];
    cursorX = BUBBLE_SIDE_PADDING;
  }

  nodes.forEach((node) => {
    const diameter = node.radius * 2;
    const nextRight = cursorX + diameter;
    const rowHasSpace = nextRight <= BUBBLE_SIDE_PADDING + drawableWidth;

    if (row.length && !rowHasSpace) {
      flushRow();
    }

    node.x = cursorX + node.radius;
    row.push(node);
    cursorX += diameter + BUBBLE_GAP;
  });

  flushRow();

  const height = nodes.length
    ? Math.ceil(cursorY - BUBBLE_GAP + BUBBLE_TOP_BOTTOM_PADDING)
    : BUBBLE_TOP_BOTTOM_PADDING * 2;

  return { height, nodes };
}
