import { getDb } from "@/server/db/client";
import { clientKey, handle, json } from "@/server/http/respond";
import { rateLimit } from "@/server/security/rate-limit";

/** Liveness + database reachability. Reports no configuration values. */
export async function GET(request: Request) {
  return handle(async () => {
    // Public and touches the database, so it must not be a free way to load it.
    rateLimit(`health:${clientKey(request)}`, 60, 60_000);
    try {
      const db = await getDb();
      await db.query("select 1");
      return json({ ok: true, database: db.kind });
    } catch {
      return json({ ok: false, database: "unreachable" }, 503);
    }
  });
}
