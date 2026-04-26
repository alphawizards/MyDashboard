import { describe, expect, it } from "vitest";
import { buildTickerOverlap } from "../../app/lib/overlap";
import { tweetsByAuthor } from "../../app/lib/static-data";

describe("buildTickerOverlap", () => {
  it("finds shared tickers across all tracked accounts", () => {
    const shared = buildTickerOverlap(tweetsByAuthor).filter((row) => row.shared);

    expect(shared.map((row) => row.ticker)).toEqual([
      "$AMD",
      "$AAOI",
      "$INTC",
      "$LITE",
      "$MXL",
      "$SOI",
    ]);
  });

  it("keeps the current BryzonX overlaps visible", () => {
    const shared = buildTickerOverlap(tweetsByAuthor).filter((row) => row.shared);
    const byTicker = Object.fromEntries(shared.map((row) => [row.ticker, row]));

    expect(byTicker.$AMD.authors).toEqual([
      { who: "w", count: 2 },
      { who: "b", count: 2 },
    ]);
    expect(byTicker.$MXL.authors).toEqual([
      { who: "a", count: 1 },
      { who: "b", count: 1 },
    ]);
  });
});
