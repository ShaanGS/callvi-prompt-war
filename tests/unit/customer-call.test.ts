import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/content/courses";
import { assessAnswer } from "@/server/services/assessment/assessment-service";

const exercise = COURSE_CATALOGUE.find((course) => course.id === "customer-call")!.lessons[0].practice[0];

describe("tailoring call rehearsal", () => {
  it.each([
    ["I charge 50 rupees.", "partial", ["pickup-time"]],
    ["It will be ready in two days.", "partial", ["quoted-fee"]],
    ["I charge 50 rupees and need two days.", "correct", []],
    ["ஐம்பது ரூபாய் ஆகும். ரெண்டு நாள்ல தருவேன்.", "correct", []],
    ["It costs 150 and takes two days.", "partial", ["quoted-fee"]],
  ])("assesses %s", (answer, result, missed) => {
    const outcome = assessAnswer({ exercise, language: "ta-IN", answerText: String(answer), attemptNumber: 1 });
    expect(outcome.result).toBe(result);
    expect(outcome.missedCriteria).toEqual(missed);
  });
});
