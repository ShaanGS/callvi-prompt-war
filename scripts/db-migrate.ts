import { migrate } from "@/server/db/migrate";
import { loadEnv, openDb, run } from "./_shared";

run(async () => {
  const config = loadEnv();
  const db = openDb(config);
  try {
    // The local shim provides the auth schema and roles that Supabase already has.
    const applied = await migrate(db, { localCompat: config.database.kind === "pglite" });
    console.log(
      applied.length ? `Applied ${applied.length} migration(s): ${applied.join(", ")}` : "Database is up to date.",
    );
  } finally {
    await db.close();
  }
});
