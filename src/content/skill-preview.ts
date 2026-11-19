import { conceptSchema, exerciseSchema, type Concept, type Exercise } from "./schema";
import { smallBusinessStarter } from "./courses/small-business-starter";
import { digitalBusinessBasics } from "./courses/digital-business-basics";
import { customerCall } from "./courses/customer-call";

/**
 * The three exercises the public preview offers, selected from the authored
 * courses and validated against the content schema.
 *
 * This is the only module the preview reads content through. The static build
 * replaces it with the same data pre-serialised (scripts/extract-preview.ts),
 * so a visitor's phone downloads three exercises rather than whole courses
 * and the schema library needed to check them.
 */

export interface SkillPreviewContent {
  course: { "en-IN": string; "ta-IN": string };
  exercise: Exercise;
  concept: Concept;
}

function selectPractice(course: typeof smallBusinessStarter, lessonId: string, exerciseId: string): SkillPreviewContent {
  const lesson = course.lessons.find(item => item.id === lessonId);
  const exercise = exerciseSchema.parse(lesson?.practice.find(item => item.id === exerciseId));
  const concept = conceptSchema.parse(lesson?.concepts.find(item => item.id === exercise.conceptId));
  return { course: course.title, exercise, concept };
}

const cost = selectPractice(smallBusinessStarter, "sbs-02", "sbs-02-unit-cost");
const digital = selectPractice(digitalBusinessBasics, "dbb-02", "dbb-02-screenshot");

/** The communication lesson: a customer call the learner answers as a home tailor. */
export const callPractice: Exercise = exerciseSchema.parse(customerCall.lessons[0].practice[0]);

export function getSkillPreview(skill: string): SkillPreviewContent | null {
  if (skill === "cost") return cost;
  if (skill === "digital") return digital;
  return null;
}
