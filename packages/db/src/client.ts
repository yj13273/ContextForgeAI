import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export type ContextForgeDb = NodePgDatabase<typeof schema>;

let defaultPool: pg.Pool | null = null;
let defaultDb: ContextForgeDb | null = null;

export function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/contextforge"
  );
}

export function createDbClient(connectionString?: string): {
  db: ContextForgeDb;
  pool: pg.Pool;
} {
  const connStr = connectionString || getConnectionString();
  const pool = new Pool({
    connectionString: connStr,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

export function getDb(): ContextForgeDb {
  if (!defaultDb) {
    const client = createDbClient();
    defaultPool = client.pool;
    defaultDb = client.db;
  }
  return defaultDb;
}

export async function checkDbConnection(pool?: pg.Pool): Promise<boolean> {
  const p = pool || defaultPool || createDbClient().pool;
  try {
    const client = await p.connect();
    try {
      const res = await client.query("SELECT 1 AS ready");
      return res.rows[0]?.ready === 1;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

export async function closeDbClient(pool?: pg.Pool): Promise<void> {
  const target = pool || defaultPool;
  if (target) {
    await target.end();
    if (target === defaultPool) {
      defaultPool = null;
      defaultDb = null;
    }
  }
}
