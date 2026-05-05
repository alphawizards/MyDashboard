import { describe, expect, it } from "vitest";
import { auditPostgresUrl } from "@/lib/db-config";
import { sanitizeContext, serializeError } from "@/lib/logger";

describe("database config audit", () => {
  it("accepts postgres and postgresql URLs with sanitized metadata only", () => {
    expect(auditPostgresUrl(
      "DATABASE_URL",
      "postgres://user:secret@host.railway.internal:5432/railway?sslmode=require",
    )).toEqual({
      variable: "DATABASE_URL",
      configured: true,
      valid: true,
      scheme: "postgres:",
      host: "host.railway.internal",
      port: 5432,
      database: "railway",
    });

    expect(auditPostgresUrl(
      "DATABASE_PUBLIC_URL",
      "postgresql://user:secret@roundhouse.proxy.rlwy.net:12345/railway",
    )).toMatchObject({
      variable: "DATABASE_PUBLIC_URL",
      valid: true,
      scheme: "postgresql:",
      host: "roundhouse.proxy.rlwy.net",
      port: 12345,
      database: "railway",
    });
  });

  it("rejects HTTP schemes and invalid ports", () => {
    expect(auditPostgresUrl("DATABASE_URL", "https://host.railway.internal:5432/railway")).toMatchObject({
      configured: true,
      valid: false,
      issue: "invalid_scheme",
    });

    expect(auditPostgresUrl("DATABASE_URL", "postgresql://user:pass@host:0/railway")).toMatchObject({
      configured: true,
      valid: false,
      issue: "invalid_port",
    });

    expect(auditPostgresUrl("DATABASE_URL", "postgresql://user:pass@host:PORT/railway")).toMatchObject({
      configured: true,
      valid: false,
    });
  });

  it("does not expose credentials, query params, or full URLs through logger helpers", () => {
    const sanitized = sanitizeContext({
      DATABASE_URL: "postgresql://user:secret@host:5432/railway?sslmode=require",
      nested: {
        password: "secret",
        host: "host.railway.internal",
      },
      error: new Error("connect ECONNREFUSED"),
    });

    expect(JSON.stringify(sanitized)).not.toContain("secret");
    expect(JSON.stringify(sanitized)).not.toContain("sslmode=require");
    expect(sanitized.nested).toMatchObject({ password: "[redacted]", host: "host.railway.internal" });
    expect(serializeError(new Error("boom"))).toEqual({ name: "Error", message: "boom" });
  });
});
