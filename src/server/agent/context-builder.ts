import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/languages";
import type { Queryable } from "../db/types";
import type { Learner, LearningSession } from "../domain/types";
import { enrollmentsRepo } from "../repositories/learning";
import { checkpointsRepo } from "../repositories/sessions";
import { courseService } from "../services/course-service";
import { learningService, snapshotFromSession } from "../services/learning-service";
import { memoryService } from "../services/memory-service";
import { renderCheckpointSummary } from "../services/summaries";
import { isConceptDone, suggestNextAction, type SuggestedAction } from "./learning-policy";
import { evidenceRepo } from "../repositories/evidence";
import { learningSignals, type LearningSignal } from "../services/learning-evidence";

/**
 * ContextBuilder — assembles the compact context for a learner and session.
 *
 * Layers are kept separate:
 *   1. Turn context: owned by the voice runtime; never assembled here.
 *   2. Session state: the session row's state (current goal/course/lesson/concept).
 *   3. Durable learner memory: only when consent is granted — goal, focus
 *      enrolment, mastery for that course, last checkpoint, preferences.
 *   4. Course knowledge: titles of the current course/lesson/concept only. Full
 *      lesson content is fetched separately by get_lesson_context when needed.
 *
 * It never includes other learners, other courses' progress, practice answer
 * text, transcripts or the full catalogue.
 */

export interface LearningContext {
  session: { id: string; channel: LearningSession["channel"]; memory_mode: LearningSession["memoryMode"]; phase: string; learning_ready: boolean };
  learner: {
    display_name: string | null;
    preferred_language: LanguageCode;
    consent_status: Learner["consentStatus"];
    supported_languages: readonly LanguageCode[];
  };
  active_goal: string | null;
  active_course: { id: string; title: string; lesson_count: number } | null;
  progress: {
    current_lesson: { id: string; title: string; sequence: number; of: number } | null;
    current_concept: { id: string; title: string } | null;
    completed_concepts: string[];
    needs_practice: string[];
    lessons_completed: number;
  } | null;
  last_session_summary: string | null;
  last_session_at: string | null;
  learning_evidence: LearningSignal[];
  review_suggestion: LearningSignal | null;
  preferences: { explanation_style?: string; pace?: string };
  suggested_next_action: SuggestedAction;
  guidance: string;
}

const MAX_LISTED_CONCEPTS = 12;

const GUIDANCE: Record<SuggestedAction, string> = {
  ask_memory_consent:
    "First answer the caller's question and establish what they want from this call. When saving learning becomes relevant, explain what would be saved (goal, course, progress) and ask permission once. If already answered clearly, record that decision without asking again. Consent alone is not permission to start a lesson. Learning works either way.",
  discover_goal: "Ask, one question at a time, what the learner would like to be able to do. Do not assume a goal.",
  recommend_course: "Use list_courses with the learner's goal, describe at most three options briefly, and let the learner choose.",
  start_lesson: "Ask what the caller needs today. Only if they explicitly ask to start this course now, call get_lesson_context with learner_ready=true. Choosing a topic to discuss, memory consent and a polite acknowledgement are not automatic permission to launch a lesson.",
  resume_lesson:
    "Ask what the caller wants today; saved progress does not mean they want a lesson now. If useful, briefly mention the actual stopping point and offer to continue, review or ask a question. If they explicitly choose to continue, call get_lesson_context with request=current and learner_ready=true without asking again. A hello or general yes to an open question is not a choice to learn.",
  review_or_choose_next: "The course is complete. Offer a short review or help the learner choose another course.",
};

