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

  it("loads refresh log runs with account events", async () => {
    queryRows
      .mockResolvedValueOnce([
        {
          id: "7",
          request_id: "req-7",
          triggered_by: "button",
          started_at: "2026-05-09T05:52:00.000Z",
          finished_at: "2026-05-09T05:53:00.000Z",
          ok: true,
          mode: "live",
          message: "Feed cache revalidated after live X fetch.",
          total_new_tweets: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          refresh_run_id: "7",
          author_key: "alpha",
          handle: "alpha",
          previous_last_tweet_id: "100",
          new_last_tweet_id: "102",
          new_tweet_count: 2,
          new_tweet_ids: ["101", "102"],
          new_tickers: ["AMD", "MXL"],
          status: "updated",
          error: null,
        },
      ]);

    const { getXRefreshLogRuns } = await import("@/lib/x/cache");

    await expect(getXRefreshLogRuns()).resolves.toEqual([
      {
        id: 7,
        requestId: "req-7",
        triggeredBy: "button",
        startedAt: "2026-05-09T05:52:00.000Z",
        finishedAt: "2026-05-09T05:53:00.000Z",
        ok: true,
        mode: "live",
        message: "Feed cache revalidated after live X fetch.",
        totalNewTweets: 2,
        accounts: [
          {
            authorKey: "alpha",
            handle: "alpha",
            previousLastTweetId: "100",
            newLastTweetId: "102",
            newTweetCount: 2,
            newTweetIds: ["101", "102"],
            newTickers: ["AMD", "MXL"],
            status: "updated",
          },
        ],
      },
    ]);
  });

  it("reports partial refresh-event insert failures without dropping successful inserts", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    queryRows
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("insert failed"));

    const { insertXAccountRefreshEvents } = await import("@/lib/x/cache");
    const result = await insertXAccountRefreshEvents(9, [
      {
        authorKey: "alpha",
        handle: "alpha",
        previousLastTweetId: "100",
        newLastTweetId: "101",
        newTweetCount: 1,
        newTweetIds: ["101"],
        newTickers: ["AMD"],
        status: "updated",
      },
      {
        authorKey: "beta",
        handle: "beta",
        previousLastTweetId: "200",
        newLastTweetId: "201",
        newTweetCount: 1,
        newTweetIds: ["201"],
        newTickers: ["MXL"],
        status: "updated",
      },
    ]);

    expect(result).toEqual({ attempted: 2, inserted: 1, failed: 1 });
    expect(queryRows).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.flat().join("\n")).toContain("refresh.audit.events.partial_failure");
  });
});
