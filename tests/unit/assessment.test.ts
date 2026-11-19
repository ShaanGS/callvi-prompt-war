import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/content/courses";
import { exerciseSchema } from "@/content/schema";
import { assessAnswer } from "@/lib/assessment/assessment-service";
import { extractNumbers } from "@/lib/assessment/numbers";

function exercise(id: string) {
  for (const course of COURSE_CATALOGUE) {
    for (const lesson of course.lessons) {
      const found = lesson.practice.find((p) => p.id === id);
      if (found) return found;
    }
  }
  throw new Error(`exercise ${id} not found`);
}

describe("number extraction", () => {
  it("reads digits, English number words and Tamil number words", () => {
    expect(extractNumbers("₹12 each")).toContain(12);
    expect(extractNumbers("twelve rupees")).toContain(12);
    expect(extractNumbers("பன்னிரண்டு ரூபாய்")).toContain(12);
    expect(extractNumbers("1,200")).toContain(1200);
  });

  it("understands colloquial Tamil amounts without merging separate quantities", () => {
    expect(extractNumbers("பன்னெண்டு ரூபா")).toContain(12);
    expect(extractNumbers("நூத்தி இருபது ரூபா")).toContain(120);
    expect(extractNumbers("௧௨ ரூபாய்")).toContain(12);
    expect(extractNumbers("நூறு ரூபாய் இருபது பாக்கெட்")).toEqual([100, 20]);
  });
});

