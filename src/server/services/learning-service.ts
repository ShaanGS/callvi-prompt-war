import type { Exercise, Lesson } from "@/content/schema";
import type { Db, Queryable } from "../db/types";
import { DomainError } from "../errors";
import {
  memoryModeFor,
  type ConceptMastery,
  type Enrollment,
  type Goal,
  type Learner,
  type LearningSession,
  type MasteryState,
  type PracticeAttempt,
  type SessionState,
} from "../domain/types";
import {
  canOpenLesson,
  frontierLesson,
  isLessonComplete,
  masteryAfterAttempt,
  nextLessonAfter,
  orderedLessons,
  type MasteryMap,
} from "../agent/learning-policy";
import { enrollmentsRepo, goalsRepo, progressRepo } from "../repositories/learning";
import { attemptsRepo } from "../repositories/sessions";
import type { StoredCourse } from "../repositories/courses";
import type { AssessmentOutcome } from "@/lib/assessment/assessment-service";
import { recordEvent } from "./events";
import { evidenceRepo } from "../repositories/evidence";

/**
 * Goals, enrolment and progression. Every durable write here is gated on the
 * learner's consent; callers receive `saved: false` in session-only mode and
 * keep the information in session state instead.
 */

export interface ProgressSnapshot {
  completedLessonIds: Set<string>;
  mastery: MasteryMap;
  masteryRows: ConceptMastery[];
}

export function snapshotFromSession(state: SessionState): ProgressSnapshot {
  return {
    completedLessonIds: new Set(state.sessionCompletedLessons),
    mastery: { ...state.sessionMastery },
    masteryRows: [],
  };
}

