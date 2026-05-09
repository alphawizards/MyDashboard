import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const queryRows = vi.fn();

vi.mock("@/lib/db/postgres", () => ({
  queryRows,
}));

const author = {
  key: "alpha",
  slug: "alpha",
  name: "Alpha",
  shortName: "Alpha",
  handle: "alpha",
  color: "#111111",
  bio: "",
  followers: "N/A",
  avatar: null,
};

describe("X cache ticker mentions", () => {
  beforeEach(() => {
    queryRows.mockReset();
  });

  it("normalizes ticker mentions", async () => {
    const { normalizeTickerMention } = await import("@/lib/x/cache");

    expect(["$AMD", "AMD", "amd", "HPS.A"].map(normalizeTickerMention)).toEqual([
      "AMD",
      "AMD",
      "AMD",
      "HPS.A",
    ]);
  });

  it("builds shared and unique overlap groups from persisted mention rows", async () => {
    queryRows.mockResolvedValueOnce([
      { author_key: "alpha", ticker: "AMD", count: 2 },
      { author_key: "beta", ticker: "AMD", count: 1 },
      { author_key: "beta", ticker: "MXL", count: 1 },
    ]);

    const { getTickerMentionGroupsFromDb } = await import("@/lib/x/cache");
    const groups = await getTickerMentionGroupsFromDb([
      author,
      { ...author, key: "beta", slug: "beta", handle: "beta", color: "#222222" },
    ]);

    expect(groups?.shared).toEqual([
      {
        ticker: "AMD",
        authors: [
          { who: "alpha", count: 2 },
          { who: "beta", count: 1 },
        ],
        total: 3,
        shared: true,
        color: "#f59e0b",
      },
    ]);
    expect(groups?.uniqueByAuthor).toEqual([
      { who: "alpha", tickers: [] },
      { who: "beta", tickers: [{ ticker: "MXL", who: "beta", count: 1, color: "#222222" }] },
    ]);
  });

  it("upserts one normalized ticker row per tweet ticker", async () => {
    queryRows.mockResolvedValue([]);

    const { upsertTweetsForAuthor } = await import("@/lib/x/cache");
    await upsertTweetsForAuthor(author, "user-1", [
      {
        id: "tweet-1",
        text: "$AMD $AMD amd $HPS.A",
        created_at: "",
        postedAtIso: "2026-05-08T00:00:00.000Z",
        likes: 0,
        retweets: 0,
        replies: 0,
        cashtags: ["$AMD", "AMD", "amd", "$HPS.A"],
        url: "https://x.com/alpha/status/tweet-1",
      },
    ]);

    const insertMentionCalls = queryRows.mock.calls.filter(([sql]) =>
      String(sql).includes("insert into tweet_ticker_mentions"),
    );

    expect(insertMentionCalls).toHaveLength(2);
    expect(insertMentionCalls.map(([, params]) => params?.[2]).sort()).toEqual(["AMD", "HPS.A"]);
  });
});
