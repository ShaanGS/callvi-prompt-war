import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./types";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const LOCAL_COMPAT = path.join(process.cwd(), "supabase", "local", "00_supabase_compat.sql");

/**
 * Apply versioned SQL migrations in filename order, recording each in
 * app_schema_migrations. The same files are valid Supabase CLI migrations.
 * For the embedded local database, a Supabase compatibility shim runs first.
 */
export async function migrate(db: Db, opts: { localCompat: boolean }): Promise<string[]> {
  if (opts.localCompat) {
    await db.execScript(await readFile(LOCAL_COMPAT, "utf8"));
  }
  await db.execScript(`create table if not exists public.app_schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );`);
  const applied = new Set(
    (await db.query(`select name from public.app_schema_migrations`)).map((r) =>
      typeof r === "object" && r !== null && "name" in r ? String(r.name) : "",
    ),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const escaped = file.replace(/'/g, "''");
    await db.execScript(`${sql}\n;insert into public.app_schema_migrations (name) values ('${escaped}');`);
    newlyApplied.push(file);
  }
  return newlyApplied;
}
