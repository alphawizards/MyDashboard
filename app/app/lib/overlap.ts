import type { TickerMentionGroups, TickerOverlap, Tweet } from "./types";

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
  const groups = buildTickerMentionGroups(tweetsByAuthor, colorByKey);
  return [
    ...groups.shared,
    ...groups.uniqueByAuthor.flatMap((group) =>
      group.tickers.map((ticker) => ({
        ticker: ticker.ticker,
        authors: [{ who: ticker.who, count: ticker.count }],
        total: ticker.count,
        shared: false,
        color: ticker.color,
      })),
    ),
  ];
}

export function buildTickerMentionGroups(
  tweetsByAuthor: Record<string, readonly Tweet[]>,
  colorByKey: Record<string, string>,
): TickerMentionGroups {
  const countsByWho: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(tweetsByAuthor).map(([who, tweets]) => [
      who,
      buildTickerCounts(tweets),
    ]),
  );

  const allTickers = new Set(
    Object.values(countsByWho).flatMap((counts) => Object.keys(counts)),
  );

  const classified = [...allTickers].map((ticker) => {
    const authors = Object.entries(countsByWho)
      .filter(([, counts]) => counts[ticker])
      .map(([who, counts]) => ({ who, count: counts[ticker] }));
    const total = authors.reduce((sum, author) => sum + author.count, 0);
    const shared = authors.length > 1;
    const color = shared ? "#f59e0b" : colorByKey[authors[0].who] ?? "#94a3b8";

    return { ticker, authors, total, shared, color };
  });

  const shared = classified
    .filter((row) => row.shared)
    .sort(
      (a, b) =>
        b.authors.length - a.authors.length ||
        b.total - a.total ||
        a.ticker.localeCompare(b.ticker),
    );

  const uniqueByAuthor = Object.keys(countsByWho).map((who) => ({
    who,
    tickers: classified
      .filter((row) => !row.shared && row.authors[0]?.who === who)
      .map((row) => ({
        ticker: row.ticker,
        who,
        count: row.total,
        color: colorByKey[who] ?? "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker)),
  }));

  return { shared, uniqueByAuthor };
}
