import { z } from "zod";
import { isLanguageCode, type LanguageCode } from "@/lib/languages";
import type { Concept, Exercise, Lesson } from "@/content/schema";
import { DomainError } from "../errors";
import {
  memoryModeFor,
  sessionSourceFor,
  type MasteryState,
  type PracticeResult,
  type SessionState,
} from "../domain/types";
import { canonicalJson, sha256Hex } from "../security/crypto";
import { redactText } from "../security/redact";
import { enrollmentsRepo } from "../repositories/learning";
import { attemptsRepo, sessionsRepo } from "../repositories/sessions";
import { evidenceRepo } from "../repositories/evidence";
import type { StoredCourse } from "../repositories/courses";
import { learningSignals, type LearningSignal } from "../services/learning-evidence";
import { assessAnswer, type AssessmentOutcome } from "@/lib/assessment/assessment-service";
import { courseService, exerciseForConcept, findExercise } from "../services/course-service";
import { deletionService } from "../services/deletion-service";
import { recordEvent } from "../services/events";
import { learnerService } from "../services/learner-service";
import { learningService, snapshotFromSession, type ProgressSnapshot } from "../services/learning-service";
import { memoryService } from "../services/memory-service";
import { recommendCourses } from "../services/recommendation-service";
import { sessionService } from "../services/session-service";
import { buildLearningContext } from "./context-builder";
import { lessonGuidance, NOT_SAVED_SESSION_ONLY, practiceGuidance } from "./tool-guidance";
import {
  canOpenLesson,
  canCarryForward,
  chooseExplanation,
  firstOpenConcept,
  frontierLesson,
  isConceptDone,
  isLessonComplete,
  masteryAfterAttempt,
  nextConceptAfter,
  nextLessonAfter,
  nextStepAfterAttempt,
} from "./learning-policy";
import {
  contextLanguage,
  defineTool,
  learnerConfirmed,
  slugSchema,
  type RegisteredTool,
  type ToolContext,
} from "./tool-types";

/**
 * The learning tool surface. Each tool is a narrow, typed operation over the
 * application's services. Handlers never trust the voice model for facts:
 * course content comes from the database, assessment from the rubric, and
 * checkpoints from session state.
 */

async function snapshotFor(ctx: ToolContext): Promise<ProgressSnapshot> {
  const durable = ctx.session.memoryMode === "durable" && memoryModeFor(ctx.learner) === "durable";
  if (durable && ctx.session.state.enrollmentId)
    return learningService.progress(ctx.db, ctx.session.state.enrollmentId);
  return snapshotFromSession(ctx.session.state);
}

async function requireCourse(ctx: ToolContext) {
  const courseId = ctx.session.state.courseId;
  if (!courseId) {
    throw new DomainError(
      "POLICY_VIOLATION",
      "No course is selected yet. Agree a goal and a course with the learner first.",
      {
        required_step: "start_or_resume_course",
      },
    );
  }
  return courseService.getAvailable(ctx.db, courseId);
}

async function currentEnrollment(ctx: ToolContext) {
  const durable = ctx.session.memoryMode === "durable" && memoryModeFor(ctx.learner) === "durable";
  if (!durable || !ctx.session.state.enrollmentId) return null;
  const enrollment = await enrollmentsRepo.findById(ctx.db, ctx.session.state.enrollmentId);
  return enrollment && enrollment.learnerId === ctx.learner.id ? enrollment : null;
}

function definedMastery(map: Record<string, MasteryState | undefined>): Record<string, MasteryState> {
  const out: Record<string, MasteryState> = {};
  for (const [k, v] of Object.entries(map)) if (v !== undefined) out[k] = v;
  return out;
}

function title(text: { "ta-IN": string; "en-IN": string }, language: LanguageCode): string {
  return text[language];
}

// ---------------------------------------------------------------------------

