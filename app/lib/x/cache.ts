import "server-only";
import type { AuthorProfile, TickerMentionGroups, TickerOverlap, Tweet } from "@/app/lib/types";
import { queryRows } from "@/lib/db/postgres";

export type CacheableTweet = Tweet & {
  postedAtIso?: string;
};

export type CachedAccountRow = {
  key: string;
  author_id: string | null;
  last_tweet_id: string | null;
};

export type XRefreshTrigger = "button" | "cron" | "unknown";

export type XAccountRefreshLogEvent = {
  authorKey: string;
  handle: string;
  previousLastTweetId: string | null;
  newLastTweetId: string | null;
  newTweetCount: number;
  newTweetIds: string[];
  newTickers: string[];
  status: "updated" | "no_new_tweets" | "failed" | "skipped";
  error?: string;
};

export type XRefreshAuditSummary = {
  runId: number | null;
  triggeredBy: XRefreshTrigger;
  totalNewTweets: number;
  accounts: XAccountRefreshLogEvent[];
};

type TweetRow = {
  author_key: string;
  id: string;
  text: string;
  posted_at: string;
  url: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  cashtags: string[] | string | null;
};

type TickerMentionCountRow = {
  author_key: string;
  ticker: string;
  count: string | number;
};

type LastRefreshRow = {
  last_refreshed_at: string | null;
};

type CreatedRefreshRunRow = {
  id: string | number;
};

function formatDate(iso: string): string {
  return `${new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} AEST`;
}

export function normalizeTickerMention(ticker: string): string {
  return ticker.trim().replace(/^\$/, "").toUpperCase();
}

function uniqueNormalizedCashtags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeTickerMention).filter(Boolean))];
}

function normalizeCashtags(value: TweetRow["cashtags"]): string[] {
  if (Array.isArray(value)) return uniqueNormalizedCashtags(value.map(String));
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? uniqueNormalizedCashtags(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

function toNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildMentionGroups(
  rows: readonly TickerMentionCountRow[],
  authors: readonly AuthorProfile[],
): TickerMentionGroups {
  const colorByKey = Object.fromEntries(authors.map((author) => [author.key, author.color])) as Record<string, string>;
  const countsByWho: Record<string, Record<string, number>> = Object.fromEntries(
    authors.map((author) => [author.key, {}]),
  );

  for (const row of rows) {
    countsByWho[row.author_key] ??= {};
    countsByWho[row.author_key][row.ticker] = toNumber(row.count);
  }

  const allTickers = new Set(Object.values(countsByWho).flatMap((counts) => Object.keys(counts)));
  const classified: TickerOverlap[] = [...allTickers].map((ticker) => {
    const tickerAuthors = Object.entries(countsByWho)
      .filter(([, counts]) => counts[ticker])
      .map(([who, counts]) => ({ who, count: counts[ticker] }));
    const total = tickerAuthors.reduce((sum, author) => sum + author.count, 0);
    const shared = tickerAuthors.length > 1;

    return {
      ticker,
      authors: tickerAuthors,
      total,
      shared,
      color: shared ? "#f59e0b" : colorByKey[tickerAuthors[0]?.who] ?? "#94a3b8",
    };
  });

  return {
    shared: classified
      .filter((row) => row.shared)
      .sort(
        (a, b) =>
          b.authors.length - a.authors.length ||
          b.total - a.total ||
          a.ticker.localeCompare(b.ticker),
      ),
    uniqueByAuthor: authors.map((author) => ({
      who: author.key,
      tickers: classified
        .filter((row) => !row.shared && row.authors[0]?.who === author.key)
        .map((row) => ({
          ticker: row.ticker,
          who: author.key,
          count: row.total,
          color: colorByKey[author.key] ?? "#94a3b8",
        }))
        .sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker)),
    })),
  };
}

export async function getCachedTweetsByAuthor(
  authors: readonly AuthorProfile[],
): Promise<Record<string, Tweet[]> | null> {
  const keys = authors.map((author) => author.key);
  if (!keys.length) return {};

  try {
    const rows = await queryRows<TweetRow>(
      `
        select author_key, id, text, posted_at, url, like_count, retweet_count, reply_count, cashtags
        from tweets
        where author_key = any($1::text[])
        order by posted_at desc, id desc
      `,
      [keys],
    );

    if (!rows) return null;

    const grouped: Record<string, Tweet[]> = Object.fromEntries(keys.map((key) => [key, []]));
    for (const row of rows) {
      if (!grouped[row.author_key]) grouped[row.author_key] = [];
      grouped[row.author_key].push({
        id: row.id,
        text: row.text,
        created_at: formatDate(row.posted_at),
        likes: row.like_count,
        retweets: row.retweet_count,
        replies: row.reply_count,
        cashtags: normalizeCashtags(row.cashtags),
        url: row.url,
      });
    }

    return grouped;
  } catch {
    return null;
  }
}

