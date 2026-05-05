type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /(authorization|bearer|cookie|database_url|dsn|key|password|secret|token|url)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item));
  if (isPlainObject(value)) return sanitizeContext(value);
  return value;
}

export function sanitizeContext(context: LogContext = {}): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

export function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export function createRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied) return supplied.slice(0, 120);
  return crypto.randomUUID();
}

function write(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info(event: string, context?: LogContext) {
    write("info", event, context);
  },
  warn(event: string, context?: LogContext) {
    write("warn", event, context);
  },
  error(event: string, context?: LogContext) {
    write("error", event, context);
  },
};
