import { z } from "zod";
import { col, many, maybeOne, one, type Queryable } from "../db/types";
import { courseService } from "./course-service";

/**
 * Staff workspace read models. Every number here is a live count from the
 * database; there are no estimates, targets or placeholder metrics.
 *
 * Staff see operational, minimised data: no phone numbers, no answer text,
 * no transcripts. Learners are referred to by a short pseudonymous id.
 */

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export interface StaffOverview {
  learners: {
    total: number;
    consentGranted: number;
    consentDeclined: number;
    consentPending: number;
    consentRevoked: number;
  };
  sessions: { total: number; last7Days: number; open: number; byChannel: Record<string, number> };
  enrollments: { total: number; completed: number };
  practice: { total: number; byResult: Record<string, number> };
  tools: { total: number; failed: number; last24h: number; failedLast24h: number };
  deletions: { total: number };
}

const totalsRow = z.object({
  sessions_total: col.int,
  sessions_7d: col.int,
  sessions_open: col.int,
  enrollments_total: col.int,
  enrollments_completed: col.int,
  practice_total: col.int,
  tools_total: col.int,
  tools_failed: col.int,
  tools_24h: col.int,
  tools_failed_24h: col.int,
  deletions_total: col.int,
  learners_total: col.int,
});

// One scan per table, every figure for that table taken in the same pass with
// FILTER, instead of a separate count query per number.
const TOTALS_SQL = `
  with s as (
    select count(*)::int as total,
           count(*) filter (where started_at > now() - interval '7 days')::int as last_7d,
           count(*) filter (where status in ('started','active','paused'))::int as open
      from learning_sessions),
  e as (
    select count(*)::int as total, count(*) filter (where status = 'completed')::int as completed
      from enrollments),
  t as (
    select count(*)::int as total,
           count(*) filter (where status = 'failed')::int as failed,
           count(*) filter (where created_at > now() - interval '24 hours')::int as last_24h,
           count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours')::int as failed_24h
      from tool_invocations)
  select s.total as sessions_total, s.last_7d as sessions_7d, s.open as sessions_open,
         e.total as enrollments_total, e.completed as enrollments_completed,
         (select count(*)::int from practice_attempts) as practice_total,
         t.total as tools_total, t.failed as tools_failed, t.last_24h as tools_24h, t.failed_24h as tools_failed_24h,
         (select count(*)::int from deletion_receipts) as deletions_total,
         (select count(*)::int from learners) as learners_total
    from s, e, t`;

export async function staffOverview(db: Queryable): Promise<StaffOverview> {
  const grouped = z.object({ k: col.text, n: col.int });
  const [consent, channels, results, totals] = await Promise.all([
    many(db, grouped, `select consent_status as k, count(*)::int as n from learners group by consent_status`),
    many(db, grouped, `select channel as k, count(*)::int as n from learning_sessions group by channel`),
    many(db, grouped, `select result as k, count(*)::int as n from practice_attempts group by result`),
    one(db, totalsRow, TOTALS_SQL),
  ]);
  const byConsent = Object.fromEntries(consent.map((r) => [r.k, r.n]));
  return {
    learners: {
      total: totals.learners_total,
      consentGranted: byConsent.granted ?? 0,
      consentDeclined: byConsent.declined ?? 0,
      consentPending: byConsent.pending ?? 0,
      consentRevoked: byConsent.revoked ?? 0,
    },
    sessions: {
      total: totals.sessions_total,
      last7Days: totals.sessions_7d,
      open: totals.sessions_open,
      byChannel: Object.fromEntries(channels.map((r) => [r.k, r.n])),
    },
    enrollments: { total: totals.enrollments_total, completed: totals.enrollments_completed },
    practice: { total: totals.practice_total, byResult: Object.fromEntries(results.map((r) => [r.k, r.n])) },
    tools: {
      total: totals.tools_total,
      failed: totals.tools_failed,
      last24h: totals.tools_24h,
      failedLast24h: totals.tools_failed_24h,
    },
    deletions: { total: totals.deletions_total },
  };
}

export interface StaffCourseRow {
  id: string;
  title: string;
  status: string;
  reviewStatus: string;
  lessons: number;
  flaggedLessons: number;
  contentVersion: number;
  enrollments: number;
  completed: number;
  attempts: number;
  needsPractice: number;
}

