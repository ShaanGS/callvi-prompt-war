import { describe, expect, it } from "vitest";
import { getSkillPreview } from "@/content/skill-preview";

const LANGUAGES = ["en-IN", "ta-IN"] as const;

describe("skill preview content", () => {
  it("previews the unit-cost calculation from Small Business Starter for the cost skill", () => {
    const preview = getSkillPreview("cost");
    expect(preview).not.toBeNull();
    expect(preview?.course["en-IN"]).toBe("Small Business Starter");
    expect(preview?.exercise).toMatchObject({
      id: "sbs-02-unit-cost",
      conceptId: "sbs-unit-cost",
      kind: "calculation",
    });
    expect(preview?.concept.id).toBe("sbs-unit-cost");
  });

  it("previews the payment-screenshot decision from Digital Basics for the digital skill", () => {
    const preview = getSkillPreview("digital");
    expect(preview).not.toBeNull();
    expect(preview?.course["en-IN"]).toBe("Digital Basics for a Small Business");
    expect(preview?.exercise).toMatchObject({
      id: "dbb-02-screenshot",
      conceptId: "dbb-confirm-payment",
      kind: "decide",
    });
    expect(preview?.concept.id).toBe("dbb-confirm-payment");
  });

  it.each(["cost", "digital"])("pairs the %s exercise with the concept it practises", (skill) => {
    const preview = getSkillPreview(skill);
    expect(preview?.concept.id).toBe(preview?.exercise.conceptId);
  });

  it.each(["cost", "digital"])(
    "gives the %s preview course title, prompt and every explanation in English and Tamil",
    (skill) => {
      const preview = getSkillPreview(skill);
      expect(preview?.concept.explanations.length).toBeGreaterThanOrEqual(2);
      for (const language of LANGUAGES) {
        expect(preview?.course[language].trim()).not.toBe("");
        expect(preview?.exercise.prompt[language].trim()).not.toBe("");
        expect(preview?.concept.title[language].trim()).not.toBe("");
        for (const explanation of preview?.concept.explanations ?? [])
          expect(explanation.text[language].trim()).not.toBe("");
      }
      // The Tamil text is a real translation, not the English copied across.
      expect(preview?.course["ta-IN"]).not.toBe(preview?.course["en-IN"]);
      expect(preview?.course["ta-IN"]).toMatch(/[஀-௿]/);
    },
  );

  it("offers each explanation through a distinct teaching approach", () => {
    for (const skill of ["cost", "digital"]) {
      const approaches = getSkillPreview(skill)?.concept.explanations.map((e) => e.approach) ?? [];
      expect(new Set(approaches).size).toBe(approaches.length);
    }
  });

  it("returns the same preview object on repeated calls rather than re-parsing content", () => {
    expect(getSkillPreview("cost")).toBe(getSkillPreview("cost"));
  });

  it.each(["", "Cost", "COST", "pricing", "__proto__", "cost "])("returns null for the unknown skill %j", (skill) => {
    expect(getSkillPreview(skill)).toBeNull();
  });
});
