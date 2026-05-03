import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("account server storage", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracked-accounts-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not overwrite corrupt tracked account storage", async () => {
    const dataDir = path.join(tempDir, "data");
    const accountsFile = path.join(dataDir, "tracked-accounts.json");
    fs.mkdirSync(dataDir);
    fs.writeFileSync(accountsFile, "{not json", "utf-8");

    const { addAccount } = await import("../../lib/accounts/server");

    expect(() => addAccount({ handle: "newuser", name: "New User" })).toThrow(
      /tracked account storage/i,
    );
    expect(fs.readFileSync(accountsFile, "utf-8")).toBe("{not json");
  });
});
