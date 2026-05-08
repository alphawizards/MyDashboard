import { describe, expect, it } from "vitest";
import { buildTickerMentionGroups, buildTickerOverlap } from "../../app/lib/overlap";
import { authors, tweetsByAuthor } from "../../app/lib/static-data";

const colorByKey = Object.fromEntries(authors.map((a) => [a.key, a.color]));

describe("buildTickerOverlap", () => {
  it("finds shared tickers across all tracked accounts", () => {
    const shared = buildTickerOverlap(tweetsByAuthor, colorByKey).filter((row) => row.shared);

    expect(shared.map((row) => row.ticker)).toEqual([
      "AMD",
      "AAOI",
      "INTC",
      "LITE",
      "MXL",
      "SOI",
    ]);
  });

  it("keeps the current BryzonX overlaps visible", () => {
    const shared = buildTickerOverlap(tweetsByAuthor, colorByKey).filter((row) => row.shared);
    const byTicker = Object.fromEntries(shared.map((row) => [row.ticker, row]));

    expect(byTicker.AMD.authors).toEqual([
      { who: "w", count: 2 },
      { who: "b", count: 2 },
    ]);
    expect(byTicker.MXL.authors).toEqual([
      { who: "a", count: 1 },
      { who: "b", count: 1 },
    ]);
  });

  it("classifies shared tickers for the chart and unique tickers by account for the table", () => {
    const groups = buildTickerMentionGroups(
      {
        alpha: [
          { id: "1", text: "$AAOI $SIVE", created_at: "", likes: 0, retweets: 0, replies: 0, cashtags: ["$AAOI", "$SIVE"], url: "" },
        ],
        beta: [
          { id: "2", text: "$AAOI $MXL", created_at: "", likes: 0, retweets: 0, replies: 0, cashtags: ["$AAOI", "$MXL"], url: "" },
        ],
        gamma: [],
      },
      { alpha: "#111", beta: "#222", gamma: "#333" },
    );

    expect(groups.shared.map((row) => row.ticker)).toEqual(["AAOI"]);
    expect(groups.uniqueByAuthor).toEqual([
      { who: "alpha", tickers: [{ ticker: "SIVE", who: "alpha", count: 1, color: "#111" }] },
      { who: "beta", tickers: [{ ticker: "MXL", who: "beta", count: 1, color: "#222" }] },
      { who: "gamma", tickers: [] },
    ]);
  });

  it("normalizes and counts duplicate cashtags once per tweet", () => {
    const groups = buildTickerMentionGroups(
      {
        alpha: [
          { id: "1", text: "$AMD $AMD amd", created_at: "", likes: 0, retweets: 0, replies: 0, cashtags: ["$AMD", "AMD", "amd"], url: "" },
        ],
        beta: [],
      },
      { alpha: "#111", beta: "#222" },
    );

    expect(groups.uniqueByAuthor[0].tickers).toEqual([
      { ticker: "AMD", who: "alpha", count: 1, color: "#111" },
    ]);
  });
});
