import 'server-only';
import type { AuthorKey, Tweet } from '@/app/lib/types';

export function isXConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

// Maps our AuthorKey to the real X/Twitter handle
const AUTHOR_HANDLES: Record<AuthorKey, string> = {
  s: 'michaelsikand',
  w: 'peterjwolff',
  a: 'aleabiloreddit',
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

async function resolveUserId(handle: string): Promise<string | null> {
  const res = await fetch(`${X_API}/users/by/username/${handle}?user.fields=id`, {
    headers: authHeaders(),
    next: { revalidate: 86400 }, // cache user id for 24h
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.id ?? null;
}

export async function fetchTweetsForAuthor(
  key: AuthorKey,
  handle: string
): Promise<Tweet[]> {
  const userId = await resolveUserId(handle);
  if (!userId) return [];

  const params = new URLSearchParams({
    max_results: String(MAX_RESULTS),
    tweet_fields: TWEET_FIELDS,
    expansions: 'entities',
    exclude: 'retweets,replies',
  });

  const res = await fetch(
    `${X_API}/users/${userId}/tweets?${params}`,
    { headers: authHeaders(), cache: 'no-store' }
  );
  if (!res.ok) return [];

  const json = await res.json();
  const rawTweets: {
    id: string;
    text: string;
    created_at: string;
    public_metrics: { like_count: number; retweet_count: number; reply_count: number };
    entities?: { cashtags?: { tag: string }[] };
  }[] = json?.data ?? [];

  return rawTweets.map((t) => ({
    id: t.id,
    text: t.text,
    created_at: formatDate(t.created_at),
    likes: t.public_metrics.like_count,
    retweets: t.public_metrics.retweet_count,
    replies: t.public_metrics.reply_count,
    cashtags: extractCashtags(t.text, t.entities),
    url: `https://x.com/${handle}/status/${t.id}`,
  }));
}

export async function fetchAllTweets(): Promise<Record<AuthorKey, Tweet[]>> {
  const entries = await Promise.all(
    (Object.entries(AUTHOR_HANDLES) as [AuthorKey, string][]).map(
      async ([key, handle]) => [key, await fetchTweetsForAuthor(key, handle)] as const
    )
  );
  return Object.fromEntries(entries) as Record<AuthorKey, Tweet[]>;
}
