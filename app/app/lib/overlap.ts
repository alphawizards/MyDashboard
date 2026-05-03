import type { TickerOverlap, Tweet } from "./types";

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
  tweetsByAuthor: Record<string, readonly Tweet[]>,
  colorByKey: Record<string, string>,
): TickerOverlap[] {
  const countsByWho: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(tweetsByAuthor).map(([who, tweets]) => [
      who,
      buildTickerCounts(tweets),
    ]),
  );

  const allTickers = new Set(
    Object.values(countsByWho).flatMap((counts) => Object.keys(counts)),
  );

  return [...allTickers]
    .map((ticker) => {
      const authors = Object.entries(countsByWho)
        .filter(([, counts]) => counts[ticker])
        .map(([who, counts]) => ({ who, count: counts[ticker] }));
      const total = authors.reduce((sum, author) => sum + author.count, 0);
      const shared = authors.length > 1;
      const color = shared ? "#f59e0b" : colorByKey[authors[0].who] ?? "#94a3b8";

      return { ticker, authors, total, shared, color };
    })
    .sort(
      (a, b) =>
        b.authors.length - a.authors.length ||
        b.total - a.total ||
        a.ticker.localeCompare(b.ticker),
    );
}
