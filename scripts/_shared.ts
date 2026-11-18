import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { buildConfig, type AppConfig } from "@/server/config/env";
import { createPgliteDb } from "@/server/db/pglite";
import { createPostgresDb } from "@/server/db/postgres";
import type { Db } from "@/server/db/types";

/** Load .env.local then .env (existing process variables win), matching Next.js precedence. */
export function loadEnv(): AppConfig {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
  return buildConfig(process.env);
}

/** Open the configured database without running migrations. */
export function openDb(config: AppConfig): Db {
  if (config.database.kind === "postgres") return createPostgresDb(config.database.url);
  const dataDir = config.database.dataDir ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  return createPgliteDb(dataDir);
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Run a script body, printing a short message and exiting non-zero on failure. */
export function run(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
