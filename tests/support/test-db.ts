import { createPgliteDb } from "@/server/db/pglite";
import { migrate } from "@/server/db/migrate";
import { seedCourses } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import { clearCourseCache } from "@/server/services/course-service";
import { learnerService } from "@/server/services/learner-service";
import { sessionService } from "@/server/services/session-service";
import type { Channel, Learner } from "@/server/domain/types";
import { randomUUID } from "node:crypto";

/** A fresh, migrated, seeded in-memory database (local fixtures only). */
export async function createTestDb(): Promise<Db> {
  const db = createPgliteDb();
  await migrate(db, { localCompat: true });
  await seedCourses(db);
  clearCourseCache();
  return db;
}

export async function createLearner(
  db: Db,
  opts: { consent?: "granted" | "declined" | "pending"; language?: "ta-IN" | "en-IN" } = {},
): Promise<Learner> {
  const { learner } = await learnerService.resolveOrCreate(
    db,
    { provider: "dev", subject: `test-${randomUUID()}` },
    { preferredLanguage: opts.language ?? "en-IN" },
  );
  if (opts.consent && opts.consent !== "pending") {
    return learnerService.recordConsent(db, learner.id, opts.consent, "browser");
  }
  return learner;
}

export async function startSession(db: Db, learner: Learner, channel: Channel = "simulated", courseId?: string) {
  return sessionService.start(db, {
    learner,
    channel,
    provider: channel === "simulated" ? "simulation" : channel === "text" ? "none" : "sarvam",
    courseId: courseId ?? null,
  });
}
