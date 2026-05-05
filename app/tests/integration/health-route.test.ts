import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns app liveness without database access", async () => {
    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: "dashboard-web" });
    expect(body.timestamp).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });
});
