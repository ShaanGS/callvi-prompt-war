import { getDb } from "@/server/db/client";
import { json } from "@/server/http/respond";

/** Liveness + database reachability. Reports no configuration values. */
export async function GET() {
  try {
    const db = await getDb();
    await db.query("select 1");
    return json({ ok: true, database: db.kind });
  } catch {
    return json({ ok: false, database: "unreachable" }, 503);
  }
}
