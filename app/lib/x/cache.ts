import "server-only";
import type { AuthorProfile, Tweet } from "@/app/lib/types";
import { queryRows } from "@/lib/db/postgres";

export type CacheableTweet = Tweet & {
  postedAtIso?: string;
};

export type CachedAccountRow = {
  key: string;
  author_id: string | null;
  last_tweet_id: string | null;
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

function normalizeCashtags(value: TweetRow["cashtags"]): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).replace(/^\$/, "").toUpperCase());
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((tag) => String(tag).replace(/^\$/, "").toUpperCase()) : [];
  } catch {
    return [];
  }
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
            JSON.stringify(tweet.cashtags),
          ],
        ),
      ),
    );

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