export async function getLastXRefreshTime(authors: readonly AuthorProfile[]): Promise<string | null> {
  const keys = authors.map((author) => author.key);
  if (!keys.length) return null;

  try {
    const rows = await queryRows<LastRefreshRow>(
      `
        select max(last_refreshed_at)::text as last_refreshed_at
        from tracked_accounts
        where key = any($1::text[])
      `,
      [keys],
    );

    return rows?.[0]?.last_refreshed_at ?? null;
  } catch {
    return null;
  }
}

export async function getAccountTickerCountsFromDb(authorKey: string): Promise<Record<string, number> | null> {
  try {
    const rows = await queryRows<TickerMentionCountRow>(
      `
        select author_key, ticker, sum(mention_count)::int as count
        from tweet_ticker_mentions
        where author_key = $1
        group by author_key, ticker
        order by count desc, ticker asc
      `,
      [authorKey],
    );

    if (!rows) return null;
    return Object.fromEntries(rows.map((row) => [row.ticker, toNumber(row.count)]));
  } catch {
    return null;
  }
}

export async function getTickerMentionGroupsFromDb(
  authors: readonly AuthorProfile[],
): Promise<TickerMentionGroups | null> {
  const keys = authors.map((author) => author.key);
  if (!keys.length) return { shared: [], uniqueByAuthor: [] };

  try {
    const rows = await queryRows<TickerMentionCountRow>(
      `
        select author_key, ticker, sum(mention_count)::int as count
        from tweet_ticker_mentions
        where author_key = any($1::text[])
        group by author_key, ticker
      `,
      [keys],
    );

    if (!rows) return null;
    return buildMentionGroups(rows, authors);
  } catch {
    return null;
  }
}

