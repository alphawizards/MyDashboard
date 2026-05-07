import "server-only";
import { auditPostgresUrl } from "@/lib/db-config";

type QueryablePool = {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

let poolPromise: Promise<QueryablePool | null> | null = null;

export function isPostgresConfigured(): boolean {
  return auditPostgresUrl("DATABASE_URL", process.env.DATABASE_URL).valid;
}

async function getPool(): Promise<QueryablePool | null> {
  if (!isPostgresConfigured()) {
    return null;
  }

  poolPromise ??= (async () => {
    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) return null;
      const importPg = new Function("specifier", "return import(specifier)") as (
        specifier: string,
      ) => Promise<{ Pool: new (config: { connectionString: string }) => QueryablePool }>;
      const { Pool } = await importPg("pg");
      return new Pool({ connectionString });
    } catch {
      return null;
    }
  })();

  return poolPromise;
}

export async function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[] | null> {
  const pool = await getPool();
  if (!pool) return null;

  const result = await pool.query<T>(sql, params);
  return result.rows;
}
