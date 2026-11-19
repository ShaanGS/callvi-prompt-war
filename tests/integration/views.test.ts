import { beforeAll, describe, expect, it } from "vitest";
import { runTool } from "@/server/agent/orchestrator";
import type { Db } from "@/server/db/types";
import { MASTERY_STATES, type Learner, type LearningSession } from "@/server/domain/types";
import { courseService, totalConcepts } from "@/server/services/course-service";
import { enrollmentViews, historyView, homeView, sessionView } from "@/server/services/views";
import { createLearner, createTestDb, startSession } from "../support/test-db";

const ANSWER = "I make murukku for working families on my street";
const GOAL = "Price my homemade snacks";

/** Drive tools as the agent would, keeping the latest session and learner. */
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
  await a.call("set_learning_goal", { goal_text: GOAL, learner_confirmed: true });
  await a.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
  await a.call("get_lesson_context");
  await a.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: ANSWER });
  return a;
}

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("enrolment progress view", () => {
  it("shows nothing durable to a learner who has not granted memory consent", async () => {
    for (const consent of ["pending", "declined"] as const) {
      const a = await learnSomething(db, await createLearner(db, { consent }));
      expect(await enrollmentViews(db, a.state.learner, "en-IN"), consent).toEqual([]);
    }
  });

  it("summarises the enrolled course with its current lesson, concept counts and ordered lessons", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await a.call("save_checkpoint");
    const course = await courseService.getAvailable(db, "small-business-starter");
    const [view, ...rest] = await enrollmentViews(db, a.state.learner, "en-IN");

    expect(rest).toEqual([]);
    expect(view).toMatchObject({
      course: { id: "small-business-starter", title: "Small Business Starter" },
      status: "active",
      currentLesson: { id: "sbs-01", sequence: 1, of: course.lessons.length },
      totalConcepts: totalConcepts(course),
      completedLessons: 0,
    });
    expect(view!.completedConcepts).toBeGreaterThanOrEqual(1);
    expect(view!.completedConcepts).toBeLessThanOrEqual(view!.totalConcepts);
    expect(view!.lessons.map((l) => l.sequence)).toEqual([...view!.lessons.map((l) => l.sequence)].sort((x, y) => x - y));
    expect(MASTERY_STATES).toContain(view!.lessons[0]!.concepts.find((c) => c.id === "sbs-offer")?.state);
    expect(view!.lessons.at(-1)!.concepts.every((c) => c.state === "not_started")).toBe(true);
    expect(view!.lastCheckpoint?.summary).toContain("Small Business Starter — lesson 1");
  });

  it("renders course, lesson and concept titles in the requested language", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const [ta] = await enrollmentViews(db, a.state.learner, "ta-IN");
    expect(ta!.course.title).toBe("சிறு தொழில் தொடக்கம்");
    expect(ta!.currentLesson?.title).toBe("தொழில் யோசனையும் அதன் வாடிக்கையாளரும்");
    expect(ta!.lessons[0]!.concepts[0]!.title).toMatch(/[஀-௿]/);
  });

  it("has no checkpoint summary before one is saved", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const [view] = await enrollmentViews(db, a.state.learner, "en-IN");
    expect(view!.lastCheckpoint).toBeNull();
  });
});

describe("home view", () => {
  it("shows the active goal, focuses the active course and offers to resume the open session", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const home = await homeView(db, a.state.learner, "en-IN");
    expect(home.goal?.text).toBe(GOAL);
    expect(home.focus?.course.id).toBe("small-business-starter");
    expect(home.others).toEqual([]);
    expect(home.openSession).toEqual({ id: a.state.session.id, channel: "simulated", startedAt: a.state.session.startedAt });
    expect(home.sessionCount).toBe(1);
  });

  it("stops offering a session once it has been closed", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await a.call("close_learning_session", { reason: "learner_ended" });
    const home = await homeView(db, a.state.learner, "en-IN");
    expect(home.openSession).toBeNull();
    expect(home.sessionCount).toBe(1);
  });

  // An open session left idle for hours is stale; resuming it would restore context the learner has moved on from.
  it("does not offer an open session that has been idle for more than two hours", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await db.query(`update learning_sessions set last_activity_at = now() - interval '3 hours' where id = $1`, [a.state.session.id]);
    expect((await homeView(db, a.state.learner, "en-IN")).openSession).toBeNull();
  });

  it("shows no goal or courses for a learner without consent, but still counts their sessions", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "declined" }));
    const home = await homeView(db, a.state.learner, "en-IN");
    expect(home).toMatchObject({ goal: null, focus: null, others: [], sessionCount: 1 });
  });

  it("is empty for a brand-new learner", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    expect(await homeView(db, learner, "en-IN")).toEqual({ goal: null, focus: null, others: [], openSession: null, sessionCount: 0 });
  });
});

