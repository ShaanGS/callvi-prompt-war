import { z } from "zod";
import { col, exec, jsonParam, many, maybeOne, one, type Queryable } from "../db/types";
import {
  CHANNELS,
  PRACTICE_RESULTS,
  checkpointDataSchema,
  languageSchema,
  sessionStateSchema,
  type Channel,
  type Checkpoint,
  type CheckpointData,
  type LearningSession,
  type MemoryMode,
  type PracticeAttempt,
  type SessionState,
} from "../domain/types";

const sessionRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    enrollment_id: col.uuid.nullable(),
    channel: z.enum(CHANNELS),
    provider: z.enum(["sarvam", "elevenlabs", "none", "simulation"]),
    provider_interaction_id: col.nullableText,
    status: z.enum(["started", "active", "paused", "completed", "interrupted", "failed"]),
    memory_mode: z.enum(["durable", "session_only"]),
    language: languageSchema,
    state: z.unknown(),
    state_version: col.int,
    summary: col.nullableText,
    checkpoint: z.unknown(),
    end_reason: col.nullableText,
    started_at: col.date,
    last_activity_at: col.date,
    ended_at: col.nullableDate,
  })
  .transform(
    (r): LearningSession => ({
      id: r.id,
      learnerId: r.learner_id,
      enrollmentId: r.enrollment_id,
      channel: r.channel,
      provider: r.provider,
      providerInteractionId: r.provider_interaction_id,
      status: r.status,
      memoryMode: r.memory_mode,
      language: r.language,
      // Tolerate older/partial state documents: unknown keys are dropped, defaults applied.
      state: sessionStateSchema.catch(sessionStateSchema.parse({})).parse(r.state),
      stateVersion: r.state_version,
      summary: r.summary,
      checkpoint: r.checkpoint,
      endReason: r.end_reason,
      startedAt: r.started_at,
      lastActivityAt: r.last_activity_at,
      endedAt: r.ended_at,
    }),
  );
const SESSION_COLUMNS = `id, learner_id, enrollment_id, channel, provider, provider_interaction_id, status, memory_mode,
  language, state, state_version, summary, checkpoint, end_reason, started_at, last_activity_at, ended_at`;

const checkpointRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    enrollment_id: col.uuid.nullable(),
    session_id: col.uuid.nullable(),
    goal_text: col.nullableText,
    course_id: col.nullableText,
    lesson_id: col.nullableText,
    concept_id: col.nullableText,
    completed_practice: z.array(z.object({ exerciseId: z.string(), result: z.enum(PRACTICE_RESULTS) })),
    unresolved_difficulty: col.nullableText,
    next_action: z.string(),
    summary: z.string(),
    created_at: col.date,
  })
  .transform(
    (r): Checkpoint => ({
      id: r.id,
      learnerId: r.learner_id,
      enrollmentId: r.enrollment_id,
      sessionId: r.session_id,
      goalText: r.goal_text,
      courseId: r.course_id,
      lessonId: r.lesson_id,
      conceptId: r.concept_id,
      completedPractice: r.completed_practice,
      unresolvedDifficulty: r.unresolved_difficulty,
      nextAction: r.next_action,
      summary: r.summary,
      createdAt: r.created_at,
    }),
  );
const CHECKPOINT_COLUMNS = `id, learner_id, enrollment_id, session_id, goal_text, course_id, lesson_id, concept_id,
  completed_practice, unresolved_difficulty, next_action, summary, created_at`;

