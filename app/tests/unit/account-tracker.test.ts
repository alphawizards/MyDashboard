import { describe, expect, it, vi } from "vitest";
import {
  buildAccountTickerPerformanceRows,
  buildTickerMentionCounts,
  resolveYahooSymbolCandidates,
} from "@/lib/stocks/account-tracker";
import type { Tweet } from "@/app/lib/types";

vi.mock("server-only", () => ({}));

const tweets: Tweet[] = [
  {
    id: "1",
    text: "$AAOI and $SIVE",
    created_at: "",
    likes: 0,
    retweets: 0,
    replies: 0,
    cashtags: ["AAOI", "SIVE"],
    url: "",
  },
  {
    id: "2",
    text: "$AAOI again",
    created_at: "",
    likes: 0,
    retweets: 0,
    replies: 0,
    cashtags: ["$AAOI"],
    url: "",
  },
];

describe("account stock tracker", () => {
  it("aggregates Serenity cashtag mentions by normalized ticker", () => {
    expect(buildTickerMentionCounts(tweets)).toEqual({
      AAOI: 2,
      SIVE: 1,
    });
  });

  it("joins mentions with company, theme, and performance facts", () => {
    const rows = buildAccountTickerPerformanceRows(tweets, {
      AAOI: {
        ticker: "AAOI",
        company: "Applied Optoelectronics, Inc.",
        sector: "Technology",
        industry: "Communication Equipment",
        theme: "Communication Equipment",
        perf1M: 51.8,
        perf12M: 1136,
      },
      SIVE: {
        ticker: "SIVE",
        company: "Sivers Semiconductors AB",
        sector: "Technology",
        industry: null,
        theme: "Technology",
        perf1M: 215,
        perf12M: 1173,
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        ticker: "AAOI",
        company: "Applied Optoelectronics, Inc.",
        theme: "Communication Equipment",
        perf1M: 51.8,
        perf12M: 1136,
        mentions: 2,
      }),
      expect.objectContaining({
        ticker: "SIVE",
        company: "Sivers Semiconductors AB",
        theme: "Technology",
        mentions: 1,
      }),
    ]);
  });

  it("uses Unknown placeholders when yfinance metadata is not cached yet", () => {
    expect(buildAccountTickerPerformanceRows(tweets.slice(0, 1), {})).toEqual([
      expect.objectContaining({ ticker: "AAOI", company: "Unknown", theme: "Unknown" }),
      expect.objectContaining({ ticker: "SIVE", company: "Unknown", theme: "Unknown" }),
    ]);
  });

  it("resolves Serenity tickers that need Yahoo exchange or class suffixes", () => {
    expect(resolveYahooSymbolCandidates("SIVE")).toEqual(["SIVE", "SIVE.ST"]);
    expect(resolveYahooSymbolCandidates("SOI")).toEqual(["SOI", "SOI.PA"]);
    expect(resolveYahooSymbolCandidates("HPS.A")).toEqual(["HPS.A", "HPS-A.TO", "HPS-A"]);
    expect(resolveYahooSymbolCandidates("$AAOI")).toEqual(["AAOI"]);
  });
});