const getLearningContext = defineTool({
  name: "get_learning_context",
  kind: "read",
  // Not an on_start hook: Sarvam's lifecycle hooks run without the LLM, so their
  // result would not reach the agent. The agent calls this first instead.
  description:
    "Load the learner's context at the start of a session: consent, saved goal, current course, lesson and concept, last session summary and the suggested next step. Call once at the start, or again only if the learner changes course or asks where they stopped.",
  input: z.object({}),
  async handler(ctx) {
    const context = await buildLearningContext(ctx.db, ctx.learner, ctx.session);
    await recordEvent(ctx.db, "memory.retrieved", {
      learnerId: ctx.learner.id,
      sessionId: ctx.session.id,
      channel: ctx.channel,
    });
    return {
      data: {
        ...context,
        // Flat copies for provider "save reply into variables" mapping.
        learner_name: context.learner.display_name ?? "",
        preferred_language: context.learner.preferred_language,
        consent_status: context.learner.consent_status,
        memory_mode: context.session.memory_mode,
        active_course_title: context.active_course?.title ?? "",
        current_lesson_title: context.progress?.current_lesson?.title ?? "",
        resume_summary: context.last_session_summary ?? "",
      },
      guidance: context.guidance,
    };
  },
});

const setMemoryConsent = defineTool({
  name: "set_memory_consent",
  kind: "write",
  description:
    "Record the learner's decision about saving learning progress between sessions. Only call after explaining what is saved and hearing a clear yes or no. Declining is fine; learning continues for this session only.",
  input: z.object({ decision: z.enum(["granted", "declined"]), learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    if (ctx.channel === "phone" && ctx.learner.phoneLast4 === null && input.decision === "granted") {
      throw new DomainError(
        "POLICY_VIOLATION",
        "Caller ID is unavailable. Continue this call in session-only mode and explain that progress cannot be resumed by redialling.",
      );
    }
    const channel = ctx.channel === "text" ? "text" : ctx.channel === "phone" ? "phone" : "browser";
    ctx.learner = await learnerService.recordConsent(ctx.db, ctx.learner.id, input.decision, channel, ctx.session.id);
    ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
    return {
      saved: true,
      data: { consent_status: ctx.learner.consentStatus, memory_mode: ctx.session.memoryMode },
      guidance:
        input.decision === "granted"
          ? "Consent recorded. Goals, course choice and progress confirmed from now on can be saved. If a goal or course was already confirmed in this session, call set_learning_goal / start_or_resume_course again to save it."
          : "Recorded that the learner does not want progress saved. Continue normally; nothing durable will be stored.",
    };
  },
});

const listCourses = defineTool({
  name: "list_courses",
  kind: "read",
  description:
    "List the available courses in the learner's language, with recommendations matched to their goal. Use when recommending a course or when the learner asks what is available. Describe at most three briefly and let the learner choose.",
  input: z.object({ goal_text: z.string().trim().max(500).optional() }),
  async handler(ctx, input) {
    const language = contextLanguage(ctx);
    const courses = (await courseService.listAvailable(ctx.db)).filter((c) => c.languages.includes(language));
    const goal = input.goal_text ?? ctx.session.state.goal?.text ?? "";
    const recs = goal ? recommendCourses(courses, goal) : [];
    return {
      data: {
        courses: courses.map((c) => ({
          id: c.id,
          title: title(c.title, language),
          summary: title(c.summary, language),
          lessons: c.lessons.length,
          content_review: c.contentReview.status,
          recommended: recs.some((r) => r.courseId === c.id),
        })),
        recommended_course_ids: recs.map((r) => r.courseId),
      },
      guidance:
        recs.length > 0
          ? "Mention the recommended course first and why it may fit, then ask which the learner would like. Do not enrol without a clear choice."
          : "No course clearly matches the goal yet. Ask one clarifying question, or briefly describe the options and let the learner choose.",
    };
  },
});

const setLearningGoal = defineTool({
  name: "set_learning_goal",
  kind: "write",
  description:
    "Save the learner's goal after you have restated it in your own words and the learner confirmed it. One short sentence in the learner's words.",
  input: z.object({ goal_text: z.string().trim().min(3).max(500), learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    const { goal, saved } = await learningService.confirmGoal(ctx.db, {
      learner: ctx.learner,
      goalText: input.goal_text,
      source: sessionSourceFor(ctx.channel),
      sourceSessionId: ctx.session.id,
      idempotencyKey: ctx.idempotencyKey,
    });
    ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({ ...s, goal }));
    return {
      saved,
      data: { goal_text: goal.text, goal_id: goal.id },
      guidance: saved ? "Goal saved. Next, help the learner choose a course (list_courses)." : NOT_SAVED_SESSION_ONLY,
    };
  },
});

const startOrResumeCourse = defineTool({
  name: "start_or_resume_course",
  kind: "write",
  description:
    "Enrol the learner in a course they clearly chose, or resume it if already enrolled. Only call after the learner has chosen. Returns the lesson to teach next.",
  input: z.object({ course_id: slugSchema, learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    const language = contextLanguage(ctx);
    const course = await courseService.getAvailable(ctx.db, input.course_id);
    if (!course.languages.includes(language)) {
      throw new DomainError("POLICY_VIOLATION", "That course is not available in the learner's language.");
    }
    const result = await learningService.startOrResumeCourse(ctx.db, {
      learner: ctx.learner,
      course,
      sessionId: ctx.session.id,
      idempotencyKey: ctx.idempotencyKey,
    });
    const snapshot = result.enrollment
      ? await learningService.progress(ctx.db, result.enrollment.id)
      : ctx.session.state.courseId === course.id
        ? snapshotFromSession(ctx.session.state)
        : { completedLessonIds: new Set<string>(), mastery: {}, masteryRows: [] };
    const lesson = result.enrollment
      ? result.currentLesson
      : (course.lessons.find((l) => l.id === ctx.session.state.lessonId && ctx.session.state.courseId === course.id) ??
        frontierLesson(course, snapshot.completedLessonIds));
    const concept = firstOpenConcept(lesson, snapshot.mastery) ?? lesson.concepts[0];
    const sameCourse = ctx.session.state.courseId === course.id;
    ctx.session = await sessionService.mutateState(
      ctx.db,
      ctx.session,
      (s) => ({
        ...s,
        courseId: course.id,
        enrollmentId: result.enrollment?.id ?? null,
        lessonId: lesson.id,
        conceptId: concept.id,
        pendingExerciseId: null,
        ...(sameCourse ? {} : { sessionMastery: {}, sessionCompletedLessons: [] }),
      }),
      { enrollmentId: result.enrollment?.id ?? null },
    );
    return {
      saved: result.saved,
      data: {
        course: { id: course.id, title: title(course.title, language) },
        enrollment_id: result.enrollment?.id ?? null,
        resumed: result.resumed,
        current_lesson: {
          id: lesson.id,
          title: title(lesson.title, language),
          sequence: lesson.sequence,
          of: course.lessons.length,
        },
        current_concept: { id: concept.id, title: title(concept.title, language) },
      },
      guidance: result.saved
        ? `${result.resumed ? "Resumed" : "Enrolled"}. If the caller just asked to start or continue NOW, that is already permission: immediately call get_lesson_context with learner_ready=true, without another readiness question. Otherwise ask what they want today and wait.`
        : `${NOT_SAVED_SESSION_ONLY} If the caller just asked to start NOW, call get_lesson_context with learner_ready=true without asking again. Otherwise wait for their choice.`,
    };
  },
});

const getLessonContext = defineTool({
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
    const signals = enrollment
      ? learningSignals(
          await evidenceRepo.list(ctx.db, ctx.learner.id, enrollment.id),
          course,
          language,
          ctx.session.id,
        )
      : [];
    const reviewTarget = input.request === "review" ? pickReviewTarget(signals, input) : null;
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
type Enrollment = NonNullable<Awaited<ReturnType<typeof currentEnrollment>>>;

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

const recordPracticeAttempt = defineTool({
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

const saveCheckpoint = defineTool({
  name: "save_checkpoint",
  kind: "write",
  idempotency: "internal",
  description:
    "Save where the learner is (course, lesson, idea, practice done, next step) when pausing, changing lesson, or when the learner asks to save. The summary is generated from session state. Optionally pass a short note of what the learner found difficult, in their words, without personal details.",
  input: z.object({ learner_difficulty: z.string().trim().max(200).nullish() }),
  async handler(ctx, input) {
    const difficulty = input.learner_difficulty ? redactText(input.learner_difficulty).slice(0, 200) : null;
    // Build from the latest persisted state, never from a possibly stale copy.
    ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
    if (difficulty !== null) {
      ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
        ...s,
        learnerNotedDifficulty: difficulty,
      }));
    }
    const { data } = await sessionService.buildCheckpoint(ctx.db, ctx.session, difficulty);
    // Same checkpoint content in the same session => same key => no duplicate.
    const key = `checkpoint:${ctx.session.id}:${sha256Hex(canonicalJson(data))}`;
    const result = await sessionService.saveCheckpoint(ctx.db, {
      session: ctx.session,
      learner: ctx.learner,
      idempotencyKey: key,
      unresolvedDifficulty: difficulty,
    });
    ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
    return {
      saved: result.saved,
      data: { summary: result.summary, next_action: result.data.nextAction, already_saved: result.replayed },
      guidance: result.saved
        ? "Checkpoint saved. You may tell the learner their place is saved."
        : "Nothing was saved, because the learner chose not to save progress. Do not say their place is saved.",
    };
  },
});

const closeLearningSession = defineTool({
  name: "close_learning_session",
  kind: "write",
  idempotency: "session",
  lifecycle: "on_end",
  allowOnClosedSession: true,
  description:
    "Finish the session: saves a final checkpoint when the learner has granted memory and marks the session closed. Safe to call more than once.",
  input: z.object({
    reason: z.enum(["learner_ended", "provider_ended", "paused", "interrupted"]).default("provider_ended"),
  }),
  async handler(ctx, input) {
    const result = await sessionService.close(ctx.db, {
      session: ctx.session,
      learner: ctx.learner,
      reason: input.reason,
      idempotencyKey: `close:${ctx.session.id}`,
    });
    ctx.session = result.session;
    return {
      saved: result.saved,
      data: { closed: true, already_closed: result.alreadyClosed, summary: result.summary },
      guidance: `${result.saved ? "Session closed and progress saved." : "Session closed. No progress was saved."} If speaking, give one short goodbye and end_call. Do not ask another question or offer more help after the learner asked to finish.`,
    };
  },
});

const getMemorySummary = defineTool({
  name: "get_memory_summary",
  kind: "read",
  description:
    "Tell the learner exactly what is saved about them: memory setting, goal, courses and progress, preferences and last checkpoint, with where each came from. Use when the learner asks what you remember.",
  input: z.object({}),
  async handler(ctx) {
    const language = contextLanguage(ctx);
    const summary = await memoryService.getSummary(ctx.db, ctx.learner, language);
    const learning = await buildLearningContext(ctx.db, ctx.learner, ctx.session);
    await recordEvent(ctx.db, "memory.retrieved", {
      learnerId: ctx.learner.id,
      sessionId: ctx.session.id,
      channel: ctx.channel,
    });
    return {
      data: {
        memory_mode: summary.memoryMode,
        consent_status: summary.consentStatus,
        display_name: summary.profile.displayName,
        preferred_language: summary.profile.preferredLanguage,
        goal: summary.activeGoal
          ? {
              text: summary.activeGoal.text,
              saved_from: summary.activeGoal.source,
              updated_at: summary.activeGoal.updatedAt.toISOString(),
            }
          : null,
        courses: summary.enrollments.map((e) => ({
          title: e.courseTitle,
          status: e.status,
          current_lesson: e.currentLessonTitle,
          done: e.mastery.filter((m) => isConceptDone(m.state)).map((m) => m.conceptTitle),
          needs_practice: e.mastery
            .filter((m) => m.state === "needs_practice" || m.state === "practising")
            .map((m) => m.conceptTitle),
        })),
        preferences: summary.preferences.map((p) => ({
          key: p.key,
          value: p.value,
          saved_from: p.source,
          updated_at: p.updatedAt.toISOString(),
        })),
        last_checkpoint: summary.lastCheckpoint?.summary ?? null,
        learning_evidence: learning.learning_evidence,
        review_suggestion: learning.review_suggestion,
      },
      guidance:
        summary.memoryMode === "durable"
          ? "Tell the learner plainly what is saved. Offer to correct anything (update_memory_preference) or delete it (request_data_deletion)."
          : "Tell the learner nothing is saved between sessions because they chose session-only learning.",
    };
  },
});

const updateMemoryPreference = defineTool({
  name: "update_memory_preference",
  kind: "write",
  description:
    "Correct or set something the learner explicitly asked to change: preferred_language ('ta-IN' or 'en-IN'), explanation_style ('examples', 'step_by_step', 'short', 'no_preference'), pace ('slower', 'normal'), display_name, or goal_text. Only after the learner confirmed the change.",
  input: z.object({
    key: z.enum(["preferred_language", "explanation_style", "pace", "display_name", "goal_text"]),
    value: z.string().trim().min(1).max(500),
    learner_confirmed: learnerConfirmed,
  }),
  async handler(ctx, input) {
    const durable = memoryModeFor(ctx.learner) === "durable";
    const provenance = { source: sessionSourceFor(ctx.channel), sourceSessionId: ctx.session.id };
    let saved = false;
    switch (input.key) {
      case "preferred_language": {
        const value = input.value === "Tamil" ? "ta-IN" : input.value === "English" ? "en-IN" : input.value;
        if (!isLanguageCode(value))
          throw new DomainError("VALIDATION", "Only Tamil (ta-IN) and English (en-IN) are supported.");
        await sessionsRepo.setLanguage(ctx.db, ctx.session.id, value);
        if (durable) {
          ctx.learner = await learnerService.updateProfile(ctx.db, ctx.learner.id, { preferredLanguage: value });
          saved = true;
        }
        ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
        break;
      }
      case "explanation_style":
      case "pace": {
        const key = input.key;
        const res = await memoryService.setPreference(ctx.db, ctx.learner, key, input.value, provenance);
        saved = res.saved;
        ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
          ...s,
          preferences: { ...s.preferences, [key]: input.value },
        }));
        break;
      }
      case "display_name": {
        if (durable) {
          ctx.learner = await learnerService.updateProfile(ctx.db, ctx.learner.id, {
            displayName: input.value.slice(0, 80),
          });
          saved = true;
        }
        break;
      }
      case "goal_text": {
        const res = await memoryService.correctGoal(ctx.db, ctx.learner, input.value, provenance);
        saved = res.saved;
        ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
          ...s,
          goal: { id: res.goalId ?? s.goal?.id ?? null, text: input.value.trim() },
        }));
        break;
      }
    }
    return {
      saved,
      data: { key: input.key, updated: true },
      guidance: saved
        ? "Updated and saved. Confirm the change briefly."
        : `Updated for this session. ${NOT_SAVED_SESSION_ONLY}`,
    };
  },
});