export async function createXRefreshRun(input: {
  requestId: string;
  triggeredBy: XRefreshTrigger;
  startedAtIso: string;
}): Promise<number | null> {
  try {
    const rows = await queryRows<CreatedRefreshRunRow>(
      `
        insert into x_refresh_runs (request_id, triggered_by, started_at)
        values ($1,$2,$3)
        returning id
      `,
      [input.requestId, input.triggeredBy, input.startedAtIso],
    );
    const id = rows?.[0]?.id;
    const parsed = typeof id === "number" ? id : Number(id);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function completeXRefreshRun(input: {
  runId: number | null;
  finishedAtIso: string;
  ok: boolean;
  mode: string;
  message: string;
  totalNewTweets: number;
  diagnostics?: unknown;
}): Promise<void> {
  if (input.runId === null) return;

  try {
    await queryRows(
      `
        update x_refresh_runs
        set finished_at = $2,
            ok = $3,
            mode = $4,
            message = $5,
            total_new_tweets = $6,
            diagnostics = $7::jsonb
        where id = $1
      `,
      [
        input.runId,
        input.finishedAtIso,
        input.ok,
        input.mode,
        input.message,
        input.totalNewTweets,
        JSON.stringify(input.diagnostics ?? null),
      ],
    );
  } catch {
    // Audit logging is best-effort and must not fail the refresh itself.
  }
}

export async function insertXAccountRefreshEvents(
  runId: number | null,
  events: readonly XAccountRefreshLogEvent[],
): Promise<void> {
  if (runId === null || !events.length) return;

  try {
    await Promise.all(
      events.map((event) =>
        queryRows(
          `
            insert into x_account_refresh_events (
              refresh_run_id, author_key, handle, previous_last_tweet_id, new_last_tweet_id,
              new_tweet_count, new_tweet_ids, new_tickers, status, error
            )
            values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
          `,
          [
            runId,
            event.authorKey,
            event.handle,
            event.previousLastTweetId,
            event.newLastTweetId,
            event.newTweetCount,
            JSON.stringify(event.newTweetIds),
            JSON.stringify(event.newTickers),
            event.status,
            event.error ?? null,
          ],
        ),
      ),
    );
  } catch {
    // Audit logging is best-effort and must not fail the refresh itself.
  }
}

export async function upsertTrackedAccounts(authors: readonly AuthorProfile[]): Promise<void> {
  if (!authors.length) return;

  try {
    await Promise.all(
      authors.map((author) =>
        queryRows(
          `
            insert into tracked_accounts (
              key, slug, handle, name, short_name, color, bio, followers, avatar,
              platform, win_rate, shadow_score, rank_source, active, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,now())
            on conflict (key) do update set
              slug = excluded.slug,
              handle = excluded.handle,
              name = excluded.name,
              short_name = excluded.short_name,
              color = excluded.color,
              bio = excluded.bio,
              followers = excluded.followers,
              avatar = excluded.avatar,
              platform = excluded.platform,
              win_rate = excluded.win_rate,
              shadow_score = excluded.shadow_score,
              rank_source = excluded.rank_source,
              active = true,
              updated_at = now()
          `,
          [
            author.key,
            author.slug,
            author.handle,
            author.name,
            author.shortName,
            author.color,
            author.bio,
            author.followers,
            author.avatar,
            author.platform ?? "X",
            author.winRate ?? null,
            author.shadowScore ?? null,
            author.rankSource ?? null,
          ],
        ),
      ),
    );
  } catch {
    // Cache writes are best-effort; refresh diagnostics still report X status.
  }
}

export async function getCachedAccountRows(keys: readonly string[]): Promise<Record<string, CachedAccountRow>> {
  if (!keys.length) return {};

  try {
    const rows = await queryRows<CachedAccountRow>(
      "select key, author_id, last_tweet_id from tracked_accounts where key = any($1::text[])",
      [[...keys]],
    );
    return Object.fromEntries((rows ?? []).map((row) => [row.key, row]));
  } catch {
    return {};
  }
}

export async function upsertTweetsForAuthor(
  author: AuthorProfile,
  userId: string,
  tweets: readonly CacheableTweet[],
): Promise<void> {
  try {
    await queryRows(
      `
        update tracked_accounts
        set author_id = $2, last_refreshed_at = now(), updated_at = now()
        where key = $1
      `,
      [author.key, userId],
    );

    if (!tweets.length) return;

    await Promise.all(
      tweets.map((tweet) =>
        queryRows(
          `
            insert into tweets (
              id, author_handle, author_id, author_key, posted_at, text, url,
              like_count, retweet_count, reply_count, cashtags, fetched_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
            on conflict (id) do update set
              author_handle = excluded.author_handle,
              author_id = excluded.author_id,
              author_key = excluded.author_key,
              posted_at = excluded.posted_at,
              text = excluded.text,
              url = excluded.url,
              like_count = excluded.like_count,
              retweet_count = excluded.retweet_count,
              reply_count = excluded.reply_count,
              cashtags = excluded.cashtags,
              fetched_at = now()
          `,
          [
            tweet.id,
            author.handle,
            userId,
            author.key,
            tweet.postedAtIso ?? new Date().toISOString(),
            tweet.text,
            tweet.url,
            tweet.likes,
            tweet.retweets,
            tweet.replies,
            JSON.stringify(uniqueNormalizedCashtags(tweet.cashtags)),
          ],
        ),
      ),
    );

    await Promise.all(tweets.map((tweet) => upsertTickerMentionsForTweet(author, tweet)));

    const newestTweetId = tweets
      .map((tweet) => tweet.id)
      .sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : BigInt(b) < BigInt(a) ? -1 : 0))[0];

    if (newestTweetId) {
      await queryRows(
        "update tracked_accounts set last_tweet_id = $2, updated_at = now() where key = $1",
        [author.key, newestTweetId],
      );
    }
  } catch {
    // Cache writes are best-effort; callers should rely on refresh diagnostics.
  }
}

async function upsertTickerMentionsForTweet(
  author: AuthorProfile,
  tweet: CacheableTweet,
): Promise<void> {
  const postedAt = tweet.postedAtIso ?? new Date().toISOString();
  const tickers = uniqueNormalizedCashtags(tweet.cashtags);

  if (!tickers.length) {
    await queryRows("delete from tweet_ticker_mentions where tweet_id = $1", [tweet.id]);
    return;
  }

  await Promise.all(
    tickers.map((ticker) =>
      queryRows(
        `
          insert into tweet_ticker_mentions (
            tweet_id, author_key, ticker, mention_count, posted_at, first_seen_at
          )
          values ($1,$2,$3,1,$4,now())
          on conflict (tweet_id, ticker) do update set
            author_key = excluded.author_key,
            mention_count = excluded.mention_count,
            posted_at = excluded.posted_at
        `,
        [tweet.id, author.key, ticker, postedAt],
      ),
    ),
  );

  await queryRows(
    `
      delete from tweet_ticker_mentions
      where tweet_id = $1
        and not (ticker = any($2::text[]))
    `,
    [tweet.id, tickers],
  );
}
