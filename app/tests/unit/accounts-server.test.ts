import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const queryRows = vi.fn();

vi.mock("@/lib/db/postgres", () => ({ queryRows }));

describe("server account repository", () => {
  beforeEach(() => {
    vi.resetModules();
    queryRows.mockReset();
  });

  it("loads active DB accounts alongside static authors without duplicating seeded handles", async () => {
    queryRows.mockImplementation(async (sql: string) => {
      if (sql.includes("select key, slug, handle")) {
        return [
          {
            key: "u_newuser",
            slug: "newuser",
            handle: "newuser",
            name: "New User",
            short_name: "NU",
            color: "#06b6d4",
            bio: "",
            followers: "N/A",
            avatar: null,
            platform: "X",
            win_rate: null,
            shadow_score: null,
            rank_source: null,
          },
          {
            key: "duplicate-static",
            slug: "duplicate-static",
            handle: "fransbakker9812",
            name: "Duplicate Static",
            short_name: "DS",
            color: "#111111",
            bio: "",
            followers: "N/A",
            avatar: null,
            platform: "X",
            win_rate: null,
            shadow_score: null,
            rank_source: null,
          },
        ];
      }
      return [];
    });

    const { getTrackedAuthors } = await import("../../lib/accounts/server");
    const authors = await getTrackedAuthors();

    expect(authors.some((author) => author.key === "u_newuser")).toBe(true);
    expect(authors.filter((author) => author.handle.toLowerCase() === "fransbakker9812")).toHaveLength(1);
  });

  it("persists new accounts to tracked_accounts when the DB is available", async () => {
    const inserts: unknown[][] = [];
    queryRows.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("select key, slug, handle")) return [];
      if (sql.includes("insert into tracked_accounts")) {
        inserts.push(params ?? []);
      }
      return [];
    });

    const { addAccount } = await import("../../lib/accounts/server");
    const account = await addAccount({ handle: "newuser", name: "New User" });

    expect(account).toMatchObject({
      key: "u_newuser",
      slug: "newuser",
      handle: "newuser",
      name: "New User",
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toBe("u_newuser");
  });
});
