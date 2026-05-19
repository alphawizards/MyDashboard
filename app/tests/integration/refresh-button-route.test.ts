import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshAll } = vi.hoisted(() => ({
  refreshAll: vi.fn(),
}));

vi.mock("../../app/api/refresh/all/route", () => ({
  POST: refreshAll,
}));

describe("/api/refresh/button", () => {
  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("adds the refresh secret server-side without requiring the client to send it", async () => {
    process.env.REFRESH_SHARED_SECRET = "server-only-secret";
    const refreshResponse = Response.json({ ok: true, lastRefreshTime: "2026-05-11T00:00:00.000Z" });
    refreshAll.mockResolvedValue(refreshResponse);

    const { POST } = await import("../../app/api/refresh/button/route");
    const response = await POST(new Request("https://dashboard.example/api/refresh/button", {
      method: "POST",
      headers: { origin: "https://dashboard.example" },
    }));

    expect(response).toBe(refreshResponse);
    expect(refreshAll).toHaveBeenCalledWith(expect.any(Request));
    const forwardedRequest = refreshAll.mock.calls[0]?.[0] as Request;
    const headers = forwardedRequest.headers;
    expect(headers.get("x-refresh-trigger")).toBe("button");
    expect(headers.get("x-refresh-secret")).toBe("server-only-secret");
  });

  it("allows same host origins when Railway forwards the public host", async () => {
    const refreshResponse = Response.json({ ok: true });
    refreshAll.mockResolvedValue(refreshResponse);

    const { POST } = await import("../../app/api/refresh/button/route");
    const response = await POST(new Request("http://railway.internal/api/refresh/button", {
      method: "POST",
      headers: {
        host: "railway.internal",
        origin: "https://genuine-prosperity-production-afe2.up.railway.app",
        "x-forwarded-host": "genuine-prosperity-production-afe2.up.railway.app",
      },
    }));

    expect(response).toBe(refreshResponse);
    expect(refreshAll).toHaveBeenCalledOnce();
  });

  it("blocks cross-origin browser posts", async () => {
    const { POST } = await import("../../app/api/refresh/button/route");
    const response = await POST(new Request("https://dashboard.example/api/refresh/button", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "forbidden" });
    expect(refreshAll).not.toHaveBeenCalled();
  });
});
