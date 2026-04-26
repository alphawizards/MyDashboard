import type { AuthorKey, TickerOverlap, Tweet } from "./types";

export const colorByAuthor: Record<AuthorKey, string> = {
  s: "#4fc3f7",
  w: "#10b981",
  a: "#a78bfa",
  b: "#f43f5e",
};

export function buildTickerCounts(tweets: readonly Tweet[]) {
  const counts: Record<string, number> = {};
  for (const tweet of tweets) {
    for (const tag of tweet.cashtags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildTickerOverlap(
  tweetsByAuthor: Record<AuthorKey, readonly Tweet[]>,
): TickerOverlap[] {
  const countsByWho = Object.fromEntries(
    Object.entries(tweetsByAuthor).map(([who, tweets]) => [
      who,
      buildTickerCounts(tweets),
    ]),
  ) as Record<AuthorKey, Record<string, number>>;

  const allTickers = new Set(
    Object.values(countsByWho).flatMap((counts) => Object.keys(counts)),
  );

  return [...allTickers]
    .map((ticker) => {
      const authors = (Object.entries(countsByWho) as [AuthorKey, Record<string, number>][])
        .filter(([, counts]) => counts[ticker])
        .map(([who, counts]) => ({ who, count: counts[ticker] }));
      const total = authors.reduce((sum, author) => sum + author.count, 0);
      const shared = authors.length > 1;
      const color = shared ? "#f59e0b" : colorByAuthor[authors[0].who];

      return { ticker, authors, total, shared, color };
    })
    .sort(
      (a, b) =>
        b.authors.length - a.authors.length ||
        b.total - a.total ||
        a.ticker.localeCompare(b.ticker),
    );
}