export async function buildLearningContext(db: Queryable, learner: Learner, session: LearningSession): Promise<LearningContext> {
  const language = session.language;
  const state = session.state;
  const durable = session.memoryMode === "durable" && memoryService.isDurable(learner);

  const course = state.courseId ? await courseService.getAvailable(db, state.courseId).catch(() => null) : null;
  const enrollment = durable && state.enrollmentId ? await enrollmentsRepo.findById(db, state.enrollmentId) : null;
  const snapshot = enrollment ? await learningService.progress(db, enrollment.id) : snapshotFromSession(state);

  let progress: LearningContext["progress"] = null;
  if (course) {
    const lesson = state.lessonId ? course.lessons.find((l) => l.id === state.lessonId) : undefined;
    const concept = lesson && state.conceptId ? lesson.concepts.find((c) => c.id === state.conceptId) : undefined;
    const conceptTitle = (id: string) => {
      for (const l of course.lessons) {
        const c = l.concepts.find((x) => x.id === id);
        if (c) return c.title[language];
      }
      return null;
    };
    const entries = Object.entries(snapshot.mastery).filter(([id]) => conceptTitle(id) !== null);
    progress = {
      current_lesson: lesson ? { id: lesson.id, title: lesson.title[language], sequence: lesson.sequence, of: course.lessons.length } : null,
      current_concept: concept ? { id: concept.id, title: concept.title[language] } : null,
      completed_concepts: entries
        .filter(([, s]) => isConceptDone(s))
        .map(([id]) => conceptTitle(id) ?? id)
        .slice(0, MAX_LISTED_CONCEPTS),
      needs_practice: entries
        .filter(([, s]) => s === "needs_practice" || s === "practising")
        .map(([id]) => conceptTitle(id) ?? id)
        .slice(0, MAX_LISTED_CONCEPTS),
      lessons_completed: course.lessons.filter((l) => snapshot.completedLessonIds.has(l.id)).length,
    };
  }

  let lastSummary: string | null = null;
  let lastAt: string | null = null;
  if (durable) {
    const checkpoint = enrollment
      ? await checkpointsRepo.latestForEnrollment(db, enrollment.id)
      : await checkpointsRepo.latestForLearner(db, learner.id);
    if (checkpoint && checkpoint.sessionId !== session.id) {
      const cpCourse = checkpoint.courseId ? await courseService.getAvailable(db, checkpoint.courseId).catch(() => null) : null;
      lastSummary = renderCheckpointSummary(checkpoint, cpCourse, language);
      lastAt = checkpoint.createdAt.toISOString();
    }
  }

  const courseComplete = course !== null && course.lessons.every((l) => snapshot.completedLessonIds.has(l.id));
  const suggested = suggestNextAction({
    consentStatus: learner.consentStatus,
    hasGoal: state.goal !== null,
    hasActiveCourse: course !== null,
    courseComplete,
    hasCheckpoint: lastSummary !== null,
  });

  const preferences = { ...(durable ? await memoryService.getPreferences(db, learner) : {}), ...state.preferences };
  const evidence = enrollment && course ? learningSignals(await evidenceRepo.list(db, learner.id, enrollment.id), course, language, session.id) : [];
  if (progress) progress.needs_practice = [...new Set([...progress.needs_practice, ...evidence.filter((s) => s.status === "needs_practice").map((s) => s.title)])].slice(0, MAX_LISTED_CONCEPTS);
  const review = evidence.filter((s) => s.review_exercise_id).sort((a,b) => Number(b.review_due) - Number(a.review_due) || a.last_practised_at.localeCompare(b.last_practised_at))[0] ?? null;

  return {
    session: { id: session.id, channel: session.channel, memory_mode: session.memoryMode, phase: state.phase, learning_ready: state.learningReady },
    learner: {
      display_name: learner.displayName,
      preferred_language: language,
      consent_status: learner.consentStatus,
      supported_languages: SUPPORTED_LANGUAGES,
    },
    active_goal: state.goal?.text ?? null,
    active_course: course ? { id: course.id, title: course.title[language], lesson_count: course.lessons.length } : null,
    progress,
    last_session_summary: lastSummary,
    last_session_at: lastAt,
    learning_evidence: evidence,
    review_suggestion: review,
    preferences,
    suggested_next_action: suggested,
    guidance: GUIDANCE[suggested],
  };
}
