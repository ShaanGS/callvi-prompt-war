import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { runTool } from "@/server/agent/orchestrator";
import type { Db } from "@/server/db/types";
import type { Learner, LearningSession } from "@/server/domain/types";
import { courseService } from "@/server/services/course-service";
import { deletionService } from "@/server/services/deletion-service";
import { learnerService } from "@/server/services/learner-service";
import {
  shortId,
  staffCourses,
  staffLearnerDetail,
  staffLearners,
  staffOverview,
  staffSessions,
  staffTraces,
} from "@/server/services/staff-service";
import { createLearner, createTestDb, startSession } from "../support/test-db";

const PRIVATE_ANSWER = "I make murukku for working families on my street";
const PRIVATE_GOAL = "Price my homemade snacks";

/** Drive tools as the agent would, keeping the latest session and learner. */
function agent(db: Db, learner: Learner, session: LearningSession) {
  const state = { learner, session };
  return {
    state,
    async call(toolName: string, rawInput: Record<string, unknown> = {}) {
      const r = await runTool({
        db,
        channel: state.session.channel,
        learner: state.learner,
        session: state.session,
        toolName,
        rawInput,
        interactionId: null,
      });
      if (r.session) state.session = r.session;
      if (r.learner) state.learner = r.learner;
      return r.response;
    },
  };
}

async function learnSomething(db: Db, learner: Learner) {
  const a = agent(db, learner, await startSession(db, learner));
  await a.call("set_learning_goal", { goal_text: PRIVATE_GOAL, learner_confirmed: true });
  await a.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
  await a.call("get_lesson_context");
  await a.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: PRIVATE_ANSWER });
  return a;
}

