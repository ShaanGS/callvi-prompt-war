import { z } from "zod";
import { col, exec, many, maybeOne, one, type Queryable } from "../db/types";
import {
  MASTERY_STATES,
  PRACTICE_RESULTS,
  type ConceptMastery,
  type Enrollment,
  type Goal,
  type LessonProgress,
  type MasteryState,
  type PracticeResult,
} from "../domain/types";

const goalRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    goal_text: z.string(),
    goal_status: z.enum(["active", "completed", "paused", "abandoned"]),
    user_confirmed: col.bool,
    source: z.enum(["onboarding", "settings", "voice_session", "text_session"]),
    source_session_id: col.uuid.nullable(),
    created_at: col.date,
    updated_at: col.date,
  })
  .transform((r): Goal => ({
    id: r.id,
    learnerId: r.learner_id,
    goalText: r.goal_text,
    status: r.goal_status,
    userConfirmed: r.user_confirmed,
    source: r.source,
    sourceSessionId: r.source_session_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
const GOAL_COLUMNS =
  "id, learner_id, goal_text, goal_status, user_confirmed, source, source_session_id, created_at, updated_at";

const enrollmentRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    course_id: z.string(),
    goal_id: col.uuid.nullable(),
    status: z.enum(["active", "paused", "completed", "withdrawn"]),
    current_lesson_id: col.nullableText,
    enrolled_at: col.date,
    last_activity_at: col.date,
    completed_at: col.nullableDate,
  })
  .transform((r): Enrollment => ({
    id: r.id,
    learnerId: r.learner_id,
    courseId: r.course_id,
    goalId: r.goal_id,
    status: r.status,
    currentLessonId: r.current_lesson_id,
    enrolledAt: r.enrolled_at,
    lastActivityAt: r.last_activity_at,
    completedAt: r.completed_at,
  }));
const ENROLLMENT_COLUMNS =
  "id, learner_id, course_id, goal_id, status, current_lesson_id, enrolled_at, last_activity_at, completed_at";

const progressRow = z
  .object({
    enrollment_id: col.uuid,
    lesson_id: z.string(),
    status: z.enum(["not_started", "in_progress", "completed"]),
    started_at: col.nullableDate,
    completed_at: col.nullableDate,
  })
  .transform((r): LessonProgress => ({
    enrollmentId: r.enrollment_id,
    lessonId: r.lesson_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));

const masteryRow = z
  .object({
    enrollment_id: col.uuid,
    lesson_id: z.string(),
    concept_id: z.string(),
    state: z.enum(MASTERY_STATES),
    attempts: col.int,
    last_result: z.enum(PRACTICE_RESULTS).nullable(),
    source_session_id: col.uuid.nullable(),
    updated_at: col.date,
  })
  .transform((r): ConceptMastery => ({
    enrollmentId: r.enrollment_id,
    lessonId: r.lesson_id,
    conceptId: r.concept_id,
    state: r.state,
    attempts: r.attempts,
    lastResult: r.last_result,
    sourceSessionId: r.source_session_id,
    updatedAt: r.updated_at,
  }));

export const goalsRepo = {
  async findActive(db: Queryable, learnerId: string): Promise<Goal | null> {
    return maybeOne(
      db,
      goalRow,
      `select ${GOAL_COLUMNS} from learner_goals where learner_id = $1 and goal_status = 'active'`,
      [learnerId],
    );
  },

  async findById(db: Queryable, id: string): Promise<Goal | null> {
    return maybeOne(db, goalRow, `select ${GOAL_COLUMNS} from learner_goals where id = $1`, [id]);
  },

  async findByIdempotencyKey(db: Queryable, key: string): Promise<Goal | null> {
    return maybeOne(db, goalRow, `select ${GOAL_COLUMNS} from learner_goals where idempotency_key = $1`, [key]);
  },

  async list(db: Queryable, learnerId: string): Promise<Goal[]> {
    return many(
      db,
      goalRow,
      `select ${GOAL_COLUMNS} from learner_goals where learner_id = $1 order by created_at desc limit 20`,
      [learnerId],
    );
  },

  /** Pause the current active goal (if any) and create a new active one. */
  async replaceActive(
    db: Queryable,
    input: {
      learnerId: string;
      goalText: string;
      source: Goal["source"];
      sourceSessionId: string | null;
      idempotencyKey: string | null;
    },
  ): Promise<Goal> {
    await exec(db, `update learner_goals set goal_status = 'paused' where learner_id = $1 and goal_status = 'active'`, [
      input.learnerId,
    ]);
    return one(
      db,
      goalRow,
      `insert into learner_goals (learner_id, goal_text, goal_status, user_confirmed, source, source_session_id, idempotency_key)
       values ($1, $2, 'active', true, $3, $4, $5) returning ${GOAL_COLUMNS}`,
      [input.learnerId, input.goalText, input.source, input.sourceSessionId, input.idempotencyKey],
    );
  },

  /** A learner correction: new text, and provenance now points at where the correction was made. */
  async updateText(
    db: Queryable,
    goalId: string,
    goalText: string,
    source: Goal["source"],
    sourceSessionId: string | null,
  ): Promise<Goal> {
    return one(
      db,
      goalRow,
      `update learner_goals set goal_text = $2, user_confirmed = true, source = $3, source_session_id = $4 where id = $1 returning ${GOAL_COLUMNS}`,
      [goalId, goalText, source, sourceSessionId],
    );
  },
};

export const enrollmentsRepo = {
  async findById(db: Queryable, id: string): Promise<Enrollment | null> {
    return maybeOne(db, enrollmentRow, `select ${ENROLLMENT_COLUMNS} from enrollments where id = $1`, [id]);
  },

  async findOpen(db: Queryable, learnerId: string, courseId: string): Promise<Enrollment | null> {
    return maybeOne(
      db,
      enrollmentRow,
      `select ${ENROLLMENT_COLUMNS} from enrollments
       where learner_id = $1 and course_id = $2 and status in ('active', 'paused')`,
      [learnerId, courseId],
    );
  },

  async findLatestForCourse(db: Queryable, learnerId: string, courseId: string): Promise<Enrollment | null> {
    return maybeOne(
      db,
      enrollmentRow,
      `select ${ENROLLMENT_COLUMNS} from enrollments where learner_id = $1 and course_id = $2
       order by last_activity_at desc limit 1`,
      [learnerId, courseId],
    );
  },

  async listForLearner(db: Queryable, learnerId: string): Promise<Enrollment[]> {
    return many(
      db,
      enrollmentRow,
      `select ${ENROLLMENT_COLUMNS} from enrollments where learner_id = $1 and status <> 'withdrawn'
       order by last_activity_at desc`,
      [learnerId],
    );
  },

  async create(
    db: Queryable,
    input: {
      learnerId: string;
      courseId: string;
      goalId: string | null;
      currentLessonId: string;
      idempotencyKey: string | null;
    },
  ): Promise<Enrollment> {
    return one(
      db,
      enrollmentRow,
      `insert into enrollments (learner_id, course_id, goal_id, status, current_lesson_id, idempotency_key)
       values ($1, $2, $3, 'active', $4, $5) returning ${ENROLLMENT_COLUMNS}`,
      [input.learnerId, input.courseId, input.goalId, input.currentLessonId, input.idempotencyKey],
    );
  },

  async touch(
    db: Queryable,
    id: string,
    patch: { status?: Enrollment["status"]; currentLessonId?: string | null; goalId?: string | null },
  ) {
    return one(
      db,
      enrollmentRow,
      `update enrollments set
         status = coalesce($2, status),
         current_lesson_id = case when $3::boolean then $4 else current_lesson_id end,
         goal_id = case when $5::boolean then $6::uuid else goal_id end,
         completed_at = case when coalesce($2, status) = 'completed' then coalesce(completed_at, now()) else completed_at end,
         last_activity_at = now()
       where id = $1 returning ${ENROLLMENT_COLUMNS}`,
      [
        id,
        patch.status ?? null,
        patch.currentLessonId !== undefined,
        patch.currentLessonId ?? null,
        patch.goalId !== undefined,
        patch.goalId ?? null,
      ],
    );
  },
};

export const progressRepo = {
  async listLessonProgress(db: Queryable, enrollmentId: string): Promise<LessonProgress[]> {
    return many(
      db,
      progressRow,
      `select enrollment_id, lesson_id, status, started_at, completed_at from lesson_progress where enrollment_id = $1`,
      [enrollmentId],
    );
  },

  async setLessonStatus(
    db: Queryable,
    input: { enrollmentId: string; learnerId: string; lessonId: string; status: LessonProgress["status"] },
  ): Promise<void> {
    await exec(
      db,
      `insert into lesson_progress (enrollment_id, lesson_id, learner_id, status, started_at, completed_at)
       values ($1, $2, $3, $4, case when $4 <> 'not_started' then now() end, case when $4 = 'completed' then now() end)
       on conflict (enrollment_id, lesson_id) do update set
         status = case
           when lesson_progress.status = 'completed' then 'completed'
           else excluded.status end,
         started_at = coalesce(lesson_progress.started_at, excluded.started_at),
         completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at)`,
      [input.enrollmentId, input.lessonId, input.learnerId, input.status],
    );
  },

  async listMastery(db: Queryable, enrollmentId: string): Promise<ConceptMastery[]> {
    return many(
      db,
      masteryRow,
      `select enrollment_id, lesson_id, concept_id, state, attempts, last_result, source_session_id, updated_at
       from concept_mastery where enrollment_id = $1`,
      [enrollmentId],
    );
  },

  async upsertMastery(
    db: Queryable,
    input: {
      learnerId: string;
      enrollmentId: string;
      lessonId: string;
      conceptId: string;
      state: MasteryState;
      lastResult: PracticeResult | null;
      incrementAttempts: boolean;
      sourceSessionId: string | null;
    },
  ): Promise<void> {
    await exec(
      db,
      `insert into concept_mastery (learner_id, enrollment_id, lesson_id, concept_id, state, attempts, last_result, source_session_id)
       values ($1, $2, $3, $4, $5, case when $6::boolean then 1 else 0 end, $7, $8)
       on conflict (enrollment_id, concept_id) do update set
         state = excluded.state,
         attempts = concept_mastery.attempts + case when $6::boolean then 1 else 0 end,
         last_result = coalesce(excluded.last_result, concept_mastery.last_result),
         source_session_id = excluded.source_session_id`,
      [
        input.learnerId,
        input.enrollmentId,
        input.lessonId,
        input.conceptId,
        input.state,
        input.incrementAttempts,
        input.lastResult,
        input.sourceSessionId,
      ],
    );
  },

  /** Learner-requested correction: "I want to review this again". */
  async resetMastery(db: Queryable, learnerId: string, enrollmentId: string, conceptId: string): Promise<number> {
    const rows = await db.query(
      `update concept_mastery set state = 'introduced' where learner_id = $1 and enrollment_id = $2 and concept_id = $3 returning id`,
      [learnerId, enrollmentId, conceptId],
    );
    return rows.length;
  },
};
