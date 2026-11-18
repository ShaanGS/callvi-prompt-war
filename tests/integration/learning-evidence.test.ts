import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import type { Learner } from "@/server/domain/types";
import { studyRoom } from "@/server/services/study-room";
import { learnerService } from "@/server/services/learner-service";
import { evidenceRepo } from "@/server/repositories/evidence";
import { enrollmentsRepo } from "@/server/repositories/learning";
import { sessionsRepo } from "@/server/repositories/sessions";
import { learnersRepo } from "@/server/repositories/learners";
import { createBrowserVoiceSession } from "@/server/providers/browser-voice";
import { createLearner, createTestDb } from "../support/test-db";
import { testConfig } from "../support/config";

let db: Db;
beforeAll(async () => {
  testConfig({ ELEVENLABS_API_KEY: "test-key", ELEVENLABS_AGENT_ID: "test-agent", BROWSER_VOICE_PROVIDER: "elevenlabs" });
  db = await createTestDb();
});
const call = async (learner: Learner, sessionId: string, tool: string, args = {}, key: string | null = null) =>
  (await studyRoom.callTool(db, learner, { sessionId, tool, args, idempotencyKey: key })).response;

async function practise(learner: Learner, helped: boolean) {
  const { sessionId } = await createBrowserVoiceSession(db, learner, null);
  expect(await call(learner, sessionId, "start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true })).toMatchObject({ ok: true });
  for (const [id, answer] of [
    ["sbs-01-offer-sentence", "I make murukku for working families on my street"],
    ["sbs-01-first-customer", "Working families on my street can save time"],
    ["sbs-01-customer-need", "It saves time grinding batter"],
  ]) {
    expect(await call(learner, sessionId, "get_lesson_context", { learner_ready: true })).toMatchObject({ ok: true, data: { practice: { exercise_id: id } } });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: id, answer_text: answer })).toMatchObject({ ok: true, data: { result: "correct", mastery: "practised" } });
  }
  expect(await call(learner, sessionId, "get_lesson_context", { concept_id: "sbs-unit-cost" })).toMatchObject({ ok: true });
  if (helped) expect(await call(learner, sessionId, "get_lesson_context", { request: "different_explanation" })).toMatchObject({ ok: true });
  const answer = { exercise_id: "sbs-02-unit-cost", answer_text: "12" };
  expect(await call(learner, sessionId, "record_practice_attempt", answer, "cost-answer")).toMatchObject({ ok: true, data: { result: "correct", evidence: { support: helped ? "explanation_provided" : "none_recorded" } } });
  expect(await call(learner, sessionId, "record_practice_attempt", answer, "cost-answer")).toMatchObject({ ok: true });
  const session = await sessionsRepo.findById(db, sessionId);
  expect(session?.state.enrollmentId).toBeTruthy();
  await call(learner, sessionId, "close_learning_session");
  return { sessionId, enrollmentId: session!.state.enrollmentId! };
}