export async function staffCourses(db: Queryable): Promise<StaffCourseRow[]> {
  const courses = await courseService.listAll(db);
  const stats = await many(
    db,
    z.object({ course_id: col.text, enrollments: col.int, completed: col.int }),
    `select course_id, count(*)::int as enrollments, count(*) filter (where status = 'completed')::int as completed
       from enrollments group by course_id`,
  );
  const attemptStats = await many(
    db,
    z.object({ course_id: col.text, attempts: col.int, needs_practice: col.int }),
    `select l.course_id, count(*)::int as attempts, count(*) filter (where a.result = 'needs_practice')::int as needs_practice
       from practice_attempts a join course_lessons l on l.id = a.lesson_id group by l.course_id`,
  );
  return courses.map((c) => {
    const s = stats.find((r) => r.course_id === c.id);
    const a = attemptStats.find((r) => r.course_id === c.id);
    return {
      id: c.id,
      title: c.title["en-IN"],
      status: c.status,
      reviewStatus: c.contentReview.status,
      lessons: c.lessons.length,
      flaggedLessons: c.lessons.filter((l) => l.reviewFlags.length > 0).length,
      contentVersion: c.contentVersion,
      enrollments: s?.enrollments ?? 0,
      completed: s?.completed ?? 0,
      attempts: a?.attempts ?? 0,
      needsPractice: a?.needs_practice ?? 0,
    };
  });
}

export interface StaffLearnerRow {
  id: string;
  shortId: string;
  providers: string[];
  consentStatus: string;
  language: string;
  createdAt: Date;
  enrollments: number;
  sessions: number;
  lastSessionAt: Date | null;
}

const learnerRow = z.object({
  id: col.uuid,
  providers: z.array(z.string()).nullable(),
  consent_status: col.text,
  preferred_language: col.text,
  created_at: col.date,
  enrollments: col.int,
  sessions: col.int,
  last_session_at: col.nullableDate,
});

