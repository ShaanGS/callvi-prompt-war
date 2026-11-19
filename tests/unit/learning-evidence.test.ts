import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/content/courses";
import { learningSignals } from "@/server/services/learning-evidence";
import type { LearningEvidence } from "@/server/repositories/evidence";

const course = COURSE_CATALOGUE.find((c) => c.id === "small-business-starter")!;
const base: LearningEvidence = {
  attempt_id: "11111111-1111-4111-8111-111111111111",
  learner_id: "11111111-1111-4111-8111-111111111111",
  enrollment_id: "11111111-1111-4111-8111-111111111111",
  session_id: "first-call",
  lesson_id: "sbs-02",
  concept_id: "sbs-unit-cost",
  exercise_id: "sbs-02-unit-cost",
  purpose: "practice",
  result: "correct",
  support: "none_recorded",
  approach: "plain",
  met_criteria: ["unit-cost-12"],
  missed_criteria: [],
  rubric_version: 1,
  observed_at: new Date("2026-11-01T10:00:00Z"),
};
const review: LearningEvidence = {
  ...base,
  session_id: "second-call",
  exercise_id: "sbs-02-unit-cost-review",
  purpose: "review",
  observed_at: new Date("2026-11-03T10:00:00Z"),
};
const signal = (rows: LearningEvidence[]) =>
  learningSignals(rows, course, "en-IN", "third-call", new Date("2026-11-04T10:00:00Z"))[0];

describe("claims from learning evidence", () => {
  it("requires a new question, a later call, a later day and no recorded help for checked-again status", () => {
    expect(signal([base, review]).status).toBe("checked_again");
    for (const modified of [
      { ...review, exercise_id: base.exercise_id },
      { ...review, session_id: base.session_id },
      { ...review, observed_at: new Date("2026-11-01T11:00:00Z") },
      { ...review, support: "example_provided" as const },
    ])
      expect(signal([base, modified]).status).not.toBe("checked_again");
  });
  it("uses a later difficulty instead of preserving a false success claim", () => {
    expect(signal([base, { ...review, result: "needs_practice", missed_criteria: ["unit-cost-12"] }])).toMatchObject({
      status: "needs_practice",
      missing: ["Cost per packet is 18 rupees"],
    });
  });
  it("does not interpret an ungraded answer as evidence of failure", () => {
    expect(signal([{ ...base, result: "ungraded" }]).status).toBe("not_assessed");
  });
});
