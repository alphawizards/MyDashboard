import "server-only";
import type { AuthorProfile, TickerMentionGroups, TickerOverlap, Tweet } from "@/app/lib/types";
import { queryRows } from "@/lib/db/postgres";
import { logger, serializeError } from "@/lib/logger";

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

export type XRefreshLogRun = {
  id: number;
  requestId: string;
  triggeredBy: XRefreshTrigger;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  mode: string | null;
  message: string | null;
  totalNewTweets: number;
  accounts: XAccountRefreshLogEvent[];
};

export type XAccountRefreshEventInsertResult = {
  attempted: number;
  inserted: number;
  failed: number;
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

type XRefreshRunRow = {
  id: string | number;
  request_id: string;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  mode: string | null;
  message: string | null;
  total_new_tweets: string | number;
};

type XAccountRefreshEventRow = {
  refresh_run_id: string | number;
  author_key: string;
  handle: string;
  previous_last_tweet_id: string | null;
  new_last_tweet_id: string | null;
  new_tweet_count: string | number;
  new_tweet_ids: string[] | string | null;
  new_tickers: string[] | string | null;
  status: XAccountRefreshLogEvent["status"] | string;
  error: string | null;
};

let xRefreshLogSchemaReady = false;

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

async function ensureXRefreshLogSchema(): Promise<boolean> {
  if (xRefreshLogSchemaReady) return true;

  try {
    const rows = await queryRows(`
      create table if not exists x_refresh_runs (
        id                bigserial primary key,
        request_id        text not null,
        triggered_by      text not null default 'unknown',
        started_at        timestamptz not null default now(),
        finished_at       timestamptz,
        ok                boolean,
        mode              text,
        message           text,
        total_new_tweets  int not null default 0,
        diagnostics       jsonb
      );

      create index if not exists x_refresh_runs_started_idx on x_refresh_runs (started_at desc);
      create index if not exists x_refresh_runs_request_idx on x_refresh_runs (request_id);

      create table if not exists x_account_refresh_events (
        id                      bigserial primary key,
        refresh_run_id          bigint not null references x_refresh_runs(id) on delete cascade,
        author_key              text not null,
        handle                  text not null,
        previous_last_tweet_id  text,
        new_last_tweet_id       text,
        new_tweet_count         int not null default 0,
        new_tweet_ids           jsonb not null default '[]'::jsonb,
        new_tickers             jsonb not null default '[]'::jsonb,
        status                  text not null,
        error                   text,
        created_at              timestamptz not null default now()
      );

      create index if not exists x_account_refresh_events_run_idx on x_account_refresh_events (refresh_run_id);
      create index if not exists x_account_refresh_events_author_created_idx on x_account_refresh_events (author_key, created_at desc);
    `);

    xRefreshLogSchemaReady = rows !== null;
    return xRefreshLogSchemaReady;
  } catch (err) {
    logger.warn("refresh.audit.schema_unavailable", { error: serializeError(err) });
    return false;
  }
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
    if (!(await ensureXRefreshLogSchema())) return null;

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
  } catch (err) {
    logger.warn("refresh.audit.run_create_failed", {
      requestId: input.requestId,
      error: serializeError(err),
    });
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
): Promise<XAccountRefreshEventInsertResult> {
  if (runId === null || !events.length) {
    return { attempted: 0, inserted: 0, failed: 0 };
  }
  if (!(await ensureXRefreshLogSchema())) {
    return { attempted: events.length, inserted: 0, failed: events.length };
  }

  const results = await Promise.allSettled(
    events.map(async (event) => {
      const rows = await queryRows(
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
      );

      if (rows === null) {
        throw new Error("Refresh audit database unavailable.");
      }
    }),
  );
  const failedResults = results.filter((result) => result.status === "rejected");
  const summary = {
    attempted: events.length,
    inserted: events.length - failedResults.length,
    failed: failedResults.length,
  };

  if (summary.failed > 0) {
    logger.warn("refresh.audit.events.partial_failure", {
      runId,
      attempted: summary.attempted,
      inserted: summary.inserted,
      failed: summary.failed,
      handles: events
        .filter((_, index) => results[index]?.status === "rejected")
        .map((event) => event.handle),
      errors: failedResults.map((result) => serializeError(result.reason)),
    });
  }

  return summary;
}

export async function getXRefreshLogRuns(limit = 25): Promise<XRefreshLogRun[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));

  try {
    if (!(await ensureXRefreshLogSchema())) return [];

    const runs = await queryRows<XRefreshRunRow>(
      `
        select
          id,
          request_id,
          triggered_by,
          started_at::text,
          finished_at::text,
          ok,
          mode,
          message,
          total_new_tweets
        from x_refresh_runs
        order by started_at desc
        limit $1
      `,
      [boundedLimit],
    );

    if (!runs?.length) return [];

    const runIds = runs.map((run) => toNumber(run.id));
    const events = await queryRows<XAccountRefreshEventRow>(
      `
        select
          refresh_run_id,
          author_key,
          handle,
          previous_last_tweet_id,
          new_last_tweet_id,
          new_tweet_count,
          new_tweet_ids,
          new_tickers,
          status,
          error
        from x_account_refresh_events
        where refresh_run_id = any($1::bigint[])
        order by refresh_run_id desc, id asc
      `,
      [runIds],
    );
    const eventsByRun = new Map<number, XAccountRefreshLogEvent[]>();

    for (const event of events ?? []) {
      const runId = toNumber(event.refresh_run_id);
      const list = eventsByRun.get(runId) ?? [];
      list.push({
        authorKey: event.author_key,
        handle: event.handle,
        previousLastTweetId: event.previous_last_tweet_id,
        newLastTweetId: event.new_last_tweet_id,
        newTweetCount: toNumber(event.new_tweet_count),
        newTweetIds: parseJsonStringArray(event.new_tweet_ids),
        newTickers: parseJsonStringArray(event.new_tickers),
        status: normalizeRefreshEventStatus(event.status),
        ...(event.error ? { error: event.error } : {}),
      });
      eventsByRun.set(runId, list);
    }

    return runs.map((run) => {
      const runId = toNumber(run.id);
      return {
        id: runId,
        requestId: run.request_id,
        triggeredBy: normalizeRefreshTrigger(run.triggered_by),
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        ok: run.ok,
        mode: run.mode,
        message: run.message,
        totalNewTweets: toNumber(run.total_new_tweets),
        accounts: eventsByRun.get(runId) ?? [],
      };
    });
  } catch {
    return [];
  }
}

function normalizeRefreshTrigger(value: string): XRefreshTrigger {
  return value === "button" || value === "cron" ? value : "unknown";
}

function normalizeRefreshEventStatus(value: string): XAccountRefreshLogEvent["status"] {
  if (value === "updated" || value === "no_new_tweets" || value === "failed" || value === "skipped") {
    return value;
  }
  return "failed";
}

function parseJsonStringArray(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function getLastXRefreshAudit(): Promise<XRefreshAuditSummary | null> {
  const runs = await getXRefreshLogRuns(1);
  const run = runs[0];
  if (!run) return null;
  return {
    runId: run.id,
    triggeredBy: run.triggeredBy,
    totalNewTweets: run.totalNewTweets,
    accounts: run.accounts,
  };
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
