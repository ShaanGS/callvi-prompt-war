import { z } from "zod";
import type { LanguageCode } from "@/lib/languages";
import type { Concept, Exercise, Lesson } from "@/content/schema";
import { DomainError } from "../../errors";
import type { SessionState } from "../../domain/types";
import { attemptsRepo } from "../../repositories/sessions";
import { evidenceRepo } from "../../repositories/evidence";
import type { StoredCourse } from "../../repositories/courses";
import { learningSignals, type LearningSignal } from "../../services/learning-evidence";
import { exerciseForConcept } from "../../services/course-service";
import { recordEvent } from "../../services/events";
import { learningService, type ProgressSnapshot } from "../../services/learning-service";
import { memoryService } from "../../services/memory-service";
import { sessionService } from "../../services/session-service";
import { lessonGuidance } from "../tool-guidance";
import {
  canOpenLesson,
  canCarryForward,
  chooseExplanation,
  firstOpenConcept,
  frontierLesson,
  isConceptDone,
  isLessonComplete,
  nextLessonAfter,
} from "../learning-policy";
import { contextLanguage, defineTool, slugSchema, type ToolContext } from "../tool-types";
import { currentEnrollment, definedMastery, requireCourse, snapshotFor, title, type Enrollment } from "./shared";

/** Teaching: opening the current idea, explaining it another way, moving on, and choosing review questions. */

export const getLessonContext = defineTool({
  name: "get_lesson_context",
  kind: "session",
  description:
    "Get the content for the current learning idea. On a voice call, first obtain the caller's explicit choice to start, continue, review or practise NOW and pass learner_ready=true; a hello, memory consent or saved course is not readiness. request='different_explanation' returns another approach, 'repeat' repeats, 'move_on' carries an attempted idea forward. request='review' selects a fresh question for an idea previously practised, without teaching the answer first. Pass lesson_id only for an unlocked lesson.",
  input: z.object({
    lesson_id: slugSchema.optional(),
    concept_id: slugSchema.optional(),
    request: z.enum(["current", "different_explanation", "repeat", "move_on", "review"]).default("current"),
    learner_ready: z
      .boolean()
      .optional()
      .describe(
        "Set true only after the learner explicitly asks to start, continue, review, practise, or discuss this lesson in the current call. A greeting, memory consent, saved course or polite acknowledgement is not readiness.",
      ),
  }),
  async handler(ctx, input) {
    const voiceCall = ctx.channel === "browser" || ctx.channel === "phone";
    if (voiceCall && !ctx.session.state.learningReady && input.learner_ready !== true) {
      throw new DomainError(
        "POLICY_VIOLATION",
        "Ask what the caller needs today and wait for an explicit choice to start before opening a lesson.",
        { required_step: "ask_call_intent" },
      );
    }
    const language = contextLanguage(ctx);
    const course = await requireCourse(ctx);
    const enrollment = await currentEnrollment(ctx);
    let snapshot = await snapshotFor(ctx);
    const state = ctx.session.state;
    // Evidence is only needed to choose a review question, so it is read only then.
    const reviewTarget =
      input.request === "review" && enrollment
        ? pickReviewTarget(
            learningSignals(
              await evidenceRepo.list(ctx.db, ctx.learner.id, enrollment.id),
              course,
              language,
              ctx.session.id,
            ),
            input,
          )
        : null;
    if (input.request === "review" && !reviewTarget)
      throw new DomainError(
        "POLICY_VIOLATION",
        "There is no fresh prepared review question for earlier practice yet. Offer to continue learning or discuss the learner's question.",
      );
    const continuingReview =
      !!state.reviewReturn && (input.request === "different_explanation" || input.request === "repeat");
    const isFreshReview = !!reviewTarget || continuingReview;
    const restore = !isFreshReview ? state.reviewReturn : null;

    // Resolve the lesson, enforcing sequence.
    const requestedLessonId =
      reviewTarget?.lesson_id ??
      input.lesson_id ??
      restore?.lessonId ??
      state.lessonId ??
      frontierLesson(course, snapshot.completedLessonIds).id;
    let opened = await openRequestedLesson(ctx, {
      enrollment: isFreshReview ? null : enrollment,
      course,
      snapshot,
      lessonId: requestedLessonId,
    });
    let lesson = opened.lesson;
    const lessonChanged = lesson.id !== state.lessonId;

    let concept =
      (reviewTarget ? lesson.concepts.find((c) => c.id === reviewTarget.concept_id) : undefined) ??
      (input.concept_id ? lesson.concepts.find((c) => c.id === input.concept_id) : undefined) ??
      (restore?.conceptId ? lesson.concepts.find((c) => c.id === restore.conceptId) : undefined) ??
      (!lessonChanged && state.conceptId ? lesson.concepts.find((c) => c.id === state.conceptId) : undefined) ??
      firstOpenConcept(lesson, snapshot.mastery) ??
      lesson.concepts[0];
    if (input.concept_id && !lesson.concepts.some((c) => c.id === input.concept_id)) {
      throw new DomainError("NOT_FOUND", "That idea is not part of this lesson.");
    }

    let movedOn = false;
    const alreadyAdvanced = state.pendingExerciseId === null && state.attempts.at(-1)?.result === "correct";
    if (input.request === "move_on" && !restore && !alreadyAdvanced) {
      const carried = await carryConceptForward(ctx, { enrollment, course, lesson, conceptId: concept.id, snapshot });
      snapshot = carried.snapshot;
      if (carried.nextLesson) {
        lesson = carried.nextLesson;
        opened = { lesson, review: false };
      }
      concept = firstOpenConcept(lesson, snapshot.mastery) ?? lesson.concepts[0];
      movedOn = true;
    }

    const used = state.explanationsUsed[concept.id] ?? [];
    const prefs = { ...(await memoryService.getPreferences(ctx.db, ctx.learner)), ...state.preferences };
    const choice = chooseExplanation(
      concept,
      movedOn ? [] : used,
      input.request === "different_explanation" ? "different" : input.request === "repeat" ? "repeat" : "default",
      prefs.explanation_style,
    );
    const exercise = reviewTarget
      ? (lesson.practice.find((p) => p.id === reviewTarget.review_exercise_id) ?? null)
      : continuingReview
        ? (lesson.practice.find((p) => p.id === state.pendingExerciseId) ?? null)
        : exerciseForConcept(lesson, concept.id);
    const reviewing = isFreshReview || opened.review;
    const helpRequested = input.request === "different_explanation" || input.request === "repeat";

    ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) =>
      stateAfterOpening(s, {
        learnerReady: input.learner_ready === true,
        lesson,
        concept,
        exercise,
        approach: choice.approach,
        reviewing,
        freshReview: isFreshReview,
        helpRequested,
        sessionOnlySnapshot: enrollment ? null : snapshot,
      }),
    );
    if (enrollment) {
      await learningService.markIntroduced(ctx.db, {
        learner: ctx.learner,
        enrollment,
        lessonId: lesson.id,
        conceptId: concept.id,
        snapshot,
        sessionId: ctx.session.id,
      });
    }
    if (lessonChanged) {
      await recordEvent(ctx.db, "lesson.started", {
        learnerId: ctx.learner.id,
        sessionId: ctx.session.id,
        metadata: { lesson: lesson.id },
      });
    }

    const guidance = lessonGuidance({
      request: input.request,
      explanationsExhausted: choice.exhausted,
      freshReview: isFreshReview,
      helpRequested,
      lessonAlreadyComplete: opened.review,
    });

    return {
      data: lessonContextData({
        language,
        course,
        lesson,
        concept,
        choice,
        exercise,
        snapshot,
        reviewing,
        showTeaching: !isFreshReview || helpRequested,
        freshReview: isFreshReview,
        movedOn,
      }),
      guidance,
    };
  },
});