export const learningService = {
  async confirmGoal(
    db: Db,
    input: {
      learner: Learner;
      goalText: string;
      source: Goal["source"];
      sourceSessionId: string | null;
      idempotencyKey: string | null;
    },
  ): Promise<{ goal: { id: string | null; text: string }; saved: boolean }> {
    const text = input.goalText.trim().replace(/\s+/g, " ");
    if (text.length < 3 || text.length > 500)
      throw new DomainError("VALIDATION", "A goal should be between 3 and 500 characters.");
    if (memoryModeFor(input.learner) !== "durable") return { goal: { id: null, text }, saved: false };

    if (input.idempotencyKey) {
      const existing = await goalsRepo.findByIdempotencyKey(db, input.idempotencyKey);
      if (existing) return { goal: { id: existing.id, text: existing.goalText }, saved: true };
    }
    const goal = await db.transaction((tx) =>
      goalsRepo.replaceActive(tx, {
        learnerId: input.learner.id,
        goalText: text,
        source: input.source,
        sourceSessionId: input.sourceSessionId,
        idempotencyKey: input.idempotencyKey,
      }),
    );
    await recordEvent(db, "goal.confirmed", {
      learnerId: input.learner.id,
      sessionId: input.sourceSessionId,
      metadata: { source: input.source },
    });
    return { goal: { id: goal.id, text: goal.goalText }, saved: true };
  },

  async startOrResumeCourse(
    db: Db,
    input: { learner: Learner; course: StoredCourse; sessionId: string | null; idempotencyKey: string | null },
  ): Promise<{ enrollment: Enrollment | null; resumed: boolean; saved: boolean; currentLesson: Lesson }> {
    const first = orderedLessons(input.course)[0];
    if (memoryModeFor(input.learner) !== "durable") {
      return { enrollment: null, resumed: false, saved: false, currentLesson: first };
    }
    const open = await enrollmentsRepo.findOpen(db, input.learner.id, input.course.id);
    if (open) {
      const touched = await enrollmentsRepo.touch(db, open.id, { status: "active" });
      const lesson = input.course.lessons.find((l) => l.id === touched.currentLessonId) ?? first;
      return { enrollment: touched, resumed: true, saved: true, currentLesson: lesson };
    }
    const goal = await goalsRepo.findActive(db, input.learner.id);
    let enrollment: Enrollment;
    try {
      enrollment = await db.transaction(async (tx) => {
        const created = await enrollmentsRepo.create(tx, {
          learnerId: input.learner.id,
          courseId: input.course.id,
          goalId: goal?.id ?? null,
          currentLessonId: first.id,
          idempotencyKey: input.idempotencyKey,
        });
        await progressRepo.setLessonStatus(tx, {
          enrollmentId: created.id,
          learnerId: input.learner.id,
          lessonId: first.id,
          status: "in_progress",
        });
        return created;
      });
    } catch (e) {
      // Concurrent enrolment (unique open enrolment per course): resume the winner.
      const raced = await enrollmentsRepo.findOpen(db, input.learner.id, input.course.id);
      if (!raced) throw e;
      const lesson = input.course.lessons.find((l) => l.id === raced.currentLessonId) ?? first;
      return { enrollment: raced, resumed: true, saved: true, currentLesson: lesson };
    }
    await recordEvent(db, "course.selected", {
      learnerId: input.learner.id,
      sessionId: input.sessionId,
      metadata: { course: input.course.id },
    });
    return { enrollment, resumed: false, saved: true, currentLesson: first };
  },

  async progress(db: Queryable, enrollmentId: string): Promise<ProgressSnapshot> {
    const [lessons, masteryRows] = await Promise.all([
      progressRepo.listLessonProgress(db, enrollmentId),
      progressRepo.listMastery(db, enrollmentId),
    ]);
    const mastery: MasteryMap = {};
    for (const m of masteryRows) mastery[m.conceptId] = m.state;
    return {
      completedLessonIds: new Set(lessons.filter((l) => l.status === "completed").map((l) => l.lessonId)),
      mastery,
      masteryRows,
    };
  },

  /** Open a lesson for teaching, enforcing course sequence. */
  async openLesson(
    db: Queryable,
    input: {
      learner: Learner;
      enrollment: Enrollment | null;
      course: StoredCourse;
      snapshot: ProgressSnapshot;
      lessonId: string;
    },
  ): Promise<{ lesson: Lesson; review: boolean }> {
    const access = canOpenLesson(input.course, input.snapshot.completedLessonIds, input.lessonId);
    if (!access.allowed) {
      throw new DomainError(
        "POLICY_VIOLATION",
        access.reason === "locked"
          ? "That lesson opens after the earlier lessons are complete."
          : "That lesson is not part of this course.",
        { reason: access.reason, next_allowed_lesson_id: access.nextAllowedLesson.id },
      );
    }
    if (input.enrollment && !access.review) {
      await progressRepo.setLessonStatus(db, {
        enrollmentId: input.enrollment.id,
        learnerId: input.learner.id,
        lessonId: access.lesson.id,
        status: "in_progress",
      });
      if (input.enrollment.currentLessonId !== access.lesson.id) {
        await enrollmentsRepo.touch(db, input.enrollment.id, { currentLessonId: access.lesson.id });
      }
    }
    return { lesson: access.lesson, review: access.review };
  },

  async markIntroduced(
    db: Queryable,
    input: {
      learner: Learner;
      enrollment: Enrollment | null;
      lessonId: string;
      conceptId: string;
      snapshot: ProgressSnapshot;
      sessionId: string;
    },
  ): Promise<void> {
    if (!input.enrollment || input.snapshot.mastery[input.conceptId]) return;
    await progressRepo.upsertMastery(db, {
      learnerId: input.learner.id,
      enrollmentId: input.enrollment.id,
      lessonId: input.lessonId,
      conceptId: input.conceptId,
      state: "introduced",
      lastResult: null,
      incrementAttempts: false,
      sourceSessionId: input.sessionId,
    });
  },

  /**
   * Persist an assessed attempt and update mastery and progression. Idempotent
   * on the idempotency key: a retried call returns the original attempt and
   * does not count twice.
   */
  async recordAttempt(
    db: Db,
    input: {
      learner: Learner;
      session: LearningSession;
      enrollment: Enrollment;
      course: StoredCourse;
      lesson: Lesson;
      exercise: Exercise;
      answerText: string;
      outcome: AssessmentOutcome;
      idempotencyKey: string;
    },
  ): Promise<{
    attempt: PracticeAttempt;
    created: boolean;
    masteryState: MasteryState;
    attemptsOnConcept: number;
    lessonComplete: boolean;
    courseComplete: boolean;
    nextLesson: Lesson | null;
  }> {
    const result = await db.transaction(async (tx) => {
      const { attempt, created } = await attemptsRepo.insert(tx, {
        learnerId: input.learner.id,
        enrollmentId: input.enrollment.id,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        conceptId: input.exercise.conceptId,
        exerciseId: input.exercise.id,
        answerText: input.answerText,
        score: input.outcome.score,
        result: input.outcome.result,
        feedback: input.outcome.feedback,
        idempotencyKey: input.idempotencyKey,
        rubricVersion: input.outcome.rubricVersion,
      });
      const before = await learningService.progress(tx, input.enrollment.id);
      let masteryState = before.mastery[input.exercise.conceptId] ?? "introduced";
      if (created) {
        await evidenceRepo.insert(tx, {
          attempt_id: attempt.id,
          learner_id: input.learner.id,
          enrollment_id: input.enrollment.id,
          session_id: input.session.id,
          lesson_id: input.lesson.id,
          concept_id: input.exercise.conceptId,
          exercise_id: input.exercise.id,
          purpose: input.exercise.purpose,
          result: input.outcome.result,
          support: input.session.state.practiceSupport[input.exercise.id] ?? "none_recorded",
          approach:
            input.exercise.purpose === "review" && !input.session.state.practiceSupport[input.exercise.id]
              ? null
              : (input.session.state.explanationsUsed[input.exercise.conceptId]?.at(-1) ?? null),
          met_criteria: input.outcome.metCriteria,
          missed_criteria: input.outcome.missedCriteria,
          rubric_version: input.outcome.rubricVersion,
        });
        masteryState = masteryAfterAttempt(before.mastery[input.exercise.conceptId], input.outcome.result);
        await progressRepo.upsertMastery(tx, {
          learnerId: input.learner.id,
          enrollmentId: input.enrollment.id,
          lessonId: input.lesson.id,
          conceptId: input.exercise.conceptId,
          state: masteryState,
          lastResult: input.outcome.result,
          incrementAttempts: true,
          sourceSessionId: input.session.id,
        });
      }
      const after = await learningService.progress(tx, input.enrollment.id);
      const progression =
        input.exercise.purpose === "review" || before.completedLessonIds.has(input.lesson.id)
          ? {
              lessonComplete: after.completedLessonIds.has(input.lesson.id),
              courseComplete: input.course.lessons.every((l) => after.completedLessonIds.has(l.id)),
              nextLesson: null,
            }
          : await applyProgression(tx, {
              learner: input.learner,
              enrollment: input.enrollment,
              course: input.course,
              lesson: input.lesson,
              snapshot: after,
            });
      const attemptsOnConcept = await attemptsRepo.countForConcept(tx, input.enrollment.id, input.exercise.conceptId);
      return { attempt, created, masteryState, attemptsOnConcept, ...progression };
    });
    if (result.created) {
      await recordEvent(db, "practice.submitted", {
        learnerId: input.learner.id,
        sessionId: input.session.id,
        channel: input.session.channel,
        metadata: { exercise: input.exercise.id, result: input.outcome.result },
      });
      if (result.lessonComplete && input.exercise.purpose !== "review") {
        await recordEvent(db, "lesson.completed", {
          learnerId: input.learner.id,
          sessionId: input.session.id,
          metadata: { lesson: input.lesson.id },
        });
      }
    }
    return result;
  },

  /** Learner chose to move on from a concept they have practised but not mastered. */
  async carryForward(
    db: Db,
    input: {
      learner: Learner;
      session: LearningSession;
      enrollment: Enrollment;
      course: StoredCourse;
      lesson: Lesson;
      conceptId: string;
    },
  ): Promise<{ lessonComplete: boolean; courseComplete: boolean; nextLesson: Lesson | null }> {
    return db.transaction(async (tx) => {
      await progressRepo.upsertMastery(tx, {
        learnerId: input.learner.id,
        enrollmentId: input.enrollment.id,
        lessonId: input.lesson.id,
        conceptId: input.conceptId,
        state: "carried_forward",
        lastResult: null,
        incrementAttempts: false,
        sourceSessionId: input.session.id,
      });
      const snapshot = await learningService.progress(tx, input.enrollment.id);
      return applyProgression(tx, {
        learner: input.learner,
        enrollment: input.enrollment,
        course: input.course,
        lesson: input.lesson,
        snapshot,
      });
    });
  },
};

