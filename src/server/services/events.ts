import type { Queryable } from "../db/types";
import { eventsRepo } from "../repositories/ops";
import { log } from "../observability/log";

/**
 * Privacy-minimised product events (TRD §10). Metadata carries ids, counts
 * and codes only — never phone numbers, answers or transcripts.
 */
export type EventName =
  | "session.started"
  | "session.ended"
  | "session.failed"
  | "learner.identified"
  | "consent.granted"
  | "consent.declined"
  | "consent.revoked"
  | "goal.confirmed"
  | "course.selected"
  | "lesson.started"
  | "lesson.completed"
  | "practice.submitted"
  | "practice.feedback_given"
  | "checkpoint.saved"
  | "memory.retrieved"
  | "memory.updated"
  | "memory.deleted"
  | "account.deleted";

export async function recordEvent(
  db: Queryable,
  name: EventName,
  input: {
    learnerId?: string | null;
    sessionId?: string | null;
    channel?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  } = {},
): Promise<void> {
  try {
    await eventsRepo.record(db, { name, ...input });
  } catch (e) {
    // Events must never break a learning action.
    log.warn("event.record_failed", { name, error: e instanceof Error ? e.name : "unknown" });
  }
}
