import postgres from "postgres";
import type { Db, Queryable } from "./types";

function normaliseParams(params: readonly unknown[] = []): postgres.ParameterOrJSON<never>[] {
  return params.map((p) => (p === undefined ? null : p)) as postgres.ParameterOrJSON<never>[];
}

/**
 * json/jsonb parameters: repositories pass JSON text (JSON.stringify output), which
 * PGlite stores as-is. postgres.js would JSON-encode that text a second time, so
 * strings pass through unchanged and only non-string values are encoded.
 */
export function serializeJsonParam(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

const JSON_OID = 114;
const JSONB_OID = 3802;

/**
 * Server-side PostgreSQL connection (Supabase Postgres via DATABASE_URL).
 * Use Supabase's transaction pooler (port 6543) in serverless deployments.
 * Disable query pipelining as well as prepared statements: Supavisor must not
 * receive overlapping transactions on one connection. A single short-lived
 * client per instance avoids reserving the small database pool across routes.
 */
export function createPostgresDb(url: string): Db {
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    max_pipeline: 1,
    idle_timeout: 5,
    max_lifetime: 60,
    queue_timeout: 10,
    connect_timeout: 10,
    connection: { application_name: "callvi" },
    onnotice: () => undefined,
    types: {
      json: { to: JSON_OID, from: [JSON_OID], serialize: serializeJsonParam, parse: (v: string) => JSON.parse(v) },
      jsonb: { to: JSONB_OID, from: [JSONB_OID], serialize: serializeJsonParam, parse: (v: string) => JSON.parse(v) },
    },
  });
  const wrap = (q: postgres.Sql | postgres.TransactionSql): Queryable => ({
    async query(text, params) {
      const rows = await q.unsafe(text, normaliseParams(params));
      return Array.from(rows);
    },
  });
  const base = wrap(sql);
  return {
    kind: "postgres",
    query: base.query,
    async transaction(fn) {
      const result = await sql.begin(async (tx) => fn(wrap(tx)));
      return result as Awaited<ReturnType<typeof fn>>;
    },
    async execScript(script) {
      await sql.begin(async (tx) => {
        // No parameters: postgres.js uses the simple protocol, which allows
        // multiple statements in one script.
        await tx.unsafe(script);
      });
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
