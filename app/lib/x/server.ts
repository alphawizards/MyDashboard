import 'server-only';
import { getTrackedAuthors } from '@/lib/accounts/server';
import type { Tweet } from '@/app/lib/types';
import {
  getCachedAccountRows,
  normalizeTickerMention,
  upsertTrackedAccounts,
  upsertTweetsForAuthor,
  type CacheableTweet,
  type XAccountRefreshLogEvent,
} from '@/lib/x/cache';

type XEndpointDiagnostic = {
  ok: boolean;
  status: number | null;
  error?: string;
};

export type XAuthorRefreshDiagnostic = {
  handle: string;
  userLookup: XEndpointDiagnostic;
  tweets?: XEndpointDiagnostic & {
    returned?: number;
  };
};

export type XRefreshDiagnostics = Record<string, XAuthorRefreshDiagnostic>;

export type XRefreshAuditEvent = XAccountRefreshLogEvent;

export function isXConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

const TWEET_FIELDS =
  'id,text,created_at,public_metrics,entities';
const MAX_RESULTS = 20;
const X_API = 'https://api.twitter.com/2';

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
  };
}

async function responseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return JSON.stringify(body);
  } catch {
    try {
      return await res.text();
    } catch {
      return res.statusText || `HTTP ${res.status}`;
    }
  }
}

// Parses AEST-formatted date string from ISO 8601
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' AEST';
}

