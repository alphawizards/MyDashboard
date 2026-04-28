import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalBearer = process.env.X_BEARER_TOKEN;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("X server client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.X_BEARER_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.X_BEARER_TOKEN = originalBearer;
  });

  it("requests latest tweets with valid X API v2 timeline parameters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users/by/username/")) {
        return jsonResponse({ data: { id: "user-123" } });
      }

      return jsonResponse({
        data: [
          {
            id: "2050000000000000001",
            text: "Watching $AAOI and $SIVE here",
            created_at: "2026-04-28T02:30:00.000Z",
            public_metrics: { like_count: 12, retweet_count: 3, reply_count: 4 },
            entities: { cashtags: [{ tag: "AAOI" }, { tag: "SIVE" }] },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchTweetsForAuthorWithDiagnostic } = await import("../../lib/x/server");
    const { tweets, diagnostic } = await fetchTweetsForAuthorWithDiagnostic("s", "michaelsikand");

    const timelineUrl = String(fetchMock.mock.calls[1][0]);
    const timelineParams = new URL(timelineUrl).searchParams;

    expect(timelineParams.get("tweet.fields")).toBe("id,text,created_at,public_metrics,entities");
    expect(timelineParams.has("tweet_fields")).toBe(false);
    expect(timelineParams.has("expansions")).toBe(false);
    expect(timelineParams.get("exclude")).toBe("retweets,replies");
    expect(diagnostic.tweets).toMatchObject({ ok: true, status: 200, returned: 1 });
    expect(tweets).toEqual([
      expect.objectContaining({
        id: "2050000000000000001",
        text: "Watching $AAOI and $SIVE here",
        likes: 12,
        retweets: 3,
        replies: 4,
        cashtags: ["AAOI", "SIVE"],
        url: "https://x.com/michaelsikand/status/2050000000000000001",
      }),
    ]);
  });

  it("refreshes the current four tracked handles including Serenity's correct handle", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users/by/username/")) {
        const handle = url.match(/\/username\/([^?]+)/)?.[1] ?? "unknown";
        return jsonResponse({ data: { id: `id-${handle}` } });
      }

      const userId = url.match(/\/users\/([^/]+)\/tweets/)?.[1] ?? "unknown";
      return jsonResponse({
        data: [
          {
            id: `${userId}-tweet`,
            text: "Fresh post with $AMD",
            created_at: "2026-04-28T03:00:00.000Z",
            public_metrics: { like_count: 1, retweet_count: 2, reply_count: 3 },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchAllTweetsWithDiagnostics } = await import("../../lib/x/server");
    const { tweetsByAuthor, diagnostics } = await fetchAllTweetsWithDiagnostics();
    const requestedHandles = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/users/by/username/"))
      .map((url) => decodeURIComponent(url.match(/\/username\/([^?]+)/)?.[1] ?? ""));

    expect(requestedHandles).toEqual(["michaelsikand", "peterjwolff", "aleabitoreddit", "BryzonX"]);
    expect(Object.fromEntries(Object.entries(tweetsByAuthor).map(([key, tweets]) => [key, tweets.length]))).toEqual({
      s: 1,
      w: 1,
      a: 1,
      b: 1,
    });
    expect(diagnostics.a.handle).toBe("aleabitoreddit");
  });
});