/** Where the session stands once an idea is opened: what is being taught, which approach was used, what is asked. */
function stateAfterOpening(
  s: SessionState,
  a: {
    learnerReady: boolean;
    lesson: Lesson;
    concept: Concept;
    exercise: Exercise | null;
    approach: ReturnType<typeof chooseExplanation>["approach"];
    reviewing: boolean;
    freshReview: boolean;
    helpRequested: boolean;
    sessionOnlySnapshot: ProgressSnapshot | null;
  },
): SessionState {
  const { concept, exercise } = a;
  const prior = s.explanationsUsed[concept.id] ?? [];
  return {
    ...s,
    learningReady: s.learningReady || a.learnerReady,
    lessonId: a.lesson.id,
    conceptId: concept.id,
    pendingExerciseId: exercise?.id ?? null,
    reviewReturn: a.reviewing ? (s.reviewReturn ?? { lessonId: s.lessonId, conceptId: s.conceptId }) : null,
    practiceSupport:
      exercise && a.helpRequested && !s.practiceSupport[exercise.id]
        ? { ...s.practiceSupport, [exercise.id]: "explanation_provided" }
        : s.practiceSupport,
    explanationsUsed:
      a.freshReview && !a.helpRequested
        ? s.explanationsUsed
        : { ...s.explanationsUsed, [concept.id]: prior.includes(a.approach) ? prior : [...prior, a.approach] },
    conceptsCovered: s.conceptsCovered.includes(concept.id) ? s.conceptsCovered : [...s.conceptsCovered, concept.id],
    sessionMastery: a.sessionOnlySnapshot
      ? {
          ...definedMastery(a.sessionOnlySnapshot.mastery),
          [concept.id]: a.sessionOnlySnapshot.mastery[concept.id] ?? "introduced",
        }
      : s.sessionMastery,
    sessionCompletedLessons: a.sessionOnlySnapshot
      ? Array.from(a.sessionOnlySnapshot.completedLessonIds)
      : s.sessionCompletedLessons,
  };
}

type OpenedLesson = { lesson: Lesson; review: boolean };

/**
 * Open a lesson, enforcing sequence. With an enrollment the service records
 * the opening; without one (no consent, or a fresh review) access is only checked.
 */
