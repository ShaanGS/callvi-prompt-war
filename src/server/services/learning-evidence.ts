import type { Course } from "@/content/schema";
import type { LanguageCode } from "@/lib/languages";
import type { LearningEvidence } from "../repositories/evidence";

export const REVIEW_INTERVAL_MS = 24 * 60 * 60 * 1000;
export interface LearningSignal {
  concept_id: string;
  lesson_id: string;
  title: string;
  status: "needs_practice" | "practised_with_support" | "practised" | "checked_again" | "not_assessed";
  last_result: LearningEvidence["result"];
  support: LearningEvidence["support"];
  missing: string[];
  last_approach: string | null;
  last_practised_at: string;
  review_due: boolean;
  review_exercise_id: string | null;
}

/** Summarise observations, never infer ability, confidence or personal traits. */
export function learningSignals(rows: LearningEvidence[], course: Course, language: LanguageCode, sessionId: string, now = new Date()): LearningSignal[] {
  const signals: LearningSignal[] = [];
  for (const lesson of course.lessons) for (const concept of lesson.concepts) {
    const history = rows.filter((r) => r.concept_id === concept.id).sort((a,b) => b.observed_at.getTime() - a.observed_at.getTime());
    const latest = history[0];
    if (!latest) continue;
    const exercise = lesson.practice.find((p) => p.id === latest.exercise_id);
    const earlierSuccess = history.find((r) => r.result === "correct" && r.session_id !== latest.session_id && r.exercise_id !== latest.exercise_id && latest.observed_at.getTime() - r.observed_at.getTime() >= REVIEW_INTERVAL_MS);
    const checkedAgain = latest.result === "correct" && latest.purpose === "review" && latest.support === "none_recorded" && !!earlierSuccess;
    const lastSuccess = history.find((r) => r.result === "correct");
    const availableReview = latest.session_id !== sessionId
      ? lesson.practice.find((p) => p.conceptId === concept.id && p.purpose === "review" && !history.some((r) => r.exercise_id === p.id && r.result === "correct")) ?? null
      : null;
    signals.push({
      concept_id: concept.id, lesson_id: lesson.id, title: concept.title[language],
      status: latest.result === "ungraded" ? "not_assessed" : latest.result !== "correct" ? "needs_practice" : checkedAgain ? "checked_again" : latest.support !== "none_recorded" ? "practised_with_support" : "practised",
      last_result: latest.result, support: latest.support,
      missing: latest.missed_criteria.map((id) => exercise?.rubric.criteria.find((c) => c.id === id)?.description[language]).filter((s): s is string => !!s),
      last_approach: latest.approach, last_practised_at: latest.observed_at.toISOString(),
      review_due: latest.session_id !== sessionId && (!lastSuccess || now.getTime() - latest.observed_at.getTime() >= REVIEW_INTERVAL_MS),
      review_exercise_id: availableReview?.id ?? null,
    });
  }
  return signals;
}
