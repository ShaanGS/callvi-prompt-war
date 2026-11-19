import type { LanguageCode } from "@/lib/languages";
import type { Queryable } from "../db/types";
import { isSessionOpen, type Learner, type LearningSession, type MasteryState, type PracticeResult } from "../domain/types";
import { isConceptDone } from "../agent/learning-policy";
import { enrollmentsRepo, goalsRepo } from "../repositories/learning";
import { attemptsRepo, checkpointsRepo, sessionsRepo } from "../repositories/sessions";
import type { StoredCourse } from "../repositories/courses";
import { courseService, totalConcepts } from "./course-service";
import { learningService, snapshotFromSession } from "./learning-service";
import { renderCheckpointSummary } from "./summaries";
import { evidenceRepo } from "../repositories/evidence";
import { learningSignals, type LearningSignal } from "./learning-evidence";

/**
 * Read models for the learner interface. Everything shown is derived from
 * persisted state; nothing is invented or estimated.
 */

export interface EnrollmentView {
  id: string;
  course: { id: string; title: string };
  status: string;
  enrolledAt: Date;
  lastActivityAt: Date;
  currentLesson: { id: string; title: string; sequence: number; of: number } | null;
  completedConcepts: number;
  totalConcepts: number;
  completedLessons: number;
  evidence: LearningSignal[];
  lessons: Array<{
    id: string;
    sequence: number;
    title: string;
    complete: boolean;
    concepts: Array<{ id: string; title: string; state: MasteryState | "not_started" }>;
  }>;
  lastCheckpoint: { summary: string; at: Date } | null;
}

function lessonsView(course: StoredCourse, mastery: Record<string, MasteryState | undefined>, completed: Set<string>, language: LanguageCode) {
  return [...course.lessons]
    .sort((a, b) => a.sequence - b.sequence)
    .map((l) => ({
      id: l.id,
      sequence: l.sequence,
      title: l.title[language],
      complete: completed.has(l.id),
      concepts: l.concepts.map((c) => ({ id: c.id, title: c.title[language], state: mastery[c.id] ?? ("not_started" as const) })),
    }));
}

export async function enrollmentViews(db: Queryable, learner: Learner, language: LanguageCode): Promise<EnrollmentView[]> {
  if (learner.consentStatus !== "granted") return [];
  const [enrollments, courses] = await Promise.all([enrollmentsRepo.listForLearner(db, learner.id), courseService.listAll(db)]);
  // Each enrollment's reads are independent of the others, so they run
  // concurrently instead of one round trip after another.
  const views = await Promise.all(
    enrollments.map(async (e): Promise<EnrollmentView | null> => {
      const course = courses.find((c) => c.id === e.courseId);
      if (!course) return null;
      const [snapshot, checkpoint, evidence] = await Promise.all([
        learningService.progress(db, e.id),
        checkpointsRepo.latestForEnrollment(db, e.id),
        evidenceRepo.list(db, learner.id, e.id),
      ]);
      const lesson = course.lessons.find((l) => l.id === e.currentLessonId) ?? null;
      return {
        id: e.id,
        course: { id: course.id, title: course.title[language] },
        status: e.status,
        enrolledAt: e.enrolledAt,
        lastActivityAt: e.lastActivityAt,
        currentLesson: lesson ? { id: lesson.id, title: lesson.title[language], sequence: lesson.sequence, of: course.lessons.length } : null,
        completedConcepts: Object.values(snapshot.mastery).filter((s) => isConceptDone(s)).length,
        totalConcepts: totalConcepts(course),
        completedLessons: course.lessons.filter((l) => snapshot.completedLessonIds.has(l.id)).length,
        evidence: learningSignals(evidence, course, language, "progress-page"),
        lessons: lessonsView(course, snapshot.mastery, snapshot.completedLessonIds, language),
        lastCheckpoint: checkpoint ? { summary: renderCheckpointSummary(checkpoint, course, language), at: checkpoint.createdAt } : null,
      };
    }),
  );
  return views.filter((v): v is EnrollmentView => v !== null);
}

export interface HomeView {
  goal: { text: string; updatedAt: Date } | null;
  focus: EnrollmentView | null;
  others: EnrollmentView[];
  openSession: { id: string; channel: LearningSession["channel"]; startedAt: Date } | null;
  sessionCount: number;
}

export async function homeView(db: Queryable, learner: Learner, language: LanguageCode): Promise<HomeView> {
  const [goal, enrollments, sessions] = await Promise.all([
    learner.consentStatus === "granted" ? goalsRepo.findActive(db, learner.id) : Promise.resolve(null),
    enrollmentViews(db, learner, language),
    sessionsRepo.listForLearner(db, learner.id, 20),
  ]);
  const open = sessions.find((s) => isSessionOpen(s) && Date.now() - s.lastActivityAt.getTime() < 2 * 60 * 60 * 1000);
  const focus = enrollments.find((e) => e.status === "active") ?? enrollments[0] ?? null;
  return {
    goal: goal ? { text: goal.goalText, updatedAt: goal.updatedAt } : null,
    focus,
    others: enrollments.filter((e) => e.id !== focus?.id),
    openSession: open ? { id: open.id, channel: open.channel, startedAt: open.startedAt } : null,
    sessionCount: sessions.length,
  };
}