export const sessionsRepo = {
  async findById(db: Queryable, id: string): Promise<LearningSession | null> {
    return maybeOne(db, sessionRow, `select ${SESSION_COLUMNS} from learning_sessions where id = $1`, [id]);
  },

  async findByInteractionId(db: Queryable, interactionId: string): Promise<LearningSession | null> {
    return maybeOne(db, sessionRow, `select ${SESSION_COLUMNS} from learning_sessions where provider_interaction_id = $1`, [
      interactionId,
    ]);
  },

  async create(
    db: Queryable,
    input: {
      learnerId: string;
      enrollmentId: string | null;
      channel: Channel;
      provider: LearningSession["provider"];
      providerInteractionId: string | null;
      memoryMode: MemoryMode;
      language: LearningSession["language"];
      state: SessionState;
    },
  ): Promise<LearningSession> {
    return one(
      db,
      sessionRow,
      `insert into learning_sessions (learner_id, enrollment_id, channel, provider, provider_interaction_id, memory_mode, language, state)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) returning ${SESSION_COLUMNS}`,
      [
        input.learnerId,
        input.enrollmentId,
        input.channel,
        input.provider,
        input.providerInteractionId,
        input.memoryMode,
        input.language,
        jsonParam(input.state),
      ],
    );
  },

  async attachInteraction(db: Queryable, id: string, interactionId: string): Promise<void> {
    await exec(
      db,
      `update learning_sessions set provider_interaction_id = $2
       where id = $1 and (provider_interaction_id is null or provider_interaction_id = $2)`,
      [id, interactionId],
    );
  },

  /** Optimistic-concurrency state write. Returns null when the version moved. */
  async writeState(
    db: Queryable,
    id: string,
    expectedVersion: number,
    patch: { state: SessionState; enrollmentId?: string | null; status?: LearningSession["status"] },
  ): Promise<LearningSession | null> {
    return maybeOne(
      db,
      sessionRow,
      `update learning_sessions set
         state = $3::jsonb,
         state_version = state_version + 1,
         enrollment_id = case when $4::boolean then $5::uuid else enrollment_id end,
         status = coalesce($6, case when status = 'started' then 'active' else status end),
         last_activity_at = now()
       where id = $1 and state_version = $2
       returning ${SESSION_COLUMNS}`,
      [id, expectedVersion, jsonParam(patch.state), patch.enrollmentId !== undefined, patch.enrollmentId ?? null, patch.status ?? null],
    );
  },

  async setLanguage(db: Queryable, id: string, language: LearningSession["language"]): Promise<void> {
    await exec(db, `update learning_sessions set language = $2 where id = $1`, [id, language]);
  },

  async setMemoryMode(db: Queryable, learnerId: string, mode: MemoryMode): Promise<void> {
    await exec(
      db,
      `update learning_sessions set memory_mode = $2
       where learner_id = $1 and status in ('started', 'active', 'paused')`,
      [learnerId, mode],
    );
  },

  async close(
    db: Queryable,
    id: string,
    input: { status: "completed" | "interrupted" | "failed"; summary: string | null; checkpoint: unknown; endReason: string; state: SessionState },
  ): Promise<LearningSession | null> {
    return maybeOne(
      db,
      sessionRow,
      `update learning_sessions set status = $2, summary = $3, checkpoint = $4::jsonb, end_reason = $5,
         state = $6::jsonb, state_version = state_version + 1, ended_at = now(), last_activity_at = now()
       where id = $1 and status in ('started', 'active', 'paused')
       returning ${SESSION_COLUMNS}`,
      [id, input.status, input.summary, input.checkpoint === null ? null : jsonParam(input.checkpoint), input.endReason, jsonParam(input.state)],
    );
  },

  async listForLearner(db: Queryable, learnerId: string, limit = 30): Promise<LearningSession[]> {
    return many(
      db,
      sessionRow,
      `select ${SESSION_COLUMNS} from learning_sessions where learner_id = $1 order by started_at desc limit $2`,
      [learnerId, limit],
    );
  },

  async findOpenForLearner(db: Queryable, learnerId: string): Promise<LearningSession[]> {
    return many(
      db,
      sessionRow,
      `select ${SESSION_COLUMNS} from learning_sessions
       where learner_id = $1 and status in ('started', 'active', 'paused') order by started_at desc`,
      [learnerId],
    );
  },

  /** Close sessions that were abandoned without an end event (browser closed, network lost). */
  async listStaleOpen(db: Queryable, learnerId: string, olderThanMinutes: number): Promise<LearningSession[]> {
    return many(
      db,
      sessionRow,
      `select ${SESSION_COLUMNS} from learning_sessions
       where learner_id = $1 and status in ('started', 'active', 'paused')
         and last_activity_at < now() - make_interval(mins => $2)`,
      [learnerId, olderThanMinutes],
    );
  },
};

