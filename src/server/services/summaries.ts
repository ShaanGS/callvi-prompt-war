import type { LanguageCode } from "@/lib/languages";
import type { CheckpointData } from "../domain/types";
import type { StoredCourse } from "../repositories/courses";

/**
 * Factual, server-generated summaries. Checkpoints are stored as structured
 * data; these functions render them for people. The voice model never writes
 * learner memory directly.
 */

export const NEXT_ACTIONS = [
  "set_goal",
  "choose_course",
  "start_lesson",
  "continue_lesson",
  "practise_again",
  "start_next_lesson",
  "review_course",
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

const NEXT_ACTION_TEXT: Record<NextAction, Record<LanguageCode, string>> = {
  set_goal: { "en-IN": "agree a learning goal", "ta-IN": "ஒரு கற்றல் இலக்கை முடிவு செய்வது" },
  choose_course: { "en-IN": "choose a course", "ta-IN": "ஒரு பாடநெறியைத் தேர்ந்தெடுப்பது" },
  start_lesson: { "en-IN": "start the lesson", "ta-IN": "பாடத்தைத் தொடங்குவது" },
  continue_lesson: { "en-IN": "continue the lesson", "ta-IN": "பாடத்தைத் தொடர்வது" },
  practise_again: { "en-IN": "practise the same idea again", "ta-IN": "அதே கருத்தை மீண்டும் பயிற்சி செய்வது" },
  start_next_lesson: { "en-IN": "start the next lesson", "ta-IN": "அடுத்த பாடத்தைத் தொடங்குவது" },
  review_course: { "en-IN": "review the course or choose another", "ta-IN": "பாடநெறியை மீண்டும் பார்ப்பது அல்லது வேறொன்றைத் தேர்வது" },
};

export function isNextAction(value: string): value is NextAction {
  return (NEXT_ACTIONS as readonly string[]).includes(value);
}

export function describeNextAction(action: string, language: LanguageCode): string {
  return isNextAction(action) ? NEXT_ACTION_TEXT[action][language] : action;
}

export function renderCheckpointSummary(data: CheckpointData, course: StoredCourse | null, language: LanguageCode): string {
  const ta = language === "ta-IN";
  const lesson = course && data.lessonId ? course.lessons.find((l) => l.id === data.lessonId) : undefined;
  const concept = lesson && data.conceptId ? lesson.concepts.find((c) => c.id === data.conceptId) : undefined;
  const parts: string[] = [];
  if (course && lesson) {
    parts.push(
      ta
        ? `${course.title[language]} — பாடம் ${lesson.sequence}: ${lesson.title[language]}.`
        : `${course.title[language]} — lesson ${lesson.sequence}: ${lesson.title[language]}.`,
    );
  } else if (data.goalText) {
    parts.push(ta ? `இலக்கு: ${data.goalText}.` : `Goal: ${data.goalText}.`);
  }
  if (concept) parts.push(ta ? `கடைசியாகப் பார்த்த கருத்து: ${concept.title[language]}.` : `Last idea covered: ${concept.title[language]}.`);
  const n = data.completedPractice.length;
  if (n > 0) {
    const correct = data.completedPractice.filter((p) => p.result === "correct").length;
    parts.push(ta ? `${n} பயிற்சிக் கேள்விகள் (${correct} சரி).` : `${n} practice question${n === 1 ? "" : "s"} (${correct} correct).`);
  }
  if (data.unresolvedDifficulty) {
    parts.push(ta ? `கடினமாக இருந்தது: ${data.unresolvedDifficulty}.` : `Found difficult: ${data.unresolvedDifficulty}.`);
  }
  parts.push(ta ? `அடுத்து: ${describeNextAction(data.nextAction, language)}.` : `Next: ${describeNextAction(data.nextAction, language)}.`);
  return parts.join(" ");
}
