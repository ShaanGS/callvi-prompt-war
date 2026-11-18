import { z } from "zod";

/** Minimal SQL surface used by repositories. Parameters are positional ($1, $2, ...). */
export interface Queryable {
  query(sql: string, params?: readonly unknown[]): Promise<unknown[]>;
}

export interface Db extends Queryable {
  readonly kind: "pglite" | "postgres";
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /** Run a multi-statement SQL script (migrations) inside one transaction. */
  execScript(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** Parse every row with a schema so repositories never cast database results. */
export function parseRows<S extends z.ZodType>(schema: S, rows: unknown[]): z.infer<S>[] {
  return rows.map((row) => schema.parse(row));
}

export async function many<S extends z.ZodType>(
  db: Queryable,
  schema: S,
  sql: string,
  params: readonly unknown[] = [],
): Promise<z.infer<S>[]> {
  return parseRows(schema, await db.query(sql, params));
}

export async function maybeOne<S extends z.ZodType>(
  db: Queryable,
  schema: S,
  sql: string,
  params: readonly unknown[] = [],
): Promise<z.infer<S> | null> {
  const rows = await db.query(sql, params);
  return rows.length === 0 ? null : schema.parse(rows[0]);
}

export async function one<S extends z.ZodType>(
  db: Queryable,
  schema: S,
  sql: string,
  params: readonly unknown[] = [],
): Promise<z.infer<S>> {
  const row = await maybeOne(db, schema, sql, params);
  if (row === null) throw new Error("Expected exactly one row");
  return row;
}

export async function exec(db: Queryable, sql: string, params: readonly unknown[] = []): Promise<number> {
  const rows = await db.query(sql, params);
  return rows.length;
}

/** Shared column codecs. Drivers differ slightly (numeric as string, etc.). */
export const col = {
  uuid: z.string().uuid(),
  text: z.string(),
  nullableText: z.string().nullable(),
  int: z.coerce.number().int(),
  nullableInt: z.coerce.number().int().nullable(),
  real: z.coerce.number(),
  nullableReal: z.union([z.null(), z.coerce.number()]),
  bool: z.boolean(),
  date: z.coerce.date(),
  nullableDate: z.union([z.null(), z.coerce.date()]),
  json: z.unknown(),
};

export function jsonParam(value: unknown): string {
  return JSON.stringify(value);
}