export async function staffLearners(db: Queryable, limit = 100): Promise<StaffLearnerRow[]> {
  const rows = await many(
    db,
    learnerRow,
    `select l.id, l.consent_status, l.preferred_language, l.created_at,
            (select array_agg(distinct i.provider) from learner_identities i where i.learner_id = l.id) as providers,
            (select count(*)::int from enrollments e where e.learner_id = l.id) as enrollments,
            ls.sessions, ls.last_session_at
       from learners l
       -- One indexed pass over a learner's sessions for both figures, and only
       -- for the rows the limit keeps.
       left join lateral (
         select count(*)::int as sessions, max(s.started_at) as last_session_at
           from learning_sessions s where s.learner_id = l.id
       ) ls on true
      order by l.created_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    shortId: shortId(r.id),
    providers: r.providers ?? [],
    consentStatus: r.consent_status,
    language: r.preferred_language,
    createdAt: r.created_at,
    enrollments: r.enrollments,
    sessions: r.sessions,
    lastSessionAt: r.last_session_at,
  }));
}

export interface StaffLearnerDetail extends StaffLearnerRow {
  consentHistory: Array<{ decision: string; channel: string; version: string; at: Date }>;
  enrollments_: Array<{
    courseId: string;
    status: string;
    currentLessonId: string | null;
    mastered: number;
    needsPractice: number;
    enrolledAt: Date;
  }>;
  sessions_: StaffSessionRow[];
  practiceByResult: Record<string, number>;
}

export async function staffLearnerDetail(db: Queryable, learnerId: string): Promise<StaffLearnerDetail | null> {
  const base = await maybeOne(
    db,
    learnerRow,
    `select l.id, l.consent_status, l.preferred_language, l.created_at,
            (select array_agg(distinct i.provider) from learner_identities i where i.learner_id = l.id) as providers,
            (select count(*)::int from enrollments e where e.learner_id = l.id) as enrollments,
            (select count(*)::int from learning_sessions s where s.learner_id = l.id) as sessions,
            (select max(s.started_at) from learning_sessions s where s.learner_id = l.id) as last_session_at
       from learners l where l.id = $1`,
    [learnerId],
  );
  if (!base) return null;
  const [consent, enrollments, sessions, practice] = await Promise.all([
    many(
      db,
      z.object({ decision: col.text, channel: col.text, consent_version: col.text, created_at: col.date }),
      `select decision, channel, consent_version, created_at from consent_records where learner_id = $1 order by created_at desc limit 50`,
      [learnerId],
    ),
    many(
      db,
      z.object({
        course_id: col.text,
        status: col.text,
        current_lesson_id: col.nullableText,
        mastered: col.int,
        needs_practice: col.int,
        enrolled_at: col.date,
      }),
      `select e.course_id, e.status, e.current_lesson_id, e.enrolled_at, m.mastered, m.needs_practice
         from enrollments e
         left join lateral (
           select count(*) filter (where state in ('practised','mastered','carried_forward'))::int as mastered,
                  count(*) filter (where state = 'needs_practice')::int as needs_practice
             from concept_mastery where enrollment_id = e.id
         ) m on true
        where e.learner_id = $1 order by e.enrolled_at desc`,
      [learnerId],
    ),
    staffSessions(db, { learnerId, limit: 50 }),
    many(
      db,
      z.object({ k: col.text, n: col.int }),
      `select result as k, count(*)::int as n from practice_attempts where learner_id = $1 group by result`,
      [learnerId],
    ),
  ]);
  return {
    id: base.id,
    shortId: shortId(base.id),
    providers: base.providers ?? [],
    consentStatus: base.consent_status,
    language: base.preferred_language,
    createdAt: base.created_at,
    enrollments: base.enrollments,
    sessions: base.sessions,
    lastSessionAt: base.last_session_at,
    consentHistory: consent.map((c) => ({
      decision: c.decision,
      channel: c.channel,
      version: c.consent_version,
      at: c.created_at,
    })),
    enrollments_: enrollments.map((e) => ({
      courseId: e.course_id,
      status: e.status,
      currentLessonId: e.current_lesson_id,
      mastered: e.mastered,
      needsPractice: e.needs_practice,
      enrolledAt: e.enrolled_at,
    })),
    sessions_: sessions,
    practiceByResult: Object.fromEntries(practice.map((p) => [p.k, p.n])),
  };
}

export interface StaffSessionRow {
  id: string;
  learnerShortId: string;
  learnerId: string;
  channel: string;
  provider: string;
  status: string;
  memoryMode: string;
  language: string;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  toolCalls: number;
  toolFailures: number;
  hasCheckpoint: boolean;
}

export async function staffSessions(
  db: Queryable,
  opts: { learnerId?: string; limit?: number } = {},
): Promise<StaffSessionRow[]> {
  const rows = await many(
    db,
    z.object({
      id: col.uuid,
      learner_id: col.uuid,
      channel: col.text,
      provider: col.text,
      status: col.text,
      memory_mode: col.text,
      language: col.text,
      started_at: col.date,
      ended_at: col.nullableDate,
      end_reason: col.nullableText,
      tool_calls: col.int,
      tool_failures: col.int,
      has_checkpoint: col.bool,
    }),
    `select s.id, s.learner_id, s.channel, s.provider, s.status, s.memory_mode, s.language, s.started_at, s.ended_at, s.end_reason,
            tc.tool_calls, tc.tool_failures,
            (s.checkpoint is not null) as has_checkpoint
       from learning_sessions s
       left join lateral (
         select count(*)::int as tool_calls, count(*) filter (where t.status = 'failed')::int as tool_failures
           from tool_invocations t where t.session_id = s.id
       ) tc on true
      where ($1::uuid is null or s.learner_id = $1::uuid)
      order by s.started_at desc
      limit $2`,
    [opts.learnerId ?? null, opts.limit ?? 100],
  );
  return rows.map((r) => ({
    id: r.id,
    learnerShortId: shortId(r.learner_id),
    learnerId: r.learner_id,
    channel: r.channel,
    provider: r.provider,
    status: r.status,
    memoryMode: r.memory_mode,
    language: r.language,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endReason: r.end_reason,
    toolCalls: r.tool_calls,
    toolFailures: r.tool_failures,
    hasCheckpoint: r.has_checkpoint,
  }));
}

export interface StaffTraceRow {
  id: string;
  tool: string;
  channel: string;
  status: string;
  latencyMs: number | null;
  errorCode: string | null;
  argSummary: unknown;
  replays: number;
  sessionId: string | null;
  at: Date;
}

export async function staffTraces(
  db: Queryable,
  opts: { status?: string; limit?: number } = {},
): Promise<StaffTraceRow[]> {
  const rows = await many(
    db,
    z.object({
      id: col.uuid,
      tool_name: col.text,
      channel: col.text,
      status: col.text,
      latency_ms: col.nullableInt,
      error_code: col.nullableText,
      request_summary: col.json,
      replay_count: col.int,
      session_id: z.string().uuid().nullable(),
      created_at: col.date,
    }),
    `select id, tool_name, channel, status, latency_ms, error_code, request_summary, replay_count, session_id, created_at
       from tool_invocations
      where ($1::text is null or status = $1::text)
      order by created_at desc
      limit $2`,
    [opts.status ?? null, opts.limit ?? 200],
  );
  return rows.map((r) => ({
    id: r.id,
    tool: r.tool_name,
    channel: r.channel,
    status: r.status,
    latencyMs: r.latency_ms,
    errorCode: r.error_code,
    argSummary: r.request_summary,
    replays: r.replay_count,
    sessionId: r.session_id,
    at: r.created_at,
  }));
}
