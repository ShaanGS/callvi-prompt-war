import { conceptSchema, exerciseSchema } from "./schema";
import { smallBusinessStarter } from "./courses/small-business-starter";
import { digitalBusinessBasics } from "./courses/digital-business-basics";

function selectPractice(course: typeof smallBusinessStarter, lessonId: string, exerciseId: string) {
  const lesson = course.lessons.find(item => item.id === lessonId);
  const exercise = exerciseSchema.parse(lesson?.practice.find(item => item.id === exerciseId));
  const concept = conceptSchema.parse(lesson?.concepts.find(item => item.id === exercise.conceptId));
  return { course: course.title, exercise, concept };
}

const cost = selectPractice(smallBusinessStarter, "sbs-02", "sbs-02-unit-cost");
const digital = selectPractice(digitalBusinessBasics, "dbb-02", "dbb-02-screenshot");

export function getSkillPreview(skill: string) {
  if (skill === "cost") return cost;
  if (skill === "digital") return digital;
  return null;
}
