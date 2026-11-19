import { describe, expect, it } from "vitest";
import { createTestDb } from "../support/test-db";

/**
 * Properties of the migrated schema itself, checked against the real
 * migrations rather than by reading the SQL.
 */
describe("schema", () => {
  it("has an index leading with every foreign-key column", async () => {
    // Postgres does not index foreign keys automatically. Without one, deleting
    // a learner (which cascades) or a session (which sets null) scans every
    // referencing table, and per-learner reads fall back to sequential scans.
    const db = await createTestDb();
    const unindexed = await db.query(`
      select c.conrelid::regclass || '(' || string_agg(a.attname, ', ' order by k.n) || ')' as ref
        from pg_constraint c
        cross join lateral unnest(c.conkey) with ordinality as k(attnum, n)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
       where c.contype = 'f'
         and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
            where i.indrelid = c.conrelid
              and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
              and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
       group by c.conrelid, c.conname
       order by 1`);
    expect(unindexed.map((r) => (r as { ref: string }).ref)).toEqual([]);
  });

  it("enables row-level security on every table", async () => {
    const db = await createTestDb();
    const open = await db.query(
      `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity order by 1`,
    );
    expect(open.map((r) => (r as { relname: string }).relname)).toEqual([]);
  });
});