describe("staff overview counts", () => {
  let db: Db;
  let active: ReturnType<typeof agent>;

  beforeAll(async () => {
    db = await createTestDb();
    active = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await createLearner(db, { consent: "declined" });
    await createLearner(db, { consent: "pending" });
    const revoked = await createLearner(db, { consent: "granted" });
    await learnerService.revokeConsent(db, revoked.id, "settings");
    const quiet = await createLearner(db, { consent: "granted" });
    await startSession(db, quiet, "text");
  });

  it("starts from zero on an empty database rather than placeholder numbers", async () => {
    const empty = await staffOverview(await createTestDb());
    expect(empty.learners).toEqual({
      total: 0,
      consentGranted: 0,
      consentDeclined: 0,
      consentPending: 0,
      consentRevoked: 0,
    });
    expect(empty.sessions).toEqual({ total: 0, last7Days: 0, open: 0, byChannel: {} });
    expect(empty.practice).toEqual({ total: 0, byResult: {} });
    expect(empty.tools).toEqual({ total: 0, failed: 0, last24h: 0, failedLast24h: 0 });
    expect(empty.deletions.total).toBe(0);
  });

  it("breaks learners down by consent status", async () => {
    const o = await staffOverview(db);
    expect(o.learners).toEqual({
      total: 5,
      consentGranted: 2,
      consentDeclined: 1,
      consentPending: 1,
      consentRevoked: 1,
    });
  });

  it("counts sessions in total, by channel and while still open", async () => {
    const o = await staffOverview(db);
    expect(o.sessions.total).toBe(2);
    expect(o.sessions.byChannel).toEqual({ simulated: 1, text: 1 });
    expect(o.sessions.open).toBe(2);
    expect(o.sessions.last7Days).toBe(2);
  });

  it("counts the enrolment and practice attempt the learner made", async () => {
    const o = await staffOverview(db);
    expect(o.enrollments).toEqual({ total: 1, completed: 0 });
    expect(o.practice.total).toBe(1);
    expect(Object.values(o.practice.byResult).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("counts every tool call and none as failed when all succeeded", async () => {
    const o = await staffOverview(db);
    expect(o.tools.total).toBe(4);
    expect(o.tools.last24h).toBe(4);
    expect(o.tools.failed).toBe(0);
  });

  it("only counts failures from the last 24 hours in the recent-failure figure", async () => {
    const [first] = await staffTraces(db, { limit: 1 });
    await db.query(`update tool_invocations set status = 'failed', error_code = 'TIMEOUT' where id = $1`, [first!.id]);
    let o = await staffOverview(db);
    expect(o.tools).toMatchObject({ failed: 1, failedLast24h: 1 });

    await db.query(`update tool_invocations set created_at = now() - interval '2 days' where id = $1`, [first!.id]);
    o = await staffOverview(db);
    expect(o.tools).toMatchObject({ total: 4, failed: 1, last24h: 3, failedLast24h: 0 });
  });

  it("drops sessions older than seven days from the weekly count but not the total", async () => {
    await db.query(`update learning_sessions set started_at = now() - interval '8 days' where id = $1`, [
      active.state.session.id,
    ]);
    const o = await staffOverview(db);
    expect(o.sessions.total).toBe(2);
    expect(o.sessions.last7Days).toBe(1);
  });

  it("stops counting a session as open once it is closed", async () => {
    await active.call("close_learning_session", { reason: "learner_ended" });
    const o = await staffOverview(db);
    expect(o.sessions.open).toBe(1);
  });

  it("counts completed enrolments separately", async () => {
    await db.query(`update enrollments set status = 'completed' where learner_id = $1`, [active.state.learner.id]);
    expect((await staffOverview(db)).enrollments).toEqual({ total: 1, completed: 1 });
  });

  it("counts the erasure receipt written when consent is revoked", async () => {
    expect((await staffOverview(db)).deletions.total).toBe(1);
  });

  it("records an account deletion and removes the learner from the totals", async () => {
    const before = (await staffOverview(db)).deletions.total;
    await deletionService.deleteAccount(db, active.state.learner.id, "settings");
    const o = await staffOverview(db);
    expect(o.deletions.total).toBe(before + 1);
    expect(o.learners.total).toBe(4);
    expect(o.learners.consentGranted).toBe(1);
  });
});

describe("staff course table", () => {
  it("lists every course with live enrolment and attempt figures, zero where nobody has started", async () => {
    const db = await createTestDb();
    await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const all = await courseService.listAll(db);
    const rows = await staffCourses(db);

    expect(rows.map((r) => r.id).sort()).toEqual(all.map((c) => c.id).sort());
    const sbs = rows.find((r) => r.id === "small-business-starter");
    expect(sbs).toMatchObject({ title: "Small Business Starter", enrollments: 1, completed: 0, attempts: 1 });
    expect(sbs!.lessons).toBe(all.find((c) => c.id === "small-business-starter")!.lessons.length);
    expect(sbs!.flaggedLessons).toBeLessThanOrEqual(sbs!.lessons);
    for (const other of rows.filter((r) => r.id !== "small-business-starter")) {
      expect(other).toMatchObject({ enrollments: 0, completed: 0, attempts: 0, needsPractice: 0 });
    }
  });
});

describe("staff learner list and detail", () => {
  let db: Db;
  let first: Learner;
  let second: ReturnType<typeof agent>;
  let declined: Learner;

  beforeAll(async () => {
    db = await createTestDb();
    first = await createLearner(db, { consent: "granted", language: "ta-IN" });
    second = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    declined = await createLearner(db, { consent: "declined" });
  });

  it("lists the newest learners first with a short pseudonymous id", async () => {
    const rows = await staffLearners(db);
    expect(rows.map((r) => r.id)).toEqual([declined.id, second.state.learner.id, first.id]);
    for (const r of rows) {
      expect(r.shortId).toBe(r.id.slice(0, 8));
      expect(r.shortId).toBe(shortId(r.id));
    }
  });

  it("shows each learner's consent, language, sign-in provider and activity counts", async () => {
    const rows = await staffLearners(db);
    const active = rows.find((r) => r.id === second.state.learner.id)!;
    expect(active).toMatchObject({
      consentStatus: "granted",
      language: "en-IN",
      providers: ["dev"],
      enrollments: 1,
      sessions: 1,
    });
    expect(active.lastSessionAt).toBeInstanceOf(Date);

    const idle = rows.find((r) => r.id === first.id)!;
    expect(idle).toMatchObject({ language: "ta-IN", enrollments: 0, sessions: 0, lastSessionAt: null });
    expect(rows.find((r) => r.id === declined.id)?.consentStatus).toBe("declined");
  });

  it("respects the row limit", async () => {
    const rows = await staffLearners(db, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe(declined.id);
  });

  // Staff see minimised data: no answers, goals or sign-in subjects, even in the detail view.
  it("never exposes the learner's answers, goal text or sign-in subject", async () => {
    const detail = await staffLearnerDetail(db, second.state.learner.id);
    const serialised = JSON.stringify([
      detail,
      await staffLearners(db),
      await staffSessions(db),
      await staffTraces(db),
    ]);
    expect(serialised).not.toContain("murukku");
    expect(serialised).not.toContain(PRIVATE_GOAL);
    expect(serialised).not.toContain("test-");
  });

  it("returns null for a learner that does not exist", async () => {
    expect(await staffLearnerDetail(db, randomUUID())).toBeNull();
  });

  it("returns the learner's consent history, enrolments, sessions and practice results", async () => {
    const detail = await staffLearnerDetail(db, second.state.learner.id);
    expect(detail).not.toBeNull();
    expect(detail!.consentHistory).toHaveLength(1);
    expect(detail!.consentHistory[0]).toMatchObject({ decision: "granted", channel: "browser" });
    expect(detail!.enrollments_).toEqual([
      expect.objectContaining({ courseId: "small-business-starter", status: "active", currentLessonId: "sbs-01" }),
    ]);
    expect(detail!.sessions_).toHaveLength(1);
    expect(detail!.sessions_[0]!.learnerId).toBe(second.state.learner.id);
    expect(Object.values(detail!.practiceByResult).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("orders consent history newest first after a revocation", async () => {
    await learnerService.revokeConsent(db, first.id, "settings");
    const detail = await staffLearnerDetail(db, first.id);
    expect(detail!.consentStatus).toBe("revoked");
    expect(detail!.consentHistory.map((c) => c.decision)).toEqual(["revoked", "granted"]);
    expect(detail!.enrollments_).toEqual([]);
    expect(detail!.practiceByResult).toEqual({});
  });
});

describe("staff session and trace lists", () => {
  let db: Db;
  let a: ReturnType<typeof agent>;
  let other: Learner;

  beforeAll(async () => {
    db = await createTestDb();
    a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    other = await createLearner(db, { consent: "granted" });
    await startSession(db, other, "text");
  });

  it("filters sessions to a single learner when asked", async () => {
    const mine = await staffSessions(db, { learnerId: a.state.learner.id });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      learnerId: a.state.learner.id,
      learnerShortId: a.state.learner.id.slice(0, 8),
      channel: "simulated",
      provider: "simulation",
    });
    const theirs = await staffSessions(db, { learnerId: other.id });
    expect(theirs.map((s) => s.channel)).toEqual(["text"]);
  });

  it("lists all learners' sessions newest first without a filter, honouring the limit", async () => {
    const all = await staffSessions(db);
    expect(all.map((s) => s.learnerId)).toEqual([other.id, a.state.learner.id]);
    expect(await staffSessions(db, { limit: 1 })).toHaveLength(1);
  });

  it("counts tool calls per session and reports whether a checkpoint was saved", async () => {
    let [s] = await staffSessions(db, { learnerId: a.state.learner.id });
    expect(s).toMatchObject({
      toolCalls: 4,
      toolFailures: 0,
      hasCheckpoint: false,
      status: "active",
      endedAt: null,
      endReason: null,
    });

    await a.call("close_learning_session", { reason: "learner_ended" });
    [s] = await staffSessions(db, { learnerId: a.state.learner.id });
    expect(s!.toolCalls).toBe(5);
    expect(s!.hasCheckpoint).toBe(true);
    expect(s!.endReason).toBe("learner_ended");
    expect(s!.endedAt).toBeInstanceOf(Date);
    expect((await staffSessions(db, { learnerId: other.id }))[0]!.toolCalls).toBe(0);
  });

  it("lists tool traces newest first with only argument shapes, never argument values", async () => {
    const traces = await staffTraces(db);
    expect(traces.length).toBeGreaterThanOrEqual(5);
    const times = traces.map((t) => t.at.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);

    const attempt = traces.find((t) => t.tool === "record_practice_attempt")!;
    expect(attempt).toMatchObject({
      channel: "simulated",
      status: "succeeded",
      errorCode: null,
      replays: 0,
      sessionId: a.state.session.id,
    });
    expect(attempt.argSummary).toEqual({ exercise_id: "string(21)", answer_text: `string(${PRIVATE_ANSWER.length})` });
    expect(attempt.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("filters traces by status and honours the limit", async () => {
    const [target] = await staffTraces(db, { limit: 1 });
    await db.query(`update tool_invocations set status = 'failed', error_code = 'PROVIDER_UNAVAILABLE' where id = $1`, [
      target!.id,
    ]);
    const failed = await staffTraces(db, { status: "failed" });
    expect(failed).toEqual([
      expect.objectContaining({ id: target!.id, status: "failed", errorCode: "PROVIDER_UNAVAILABLE" }),
    ]);
    expect(await staffTraces(db, { status: "rejected" })).toEqual([]);
    expect(await staffTraces(db, { limit: 2 })).toHaveLength(2);

    const [s] = await staffSessions(db, { learnerId: a.state.learner.id });
    expect(s!.toolFailures).toBe(1);
  });
});
