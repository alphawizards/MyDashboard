import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAllTweetsWithDiagnostics,
  isXConfigured,
  refreshFarsideBtcFlows,
  refreshTickerFacts,
  revalidatePath,
} = vi.hoisted(() => ({
  fetchAllTweetsWithDiagnostics: vi.fn(),
  isXConfigured: vi.fn(),
  refreshFarsideBtcFlows: vi.fn(),
  refreshTickerFacts: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/app/lib/watchlist/farside", () => ({ refreshFarsideBtcFlows }));
vi.mock("@/lib/stocks/account-tracker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stocks/account-tracker")>();

  return {
    ...actual,
    refreshTickerFacts,
  };
});
vi.mock("@/lib/x/server", () => ({
  fetchAllTweetsWithDiagnostics,
  isXConfigured,
}));

describe("/api/refresh/all", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    revalidatePath.mockReset();
    fetchAllTweetsWithDiagnostics.mockReset();
    isXConfigured.mockReset();
    refreshFarsideBtcFlows.mockReset();
    refreshTickerFacts.mockReset();
    delete process.env.REFRESH_SHARED_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PUBLIC_URL;
    isXConfigured.mockReturnValue(true);
    refreshFarsideBtcFlows.mockResolvedValue({
      rows: [],
      sourceUrl: "https://farside.co.uk/bitcoin-etf-flow-all-data/",
      status: {
        provider: "farside",
        status: "ok",
        message: "Loaded 10 Farside rows.",
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PUBLIC_URL;
    vi.restoreAllMocks();
  });

  it("reports non-zero fetched counts after a live refresh", async () => {
    fetchAllTweetsWithDiagnostics.mockResolvedValue({
      tweetsByAuthor: {
        s: [{ id: "s1" }],
        w: [{ id: "w1" }, { id: "w2" }],
        a: [{ id: "a1" }],
        b: [{ id: "b1" }],
      },
      diagnostics: {
        s: { handle: "michaelsikand", userLookup: { ok: true, status: 200 }, tweets: { ok: true, status: 200, returned: 1 } },
        w: { handle: "peterjwolff", userLookup: { ok: true, status: 200 }, tweets: { ok: true, status: 200, returned: 2 } },
        a: { handle: "aleabitoreddit", userLookup: { ok: true, status: 200 }, tweets: { ok: true, status: 200, returned: 1 } },
        b: { handle: "BryzonX", userLookup: { ok: true, status: 200 }, tweets: { ok: true, status: 200, returned: 1 } },
      },
    });

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      refreshed: true,
      mode: "live",
      fetched: { s: 1, w: 2, a: 1, b: 1 },
    });
    expect(body.diagnostics.a.handle).toBe("aleabitoreddit");
    expect(revalidatePath).toHaveBeenCalledWith("/feed");
    expect(revalidatePath).toHaveBeenCalledWith("/watchlist");
    expect(body.providers.farside.status).toBe("ok");
    expect(body.requestId).toBeTruthy();
  });

  it("refreshes Yahoo facts from live Serenity cashtags", async () => {
    fetchAllTweetsWithDiagnostics.mockResolvedValue({
      tweetsByAuthor: {
        a: [
          {
            id: "a1",
            text: "$SIVE $AAOI",
            created_at: "2026-05-08T00:00:00.000Z",
            likes: 0,
            retweets: 0,
            replies: 0,
            cashtags: ["$SIVE", "$AAOI", "$AAOI"],
            url: "https://x.com/aleabitoreddit/status/a1",
          },
        ],
      },
      diagnostics: {
        a: { handle: "aleabitoreddit", userLookup: { ok: true, status: 200 }, tweets: { ok: true, status: 200, returned: 1 } },
      },
    });

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(refreshTickerFacts).toHaveBeenCalledWith(expect.arrayContaining(["SIVE", "AAOI"]));
    expect(body.yahoo).toEqual({ source: "live", tickers: 2 });
  });

  it("refreshes Yahoo facts from static Serenity tickers when X is not configured", async () => {
    isXConfigured.mockReturnValue(false);

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchAllTweetsWithDiagnostics).not.toHaveBeenCalled();
    expect(refreshTickerFacts).toHaveBeenCalledWith(expect.arrayContaining(["SIVE", "AAOI"]));
    expect(body.yahoo.source).toBe("static");
    expect(body.yahoo.tickers).toBeGreaterThan(0);
  });

  it("keeps diagnostics visible when X returns zero fetched posts", async () => {
    fetchAllTweetsWithDiagnostics.mockResolvedValue({
      tweetsByAuthor: { s: [], w: [], a: [], b: [] },
      diagnostics: {
        s: {
          handle: "michaelsikand",
          userLookup: { ok: true, status: 200 },
          tweets: { ok: false, status: 400, error: "Invalid Request" },
        },
        w: {
          handle: "peterjwolff",
          userLookup: { ok: true, status: 200 },
          tweets: { ok: false, status: 400, error: "Invalid Request" },
        },
        a: {
          handle: "aleabitoreddit",
          userLookup: { ok: true, status: 200 },
          tweets: { ok: false, status: 400, error: "Invalid Request" },
        },
        b: {
          handle: "BryzonX",
          userLookup: { ok: true, status: 200 },
          tweets: { ok: false, status: 400, error: "Invalid Request" },
        },
      },
    });

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fetched).toEqual({ s: 0, w: 0, a: 0, b: 0 });
    expect(body.diagnostics.s.tweets).toMatchObject({
      ok: false,
      status: 400,
      error: "Invalid Request",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/feed");
    expect(revalidatePath).toHaveBeenCalledWith("/watchlist");
  });

  it("returns 401 without logging secrets when the refresh secret is wrong", async () => {
    process.env.REFRESH_SHARED_SECRET = "super-secret-value";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", {
      method: "POST",
      headers: {
        "x-refresh-secret": "wrong-secret",
        "x-request-id": "req-auth-fail",
      },
    }));
    const body = await response.json();
    const logs = [...warn.mock.calls, ...info.mock.calls].flat().join("\n");

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized", requestId: "req-auth-fail" });
    expect(logs).not.toContain("super-secret-value");
    expect(logs).not.toContain("wrong-secret");
    expect(refreshFarsideBtcFlows).not.toHaveBeenCalled();
  });

  it("returns controlled 500 JSON when Farside throws", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    refreshFarsideBtcFlows.mockRejectedValue(new Error("Farside exploded"));

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", {
      method: "POST",
      headers: { "x-request-id": "req-farside-fail" },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "refresh_failed", requestId: "req-farside-fail" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps X refresh failures observable while returning the existing fallback success", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchAllTweetsWithDiagnostics.mockRejectedValue(new Error("X API unavailable"));

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", {
      method: "POST",
      headers: { "x-request-id": "req-x-fail" },
    }));
    const body = await response.json();
    const warnLogs = warn.mock.calls.flat().join("\n");

    expect(response.status).toBe(200);
    expect(body.mode).toBe("live-fallback");
    expect(warnLogs).toContain("refresh.x.failure");
    expect(warnLogs).toContain("X API unavailable");
    expect(revalidatePath).toHaveBeenCalledWith("/feed");
    expect(revalidatePath).toHaveBeenCalledWith("/watchlist");
  });

  it("returns controlled 500 JSON when revalidation throws", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchAllTweetsWithDiagnostics.mockResolvedValue({
      tweetsByAuthor: { s: [] },
      diagnostics: {
        s: { handle: "michaelsikand", userLookup: { ok: true, status: 200 } },
      },
    });
    revalidatePath.mockImplementation(() => {
      throw new Error("revalidate failed");
    });

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", {
      method: "POST",
      headers: { "x-request-id": "req-revalidate-fail" },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "refresh_failed", requestId: "req-revalidate-fail" });
  });

  it("logs malformed database URLs without failing the refresh route", async () => {
    process.env.DATABASE_URL = "http://postgres.internal:5432/railway";
    process.env.DATABASE_PUBLIC_URL = "postgresql://user:pass@roundhouse.proxy.rlwy.net:PORT/railway?sslmode=require";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchAllTweetsWithDiagnostics.mockResolvedValue({
      tweetsByAuthor: { s: [] },
      diagnostics: {
        s: { handle: "michaelsikand", userLookup: { ok: true, status: 200 } },
      },
    });

    const { POST } = await import("../../app/api/refresh/all/route");
    const response = await POST(new Request("http://localhost/api/refresh/all", {
      method: "POST",
      headers: { "x-request-id": "req-db-warning" },
    }));
    const body = await response.json();
    const warnLogs = warn.mock.calls.flat().join("\n");

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(warnLogs).toContain("db.config.warning");
    expect(warnLogs).not.toContain("user:pass");
    expect(warnLogs).not.toContain("sslmode=require");
  });
});
