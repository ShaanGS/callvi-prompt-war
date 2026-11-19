import type { Db, Queryable } from "../db/types";
import { DomainError } from "../errors";
import {
  emptySessionState,
  isSessionOpen,
  memoryModeFor,
  type Channel,
  type Checkpoint,
  type CheckpointData,
  type Learner,
  type LearningSession,
  type SessionState,
} from "../domain/types";
import { firstOpenConcept, frontierLesson, isConceptDone, isLessonComplete, phaseFor } from "../agent/learning-policy";
import { checkpointsRepo, sessionsRepo } from "../repositories/sessions";
import { enrollmentsRepo, goalsRepo } from "../repositories/learning";
import type { StoredCourse } from "../repositories/courses";
import { courseService } from "./course-service";
import { learningService, snapshotFromSession } from "./learning-service";
import { recordEvent } from "./events";
import { renderCheckpointSummary, type NextAction } from "./summaries";

/**
 * SessionService — starts, resumes, pauses and closes learning sessions and
 * saves idempotent checkpoints. Session state (context layer 2) lives on the
 * session row and is written with optimistic concurrency.
 */

/** Sessions with no activity for this long are closed as interrupted. */
export const STALE_SESSION_MINUTES = 120;

export const sessionService = {
  async start(
    db: Db,
    input: {
      learner: Learner;
      channel: Channel;
      provider: LearningSession["provider"];
      courseId?: string | null;
      providerInteractionId?: string | null;
    },
  ): Promise<LearningSession> {
    await sessionService.closeStale(db, input.learner);
    const state = await initialState(db, input.learner, input.courseId ?? null);
    const session = await sessionsRepo.create(db, {
      learnerId: input.learner.id,
      enrollmentId: state.enrollmentId,
      channel: input.channel,
      provider: input.provider,
      providerInteractionId: input.providerInteractionId ?? null,
      memoryMode: memoryModeFor(input.learner),
      language: input.learner.preferredLanguage,
      state,
    });
    await recordEvent(db, "session.started", {
      learnerId: input.learner.id,
      sessionId: session.id,
      channel: input.channel,
      metadata: { memory_mode: session.memoryMode, resumed: state.lessonId !== null },
    });
    return session;
  },

  async getOwned(db: Queryable, sessionId: string, learnerId: string): Promise<LearningSession> {
    const session = await sessionsRepo.findById(db, sessionId);
    // Same error for "missing" and "someone else's" so ids can't be probed.
    if (!session || session.learnerId !== learnerId) throw new DomainError("NOT_FOUND", "Session not found.");
    return session;
  },

  requireOpen(session: LearningSession): void {
    if (!isSessionOpen(session))
      throw new DomainError("SESSION_CLOSED", "This learning session has ended. Start a new one to continue.");
  },

  /**
   * Apply a state change with optimistic concurrency. Reloads and retries once
   * if another tool call changed the state in between.
   */
  async mutateState(
    db: Queryable,
    session: LearningSession,
    mutate: (state: SessionState) => SessionState,
    extra: { enrollmentId?: string | null } = {},
  ): Promise<LearningSession> {
    let current = session;
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = mutate(structuredClone(current.state));
      next.phase = next.phase === "closed" ? "closed" : phaseFor(next);
      const written = await sessionsRepo.writeState(db, current.id, current.stateVersion, { state: next, ...extra });
      if (written) return written;
      const reloaded = await sessionsRepo.findById(db, current.id);
      if (!reloaded) throw new DomainError("NOT_FOUND", "Session not found.");
      sessionService.requireOpen(reloaded);
      current = reloaded;
    }
    throw new DomainError("CONFLICT", "The session changed while saving. Please try again.");
  },

  async attachInteraction(db: Queryable, session: LearningSession, interactionId: string): Promise<void> {
    if (session.providerInteractionId === interactionId) return;
    if (session.providerInteractionId && session.providerInteractionId !== interactionId) {
      throw new DomainError("CONFLICT", "This session is already linked to a different call.");
    }
    await sessionsRepo.attachInteraction(db, session.id, interactionId);
  },

  /** Build the structured checkpoint from session state (never from model text). */
  async buildCheckpoint(
    db: Queryable,
    session: LearningSession,
    unresolvedDifficulty: string | null,
  ): Promise<{
    data: CheckpointData;
    course: StoredCourse | null;
  }> {
    const state = session.state;
    const course = state.courseId ? await courseService.getAvailable(db, state.courseId).catch(() => null) : null;
    const lesson = course && state.lessonId ? course.lessons.find((l) => l.id === state.lessonId) : undefined;

    let nextAction: NextAction;
    if (!state.goal && !state.courseId) nextAction = "set_goal";
    else if (!state.courseId) nextAction = "choose_course";
    else if (!lesson) nextAction = "start_lesson";
    else {
      const snapshot =
        session.memoryMode === "durable" && state.enrollmentId
          ? await learningService.progress(db, state.enrollmentId)
          : snapshotFromSession(state);
      const lastForConcept = [...state.attempts].reverse().find((a) => a.conceptId === state.conceptId);
      if (course && course.lessons.every((l) => snapshot.completedLessonIds.has(l.id))) nextAction = "review_course";
      else if (isLessonComplete(lesson, snapshot.mastery)) nextAction = "start_next_lesson";
      else if (lastForConcept && lastForConcept.result !== "correct") nextAction = "practise_again";
      else nextAction = "continue_lesson";
    }

    return {
      course,
      data: {
        goalText: state.goal?.text ?? null,
        courseId: state.courseId,
        lessonId: state.lessonId,
        conceptId: state.conceptId,
        completedPractice: state.attempts.map((a) => ({ exerciseId: a.exerciseId, result: a.result })),
        unresolvedDifficulty: unresolvedDifficulty ?? state.learnerNotedDifficulty,
        nextAction,
      },
    };
  },

  /**
   * Save a checkpoint. Persisted only when the learner has granted durable
   * memory; otherwise `saved: false` and nothing is written.
   */
  async saveCheckpoint(
    db: Db,
    input: { session: LearningSession; learner: Learner; idempotencyKey: string; unresolvedDifficulty: string | null },
  ): Promise<{
    saved: boolean;
    checkpoint: Checkpoint | null;
    data: CheckpointData;
    summary: string;
    replayed: boolean;
  }> {
    const { data, course } = await sessionService.buildCheckpoint(db, input.session, input.unresolvedDifficulty);
    const summaryEn = renderCheckpointSummary(data, course, "en-IN");
    const summaryLearner = renderCheckpointSummary(data, course, input.learner.preferredLanguage);
    if (input.session.memoryMode !== "durable" || memoryModeFor(input.learner) !== "durable") {
      return { saved: false, checkpoint: null, data, summary: summaryLearner, replayed: false };
    }
    const { checkpoint, created } = await checkpointsRepo.insert(db, {
      learnerId: input.learner.id,
      enrollmentId: input.session.state.enrollmentId,
      sessionId: input.session.id,
      idempotencyKey: input.idempotencyKey,
      data,
      summary: summaryEn,
    });
    if (created) {
      await sessionService.mutateState(db, input.session, (s) => ({ ...s, checkpointsSaved: s.checkpointsSaved + 1 }));
      await recordEvent(db, "checkpoint.saved", {
        learnerId: input.learner.id,
        sessionId: input.session.id,
        channel: input.session.channel,
      });
    }
    return { saved: true, checkpoint, data, summary: summaryLearner, replayed: !created };
  },

  /**
   * Close a session. Idempotent: closing an already-closed session returns its
   * stored outcome. In session-only mode the session state is cleared so no
   * learning content outlives the session.
   */
  async close(
    db: Db,
    input: {
      session: LearningSession;
      learner: Learner;
      reason: "learner_ended" | "provider_ended" | "paused" | "interrupted" | "stale" | "error";
      idempotencyKey: string;
    },
  ): Promise<{ alreadyClosed: boolean; saved: boolean; summary: string | null; session: LearningSession }> {
    if (!isSessionOpen(input.session)) {
      return {
        alreadyClosed: true,
        saved: input.session.checkpoint !== null,
        summary: input.session.summary,
        session: input.session,
      };
    }
    const durable = input.session.memoryMode === "durable" && memoryModeFor(input.learner) === "durable";
    let summary: string | null = null;
    let checkpointJson: unknown = null;
    const hadLearning = input.session.state.courseId !== null || input.session.state.goal !== null;
    if (durable && hadLearning) {
      const cp = await sessionService.saveCheckpoint(db, {
        session: input.session,
        learner: input.learner,
        idempotencyKey: `${input.idempotencyKey}:checkpoint`,
        unresolvedDifficulty: null,
      });
      summary = cp.checkpoint?.summary ?? null;
      checkpointJson = cp.data;
    }
    const reloaded = (await sessionsRepo.findById(db, input.session.id)) ?? input.session;
    const finalState: SessionState = durable
      ? { ...reloaded.state, phase: "closed" }
      : { ...emptySessionState(), phase: "closed" };
    const status =
      input.reason === "error"
        ? "failed"
        : input.reason === "interrupted" || input.reason === "stale"
          ? "interrupted"
          : "completed";
    const closed = await sessionsRepo.close(db, input.session.id, {
      status,
      summary,
      checkpoint: checkpointJson,
      endReason: input.reason,
      state: finalState,
    });
    if (!closed) {
      // Lost a race with another close (e.g. browser end + provider on_end).
      const current = await sessionsRepo.findById(db, input.session.id);
      if (!current) throw new DomainError("NOT_FOUND", "Session not found.");
      return { alreadyClosed: true, saved: current.checkpoint !== null, summary: current.summary, session: current };
    }
    if (closed.enrollmentId) await enrollmentsRepo.touch(db, closed.enrollmentId, {}).catch(() => undefined);
    await recordEvent(db, status === "failed" ? "session.failed" : "session.ended", {
      learnerId: input.learner.id,
      sessionId: closed.id,
      channel: closed.channel,
      metadata: { reason: input.reason, saved: summary !== null },
    });
    return { alreadyClosed: false, saved: summary !== null, summary, session: closed };
  },

  async closeStale(db: Db, learner: Learner): Promise<void> {
    const stale = await sessionsRepo.listStaleOpen(db, learner.id, STALE_SESSION_MINUTES);
    // Sequential on purpose: each close writes a checkpoint and touches the
    // enrollment, and two stale sessions can share one. There is rarely more
    // than one, so concurrency would buy nothing and risk racing on that row.
    for (const s of stale) {
      await sessionService.close(db, { session: s, learner, reason: "stale", idempotencyKey: `stale:${s.id}` });
    }
  },
};