// Extract $CASHTAGS from tweet text + entities
function extractCashtags(text: string, entities?: { cashtags?: { tag: string }[] }): string[] {
  if (entities?.cashtags?.length) {
    return entities.cashtags.map((c) => c.tag.toUpperCase());
  }
  const matches = text.match(/\$[A-Z]{1,5}(?:\.[A-Z])?/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

async function resolveUserIdWithDiagnostic(
  handle: string,
  cachedUserId?: string | null,
): Promise<{ userId: string | null; diagnostic: XEndpointDiagnostic }> {
  if (cachedUserId) {
    return {
      userId: cachedUserId,
      diagnostic: { ok: true, status: null },
    };
  }

  try {
    const res = await fetch(`${X_API}/users/by/username/${handle}?user.fields=id`, {
      headers: authHeaders(),
      next: { revalidate: 86400 }, // cache user id for 24h
    });

    if (!res.ok) {
      return {
        userId: null,
        diagnostic: { ok: false, status: res.status, error: await responseError(res) },
      };
    }

    const json = await res.json();
    const userId = json?.data?.id ?? null;
    return {
      userId,
      diagnostic: userId
        ? { ok: true, status: res.status }
        : { ok: false, status: res.status, error: "X response did not include data.id" },
    };
  } catch (err) {
    return {
      userId: null,
      diagnostic: {
        ok: false,
        status: null,
        error: err instanceof Error ? err.message : "Unknown user lookup error",
      },
    };
  }
}

export async function fetchTweetsForAuthorWithDiagnostic(
  key: string,
  handle: string,
  options: { cachedUserId?: string | null; sinceId?: string | null } = {},
): Promise<{ tweets: CacheableTweet[]; diagnostic: XAuthorRefreshDiagnostic; userId: string | null }> {
  const { userId, diagnostic: userLookup } = await resolveUserIdWithDiagnostic(handle, options.cachedUserId);
  const diagnostic: XAuthorRefreshDiagnostic = { handle, userLookup };

  if (!userId) return { tweets: [], diagnostic, userId };

  const params = new URLSearchParams({
    max_results: String(MAX_RESULTS),
    'tweet.fields': TWEET_FIELDS,
    exclude: 'retweets,replies',
  });
  if (options.sinceId) {
    params.set('since_id', options.sinceId);
  }

  let res: Response;
  try {
    res = await fetch(
      `${X_API}/users/${userId}/tweets?${params}`,
      { headers: authHeaders(), cache: 'no-store' }
    );
  } catch (err) {
    diagnostic.tweets = {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : "Unknown tweets fetch error",
    };
    return { tweets: [], diagnostic, userId };
  }

  if (!res.ok) {
    diagnostic.tweets = { ok: false, status: res.status, error: await responseError(res) };
    return { tweets: [], diagnostic, userId };
  }

  const json = await res.json();
  const rawTweets: {
    id: string;
    text: string;
    created_at: string;
    public_metrics: { like_count: number; retweet_count: number; reply_count: number };
    entities?: { cashtags?: { tag: string }[] };
  }[] = json?.data ?? [];

  diagnostic.tweets = { ok: true, status: res.status, returned: rawTweets.length };

  const tweets = rawTweets.map((t) => ({
    id: t.id,
    text: t.text,
    created_at: formatDate(t.created_at),
    postedAtIso: t.created_at,
    likes: t.public_metrics.like_count,
    retweets: t.public_metrics.retweet_count,
    replies: t.public_metrics.reply_count,
    cashtags: extractCashtags(t.text, t.entities),
    url: `https://x.com/${handle}/status/${t.id}`,
  }));

  return { tweets, diagnostic, userId };
}

export async function verifyXUserExists(handle: string): Promise<{ exists: boolean; diagnostic: XEndpointDiagnostic }> {
  const { userId, diagnostic } = await resolveUserIdWithDiagnostic(handle);
  return { exists: userId !== null, diagnostic };
}

export async function fetchTweetsForAuthor(
  key: string,
  handle: string
): Promise<Tweet[]> {
  const { tweets } = await fetchTweetsForAuthorWithDiagnostic(key, handle);
  return tweets;
}

export async function fetchAllTweets(): Promise<Record<string, Tweet[]>> {
  const { tweetsByAuthor } = await fetchAllTweetsWithDiagnostics();
  return tweetsByAuthor;
}

export async function fetchAllTweetsWithDiagnostics(): Promise<{
  tweetsByAuthor: Record<string, Tweet[]>;
  diagnostics: XRefreshDiagnostics;
  accountEvents: XRefreshAuditEvent[];
}> {
  const authors = await getTrackedAuthors();
  await upsertTrackedAccounts(authors);
  const cachedAccountRows = await getCachedAccountRows(authors.map((author) => author.key));
  const authorHandles = Object.fromEntries(
    authors.map((author) => [author.key, author.handle])
  ) as Record<string, string>;

  const entries = await Promise.all(
    Object.entries(authorHandles).map(
      async ([key, handle]) => {
        const account = cachedAccountRows[key];
        const result = await fetchTweetsForAuthorWithDiagnostic(key, handle, {
          cachedUserId: account?.author_id,
          sinceId: account?.last_tweet_id,
        });
        const author = authors.find((item) => item.key === key);
        if (author && result.userId) {
          await upsertTweetsForAuthor(author, result.userId, result.tweets);
        }
        return [key, result, buildAccountRefreshEvent({
          key,
          handle,
          previousLastTweetId: account?.last_tweet_id ?? null,
          tweets: result.tweets,
          diagnostic: result.diagnostic,
        })] as const;
      }
    )
  );

  return {
    tweetsByAuthor: Object.fromEntries(
      entries.map(([key, result]) => [key, result.tweets])
    ),
    diagnostics: Object.fromEntries(
      entries.map(([key, result]) => [key, result.diagnostic])
    ) as XRefreshDiagnostics,
    accountEvents: entries.map(([, , event]) => event),
  };
}

function buildAccountRefreshEvent(input: {
  key: string;
  handle: string;
  previousLastTweetId: string | null;
  tweets: readonly CacheableTweet[];
  diagnostic: XAuthorRefreshDiagnostic;
}): XRefreshAuditEvent {
  const tweetError =
    input.diagnostic.tweets?.error ??
    (!input.diagnostic.userLookup.ok ? input.diagnostic.userLookup.error : undefined);
  const newTweetIds = input.tweets.map((tweet) => tweet.id);
  const newTickers = [
    ...new Set(
      input.tweets.flatMap((tweet) =>
        (tweet.cashtags ?? []).map(normalizeTickerMention).filter(Boolean),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const newLastTweetId = getNewestTweetId(newTweetIds) ?? input.previousLastTweetId;
  const status: XRefreshAuditEvent["status"] = tweetError
    ? "failed"
    : input.tweets.length > 0
      ? "updated"
      : "no_new_tweets";

  return {
    authorKey: input.key,
    handle: input.handle,
    previousLastTweetId: input.previousLastTweetId,
    newLastTweetId,
    newTweetCount: input.tweets.length,
    newTweetIds,
    newTickers,
    status,
    ...(tweetError ? { error: tweetError } : {}),
  };
}

function getNewestTweetId(ids: readonly string[]): string | null {
  if (!ids.length) return null;

  return [...ids].sort(compareTweetIdsDesc)[0] ?? null;
}

function compareTweetIdsDesc(a: string, b: string): number {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    return right > left ? 1 : right < left ? -1 : 0;
  } catch {
    return b.localeCompare(a);
  }
}
