import type { Concept, Course, ExplanationApproach, Lesson } from "@/content/schema";
import type { ConsentStatus, MasteryState, PracticeResult, SessionState } from "../domain/types";

/**
 * LearningPolicy — the product's learning rules, independent of channel and
 * provider. Pure functions only: given facts, decide what is allowed and what
 * should happen next. The orchestrator enforces these; the voice runtime only
 * receives their outcome.
 */

/** Course advancement, separate from evidence of independent or retained learning. */
export function isConceptDone(state: MasteryState | undefined): boolean {
  return state === "practised" || state === "mastered" || state === "carried_forward";
}

export type MasteryMap = Record<string, MasteryState | undefined>;

export function isLessonComplete(lesson: Lesson, mastery: MasteryMap): boolean {
  return lesson.concepts.every((c) => isConceptDone(mastery[c.id]));
}

export function orderedLessons(course: Course): Lesson[] {
  return [...course.lessons].sort((a, b) => a.sequence - b.sequence);
}

/** The first lesson that is not complete (the furthest a learner may go), or the last lesson. */
export function frontierLesson(course: Course, completedLessonIds: ReadonlySet<string>): Lesson {
  const lessons = orderedLessons(course);
  return lessons.find((l) => !completedLessonIds.has(l.id)) ?? lessons[lessons.length - 1];
}

export type LessonAccess =
  | { allowed: true; lesson: Lesson; review: boolean }
  | { allowed: false; reason: "unknown_lesson" | "locked"; nextAllowedLesson: Lesson };

/**
 * Lessons follow the course sequence. A learner may open any completed lesson
 * for review and the frontier lesson; later lessons stay locked.
 */
export function canOpenLesson(course: Course, completedLessonIds: ReadonlySet<string>, lessonId: string): LessonAccess {
  const frontier = frontierLesson(course, completedLessonIds);
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return { allowed: false, reason: "unknown_lesson", nextAllowedLesson: frontier };
  if (completedLessonIds.has(lesson.id)) return { allowed: true, lesson, review: true };
  if (lesson.sequence <= frontier.sequence) return { allowed: true, lesson, review: false };
  return { allowed: false, reason: "locked", nextAllowedLesson: frontier };
}

export function nextLessonAfter(course: Course, lessonId: string): Lesson | null {
  const lessons = orderedLessons(course);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  return idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
}

export function firstOpenConcept(lesson: Lesson, mastery: MasteryMap): Concept | null {
  return lesson.concepts.find((c) => !isConceptDone(mastery[c.id])) ?? null;
}

export function nextConceptAfter(lesson: Lesson, conceptId: string, mastery: MasteryMap): Concept | null {
  const idx = lesson.concepts.findIndex((c) => c.id === conceptId);
  const after = lesson.concepts.slice(idx + 1).find((c) => !isConceptDone(mastery[c.id]));
  return after ?? firstOpenConcept(lesson, mastery);
}

/** After this many unsuccessful attempts on a concept, the learner may choose to move on. */
export const ATTEMPTS_BEFORE_MOVE_ON = 2;

export function masteryAfterAttempt(previous: MasteryState | undefined, result: PracticeResult): MasteryState {
  switch (result) {
    case "correct":
      return "practised";
    case "partial":
      return isConceptDone(previous) ? previous! : "practising";
    case "needs_practice":
      return isConceptDone(previous) ? previous! : "needs_practice";
    case "ungraded":
      return previous ?? "practising";
  }
}

export type NextStep = "retry" | "offer_move_on" | "self_check" | "next_concept" | "lesson_complete" | "course_complete";

export function nextStepAfterAttempt(input: {
  result: PracticeResult;
  attemptsOnConcept: number;
  lessonComplete: boolean;
  courseComplete: boolean;
}): NextStep {
  if (input.result === "correct") {
    if (input.courseComplete) return "course_complete";
    if (input.lessonComplete) return "lesson_complete";
    return "next_concept";
  }
  if (input.result === "ungraded") return "self_check";
  return input.attemptsOnConcept >= ATTEMPTS_BEFORE_MOVE_ON ? "offer_move_on" : "retry";
}

