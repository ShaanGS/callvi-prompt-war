import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/content/courses";
import type { Db, Queryable } from "@/server/db/types";
import { learnersRepo } from "@/server/repositories/learners";
import { createTestDb } from "../support/test-db";

/**
 * Row-level security, exercised with the same migrations against the local
 * Supabase-compatible shim (auth.uid() reads request.jwt.claim.sub).
 * Each probe runs in its own transaction because a permission error aborts it.
 */
async function as<T>(
  db: Db,
  role: "anon" | "authenticated",
  sub: string | null,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T | "denied"> {
  return db
    .transaction(async (tx) => {
      if (sub) await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub]);
      await tx.query(`set local role ${role}`);
      return fn(tx);
    })
    .catch(() => "denied" as const);
}

describe("row-level security", () => {
  it("lets an authenticated learner read only their own rows and write nothing directly", async () => {
    const db = await createTestDb();
    const a = await learnersRepo.create(db, { preferredLanguage: "en-IN" });
    const b = await learnersRepo.create(db, { preferredLanguage: "en-IN" });
    const userA = "11111111-1111-4111-8111-111111111111";
    await learnersRepo.addIdentity(db, a.id, "supabase", userA);
    await learnersRepo.addIdentity(db, b.id, "supabase", "22222222-2222-4222-8222-222222222222");

    expect(await as(db, "authenticated", userA, (tx) => tx.query(`select id from learners`))).toEqual([{ id: a.id }]);
    const courses = await as(db, "authenticated", userA, (tx) => tx.query(`select id from courses`));
    expect(Array.isArray(courses) && courses.length).toBe(COURSE_CATALOGUE.length);
    expect(await as(db, "authenticated", userA, (tx) => tx.query(`select count(*) from tool_invocations`))).toBe(
      "denied",
    );
    expect(
      await as(db, "authenticated", userA, (tx) =>
        tx.query(`update learners set display_name = 'changed' where id = $1`, [a.id]),
      ),
    ).toBe("denied");
    expect(await as(db, "authenticated", userA, (tx) => tx.query(`delete from learner_memory`))).toBe("denied");
  });

  it("gives anonymous visitors published course content only", async () => {
    const db = await createTestDb();
    await learnersRepo.create(db, { preferredLanguage: "en-IN" });
    const courses = await as(db, "anon", null, (tx) => tx.query(`select id from courses`));
    expect(Array.isArray(courses) && courses.length).toBe(COURSE_CATALOGUE.length);
    const learners = await as(db, "anon", null, (tx) => tx.query(`select id from learners`));
    expect(learners === "denied" || learners.length === 0).toBe(true);
  });
});
