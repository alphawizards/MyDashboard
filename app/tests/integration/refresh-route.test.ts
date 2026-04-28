import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const fetchAllTweetsWithDiagnostics = vi.fn();
const isXConfigured = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/x/server", () => ({
  fetchAllTweetsWithDiagnostics,
  isXConfigured,
}));

describe("/api/refresh/all", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.REFRESH_SHARED_SECRET;
    isXConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
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
  });
});
