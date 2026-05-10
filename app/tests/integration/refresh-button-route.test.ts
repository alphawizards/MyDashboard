import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/refresh/button", () => {
  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
    vi.restoreAllMocks();
  });

  it("adds the refresh secret server-side without requiring the client to send it", async () => {
    process.env.REFRESH_SHARED_SECRET = "server-only-secret";
    const refreshResponse = Response.json({ ok: true, lastRefreshTime: "2026-05-11T00:00:00.000Z" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(refreshResponse);

    const { POST } = await import("../../app/api/refresh/button/route");
    const response = await POST(new Request("https://dashboard.example/api/refresh/button", {
      method: "POST",
      headers: { origin: "https://dashboard.example" },
    }));

    expect(response).toBe(refreshResponse);
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://dashboard.example/api/refresh/all"), {
      method: "POST",
      headers: expect.any(Headers),
      cache: "no-store",
    });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-refresh-trigger")).toBe("button");
    expect(headers.get("x-refresh-secret")).toBe("server-only-secret");
  });

  it("blocks cross-origin browser posts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const { POST } = await import("../../app/api/refresh/button/route");
    const response = await POST(new Request("https://dashboard.example/api/refresh/button", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
