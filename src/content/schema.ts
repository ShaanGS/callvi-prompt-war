import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

/**
 * Structured course content. Each course, lesson, concept, explanation,
 * example, exercise and rubric is a separate typed record. Content is
 * authoritative course knowledge: it is never overwritten by generated text.
 */

const slug = z.string().regex(/^[a-z0-9-]{3,64}$/, "lowercase slug");

export const localizedSchema = z.object({
  "ta-IN": z.string().trim().min(1),
  "en-IN": z.string().trim().min(1),
});

export const localizedTermsSchema = z.object({
  "ta-IN": z.array(z.string().trim().min(1)),
  "en-IN": z.array(z.string().trim().min(1)),
});

export const reviewStatusSchema = z.enum(["team_authored", "mentor_review_in_progress", "mentor_reviewed"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const explanationApproachSchema = z.enum([
  "plain",
  "everyday_example",
  "analogy",
  "step_by_step",
  "question_led",
]);
export type ExplanationApproach = z.infer<typeof explanationApproachSchema>;

export const explanationSchema = z.object({
  approach: explanationApproachSchema,
  text: localizedSchema,
});

export const conceptSchema = z
  .object({
    id: slug,
    title: localizedSchema,
    /** Distinct teaching approaches, in the order they should be offered. */
    explanations: z.array(explanationSchema).min(2),
    keyPoints: z.array(localizedSchema).min(1).max(4),
    checkQuestion: localizedSchema,
  })
  .refine(
    (c) => new Set(c.explanations.map((e) => e.approach)).size === c.explanations.length,
    "each explanation must use a different approach",
  );
export type Concept = z.infer<typeof conceptSchema>;

/** A numeric criterion: the asserted answer must be this number (within tolerance). */
export const numericCriterionSchema = z.object({
  id: slug,
  kind: z.literal("numeric"),
  description: localizedSchema,
  expected: z.number(),
  tolerance: z.number().min(0),
  /** Known wrong values with a targeted explanation of the likely slip. */
  commonMistakes: z.array(z.object({ value: z.number(), explanation: localizedSchema })).default([]),
});

/** A conceptual criterion: the answer must express one of these ideas. */
export const termsCriterionSchema = z.object({
  id: slug,
  kind: z.literal("terms"),
  description: localizedSchema,
  /** Stems/phrases that indicate the idea is present (case-insensitive substring match). */
  terms: localizedTermsSchema,
  minMatches: z.number().int().min(1).default(1),
  /** For ideas whose correct expression can itself be negative (honest limits). */
  acceptsNegation: z.boolean().default(false),
});

export const criterionSchema = z.discriminatedUnion("kind", [numericCriterionSchema, termsCriterionSchema]);
export type Criterion = z.infer<typeof criterionSchema>;

export const rubricSchema = z
  .object({
    version: z.number().int().positive().default(1),
    criteria: z.array(criterionSchema).min(1),
    /** Criterion ids that must all be met for "correct". */
    requiredForCorrect: z.array(slug).min(1),
    /**
     * "auto": the criteria can judge the answer, so an answer that meets none of
     * them is "needs_practice".
     * "open": open-ended (e.g. role play). An answer that meets no criterion but
     * is substantive is "ungraded" rather than wrongly marked incorrect.
     */
    mode: z.enum(["auto", "open"]),
    feedback: z.object({
      correct: localizedSchema,
      partial: localizedSchema,
      needs_practice: localizedSchema,
      ungraded: localizedSchema,
    }),
  })
  .refine(
    (r) => r.requiredForCorrect.every((id) => r.criteria.some((c) => c.id === id)),
    "requiredForCorrect must reference criteria defined in this rubric",
  );
export type Rubric = z.infer<typeof rubricSchema>;

export const exerciseSchema = z.object({
  id: slug,
  conceptId: slug,
  kind: z.enum(["calculation", "explain", "role_play", "decide"]),
  purpose: z.enum(["practice", "review"]).default("practice"),
  prompt: localizedSchema,
  hints: z.array(localizedSchema).min(1),
  modelAnswer: localizedSchema,
  rubric: rubricSchema,
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const lessonSchema = z
  .object({
    id: slug,
    sequence: z.number().int().positive(),
    title: localizedSchema,
    objective: localizedSchema,
    estimatedMinutes: z.number().int().positive(),
    concepts: z.array(conceptSchema).min(1),
    practice: z.array(exerciseSchema).min(1),
    /** A small, safe action the learner can try after the lesson. */
    realWorldAction: localizedSchema,
    reviewStatus: reviewStatusSchema,
    /** Content that needs specialist review before wider deployment. */
    reviewFlags: z.array(localizedSchema).default([]),
  })
  .superRefine((lesson, ctx) => {
    const conceptIds = new Set(lesson.concepts.map((c) => c.id));
    if (conceptIds.size !== lesson.concepts.length) {
      ctx.addIssue({ code: "custom", message: `duplicate concept id in ${lesson.id}` });
    }
    for (const ex of lesson.practice) {
      if (!conceptIds.has(ex.conceptId)) {
        ctx.addIssue({ code: "custom", message: `exercise ${ex.id} references unknown concept ${ex.conceptId}` });
      }
      const criterionIds = new Set(ex.rubric.criteria.map((c) => c.id));
      for (const req of ex.rubric.requiredForCorrect) {
        if (!criterionIds.has(req)) {
          ctx.addIssue({ code: "custom", message: `exercise ${ex.id} requires unknown criterion ${req}` });
        }
      }
    }
    for (const concept of lesson.concepts) {
      if (!lesson.practice.some((ex) => ex.conceptId === concept.id)) {
        ctx.addIssue({ code: "custom", message: `concept ${concept.id} in ${lesson.id} has no practice exercise` });
      }
    }
  });
export type Lesson = z.infer<typeof lessonSchema>;

export const courseStatusSchema = z.enum(["draft", "reviewed", "published", "archived"]);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

export const courseSchema = z
  .object({
    id: slug,
    sortOrder: z.number().int(),
    title: localizedSchema,
    summary: localizedSchema,
    description: localizedSchema,
    audience: localizedSchema,
    outcomes: z.array(localizedSchema).min(1),
    languages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1),
    primaryLanguage: z.enum(SUPPORTED_LANGUAGES),
    level: z.enum(["beginner", "intermediate"]),
    status: courseStatusSchema,
    contentReview: z.object({ status: reviewStatusSchema, note: localizedSchema }),
    estimatedMinutes: z.number().int().positive(),
    /** Words that suggest this course fits a learner's stated goal. */
    recommendationTerms: localizedTermsSchema,
    lessons: z.array(lessonSchema).min(1),
  })
  .superRefine((course, ctx) => {
    const sequences = course.lessons.map((l) => l.sequence).sort((a, b) => a - b);
    sequences.forEach((seq, i) => {
      if (seq !== i + 1) ctx.addIssue({ code: "custom", message: `${course.id}: lesson sequence must be 1..n` });
    });
    const ids = new Set<string>();
    for (const lesson of course.lessons) {
      // Concept ids key learner mastery records, so they must be unique per course.
      for (const id of [lesson.id, ...lesson.concepts.map((c) => c.id), ...lesson.practice.map((p) => p.id)]) {
        if (ids.has(id)) ctx.addIssue({ code: "custom", message: `${course.id}: duplicate id ${id}` });
        ids.add(id);
      }
    }
  });
export type Course = z.infer<typeof courseSchema>;