describe("rubric outcomes", () => {
  const unitCost = exercise("sbs-02-unit-cost");
  const offer = exercise("sbs-01-offer-sentence");
  const openIntro = exercise("cc-01-specific-intro");

  it("marks a correct calculation correct", () => {
    expect(assessAnswer({ exercise: unitCost, answerText: "It costs 12 rupees for one", language: "en-IN", attemptNumber: 1 }).result).toBe("correct");
  });

  it.each([
    "It is not 12 rupees. My answer is 120 rupees.",
    "12 or 120", "120 for ten packets, maybe 12", "-12", "minus twelve", "௧௨ அல்லது ௧௨௦",
  ])("does not reward a quoted, uncertain or unsupported number: %s", (answerText) => {
    expect(assessAnswer({ exercise: unitCost, answerText, language: "en-IN", attemptNumber: 1 }).result).not.toBe("correct");
  });

  it.each(["120 divided by 10 equals 12", "12 because 120 divided by 10", "12.0", "Not 120. Twelve rupees.", "ஒரு பாக்கெட்டுக்கு பன்னெண்டு ரூபா", "நூத்தி இருபதை பத்தால வகுத்தா பன்னிரண்டு ரூபா"])('accepts an identifiable final answer: %s', (answerText) => {
    expect(assessAnswer({ exercise: unitCost, answerText, language: "en-IN", attemptNumber: 1 }).result).toBe("correct");
  });

  it("clarifies ambiguous arithmetic without giving away the answer", () => {
    const r = assessAnswer({ exercise: unitCost, answerText: "120 and 12", language: "ta-IN", attemptNumber: 3 });
    expect(r).toMatchObject({ result: "ungraded", score: null, hint: null, modelAnswer: null, clarification: expect.any(String) });
  });

  it("does not count negated product or customer keywords as a demonstrated offer", () => {
    for (const answerText of ["I do not sell snacks. I never sell to working families.", "நான் முறுக்கு விக்க மாட்டேன். பக்கத்து குடும்பங்களுக்கு விக்கவே மாட்டேன்."]) {
      expect(assessAnswer({ exercise: offer, answerText, language: "ta-IN", attemptNumber: 1 }).result).not.toBe("correct");
    }
  });

  it("still accepts a truthful negative delivery limit", () => {
    for (const answerText of ["I cannot deliver every day. Only Saturday nearby.", "I can only deliver on Saturdays.", "சனிக்கிழமை மட்டும் தருவேன்."]) {
      expect(assessAnswer({ exercise: exercise("sbs-03-honest-answer"), answerText, language: "en-IN", attemptNumber: 1 }).result).toBe("correct");
    }
  });

  it("does not invent the cause of a wrong answer on a new problem", () => {
    const outcome = assessAnswer({ exercise: exercise("sbs-02-unit-cost-review"), answerText: "12", language: "ta-IN", attemptNumber: 1 });
    expect(outcome.result).toBe("needs_practice");
    expect(outcome.mistakeExplanation).toBeNull();
    expect(outcome.feedback).not.toContain("மொத்தச் செலவை ஒரு packet செலவா");
  });

  it("does not accept a generic inability or a negated Saturday promise as the actual delivery limit", () => {
    for (const answerText of ["I cannot do that", "I cannot deliver on Saturday", "சனிக்கிழமை தர முடியாது"]) {
      expect(assessAnswer({ exercise: exercise("sbs-03-honest-answer"), answerText, language: "en-IN", attemptNumber: 1 }).result).not.toBe("correct");
    }
  });

  it("explains a recognised calculation slip without revealing the answer on the first try", () => {
    const r = assessAnswer({ exercise: unitCost, answerText: "120", language: "en-IN", attemptNumber: 1 });
    expect(r.result).toBe("needs_practice");
    expect(r.mistakeExplanation).not.toBeNull();
    expect(r.modelAnswer).toBeNull();
    expect(r.hint).not.toBeNull();
  });

  it("reveals the example answer from the second unsuccessful attempt", () => {
    const r = assessAnswer({ exercise: unitCost, answerText: "120", language: "en-IN", attemptNumber: 2 });
    expect(r.modelAnswer).not.toBeNull();
  });

  it("gives partial credit when some required criteria are met", () => {
    const r = assessAnswer({ exercise: offer, answerText: "I sell snacks", language: "en-IN", attemptNumber: 1 });
    expect(r.result).toBe("partial");
    expect(r.metCriteria.length).toBeGreaterThan(0);
    expect(r.missedCriteria.length).toBeGreaterThan(0);
  });

  it("accepts a Tamil answer", () => {
    const r = assessAnswer({ exercise: offer, answerText: "நான் தெருவில் உள்ள வேலைக்குப் போகும் குடும்பங்களுக்கு முறுக்கு செய்கிறேன்", language: "ta-IN", attemptNumber: 1 });
    expect(["correct", "partial"]).toContain(r.result);
  });

  it("assesses everyday Tamil and code-mixed demo answers without granting missing skills", () => {
    const assess = (id: string, answerText: string) => assessAnswer({ exercise: exercise(id), answerText, language: "ta-IN", attemptNumber: 1 });
    expect(assess("sbs-01-offer-sentence", "வீட்டுல முறுக்கு செஞ்சு பக்கத்து குடும்பங்களுக்கு விப்பேன்").result).toBe("correct");
    expect(assess("sbs-01-offer-sentence", "முறுக்கு செஞ்சு விப்பேன்").result).toBe("partial");
    expect(assess("sbs-01-first-customer", "எங்க தெருவில வேலைக்குப் போற குடும்பங்கள், காலைல டைம் மிச்சமாகும்").result).toBe("correct");
    expect(assess("sbs-03-introduce", "வீட்டுல புதுசா முறுக்கு செய்றேன். சனிக்கிழமை வாங்கிக்கலாம்.").result).toBe("correct");
    expect(assess("sbs-02-unit-cost", "பன்னெண்டு ரூபா").result).toBe("correct");
    expect(assess("sbs-02-unit-cost", "நூத்தி இருபது ரூபா").result).toBe("needs_practice");
  });

  it("returns ungraded for a substantive open answer it cannot fully judge, and never 'correct' by default", () => {
    const r = assessAnswer({
      exercise: openIntro,
      answerText: "Hello, I help people with their clothing needs and I am very good and reliable",
      language: "en-IN",
      attemptNumber: 1,
    });
    expect(["ungraded", "partial"]).toContain(r.result);
    expect(r.result).not.toBe("correct");
  });

  it("treats an empty-ish answer as needing practice", () => {
    expect(assessAnswer({ exercise: offer, answerText: "hmm", language: "en-IN", attemptNumber: 1 }).result).toBe("needs_practice");
  });
});

describe("practice rubric schema", () => {
  it("accepts every exercise in the catalogue", () => {
    for (const course of COURSE_CATALOGUE) for (const lesson of course.lessons) for (const ex of lesson.practice) expect(exerciseSchema.safeParse(ex).success).toBe(true);
  });

  it("rejects malformed rubrics", () => {
    const valid = exercise("sbs-02-unit-cost");
    const missingFeedback = { ...valid, rubric: { ...valid.rubric, feedback: { correct: valid.rubric.feedback.correct } } };
    expect(exerciseSchema.safeParse(missingFeedback).success).toBe(false);
    const unknownCriterion = { ...valid, rubric: { ...valid.rubric, requiredForCorrect: ["does-not-exist"] } };
    expect(exerciseSchema.safeParse(unknownCriterion).success).toBe(false);
    const badMode = { ...valid, rubric: { ...valid.rubric, mode: "llm" } };
    expect(exerciseSchema.safeParse(badMode).success).toBe(false);
  });
});