/** Seed session state from durable memory (resume) or from the requested course. */
async function initialState(db: Queryable, learner: Learner, requestedCourseId: string | null): Promise<SessionState> {
  const state = emptySessionState();
  if (memoryModeFor(learner) !== "durable") {
    if (requestedCourseId) {
      const course = await courseService.getAvailable(db, requestedCourseId);
      const lesson = frontierLesson(course, new Set());
      state.courseId = course.id;
      state.lessonId = lesson.id;
      state.conceptId = lesson.concepts[0]?.id ?? null;
      state.phase = "teach";
    }
    return state;
  }

  const goal = await goalsRepo.findActive(db, learner.id);
  if (goal) state.goal = { id: goal.id, text: goal.goalText };

  const enrollments = await enrollmentsRepo.listForLearner(db, learner.id);
  const enrollment = requestedCourseId
    ? enrollments.find((e) => e.courseId === requestedCourseId && e.status !== "withdrawn")
    : (enrollments.find((e) => e.status === "active") ?? enrollments[0]);
  if (requestedCourseId && !enrollment) {
    // Course chosen but not yet enrolled: the agent confirms before enrolling.
    await courseService.getAvailable(db, requestedCourseId);
    state.courseId = requestedCourseId;
    state.phase = "confirm_enrolment";
    return state;
  }
  if (!enrollment) {
    state.phase = goal ? "recommend_course" : "discover_goal";
    return state;
  }

  const course = await courseService.getAvailable(db, enrollment.courseId).catch(() => null);
  if (!course) return state;
  const snapshot = await learningService.progress(db, enrollment.id);
  const lesson =
    course.lessons.find((l) => l.id === enrollment.currentLessonId && !snapshot.completedLessonIds.has(l.id)) ??
    frontierLesson(course, snapshot.completedLessonIds);
  const checkpoint = await checkpointsRepo.latestForEnrollment(db, enrollment.id);
  const conceptFromCheckpoint =
    checkpoint && checkpoint.lessonId === lesson.id && checkpoint.conceptId
      ? lesson.concepts.find((c) => c.id === checkpoint.conceptId && !isConceptDone(snapshot.mastery[c.id]))
      : undefined;
  const concept = conceptFromCheckpoint ?? firstOpenConcept(lesson, snapshot.mastery) ?? lesson.concepts[0];

  state.courseId = course.id;
  state.enrollmentId = enrollment.id;
  state.lessonId = lesson.id;
  state.conceptId = concept?.id ?? null;
  state.phase = "teach";
  return state;
}
