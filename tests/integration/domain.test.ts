import { beforeAll, describe, expect, it } from "vitest";
import { runTool } from "@/server/agent/orchestrator";
import { buildLearningContext } from "@/server/agent/context-builder";
import type { Db } from "@/server/db/types";
import type { Learner, LearningSession } from "@/server/domain/types";
import { learnerService } from "@/server/services/learner-service";
import { deletionService } from "@/server/services/deletion-service";
import { memoryService } from "@/server/services/memory-service";
import { sessionService } from "@/server/services/session-service";
import { studyRoom } from "@/server/services/study-room";
import { createLearner, createTestDb, startSession } from "../support/test-db";

const LEARNER_TABLES = [
  "learner_identities",
  "consent_records",
  "learning_sessions",
  "learner_goals",
  "enrollments",
  "lesson_progress",
  "concept_mastery",
  "learning_checkpoints",
  "practice_attempts",
  "learner_memory",
  "tool_invocations",
  "app_events",
];

async function count(db: Db, table: string, learnerId: string): Promise<number> {
  const rows = await db.query(`select count(*)::int as n from ${table} where learner_id = $1`, [learnerId]);
  const first = rows[0];
  return typeof first === "object" && first !== null && "n" in first ? Number(first.n) : 0;
}

/** Drive tools as the agent would, keeping the latest session/learner. */
function agent(db: Db, learner: Learner, session: LearningSession) {
  const state = { learner, session };
  return {
    state,
    async call(toolName: string, rawInput: Record<string, unknown> = {}) {
      const r = await runTool({ db, channel: state.session.channel, learner: state.learner, session: state.session, toolName, rawInput, interactionId: null });
      if (r.session) state.session = r.session;
      if (r.learner) state.learner = r.learner;
      return r.response;
    },
  };
}

async function learnSomething(db: Db, learner: Learner) {
  const a = agent(db, learner, await startSession(db, learner));
  await a.call("set_learning_goal", { goal_text: "Price my homemade snacks", learner_confirmed: true });
  await a.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
  await a.call("get_lesson_context");
  await a.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "I make murukku for working families on my street" });
  await a.call("update_memory_preference", { key: "pace", value: "slower", learner_confirmed: true });
  await a.call("save_checkpoint");
  return a;
}

describe("consent gating and revocation", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it("writes nothing durable while consent is pending or declined", async () => {
    for (const consent of ["pending", "declined"] as const) {
      const learner = await createLearner(db, { consent });
      await learnSomething(db, learner);
      for (const t of ["learner_goals", "enrollments", "concept_mastery", "learning_checkpoints", "practice_attempts", "learner_memory"]) {
        expect(await count(db, t, learner.id), `${consent}: ${t}`).toBe(0);
      }
    }
  });

  it("revoking consent erases learning memory, keeps the account and switches open sessions to session-only", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    expect(await count(db, "practice_attempts", learner.id)).toBe(1);
    const revoked = await learnerService.revokeConsent(db, learner.id, "settings");
    expect(revoked.consentStatus).toBe("revoked");
    for (const t of ["learner_goals", "enrollments", "concept_mastery", "learning_checkpoints", "practice_attempts", "learner_memory"]) {
      expect(await count(db, t, learner.id), t).toBe(0);
    }
    const reloaded = await sessionService.getOwned(db, a.state.session.id, learner.id);
    expect(reloaded.memoryMode).toBe("session_only");
    expect(await count(db, "consent_records", learner.id)).toBeGreaterThanOrEqual(2);
  });
});

describe("context builder relevance", () => {
  it("returns only this learner's active goal, course and current lesson, with no history dump", async () => {
    const db = await createTestDb();
    const other = await createLearner(db, { consent: "granted" });
    const a2 = agent(db, other, await startSession(db, other));
    await a2.call("set_learning_goal", { goal_text: "Another learner's private goal", learner_confirmed: true });

    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    const ctx = await buildLearningContext(db, a.state.learner, a.state.session);
    const json = JSON.stringify(ctx);

    expect(ctx.active_goal).toBe("Price my homemade snacks");
    expect(ctx.active_course?.id).toBe("small-business-starter");
    expect(ctx.progress?.current_lesson?.id).toBe("sbs-01");
    expect(json).not.toContain("Another learner's private goal");
    expect(json).not.toContain("I make murukku"); // practice answers are not replayed into context
    expect(json).not.toContain("explanations"); // course text comes from get_lesson_context, not the context dump
    expect(json.length).toBeLessThan(4000);
  });
});

