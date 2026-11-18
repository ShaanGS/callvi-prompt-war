import { seedCourses } from "@/server/db/seed";
import { loadEnv, openDb, run } from "./_shared";

run(async () => {
  const db = openDb(loadEnv());
  try {
    const n = await seedCourses(db);
    console.log(`Seeded ${n} course(s) from src/content (idempotent upsert).`);
  } finally {
    await db.close();
  }
});
