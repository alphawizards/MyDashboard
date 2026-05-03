import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addAccount = vi.fn();
const findByHandle = vi.fn();
const isXConfigured = vi.fn();
const verifyXUserExists = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/accounts/server", () => ({ addAccount, findByHandle }));
vi.mock("@/lib/x/server", () => ({ isXConfigured, verifyXUserExists }));

describe("POST /api/x-accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REFRESH_SHARED_SECRET;
    isXConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
  });

  it("returns 401 when REFRESH_SHARED_SECRET is configured", async () => {
    process.env.REFRESH_SHARED_SECRET = "admin-secret";

    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "newuser", name: "New User" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/not available/i);
    expect(addAccount).not.toHaveBeenCalled();
  });

  it("returns 400 for empty body", async () => {
    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing handle", async () => {
    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New User" }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid handle format", async () => {
    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "!!!invalid!!!", name: "New User" }),
    }));

    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate handle", async () => {
    findByHandle.mockReturnValue({ key: "u_existing", handle: "existing" });

    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "existing", name: "Existing" }),
    }));

    expect(res.status).toBe(409);
    expect(addAccount).not.toHaveBeenCalled();
  });

  it("returns 422 when X user is not found", async () => {
    isXConfigured.mockReturnValue(true);
    verifyXUserExists.mockResolvedValue({ exists: false, diagnostic: { ok: false, status: 404, error: "Not Found" } });
    findByHandle.mockReturnValue(undefined);

    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "nonexistent", name: "Ghost" }),
    }));

    expect(res.status).toBe(422);
    expect(addAccount).not.toHaveBeenCalled();
  });

  it("returns 201 for valid input when X is not configured", async () => {
    findByHandle.mockReturnValue(undefined);
    addAccount.mockReturnValue({ key: "u_newuser", handle: "newuser", name: "New User" });

    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "newuser", name: "New User" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.account.key).toBe("u_newuser");
    expect(addAccount).toHaveBeenCalledWith({ handle: "newuser", name: "New User" });
  });

  it("returns 201 when X user exists and has zero tweets", async () => {
    isXConfigured.mockReturnValue(true);
    verifyXUserExists.mockResolvedValue({ exists: true, diagnostic: { ok: true, status: 200 } });
    findByHandle.mockReturnValue(undefined);
    addAccount.mockReturnValue({ key: "u_quiet", handle: "quiet", name: "Quiet" });

    const { POST } = await import("../../app/api/x-accounts/route");
    const res = await POST(new Request("http://localhost/api/x-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "quiet", name: "Quiet" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(addAccount).toHaveBeenCalled();
  });
});

describe("GET /api/x-accounts", () => {
  afterEach(() => {
    delete process.env.REFRESH_SHARED_SECRET;
  });

  it("returns enabled=true when no secret is configured", async () => {
    const { GET } = await import("../../app/api/x-accounts/route");
    const res = await GET();
    const body = await res.json();

    expect(body.enabled).toBe(true);
  });

  it("returns enabled=false when REFRESH_SHARED_SECRET is configured", async () => {
    process.env.REFRESH_SHARED_SECRET = "set";
    const { GET } = await import("../../app/api/x-accounts/route");
    const res = await GET();
    const body = await res.json();

    expect(body.enabled).toBe(false);
  });
});
