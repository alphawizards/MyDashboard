import 'server-only';
import type { AuthorKey, Tweet } from '@/app/lib/types';

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

export type XRefreshDiagnostics = Record<AuthorKey, XAuthorRefreshDiagnostic>;

export function isXConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

// Maps our AuthorKey to the real X/Twitter handle
const AUTHOR_HANDLES: Record<AuthorKey, string> = {
  s: 'michaelsikand',
  w: 'peterjwolff',
  a: 'aleabitoreddit',
  b: 'BryzonX',
};

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
  handle: string
): Promise<{ userId: string | null; diagnostic: XEndpointDiagnostic }> {
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
  key: AuthorKey,
  handle: string
): Promise<{ tweets: Tweet[]; diagnostic: XAuthorRefreshDiagnostic }> {
  const { userId, diagnostic: userLookup } = await resolveUserIdWithDiagnostic(handle);
  const diagnostic: XAuthorRefreshDiagnostic = { handle, userLookup };

  if (!userId) return { tweets: [], diagnostic };

  const params = new URLSearchParams({
    max_results: String(MAX_RESULTS),
    'tweet.fields': TWEET_FIELDS,
    exclude: 'retweets,replies',
  });

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
    return { tweets: [], diagnostic };
  }

  if (!res.ok) {
    diagnostic.tweets = { ok: false, status: res.status, error: await responseError(res) };
    return { tweets: [], diagnostic };
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
    likes: t.public_metrics.like_count,
    retweets: t.public_metrics.retweet_count,
    replies: t.public_metrics.reply_count,
    cashtags: extractCashtags(t.text, t.entities),
    url: `https://x.com/${handle}/status/${t.id}`,
  }));

  return { tweets, diagnostic };
}

export async function fetchTweetsForAuthor(
  key: AuthorKey,
  handle: string
): Promise<Tweet[]> {
  const { tweets } = await fetchTweetsForAuthorWithDiagnostic(key, handle);
  return tweets;
}

export async function fetchAllTweets(): Promise<Record<AuthorKey, Tweet[]>> {
  const { tweetsByAuthor } = await fetchAllTweetsWithDiagnostics();
  return tweetsByAuthor;
}

export async function fetchAllTweetsWithDiagnostics(): Promise<{
  tweetsByAuthor: Record<AuthorKey, Tweet[]>;
  diagnostics: XRefreshDiagnostics;
}> {
  const entries = await Promise.all(
    (Object.entries(AUTHOR_HANDLES) as [AuthorKey, string][]).map(
      async ([key, handle]) => [key, await fetchTweetsForAuthorWithDiagnostic(key, handle)] as const
    )
  );

  return {
    tweetsByAuthor: Object.fromEntries(
      entries.map(([key, result]) => [key, result.tweets])
    ) as Record<AuthorKey, Tweet[]>,
    diagnostics: Object.fromEntries(
      entries.map(([key, result]) => [key, result.diagnostic])
    ) as XRefreshDiagnostics,
  };
}