async function openRequestedLesson(
  ctx: ToolContext,
  a: { enrollment: Enrollment | null; course: StoredCourse; snapshot: ProgressSnapshot; lessonId: string },
): Promise<OpenedLesson> {
  if (a.enrollment) {
    return learningService.openLesson(ctx.db, {
      learner: ctx.learner,
      enrollment: a.enrollment,
      course: a.course,
      snapshot: a.snapshot,
      lessonId: a.lessonId,
    });
  }
  const access = canOpenLesson(a.course, a.snapshot.completedLessonIds, a.lessonId);
  if (!access.allowed) {
    throw new DomainError("POLICY_VIOLATION", "That lesson opens after the earlier lessons are complete.", {
      reason: access.reason,
      next_allowed_lesson_id: access.nextAllowedLesson.id,
    });
  }
  return { lesson: access.lesson, review: access.review };
}

/**
 * Carry an attempted idea forward at the learner's request. Refused until the
 * idea's practice question has been tried once. Returns the updated progress
 * and the next lesson if that finished this one.
 */
async function carryConceptForward(
  ctx: ToolContext,
  a: {
    enrollment: Enrollment | null;
    course: StoredCourse;
    lesson: Lesson;
    conceptId: string;
    snapshot: ProgressSnapshot;
  },
): Promise<{ snapshot: ProgressSnapshot; nextLesson: Lesson | null }> {
  const attempts = a.enrollment
    ? await attemptsRepo.countForConcept(ctx.db, a.enrollment.id, a.conceptId)
    : ctx.session.state.attempts.filter((t) => t.conceptId === a.conceptId).length;
  if (!canCarryForward(attempts, a.snapshot.mastery[a.conceptId])) {
    throw new DomainError("POLICY_VIOLATION", "Try the practice question for this idea once before moving on.", {
      required_step: "record_practice_attempt",
    });
  }
  if (a.enrollment) {
    const progression = await learningService.carryForward(ctx.db, {
      learner: ctx.learner,
      session: ctx.session,
      enrollment: a.enrollment,
      course: a.course,
      lesson: a.lesson,
      conceptId: a.conceptId,
    });
    return {
      snapshot: await learningService.progress(ctx.db, a.enrollment.id),
      nextLesson: progression.nextLesson ?? null,
    };
  }
  // Session-only: update the in-memory snapshot, write nothing.
  const snapshot = a.snapshot;
  snapshot.mastery[a.conceptId] = "carried_forward";
  if (!isLessonComplete(a.lesson, snapshot.mastery)) return { snapshot, nextLesson: null };
  snapshot.completedLessonIds.add(a.lesson.id);
  return { snapshot, nextLesson: nextLessonAfter(a.course, a.lesson.id) ?? null };
}

/** What get_lesson_context returns to the agent: the idea to teach, the question to ask, and where it sits. */
function lessonContextData(a: {
  language: LanguageCode;
  course: StoredCourse;
  lesson: Lesson;
  concept: Concept;
  choice: ReturnType<typeof chooseExplanation>;
  exercise: Exercise | null;
  snapshot: ProgressSnapshot;
  reviewing: boolean;
  /** False for a fresh review question, which must be asked without teaching the answer first. */
  showTeaching: boolean;
  freshReview: boolean;
  movedOn: boolean;
}) {
  const { language, lesson, concept, choice, exercise, snapshot } = a;
  return {
    lesson: {
      id: lesson.id,
      title: title(lesson.title, language),
      objective: title(lesson.objective, language),
      sequence: lesson.sequence,
      of: a.course.lessons.length,
      is_review: a.reviewing,
      review_notes: lesson.reviewFlags.map((f) => title(f, language)),
      real_world_action: title(lesson.realWorldAction, language),
    },
    concept: {
      id: concept.id,
      title: title(concept.title, language),
      explanation: a.showTeaching ? title(choice.text, language) : null,
      key_points: a.showTeaching ? concept.keyPoints.map((k) => title(k, language)) : [],
      check_question: a.freshReview ? null : title(concept.checkQuestion, language),
    },
    explanation_status: {
      approach: choice.approach,
      alternatives_remaining: choice.remaining,
      all_used: choice.exhausted,
    },
    practice: exercise
      ? { exercise_id: exercise.id, prompt: title(exercise.prompt, language), kind: exercise.kind }
      : null,
    lesson_concepts: lesson.concepts.map((c) => ({
      id: c.id,
      title: title(c.title, language),
      status: isConceptDone(snapshot.mastery[c.id]) ? "done" : (snapshot.mastery[c.id] ?? "not_started"),
    })),
    moved_on: a.movedOn,
  };
}

/** The most useful prepared review question: overdue first, then least recently practised. */
function pickReviewTarget(signals: LearningSignal[], filter: { concept_id?: string; lesson_id?: string }) {
  return (
    signals
      .filter(
        (s) =>
          s.review_exercise_id &&
          (!filter.concept_id || filter.concept_id === s.concept_id) &&
          (!filter.lesson_id || filter.lesson_id === s.lesson_id),
      )
      .sort(
        (a, b) => Number(b.review_due) - Number(a.review_due) || a.last_practised_at.localeCompare(b.last_practised_at),
      )[0] ?? null
  );
}