describe("history view", () => {
  it("lists the learner's own sessions and practice attempts with readable titles", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const history = await historyView(db, a.state.learner, "en-IN");

    expect(history.sessions).toEqual([expect.objectContaining({ id: a.state.session.id, channel: "simulated", endedAt: null, minutes: null })]);
    expect(history.attempts).toHaveLength(1);
    expect(history.attempts[0]).toMatchObject({
      course: "Small Business Starter",
      lesson: "A business idea and its customer",
      concept: "What you offer",
      answer: ANSWER,
    });
    expect(history.attempts[0]!.prompt).not.toBe("");
    expect(history.attempts[0]!.feedback).not.toBe("");
  });

  it("reports session length in whole minutes, never less than one, once a session ends", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await a.call("close_learning_session", { reason: "learner_ended" });
    await db.query(`update learning_sessions set started_at = ended_at - interval '7 minutes 20 seconds' where id = $1`, [a.state.session.id]);
    expect((await historyView(db, a.state.learner, "en-IN")).sessions[0]!.minutes).toBe(7);

    await db.query(`update learning_sessions set started_at = ended_at - interval '5 seconds' where id = $1`, [a.state.session.id]);
    expect((await historyView(db, a.state.learner, "en-IN")).sessions[0]!.minutes).toBe(1);
  });

  it("hides practice answers from a learner without consent while still listing their sessions", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "declined" }));
    const history = await historyView(db, a.state.learner, "en-IN");
    expect(history.sessions).toHaveLength(1);
    expect(history.attempts).toEqual([]);
  });

  it("never includes another learner's sessions or answers", async () => {
    const mine = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const stranger = await createLearner(db, { consent: "granted" });
    await startSession(db, stranger, "text");
    const history = await historyView(db, stranger, "en-IN");
    expect(history.sessions.map((s) => s.id)).not.toContain(mine.state.session.id);
    expect(history.attempts).toEqual([]);
    expect(JSON.stringify(history)).not.toContain("murukku");
  });
});

describe("live session view", () => {
  it("shows the current course, lesson and concept with the explanation in the session language", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    const view = await sessionView(db, a.state.learner, a.state.session);
    const course = await courseService.getAvailable(db, "small-business-starter");

    expect(view).toMatchObject({
      id: a.state.session.id,
      status: "active",
      open: true,
      channel: "simulated",
      memoryMode: "durable",
      language: "en-IN",
      goal: GOAL,
      course: { id: "small-business-starter", title: "Small Business Starter" },
      lesson: { id: "sbs-01", title: "A business idea and its customer", sequence: 1, of: course.lessons.length },
    });
    expect(view.startedAt).toBe(a.state.session.startedAt.toISOString());
    expect(view.concept).not.toBeNull();
    expect(view.concept!.approachesUsed).toBeLessThanOrEqual(view.concept!.approachesTotal);
    expect(view.concept!.explanation).not.toBe("");
    expect(view.lessonConcepts.map((c) => c.id)).toEqual(course.lessons.find((l) => l.id === "sbs-01")!.concepts.map((c) => c.id));
    expect(view.attempts).toEqual([expect.objectContaining({ exerciseId: "sbs-01-offer-sentence" })]);
    expect(view.courseProgress.totalConcepts).toBe(totalConcepts(course));
    expect(view.courseProgress.completedConcepts).toBeGreaterThanOrEqual(1);
  });

  it("renders a Tamil learner's session in Tamil", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted", language: "ta-IN" }));
    const view = await sessionView(db, a.state.learner, a.state.session);
    expect(view.language).toBe("ta-IN");
    expect(view.course?.title).toBe("சிறு தொழில் தொடக்கம்");
    expect(view.lesson?.title).toBe("தொழில் யோசனையும் அதன் வாடிக்கையாளரும்");
  });

  it("tracks progress within the session for a learner who declined memory", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "declined" }));
    const view = await sessionView(db, a.state.learner, a.state.session);
    expect(view.memoryMode).toBe("session_only");
    expect(view.course?.id).toBe("small-business-starter");
    expect(view.attempts).toHaveLength(1);
    expect(MASTERY_STATES).toContain(view.lessonConcepts.find((c) => c.id === "sbs-offer")?.state);
  });

  it("shows an empty frame for a session with no course chosen yet", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const session = await startSession(db, learner, "text");
    const view = await sessionView(db, learner, session);
    expect(view).toMatchObject({
      channel: "text",
      open: true,
      goal: null,
      course: null,
      lesson: null,
      concept: null,
      lessonConcepts: [],
      practice: null,
      attempts: [],
      courseProgress: { completedConcepts: 0, totalConcepts: 0 },
    });
  });

  it("marks a closed session as no longer open and carries its summary", async () => {
    const a = await learnSomething(db, await createLearner(db, { consent: "granted" }));
    await a.call("close_learning_session", { reason: "learner_ended" });
    const view = await sessionView(db, a.state.learner, a.state.session);
    expect(view.open).toBe(false);
    expect(view.summary).toEqual(expect.any(String));
  });

  it("shows the pending practice prompt after the lesson asks a question", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const a = agent(db, learner, await startSession(db, learner, "text"));
    await a.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
    await a.call("get_lesson_context", { learner_ready: true });
    const view = await sessionView(db, a.state.learner, a.state.session);
    expect(view.practice).toMatchObject({ exerciseId: "sbs-01-offer-sentence" });
    expect(view.practice!.prompt).not.toBe("");
  });
});