describe("memory provenance and correction", () => {
  it("records where each memory came from and lets the learner correct and delete it", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    let summary = await memoryService.getSummary(db, a.state.learner, "en-IN");
    expect(summary.activeGoal?.source).toBe("voice_session");
    expect(summary.preferences.find((p) => p.key === "pace")?.sourceSessionId).toBe(a.state.session.id);

    await memoryService.correctGoal(db, a.state.learner, "Sell stitched blouses", { source: "learner_settings", sourceSessionId: null });
    summary = await memoryService.getSummary(db, a.state.learner, "en-IN");
    expect(summary.activeGoal?.text).toBe("Sell stitched blouses");
    expect(summary.activeGoal?.source).toBe("settings");

    const pref = summary.preferences.find((p) => p.key === "pace");
    expect(pref).toBeDefined();
    await memoryService.deletePreference(db, a.state.learner, pref!.id);
    summary = await memoryService.getSummary(db, a.state.learner, "en-IN");
    expect(summary.preferences.find((p) => p.key === "pace")).toBeUndefined();
  });
});

describe("checkpoint and session-end idempotency", () => {
  it("duplicate on-end and duplicate enrolment never write twice", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    await a.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
    expect(await count(db, "enrollments", learner.id)).toBe(1);

    const first = await a.call("close_learning_session", { reason: "provider_ended" });
    const second = await a.call("close_learning_session", { reason: "provider_ended" });
    expect(first.ok && second.ok).toBe(true);
    // One checkpoint from save_checkpoint; the close adds at most one more, and a duplicate close adds none.
    const afterClose = await count(db, "learning_checkpoints", learner.id);
    const third = await a.call("close_learning_session", { reason: "learner_ended" });
    expect(third.ok).toBe(true);
    expect(await count(db, "learning_checkpoints", learner.id)).toBe(afterClose);
    expect(afterClose).toBeLessThanOrEqual(2);
  });

  it("an interrupted session is finalised with its progress kept", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    const res = await a.call("close_learning_session", { reason: "interrupted" });
    expect(res.ok && res.saved).toBe(true);
    const s = await sessionService.getOwned(db, a.state.session.id, learner.id);
    expect(s.status).toBe("interrupted");
    expect(s.summary).not.toBeNull();
  });

  it("refuses learning tools after the session has ended", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    await a.call("close_learning_session", { reason: "learner_ended" });
    const after = await a.call("get_lesson_context");
    expect(after.ok).toBe(false);
    expect(!after.ok && after.error.code).toBe("SESSION_CLOSED");
  });
});

describe("second session resume", () => {
  it("a new session starts from the saved course, lesson and next idea", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const a = await learnSomething(db, learner);
    await a.call("close_learning_session", { reason: "learner_ended" });
    const second = await startSession(db, a.state.learner, "browser");
    expect(second.id).not.toBe(a.state.session.id);
    expect(second.state.courseId).toBe("small-business-starter");
    expect(second.state.lessonId).toBe("sbs-01");
    expect(second.state.conceptId).toBe("sbs-customer");
  });
});

describe("deletion of dependent learner data", () => {
  it("deleting an account removes every learner-linked row", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    await learnSomething(db, learner);
    expect(await count(db, "practice_attempts", learner.id)).toBe(1);
    const { rowsDeleted } = await deletionService.deleteAccount(db, learner.id, "settings");
    expect(rowsDeleted).toBeGreaterThan(5);
    for (const t of LEARNER_TABLES) expect(await count(db, t, learner.id), t).toBe(0);
    const rows = await db.query(`select count(*)::int as n from learners where id = $1`, [learner.id]);
    expect(JSON.stringify(rows)).toContain('"n":0');
    const receipts = await db.query(`select scope from deletion_receipts where scope = 'account'`);
    expect(receipts.length).toBeGreaterThan(0);
  });
});

describe("learner web session surface", () => {
  it("lets the page end a browser voice session but not record practice on the agent's behalf", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    const session = await startSession(db, learner, "browser", "small-business-starter");
    await expect(
      studyRoom.callTool(db, learner, { sessionId: session.id, tool: "record_practice_attempt", args: {}, idempotencyKey: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const end = await studyRoom.callTool(db, learner, { sessionId: session.id, tool: "close_learning_session", args: { reason: "learner_ended" }, idempotencyKey: null });
    expect(end.response.ok).toBe(true);
  });

  it("does not reveal another learner's session", async () => {
    const db = await createTestDb();
    const owner = await createLearner(db, { consent: "granted" });
    const intruder = await createLearner(db, { consent: "granted" });
    const session = await startSession(db, owner, "text");
    await expect(studyRoom.view(db, intruder, session.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
