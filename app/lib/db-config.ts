import { logger } from "@/lib/logger";

type DbUrlAudit =
  | {
      variable: string;
      configured: false;
      valid: false;
      issue: "missing";
    }
  | {
      variable: string;
      configured: true;
      valid: true;
      scheme: "postgres:" | "postgresql:";
      host: string;
      port: number;
      database: string;
    }
  | {
      variable: string;
      configured: true;
      valid: false;
      issue: "invalid_url" | "invalid_scheme" | "missing_host" | "missing_database" | "invalid_port";
      scheme?: string;
    };

const POSTGRES_SCHEMES = new Set(["postgres:", "postgresql:"]);
let hasLoggedDbConfig = false;

export function auditPostgresUrl(variable: string, value: string | undefined): DbUrlAudit {
  if (!value?.trim()) {
    return { variable, configured: false, valid: false, issue: "missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { variable, configured: true, valid: false, issue: "invalid_url" };
  }

  if (!POSTGRES_SCHEMES.has(parsed.protocol)) {
    return {
      variable,
      configured: true,
      valid: false,
      issue: "invalid_scheme",
      scheme: parsed.protocol.replace(/:$/, ""),
    };
  }

  if (!parsed.hostname) {
    return { variable, configured: true, valid: false, issue: "missing_host", scheme: parsed.protocol };
  }

  const database = parsed.pathname.replace(/^\//, "");
  if (!database) {
    return { variable, configured: true, valid: false, issue: "missing_database", scheme: parsed.protocol };
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { variable, configured: true, valid: false, issue: "invalid_port", scheme: parsed.protocol };
  }

  return {
    variable,
    configured: true,
    valid: true,
    scheme: parsed.protocol as "postgres:" | "postgresql:",
    host: parsed.hostname,
    port,
    database,
  };
}

export function auditConfiguredDatabaseUrls() {
  return [
    auditPostgresUrl("DATABASE_URL", process.env.DATABASE_URL),
    auditPostgresUrl("DATABASE_PUBLIC_URL", process.env.DATABASE_PUBLIC_URL),
  ];
}

export function logDatabaseConfigOnce(context: { requestId?: string } = {}) {
  if (hasLoggedDbConfig) return;
  hasLoggedDbConfig = true;

  const audits = auditConfiguredDatabaseUrls();
  for (const audit of audits) {
    const event = audit.valid ? "db.config.valid" : "db.config.warning";
    const level = audit.valid ? logger.info : logger.warn;
    level(event, { ...context, db: audit });
  }
}

export function resetDatabaseConfigAuditForTests() {
  hasLoggedDbConfig = false;
}
