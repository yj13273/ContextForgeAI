import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ContextForgeDb } from "./client.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(
  db: ContextForgeDb,
  migrationsFolder?: string
): Promise<void> {
  const folder = migrationsFolder || path.resolve(__dirname, "../drizzle");
  await migrate(db, { migrationsFolder: folder });
}
