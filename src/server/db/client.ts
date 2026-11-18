import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getConfig } from "../config/env";
import { log } from "../observability/log";
import { migrate } from "./migrate";
import { createPgliteDb } from "./pglite";
import { createPostgresDb } from "./postgres";
import { seedCourses } from "./seed";
import type { Db } from "./types";

declare global {
  // Survives Next.js dev hot reloads so the embedded database is opened once.
  var __lcDb: Promise<Db> | undefined;
}

/**
 * The process-wide database handle.
 *
 * Production / staging: PostgreSQL via DATABASE_URL (Supabase). Migrations and
 * course seeding are explicit deploy steps (`npm run db:migrate && npm run db:seed`).
 *
 * Local development without DATABASE_URL: an embedded PGlite database in
 * .data/pglite, migrated and seeded with course content on first use.
 */
export function getDb(): Promise<Db> {
  if (!globalThis.__lcDb) {
    const opening = open();
    globalThis.__lcDb = opening;
    // Do not cache a failed open; the next request retries.
    opening.catch(() => {
      if (globalThis.__lcDb === opening) globalThis.__lcDb = undefined;
    });
  }
  return globalThis.__lcDb;
}

async function open(): Promise<Db> {
  const config = getConfig();
  if (config.database.kind === "postgres") {
    return createPostgresDb(config.database.url);
  }
  if (config.isProduction) {
    throw new Error("The embedded database is not available in production. Set DATABASE_URL.");
  }
  const dataDir = config.database.dataDir ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const db = createPgliteDb(dataDir);
  const applied = await migrate(db, { localCompat: true });
  await seedCourses(db);
  log.info("db.local_ready", { applied: applied.length });
  return db;
}
