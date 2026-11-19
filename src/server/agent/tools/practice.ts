import { z } from "zod";
import type { Concept, Exercise, Lesson } from "@/content/schema";
import { DomainError } from "../../errors";
import type { MasteryState, PracticeResult, SessionState } from "../../domain/types";
import { attemptsRepo } from "../../repositories/sessions";
import type { StoredCourse } from "../../repositories/courses";
import { assessAnswer, type AssessmentOutcome } from "@/lib/assessment/assessment-service";
import { findExercise } from "../../services/course-service";
import { recordEvent } from "../../services/events";
import { learningService, type ProgressSnapshot } from "../../services/learning-service";
import { sessionService } from "../../services/session-service";
import { practiceGuidance } from "../tool-guidance";
import {
  canOpenLesson,
  isLessonComplete,
  masteryAfterAttempt,
  nextConceptAfter,
  nextLessonAfter,
  nextStepAfterAttempt,
} from "../learning-policy";
import { contextLanguage, defineTool, slugSchema } from "../tool-types";
import { currentEnrollment, definedMastery, requireCourse, snapshotFor, title } from "./shared";

/** Assessing practice: grading an answer with the rubric (never the model) and advancing the learner. */

/**
 * Progress for a learner who has not consented to memory: computed in the
 * session snapshot only (which is updated in place), never written down.
 */
function applySessionOnlyAttempt(
  snapshot: ProgressSnapshot,
  course: StoredCourse,
  lesson: Lesson,
  conceptId: string,
  result: PracticeResult,
) {
  const mastery = { ...snapshot.mastery };
  const masteryState = masteryAfterAttempt(mastery[conceptId], result);
  mastery[conceptId] = masteryState;
  const lessonComplete = isLessonComplete(lesson, mastery);
  const completed = new Set(snapshot.completedLessonIds);
  if (lessonComplete) completed.add(lesson.id);
  const courseComplete = course.lessons.every((l) => completed.has(l.id));
  const nextLesson = lessonComplete && !courseComplete ? nextLessonAfter(course, lesson.id) : null;
  snapshot.mastery = mastery;
  snapshot.completedLessonIds = completed;
  return { masteryState, lessonComplete, courseComplete, nextLesson };
}

/** Where the session stands after an attempt: what was tried, what support was given, and what is open next. */
function stateAfterAttempt(
  s: SessionState,
  a: {
    created: boolean;
    lesson: Lesson;
    exercise: Exercise;
    outcome: AssessmentOutcome;
    reviewing: boolean;
    nextLesson: Lesson | null;
    nextConcept: Concept | null;
    sessionOnlySnapshot: ProgressSnapshot | null;
  },
): SessionState {
  const { exercise, outcome } = a;
  const attempts = a.created
    ? [
        ...s.attempts,
        {
          exerciseId: exercise.id,
          conceptId: exercise.conceptId,
          lessonId: a.lesson.id,
          result: outcome.result,
          at: new Date().toISOString(),
        },
      ].slice(-50)
    : s.attempts;
  const next = { ...s, attempts };
  if (outcome.result !== "correct") {
    next.practiceSupport = {
      ...s.practiceSupport,
      [exercise.id]: outcome.modelAnswer
        ? "example_provided"
        : outcome.hint
          ? "hint_provided"
          : (s.practiceSupport[exercise.id] ?? "none_recorded"),
    };
  }
  if (a.sessionOnlySnapshot) {
    next.sessionMastery = definedMastery(a.sessionOnlySnapshot.mastery);
    next.sessionCompletedLessons = Array.from(a.sessionOnlySnapshot.completedLessonIds);
  }
  if (outcome.result === "correct") {
    next.pendingExerciseId = null;
    if (a.reviewing && s.reviewReturn) {
      next.lessonId = s.reviewReturn.lessonId;
      next.conceptId = s.reviewReturn.conceptId;
      next.reviewReturn = null;
    } else if (a.nextLesson) {
      next.lessonId = a.nextLesson.id;
      next.conceptId = a.nextLesson.concepts[0]?.id ?? null;
    } else if (a.nextConcept) {
      next.conceptId = a.nextConcept.id;
    }
  } else {
    next.pendingExerciseId = exercise.id;
  }
  return next;
}

