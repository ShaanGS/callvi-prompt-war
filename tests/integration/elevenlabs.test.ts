import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Db } from "@/server/db/types";
import { createBrowserVoiceSession } from "@/server/providers/browser-voice";
import { elevenLabsConnection } from "@/server/providers/elevenlabs/connection";
import { studyRoom } from "@/server/services/study-room";
import { resetRateLimitsForTests } from "@/server/security/rate-limit";
import { createLearner, createTestDb, startSession } from "../support/test-db";
import { testConfig } from "../support/config";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => {
  testConfig({
    ELEVENLABS_API_KEY: "test-elevenlabs-server-key",
    ELEVENLABS_AGENT_ID: "agent-test",
    BROWSER_VOICE_PROVIDER: "elevenlabs",
  });
  resetRateLimitsForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ElevenLabs browser learning", () => {
  it("requires a choice to learn in every voice call, independent of consent and saved progress", async () => {
    const learner = await createLearner(db, { consent: "granted", language: "ta-IN" });
    const first = await createBrowserVoiceSession(db, learner, "small-business-starter");
    const call = (sessionId: string, args: Record<string, unknown>) =>
      studyRoom.callTool(db, learner, { sessionId, tool: "get_lesson_context", args, idempotencyKey: null });
    expect((await call(first.sessionId, {})).response).toMatchObject({
      ok: false,
      error: { code: "POLICY_VIOLATION", detail: { required_step: "ask_call_intent" } },
    });
    expect((await call(first.sessionId, { learner_ready: true })).response.ok).toBe(true);
    expect((await call(first.sessionId, { request: "different_explanation" })).response.ok).toBe(true);
    const second = await createBrowserVoiceSession(db, learner, "small-business-starter");
    expect((await call(second.sessionId, {})).response).toMatchObject({
      ok: false,
      error: { code: "POLICY_VIOLATION" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ signed_url: "wss://api.elevenlabs.io/session-test" })),
    );
    const opening = await elevenLabsConnection(db, learner, second.sessionId);
    expect(opening.dynamicVariables.greeting).toContain("என்ன உதவி வேணும்");
    expect(opening.dynamicVariables.greeting).not.toContain("தொடரலாமா");
    expect(JSON.parse(opening.dynamicVariables.call_context)).toMatchObject({
      consent_status: "granted",
      learning_ready: false,
    });
  });

  it("issues a connection only for the learner's own open ElevenLabs session", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const other = await createLearner(db, { consent: "granted" });
    const session = await createBrowserVoiceSession(db, learner, "small-business-starter");
    expect(JSON.stringify(session)).not.toContain("test-elevenlabs-server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ signed_url: "wss://api.elevenlabs.io/session-test" })),
    );
    const connection = await elevenLabsConnection(db, learner, session.sessionId);
    expect(connection.toolNames).toContain("record_practice_attempt");
    expect(JSON.stringify(connection)).not.toContain("test-elevenlabs-server-key");
    await expect(elevenLabsConnection(db, other, session.sessionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const sarvam = await startSession(db, learner, "browser");
    await expect(elevenLabsConnection(db, learner, sarvam.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not forward provider errors or malformed signed URLs to the browser", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const session = await createBrowserVoiceSession(db, learner, null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("private provider details", { status: 401 })),
    );
    await expect(elevenLabsConnection(db, learner, session.sessionId)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ signed_url: "https://invalid.example" })),
    );
    await expect(elevenLabsConnection(db, learner, session.sessionId)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("runs curriculum, assessment, checkpoint and resume through the authenticated client bridge", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const first = await createBrowserVoiceSession(db, learner, null);
    const call = (tool: string, args = {}) =>
      studyRoom.callTool(db, learner, { sessionId: first.sessionId, tool, args, idempotencyKey: null });
    expect(
      (await call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true })).response
        .ok,
    ).toBe(true);
    const lesson = (await call("get_lesson_context", { request: "current", learner_ready: true })).response;
    if (!lesson.ok) throw new Error("Lesson failed");
    const practice = z.object({ exercise_id: z.string() }).parse(lesson.data.practice);
    const result = (
      await call("record_practice_attempt", {
        exercise_id: practice.exercise_id,
        answer_text: "I make murukku for working families on my street",
      })
    ).response;
    expect(result).toMatchObject({ ok: true, saved: true, data: { result: "correct" } });
    expect((await call("save_checkpoint", { learner_difficulty: null })).response).toMatchObject({
      ok: true,
      saved: true,
    });
    expect((await call("close_learning_session")).response).toMatchObject({ ok: true, saved: true });
    const second = await createBrowserVoiceSession(db, learner, null);
    const resumed = await studyRoom.callTool(db, learner, {
      sessionId: second.sessionId,
      tool: "get_learning_context",
      args: {},
      idempotencyKey: null,
    });
    expect(resumed.response).toMatchObject({
      ok: true,
      data: { active_course: { id: "small-business-starter" }, last_session_summary: expect.any(String) },
    });
  });

  it("completes all nine business skills with colloquial Tamil answers and resumes as completed", async () => {
    const learner = await createLearner(db, { consent: "granted", language: "ta-IN" });
    const voice = await createBrowserVoiceSession(db, learner, null);
    const call = async (tool: string, args = {}) =>
      (await studyRoom.callTool(db, learner, { sessionId: voice.sessionId, tool, args, idempotencyKey: null }))
        .response;
    expect(
      await call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true }),
    ).toMatchObject({ ok: true });
    const answers = [
      ["sbs-01-offer-sentence", "வீட்டுல முறுக்கு செஞ்சு பக்கத்து குடும்பங்களுக்கு விப்பேன்."],
      ["sbs-01-first-customer", "எங்க தெருவில வேலைக்குப் போற குடும்பங்கள். காலைல டைம் மிச்சமாகும்."],
      ["sbs-01-customer-need", "மாவு அரைக்கிற நேரமும் வேலையும் மிச்சமாகும்."],
      ["sbs-02-batch-costs", "மாவு, எண்ணெய், cover, gas எல்லாத்தையும் கணக்கில் எடுக்கணும்."],
      ["sbs-02-unit-cost", "பன்னெண்டு ரூபா."],
      ["sbs-02-price-covers-costs", "Cover, gas, நம்ம நேரத்தையும் செலவில் சேர்க்கணும். அப்பதான் லாபம் தெரியும்."],
      ["sbs-03-introduce", "வீட்டுல புதுசா முறுக்கு செய்றேன். சனிக்கிழமை வாங்கிக்கலாம்."],
      ["sbs-03-ask-question", "எத்தனை பேருக்கு வேணும்?"],
      ["sbs-03-honest-answer", "தினமும் முடியாதுங்க. சனிக்கிழமை மட்டும் உங்க தெரு பக்கத்துல கொண்டு வந்து தரலாம்."],
    ];
    for (const [exerciseId, answer] of answers) {
      expect(await call("get_lesson_context", { request: "current", learner_ready: true })).toMatchObject({
        ok: true,
        data: { practice: { exercise_id: exerciseId } },
      });
      const result = await call("record_practice_attempt", { exercise_id: exerciseId, answer_text: answer });
      expect(result).toMatchObject({
        ok: true,
        saved: true,
        data: { result: "correct", course_complete: exerciseId === answers.at(-1)![0] },
      });
    }
    expect(await call("close_learning_session")).toMatchObject({ ok: true, saved: true });
    const returning = await createBrowserVoiceSession(db, learner, null);
    const context = await studyRoom.callTool(db, learner, {
      sessionId: returning.sessionId,
      tool: "get_learning_context",
      args: {},
      idempotencyKey: null,
    });
    expect(context.response).toMatchObject({
      ok: true,
      data: { suggested_next_action: "review_or_choose_next", progress: { lessons_completed: 3 } },
    });
  });
});
