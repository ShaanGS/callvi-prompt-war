import { z } from "zod";
import { col, many, type Db } from "../db/types";
import { emptySessionState } from "../domain/types";
import { deletionReceiptsRepo } from "../repositories/ops";
import { recordEvent } from "./events";

/**
 * Deletion policy (documented in docs/PRIVACY_AND_RETENTION.md):
 *
 * - "learning_memory": erases goals, enrolments, lesson progress, concept
 *   mastery, checkpoints, practice attempts, structured memory, closed session
 *   records, tool traces and events for the learner. Open sessions are reset
 *   to an empty, session-only state. The learner profile and sign-in identity
 *   remain so the learner can keep using the product without saved progress.
 * - "account": deletes the learner row; every learner-owned table cascades.
 *
 * Audio is never recorded and transcripts are never stored, so there are no
 * recordings or transcripts to delete. A non-identifying receipt is kept.
 */

async function countRows(db: Db, learnerId: string): Promise<number> {
  const rows = await many(
    db,
    z.object({ n: col.int }),
    `select (
       (select count(*) from learner_goals where learner_id = $1) +
       (select count(*) from enrollments where learner_id = $1) +
       (select count(*) from lesson_progress where learner_id = $1) +
       (select count(*) from concept_mastery where learner_id = $1) +
       (select count(*) from learning_checkpoints where learner_id = $1) +
       (select count(*) from practice_attempts where learner_id = $1) +
       (select count(*) from learning_evidence where learner_id = $1) +
       (select count(*) from learner_memory where learner_id = $1) +
       (select count(*) from learning_sessions where learner_id = $1) +
       (select count(*) from tool_invocations where learner_id = $1) +
       (select count(*) from app_events where learner_id = $1)
     )::int as n`,
    [learnerId],
  );
  return rows[0]?.n ?? 0;
}

export const deletionService = {
  async deleteLearningMemory(
    db: Db,
    learnerId: string,
    channel: "browser" | "phone" | "text" | "settings",
  ): Promise<number> {
    const before = await countRows(db, learnerId);
    await db.transaction(async (tx) => {
      await tx.query(`delete from practice_attempts where learner_id = $1`, [learnerId]);
      await tx.query(`delete from learning_checkpoints where learner_id = $1`, [learnerId]);
      await tx.query(`delete from concept_mastery where learner_id = $1`, [learnerId]);
      await tx.query(`delete from lesson_progress where learner_id = $1`, [learnerId]);
      await tx.query(`update learning_sessions set enrollment_id = null where learner_id = $1`, [learnerId]);
      await tx.query(`delete from enrollments where learner_id = $1`, [learnerId]);
      await tx.query(`delete from learner_goals where learner_id = $1`, [learnerId]);
      await tx.query(`delete from learner_memory where learner_id = $1`, [learnerId]);
      await tx.query(`delete from tool_invocations where learner_id = $1`, [learnerId]);
      await tx.query(`delete from app_events where learner_id = $1`, [learnerId]);
      await tx.query(
        `delete from learning_sessions where learner_id = $1 and status not in ('started', 'active', 'paused')`,
        [learnerId],
      );
      await tx.query(
        `update learning_sessions set state = $2::jsonb, state_version = state_version + 1, summary = null,
           checkpoint = null, memory_mode = 'session_only'
         where learner_id = $1`,
        [learnerId, JSON.stringify(emptySessionState())],
      );
    });
    const after = await countRows(db, learnerId);
    const deleted = Math.max(before - after, 0);
    await deletionReceiptsRepo.record(db, { scope: "learning_memory", channel, rowsDeleted: deleted });
    await recordEvent(db, "memory.deleted", { channel, metadata: { rows: deleted } });
    return deleted;
  },

  /** Delete the learner and all dependent data. Returns the identities that were removed. */
  async deleteAccount(
    db: Db,
    learnerId: string,
    channel: "browser" | "phone" | "text" | "settings",
  ): Promise<{ rowsDeleted: number; identities: { provider: string; subject: string }[] }> {
    const identities = await many(
      db,
      z.object({ provider: z.string(), subject: z.string() }),
      `select provider, subject from learner_identities where learner_id = $1`,
      [learnerId],
    );
    const rowsDeleted = (await countRows(db, learnerId)) + identities.length + 1;
    await db.query(`delete from learners where id = $1`, [learnerId]);
    await deletionReceiptsRepo.record(db, { scope: "account", channel, rowsDeleted });
    return { rowsDeleted, identities };
  },
};