async function applyProgression(
  db: Queryable,
  input: { learner: Learner; enrollment: Enrollment; course: StoredCourse; lesson: Lesson; snapshot: ProgressSnapshot },
): Promise<{ lessonComplete: boolean; courseComplete: boolean; nextLesson: Lesson | null }> {
  const lessonComplete = isLessonComplete(input.lesson, input.snapshot.mastery);
  if (!lessonComplete) return { lessonComplete: false, courseComplete: false, nextLesson: null };

  await progressRepo.setLessonStatus(db, {
    enrollmentId: input.enrollment.id,
    learnerId: input.learner.id,
    lessonId: input.lesson.id,
    status: "completed",
  });
  const completed = new Set(input.snapshot.completedLessonIds).add(input.lesson.id);
  const courseComplete = input.course.lessons.every((l) => completed.has(l.id));
  const nextLesson = courseComplete
    ? null
    : (nextLessonAfter(input.course, input.lesson.id) ?? frontierLesson(input.course, completed));
  await enrollmentsRepo.touch(db, input.enrollment.id, {
    status: courseComplete ? "completed" : "active",
    currentLessonId: nextLesson?.id ?? input.lesson.id,
  });
  if (nextLesson) {
    await progressRepo.setLessonStatus(db, {
      enrollmentId: input.enrollment.id,
      learnerId: input.learner.id,
      lessonId: nextLesson.id,
      status: "in_progress",
    });
  }
  return { lessonComplete: true, courseComplete, nextLesson };
}
