import { PGlite } from "@electric-sql/pglite";
import type { Db, Queryable } from "./types";

function normaliseParams(params: readonly unknown[] = []): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

/**
 * Embedded PostgreSQL (PGlite) used for local development and automated tests
 * when DATABASE_URL is not configured. Never used in production.
 */
export function createPgliteDb(dataDir?: string): Db {
  const pg = new PGlite(dataDir);
  const wrap = (q: { query: PGlite["query"] }): Queryable => ({
    async query(sql, params) {
      const result = await q.query(sql, normaliseParams(params));
      return result.rows;
    },
  });
  const base = wrap(pg);
  return {
    kind: "pglite",
    query: base.query,
    async transaction(fn) {
      return pg.transaction(async (tx) => fn(wrap(tx)));
    },
    async execScript(sql) {
      await pg.transaction(async (tx) => {
        await tx.exec(sql);
      });
    },
    async close() {
      await pg.close();
    },
  };
}