const requestDataDeletion = defineTool({
  name: "request_data_deletion",
  kind: "write",
  description:
    "Delete the learner's saved data after they clearly confirmed. scope='learning_memory' erases goals, courses, progress and preferences and stops saving; scope='account' deletes everything about the learner. Tell the learner what will be deleted before calling.",
  input: z.object({ scope: z.enum(["learning_memory", "account"]), learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    const channel = ctx.channel === "text" ? "text" : ctx.channel === "phone" ? "phone" : "browser";
    if (input.scope === "learning_memory") {
      ctx.learner = await learnerService.revokeConsent(ctx.db, ctx.learner.id, channel);
      ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
      return {
        saved: true,
        data: { deleted: true, scope: input.scope, memory_mode: "session_only" },
        guidance: "Learning memory deleted and saving stopped. Learning can continue for this session only.",
      };
    }
    await deletionService.deleteAccount(ctx.db, ctx.learner.id, channel);
    ctx.learnerDeleted = true;
    return {
      saved: true,
      data: { deleted: true, scope: input.scope },
      guidance: "All of the learner's data has been deleted. Confirm this briefly and end the session.",
    };
  },
});

export const TOOLS: readonly RegisteredTool[] = [
  getLearningContext,
  setMemoryConsent,
  listCourses,
  setLearningGoal,
  startOrResumeCourse,
  getLessonContext,
  recordPracticeAttempt,
  saveCheckpoint,
  closeLearningSession,
  getMemorySummary,
  updateMemoryPreference,
  requestDataDeletion,
];