export const checkpointsRepo = {
  async findByIdempotencyKey(db: Queryable, key: string): Promise<Checkpoint | null> {
    return maybeOne(db, checkpointRow, `select ${CHECKPOINT_COLUMNS} from learning_checkpoints where idempotency_key = $1`, [key]);
  },

  async insert(
    db: Queryable,
    input: {
      learnerId: string;
      enrollmentId: string | null;
      sessionId: string | null;
      idempotencyKey: string;
      data: CheckpointData;
      summary: string;
    },
  ): Promise<{ checkpoint: Checkpoint; created: boolean }> {
    const data = checkpointDataSchema.parse(input.data);
    const inserted = await maybeOne(
      db,
      checkpointRow,
      `insert into learning_checkpoints (learner_id, enrollment_id, session_id, idempotency_key, goal_text, course_id,
         lesson_id, concept_id, completed_practice, unresolved_difficulty, next_action, summary)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
       on conflict (idempotency_key) do nothing
       returning ${CHECKPOINT_COLUMNS}`,
      [
        input.learnerId,
        input.enrollmentId,
        input.sessionId,
        input.idempotencyKey,
        data.goalText,
        data.courseId,
        data.lessonId,
        data.conceptId,
        jsonParam(data.completedPractice),
        data.unresolvedDifficulty,
        data.nextAction,
        input.summary,
      ],
    );
    if (inserted) return { checkpoint: inserted, created: true };
    const existing = await this.findByIdempotencyKey(db, input.idempotencyKey);
    if (!existing) throw new Error("checkpoint conflict without existing row");
    return { checkpoint: existing, created: false };
  },

  async latestForEnrollment(db: Queryable, enrollmentId: string): Promise<Checkpoint | null> {
    return maybeOne(
      db,
      checkpointRow,
      `select ${CHECKPOINT_COLUMNS} from learning_checkpoints where enrollment_id = $1 order by created_at desc limit 1`,
      [enrollmentId],
    );
  },

  async latestForLearner(db: Queryable, learnerId: string): Promise<Checkpoint | null> {
    return maybeOne(
      db,
      checkpointRow,
      `select ${CHECKPOINT_COLUMNS} from learning_checkpoints where learner_id = $1 order by created_at desc limit 1`,
      [learnerId],
    );
  },

  async listForLearner(db: Queryable, learnerId: string, limit = 20): Promise<Checkpoint[]> {
    return many(
      db,
      checkpointRow,
      `select ${CHECKPOINT_COLUMNS} from learning_checkpoints where learner_id = $1 order by created_at desc limit $2`,
      [learnerId, limit],
    );
  },
};

const attemptRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    enrollment_id: col.uuid,
    session_id: col.uuid.nullable(),
    lesson_id: z.string(),
    concept_id: z.string(),
    exercise_id: z.string(),
    answer_text: z.string(),
    score: col.nullableReal,
    result: z.enum(PRACTICE_RESULTS),
    feedback: z.string(),
    created_at: col.date,
  })
  .transform(
    (r): PracticeAttempt => ({
      id: r.id,
      learnerId: r.learner_id,
      enrollmentId: r.enrollment_id,
      sessionId: r.session_id,
      lessonId: r.lesson_id,
      conceptId: r.concept_id,
      exerciseId: r.exercise_id,
      answerText: r.answer_text,
      score: r.score,
      result: r.result,
      feedback: r.feedback,
      createdAt: r.created_at,
    }),
  );
const ATTEMPT_COLUMNS = `id, learner_id, enrollment_id, session_id, lesson_id, concept_id, exercise_id, answer_text, score,
  result, feedback, created_at`;

export const attemptsRepo = {
  async insert(
    db: Queryable,
    input: Omit<PracticeAttempt, "id" | "createdAt"> & { idempotencyKey: string; rubricVersion: number },
  ): Promise<{ attempt: PracticeAttempt; created: boolean }> {
    const inserted = await maybeOne(
      db,
      attemptRow,
      `insert into practice_attempts (learner_id, enrollment_id, session_id, lesson_id, concept_id, exercise_id,
         answer_text, score, result, feedback, rubric_version, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (idempotency_key) do nothing
       returning ${ATTEMPT_COLUMNS}`,
      [
        input.learnerId,
        input.enrollmentId,
        input.sessionId,
        input.lessonId,
        input.conceptId,
        input.exerciseId,
        input.answerText,
        input.score,
        input.result,
        input.feedback,
        input.rubricVersion,
        input.idempotencyKey,
      ],
    );
    if (inserted) return { attempt: inserted, created: true };
    const existing = await maybeOne(db, attemptRow, `select ${ATTEMPT_COLUMNS} from practice_attempts where idempotency_key = $1`, [
      input.idempotencyKey,
    ]);
    if (!existing) throw new Error("attempt conflict without existing row");
    return { attempt: existing, created: false };
  },

  async listForLearner(db: Queryable, learnerId: string, limit = 50): Promise<PracticeAttempt[]> {
    return many(
      db,
      attemptRow,
      `select ${ATTEMPT_COLUMNS} from practice_attempts where learner_id = $1 order by created_at desc limit $2`,
      [learnerId, limit],
    );
  },

  async countForExercise(db: Queryable, enrollmentId: string, exerciseId: string): Promise<number> {
    const rows = await many(db, z.object({ n: col.int }),
      `select count(*)::int as n from practice_attempts where enrollment_id=$1 and exercise_id=$2`, [enrollmentId, exerciseId]);
    return rows[0]?.n ?? 0;
  },
  async countForConcept(db: Queryable, enrollmentId: string, conceptId: string): Promise<number> {
    const rows = await many(
      db,
      z.object({ n: col.int }),
      `select count(*)::int as n from practice_attempts where enrollment_id = $1 and concept_id = $2`,
      [enrollmentId, conceptId],
    );
    return rows[0]?.n ?? 0;
  },
};