describe("evidence-led learning", () => {
  it("opens the already-advanced next idea when move_on follows a correct answer", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const { sessionId } = await createBrowserVoiceSession(db, learner, null);
    await call(learner, sessionId, "start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
    await call(learner, sessionId, "get_lesson_context", { learner_ready: true });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "I sell snacks for working families" })).toMatchObject({ ok: true, data: { result: "correct" } });
    expect(await call(learner, sessionId, "get_lesson_context", { request: "move_on" })).toMatchObject({ ok: true, data: { moved_on: false, concept: { id: "sbs-customer" }, practice: { exercise_id: "sbs-01-first-customer" } } });
    const session = (await sessionsRepo.findById(db, sessionId))!;
    expect((await db.query("select state from concept_mastery where enrollment_id=$1 and concept_id='sbs-customer'", [session.state.enrollmentId]))).toEqual([{ state: "introduced" }]);
  });

  it("remembers help, checks a new problem on a later call, and preserves course position", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const first = await practise(learner, true);
    const evidence = await evidenceRepo.list(db, learner.id, first.enrollmentId);
    expect(evidence.filter((r) => r.exercise_id === "sbs-02-unit-cost")).toHaveLength(1);
    expect(await evidenceRepo.list(db, (await createLearner(db)).id, first.enrollmentId)).toEqual([]);
    await db.query("update learning_evidence set observed_at=observed_at-interval '2 days' where learner_id=$1", [learner.id]);
    const before = await enrollmentsRepo.findById(db, first.enrollmentId);
    const { sessionId } = await createBrowserVoiceSession(db, learner, null);
    expect(await call(learner, sessionId, "get_learning_context")).toMatchObject({ ok: true, data: { learning_evidence: expect.arrayContaining([expect.objectContaining({ concept_id: "sbs-unit-cost", status: "practised_with_support", review_due: true })]) } });
    expect(await call(learner, sessionId, "get_lesson_context", { request: "review" })).toMatchObject({ ok: false, error: { code: "POLICY_VIOLATION" } });
    expect(await call(learner, sessionId, "get_lesson_context", { request: "review", concept_id: "sbs-unit-cost", learner_ready: true })).toMatchObject({ ok: true, data: { concept: { explanation: null, key_points: [] }, practice: { exercise_id: "sbs-02-unit-cost-review", prompt: expect.stringContaining("180") } } });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-02-unit-cost-review", answer_text: "12" })).toMatchObject({ ok: true, data: { result: "needs_practice", next_step: "retry" } });
    expect(await call(learner, sessionId, "get_learning_context")).toMatchObject({ ok: true, data: { learning_evidence: expect.arrayContaining([expect.objectContaining({ concept_id: "sbs-unit-cost", status: "needs_practice" })]) } });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-02-unit-cost-review", answer_text: "18" })).toMatchObject({ ok: true, data: { result: "correct", next_step: "review_complete", lesson_complete: false, evidence: { support: "hint_provided" } } });
    expect(await enrollmentsRepo.findById(db, first.enrollmentId)).toMatchObject({ currentLessonId: before!.currentLessonId, status: before!.status });
    expect(await call(learner, sessionId, "get_learning_context")).toMatchObject({ ok: true, data: { learning_evidence: expect.arrayContaining([expect.objectContaining({ concept_id: "sbs-unit-cost", status: "practised_with_support" })]) } });
    await learnerService.revokeConsent(db, learner.id, "browser");
    expect(await evidenceRepo.list(db, learner.id, first.enrollmentId)).toEqual([]);
  });

  it("records a later fresh correct answer without help separately from course completion", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    await practise(learner, false);
    await db.query("update learning_evidence set observed_at=observed_at-interval '2 days' where learner_id=$1", [learner.id]);
    const { sessionId } = await createBrowserVoiceSession(db, learner, null);
    await call(learner, sessionId, "get_lesson_context", { request: "review", concept_id: "sbs-unit-cost", learner_ready: true });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-02-unit-cost-review", answer_text: "18" })).toMatchObject({ ok: true, data: { next_step: "review_complete" } });
    expect(await call(learner, sessionId, "get_learning_context")).toMatchObject({ ok: true, data: { learning_evidence: expect.arrayContaining([expect.objectContaining({ concept_id: "sbs-unit-cost", status: "checked_again" })]) } });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-02-unit-cost-review", answer_text: "18" }, "answer-without-open-question")).toMatchObject({ ok: false, error: { code: "POLICY_VIOLATION" } });
  });

  it("keeps assessment usable without saving evidence when memory is declined", async () => {
    const learner = await createLearner(db, { consent: "declined" });
    const { sessionId } = await createBrowserVoiceSession(db, learner, null);
    await call(learner, sessionId, "start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
    await call(learner, sessionId, "get_lesson_context", { learner_ready: true });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "I sell snacks for working families" })).toMatchObject({ ok: true, saved: false, data: { result: "correct" } });
    expect(await db.query("select * from learning_evidence where learner_id=$1", [learner.id])).toEqual([]);
  });

  it("protects evidence through row-level security as well as server ownership checks", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    await practise(learner, false);
    const owner = "33333333-3333-4333-8333-333333333333";
    const stranger = "44444444-4444-4444-8444-444444444444";
    await learnersRepo.addIdentity(db, learner.id, "supabase", owner);
    const read = (subject: string) => db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [subject]);
      await tx.query("set local role authenticated");
      return tx.query("select learner_id from learning_evidence");
    });
    expect(await read(owner)).toHaveLength(4);
    expect(await read(stranger)).toEqual([]);
    await expect(db.transaction(async (tx) => {
      await tx.query("set local role authenticated");
      return tx.query("delete from learning_evidence");
    })).rejects.toThrow();
  });

  it("reviews an earlier completed lesson without moving the enrolment back, and can leave review without skipping a new idea", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const first = await practise(learner, false);
    const before = await enrollmentsRepo.findById(db, first.enrollmentId);
    const { sessionId } = await createBrowserVoiceSession(db, learner, null);
    const original = (await sessionsRepo.findById(db, sessionId))!.state;
    expect(await call(learner, sessionId, "get_lesson_context", { request: "review", concept_id: "sbs-offer", learner_ready: true })).toMatchObject({ ok: true, data: { lesson: { id: "sbs-01" } } });
    expect(await call(learner, sessionId, "record_practice_attempt", { exercise_id: "sbs-01-offer-sentence-review", answer_text: "I make murukku for working families on my street" })).toMatchObject({ ok: true, data: { next_step: "review_complete" } });
    expect(await enrollmentsRepo.findById(db, first.enrollmentId)).toMatchObject({ currentLessonId: before!.currentLessonId, status: before!.status });
    expect((await sessionsRepo.findById(db, sessionId))!.state).toMatchObject({ lessonId: original.lessonId, conceptId: original.conceptId, reviewReturn: null });
    // Ask for a different earlier idea, then leave it before answering.
    expect(await call(learner, sessionId, "get_lesson_context", { request: "review", concept_id: "sbs-customer" })).toMatchObject({ ok: true });
    expect(await call(learner, sessionId, "get_lesson_context", { request: "move_on" })).toMatchObject({ ok: true });
    expect((await sessionsRepo.findById(db, sessionId))!.state).toMatchObject({ lessonId: original.lessonId, conceptId: original.conceptId, reviewReturn: null });
    expect(await enrollmentsRepo.findById(db, first.enrollmentId)).toMatchObject({ currentLessonId: before!.currentLessonId });
  });
});