export const recordPracticeAttempt = defineTool({
  name: "record_practice_attempt",
  kind: "write",
  description:
    "Assess the learner's answer to a practice question against the lesson's rubric and record it. Pass the learner's answer as they said it. The result (correct, partial, needs_practice, ungraded) and feedback come from the rubric; share them honestly and kindly, never change the result.",
  input: z.object({ exercise_id: slugSchema, answer_text: z.string().trim().min(1).max(1000) }),
  async handler(ctx, input) {
    const language = contextLanguage(ctx);
    const course = await requireCourse(ctx);
    const { lesson, exercise } = findExercise(course, input.exercise_id);
    const snapshotBefore = await snapshotFor(ctx);
    const access = canOpenLesson(course, snapshotBefore.completedLessonIds, lesson.id);
    if (!access.allowed)
      throw new DomainError("POLICY_VIOLATION", "That practice question belongs to a lesson that is not open yet.");

    if (
      (ctx.channel === "browser" || ctx.channel === "phone") &&
      (!ctx.session.state.learningReady || ctx.session.state.pendingExerciseId !== exercise.id)
    ) {
      throw new DomainError(
        "POLICY_VIOLATION",
        "Open and ask the selected practice question after the learner chooses to learn before assessing an answer.",
        { required_step: "get_lesson_context" },
      );
    }
    const reviewing = exercise.purpose === "review" || !!ctx.session.state.reviewReturn || access.review;
    const support = ctx.session.state.practiceSupport[exercise.id] ?? "none_recorded";
    const enrollment = await currentEnrollment(ctx);
    const previousAttempts = enrollment
      ? await attemptsRepo.countForExercise(ctx.db, enrollment.id, exercise.id)
      : ctx.session.state.attempts.filter((a) => a.exerciseId === exercise.id).length;
    const outcome = assessAnswer({
      exercise,
      answerText: input.answer_text,
      language,
      attemptNumber: previousAttempts + 1,
    });

    let masteryState: MasteryState;
    let lessonComplete: boolean;
    let courseComplete: boolean;
    let nextLesson: Lesson | null = null;
    let saved = false;
    let created = true;

    if (enrollment) {
      const r = await learningService.recordAttempt(ctx.db, {
        learner: ctx.learner,
        session: ctx.session,
        enrollment,
        course,
        lesson,
        exercise,
        answerText: input.answer_text,
        outcome,
        idempotencyKey: ctx.idempotencyKey,
      });
      ({ masteryState, lessonComplete, courseComplete, nextLesson, created } = r);
      saved = true;
    } else {
      ({ masteryState, lessonComplete, courseComplete, nextLesson } = applySessionOnlyAttempt(
        snapshotBefore,
        course,
        lesson,
        exercise.conceptId,
        outcome.result,
      ));
    }

    const nextStep =
      reviewing && outcome.result === "correct"
        ? "review_complete"
        : nextStepAfterAttempt({
            result: outcome.result,
            attemptsOnConcept: previousAttempts + 1,
            lessonComplete: !reviewing && lessonComplete,
            courseComplete: !reviewing && courseComplete,
          });
    const masteryNow = enrollment
      ? (await learningService.progress(ctx.db, enrollment.id)).mastery
      : snapshotBefore.mastery;
    const nextConcept =
      outcome.result === "correct" && !reviewing && !lessonComplete
        ? nextConceptAfter(lesson, exercise.conceptId, masteryNow)
        : null;

    ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) =>
      stateAfterAttempt(s, {
        created,
        lesson,
        exercise,
        outcome,
        reviewing,
        nextLesson,
        nextConcept,
        sessionOnlySnapshot: enrollment ? null : snapshotBefore,
      }),
    );
    await recordEvent(ctx.db, "practice.feedback_given", {
      learnerId: ctx.learner.id,
      sessionId: ctx.session.id,
      channel: ctx.channel,
      metadata: { result: outcome.result, saved },
    });

    const describe = (ids: string[]) =>
      ids
        .map((id) => exercise.rubric.criteria.find((c) => c.id === id)?.description[language])
        .filter((d): d is string => !!d);

    return {
      saved,
      data: {
        result: outcome.result,
        score: outcome.score,
        feedback: outcome.feedback,
        met: describe(outcome.metCriteria),
        missing: describe(outcome.missedCriteria),
        hint: outcome.hint,
        model_answer: outcome.modelAnswer,
        clarification: outcome.clarification,
        evidence: {
          support,
          purpose: exercise.purpose,
          claim: "Practice observed; this result alone does not establish retained learning.",
        },
        mastery: masteryState,
        next_step: nextStep,
        next_concept: nextConcept ? { id: nextConcept.id, title: title(nextConcept.title, language) } : null,
        lesson_complete: !reviewing && lessonComplete,
        next_lesson: nextLesson ? { id: nextLesson.id, title: title(nextLesson.title, language) } : null,
        course_complete: !reviewing && courseComplete,
        real_world_action: !reviewing && lessonComplete ? title(lesson.realWorldAction, language) : null,
      },
      guidance: practiceGuidance(outcome, nextStep, saved),
    };
  },
});