export interface HistoryView {
  sessions: Array<{
    id: string;
    channel: LearningSession["channel"];
    status: LearningSession["status"];
    memoryMode: LearningSession["memoryMode"];
    startedAt: Date;
    endedAt: Date | null;
    minutes: number | null;
    summary: string | null;
  }>;
  attempts: Array<{
    id: string;
    at: Date;
    course: string;
    lesson: string;
    concept: string;
    prompt: string;
    answer: string;
    result: PracticeResult;
    feedback: string;
  }>;
}

export async function historyView(db: Queryable, learner: Learner, language: LanguageCode): Promise<HistoryView> {
  const [sessions, attempts, courses] = await Promise.all([
    sessionsRepo.listForLearner(db, learner.id, 30),
    learner.consentStatus === "granted" ? attemptsRepo.listForLearner(db, learner.id, 50) : Promise.resolve([]),
    courseService.listAll(db),
  ]);
  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      channel: s.channel,
      status: s.status,
      memoryMode: s.memoryMode,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      minutes: s.endedAt ? Math.max(1, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000)) : null,
      summary: s.summary,
    })),
    attempts: attempts.map((a) => {
      const course = courses.find((c) => c.lessons.some((l) => l.id === a.lessonId));
      const lesson = course?.lessons.find((l) => l.id === a.lessonId);
      const concept = lesson?.concepts.find((c) => c.id === a.conceptId);
      const exercise = lesson?.practice.find((p) => p.id === a.exerciseId);
      return {
        id: a.id,
        at: a.createdAt,
        course: course?.title[language] ?? "",
        lesson: lesson?.title[language] ?? a.lessonId,
        concept: concept?.title[language] ?? a.conceptId,
        prompt: exercise?.prompt[language] ?? "",
        answer: a.answerText,
        result: a.result,
        feedback: a.feedback,
      };
    }),
  };
}

export interface SessionView {
  id: string;
  status: LearningSession["status"];
  open: boolean;
  channel: LearningSession["channel"];
  memoryMode: LearningSession["memoryMode"];
  language: LanguageCode;
  startedAt: string;
  goal: string | null;
  course: { id: string; title: string } | null;
  lesson: { id: string; title: string; objective: string; sequence: number; of: number; reviewNotes: string[]; realWorldAction: string } | null;
  concept: {
    id: string;
    title: string;
    keyPoints: string[];
    checkQuestion: string;
    explanation: string;
    approach: string;
    approachesUsed: number;
    approachesTotal: number;
  } | null;
  lessonConcepts: Array<{ id: string; title: string; state: MasteryState | "not_started" }>;
  practice: { exerciseId: string; prompt: string; kind: string } | null;
  attempts: Array<{ exerciseId: string; result: PracticeResult; at: string }>;
  courseProgress: { completedConcepts: number; totalConcepts: number };
  summary: string | null;
}

export async function sessionView(db: Queryable, learner: Learner, session: LearningSession): Promise<SessionView> {
  const language = session.language;
  const state = session.state;
  const course = state.courseId ? await courseService.getAvailable(db, state.courseId).catch(() => null) : null;
  const durable = session.memoryMode === "durable" && learner.consentStatus === "granted" && state.enrollmentId;
  const snapshot = durable && state.enrollmentId ? await learningService.progress(db, state.enrollmentId) : snapshotFromSession(state);
  const lesson = course && state.lessonId ? (course.lessons.find((l) => l.id === state.lessonId) ?? null) : null;
  const concept = lesson && state.conceptId ? (lesson.concepts.find((c) => c.id === state.conceptId) ?? null) : null;
  const used = concept ? (state.explanationsUsed[concept.id] ?? []) : [];
  const explanation = concept ? (concept.explanations.find((e) => e.approach === used[used.length - 1]) ?? concept.explanations[0]) : null;
  const exercise = lesson && state.pendingExerciseId ? (lesson.practice.find((p) => p.id === state.pendingExerciseId) ?? null) : null;

  return {
    id: session.id,
    status: session.status,
    open: isSessionOpen(session),
    channel: session.channel,
    memoryMode: session.memoryMode,
    language,
    startedAt: session.startedAt.toISOString(),
    goal: state.goal?.text ?? null,
    course: course ? { id: course.id, title: course.title[language] } : null,
    lesson: lesson
      ? {
          id: lesson.id,
          title: lesson.title[language],
          objective: lesson.objective[language],
          sequence: lesson.sequence,
          of: course?.lessons.length ?? 0,
          reviewNotes: lesson.reviewFlags.map((f) => f[language]),
          realWorldAction: lesson.realWorldAction[language],
        }
      : null,
    concept:
      concept && explanation
        ? {
            id: concept.id,
            title: concept.title[language],
            keyPoints: concept.keyPoints.map((k) => k[language]),
            checkQuestion: concept.checkQuestion[language],
            explanation: explanation.text[language],
            approach: explanation.approach,
            approachesUsed: used.length,
            approachesTotal: concept.explanations.length,
          }
        : null,
    lessonConcepts: lesson ? lesson.concepts.map((c) => ({ id: c.id, title: c.title[language], state: snapshot.mastery[c.id] ?? "not_started" })) : [],
    practice: exercise ? { exerciseId: exercise.id, prompt: exercise.prompt[language], kind: exercise.kind } : null,
    attempts: state.attempts.map((a) => ({ exerciseId: a.exerciseId, result: a.result, at: a.at })),
    courseProgress: {
      completedConcepts: Object.values(snapshot.mastery).filter((s) => isConceptDone(s)).length,
      totalConcepts: course ? totalConcepts(course) : 0,
    },
    summary: session.summary,
  };
}