/** May the learner carry a concept forward without mastering it? */
export function canCarryForward(attemptsOnConcept: number, current: MasteryState | undefined): boolean {
  return !isConceptDone(current) && attemptsOnConcept >= 1;
}

const STYLE_TO_APPROACH: Record<string, ExplanationApproach[]> = {
  examples: ["everyday_example", "analogy"],
  step_by_step: ["step_by_step", "question_led"],
  short: ["plain"],
};

export interface ExplanationChoice {
  approach: ExplanationApproach;
  text: Concept["explanations"][number]["text"];
  /** True when every distinct approach has already been used in this session. */
  exhausted: boolean;
  remaining: number;
}

/**
 * Choose an explanation. "different" must return a meaningfully different
 * approach from those already used this session; when none remain, the
 * caller is told so (and the agent switches to an example from the learner's
 * own context or to practice) instead of repeating verbatim.
 */
export function chooseExplanation(
  concept: Concept,
  used: readonly ExplanationApproach[],
  request: "default" | "different" | "repeat",
  preferredStyle?: string,
): ExplanationChoice {
  const all = concept.explanations;
  const unused = all.filter((e) => !used.includes(e.approach));
  const remainingAfter = (chosen: ExplanationApproach) => all.filter((e) => e.approach !== chosen && !used.includes(e.approach)).length;

  if (request === "repeat" && used.length > 0) {
    const last = all.find((e) => e.approach === used[used.length - 1]) ?? all[0];
    return { approach: last.approach, text: last.text, exhausted: false, remaining: unused.length };
  }

  if (request === "default" && used.length > 0) {
    const last = all.find((e) => e.approach === used[used.length - 1]) ?? all[0];
    return { approach: last.approach, text: last.text, exhausted: false, remaining: unused.length };
  }

  if (unused.length === 0) {
    // All approaches used: rotate, but flag it so the agent changes strategy.
    const next = all[used.length % all.length];
    return { approach: next.approach, text: next.text, exhausted: true, remaining: 0 };
  }

  const preferred = preferredStyle ? STYLE_TO_APPROACH[preferredStyle] : undefined;
  const chosen = (preferred && unused.find((e) => preferred.includes(e.approach))) ?? unused[0];
  return { approach: chosen.approach, text: chosen.text, exhausted: false, remaining: remainingAfter(chosen.approach) };
}

export type SuggestedAction =
  | "ask_memory_consent"
  | "discover_goal"
  | "recommend_course"
  | "start_lesson"
  | "resume_lesson"
  | "review_or_choose_next";

export function suggestNextAction(facts: {
  consentStatus: ConsentStatus;
  hasGoal: boolean;
  hasActiveCourse: boolean;
  courseComplete: boolean;
  hasCheckpoint: boolean;
}): SuggestedAction {
  if (facts.consentStatus === "pending") return "ask_memory_consent";
  if (!facts.hasGoal && !facts.hasActiveCourse) return "discover_goal";
  if (!facts.hasActiveCourse) return "recommend_course";
  if (facts.courseComplete) return "review_or_choose_next";
  return facts.hasCheckpoint ? "resume_lesson" : "start_lesson";
}

/** Session phase implied by the state after a tool ran. */
export function phaseFor(state: SessionState): SessionState["phase"] {
  if (state.phase === "closed") return "closed";
  if (state.pendingExerciseId) return "practice";
  if (state.conceptId) return "teach";
  if (state.courseId) return "confirm_enrolment";
  if (state.goal) return "recommend_course";
  return "discover_goal";
}

/**
 * Topics the product must not advise on. Used in provider instructions and in
 * tool guidance so the agent redirects honestly.
 */
export const OUT_OF_SCOPE_TOPICS = [
  "personal legal, tax, loan, investment or other regulated financial advice",
  "guarantees of income, employment, business success or certification",
  "medical, emergency or safety services",
  "topics unrelated to the learner's chosen course",
] as const;

/** Sensitive data the product never asks for or stores. */
export const NEVER_COLLECT = [
  "OTPs, PINs, passwords or bank/account credentials",
  "caste, religion, health details or political views",
  "precise home address",
  "income or family conflict details",
] as const;
