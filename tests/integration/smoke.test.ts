import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runTool } from "@/server/agent/orchestrator";
import { createLearner, createTestDb, startSession } from "../support/test-db";

/** Set SMOKE_DUMP=/path/file.txt to inspect the raw tool payloads. */
const dump = (label: string, value: unknown) => {
  if (process.env.SMOKE_DUMP)
    appendFileSync(process.env.SMOKE_DUMP, `## ${label}\n${JSON.stringify(value, null, 2)}\n\n`);
};

describe("smoke: end-to-end tool flow", () => {
  it("runs goal -> course -> lesson -> practice -> checkpoint -> close", async () => {
    const db = await createTestDb();
    const learner = await createLearner(db, { consent: "granted" });
    let session = await startSession(db, learner);
    const call = async (toolName: string, rawInput: unknown = {}) => {
      const r = await runTool({ db, channel: "simulated", learner, session, toolName, rawInput, interactionId: null });
      if (r.session) session = r.session;
      dump(toolName, r.response);
      return r.response;
    };

    expect((await call("get_learning_context")).ok).toBe(true);
    expect(
      await call("set_learning_goal", { goal_text: "I want to price my homemade snacks", learner_confirmed: true }),
    ).toMatchObject({
      ok: true,
      saved: true,
    });
    expect((await call("list_courses", {})).ok).toBe(true);
    expect(
      (await call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true })).ok,
    ).toBe(true);
    expect((await call("get_lesson_context", {})).ok).toBe(true);
    expect((await call("get_lesson_context", { request: "different_explanation" })).ok).toBe(true);
    expect(await call("get_lesson_context", { lesson_id: "sbs-02" })).toMatchObject({
      ok: false,
      error: { code: "POLICY_VIOLATION" },
    });
    expect(
      await call("record_practice_attempt", {
        exercise_id: "sbs-01-offer-sentence",
        answer_text: "I make murukku for working families on my street",
      }),
    ).toMatchObject({ ok: true, saved: true, data: { result: "correct" } });
    expect(await call("save_checkpoint", {})).toMatchObject({ ok: true, saved: true });
    expect((await call("get_memory_summary")).ok).toBe(true);
    expect(await call("close_learning_session", { reason: "learner_ended" })).toMatchObject({ ok: true, saved: true });
    expect((await call("close_learning_session", { reason: "learner_ended" })).ok).toBe(true);
  });
});
