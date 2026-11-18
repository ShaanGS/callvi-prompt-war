import { z } from "zod";
import { col, exec, jsonParam, many, type Queryable } from "../db/types";
import {
  conceptSchema,
  courseStatusSchema,
  exerciseSchema,
  localizedSchema,
  localizedTermsSchema,
  reviewStatusSchema,
  type Course,
  type Lesson,
} from "@/content/schema";
import { languageSchema } from "../domain/types";

const courseRow = z.object({
  id: z.string(),
  sort_order: col.int,
  title: localizedSchema,
  summary: localizedSchema,
  description: localizedSchema,
  audience: localizedSchema,
  outcomes: z.array(localizedSchema),
  recommendation_terms: localizedTermsSchema,
  languages: z.array(languageSchema),
  primary_language: languageSchema,
  level: z.enum(["beginner", "intermediate"]),
  status: courseStatusSchema,
  content_review_status: reviewStatusSchema,
  content_review_note: localizedSchema,
  estimated_minutes: col.int,
  content_version: col.int,
  updated_at: col.date,
});

const lessonRow = z.object({
  id: z.string(),
  course_id: z.string(),
  sequence: col.int,
  title: localizedSchema,
  objective: localizedSchema,
  concepts: z.array(conceptSchema),
  practice: z.array(exerciseSchema),
  real_world_action: localizedSchema,
  mentor_review_status: reviewStatusSchema,
  review_flags: z.array(localizedSchema),
  estimated_minutes: col.int,
});

export interface StoredCourse extends Course {
  contentVersion: number;
  updatedAt: Date;
}

function toLesson(r: z.infer<typeof lessonRow>): Lesson {
  return {
    id: r.id,
    sequence: r.sequence,
    title: r.title,
    objective: r.objective,
    estimatedMinutes: r.estimated_minutes,
    concepts: r.concepts,
    practice: r.practice,
    realWorldAction: r.real_world_action,
    reviewStatus: r.mentor_review_status,
    reviewFlags: r.review_flags,
  };
}

function toCourse(r: z.infer<typeof courseRow>, lessons: Lesson[]): StoredCourse {
  return {
    id: r.id,
    sortOrder: r.sort_order,
    title: r.title,
    summary: r.summary,
    description: r.description,
    audience: r.audience,
    outcomes: r.outcomes,
    languages: r.languages,
    primaryLanguage: r.primary_language,
    level: r.level,
    status: r.status,
    contentReview: { status: r.content_review_status, note: r.content_review_note },
    estimatedMinutes: r.estimated_minutes,
    recommendationTerms: r.recommendation_terms,
    lessons,
    contentVersion: r.content_version,
    updatedAt: r.updated_at,
  };
}

const COURSE_COLUMNS = `id, sort_order, title, summary, description, audience, outcomes, recommendation_terms, languages,
  primary_language, level, status, content_review_status, content_review_note, estimated_minutes, content_version, updated_at`;
const LESSON_COLUMNS = `id, course_id, sequence, title, objective, concepts, practice, real_world_action,
  mentor_review_status, review_flags, estimated_minutes`;

export const coursesRepo = {
  /** All courses with lessons. `availableOnly` limits to learner-visible statuses. */
  async listWithLessons(db: Queryable, opts: { availableOnly: boolean }): Promise<StoredCourse[]> {
    const courses = await many(
      db,
      courseRow,
      `select ${COURSE_COLUMNS} from courses
       ${opts.availableOnly ? "where status in ('published', 'reviewed')" : ""}
       order by sort_order, id`,
    );
    if (courses.length === 0) return [];
    const lessons = await many(
      db,
      lessonRow,
      `select ${LESSON_COLUMNS} from course_lessons where course_id = any($1::text[]) order by course_id, sequence`,
      [courses.map((c) => c.id)],
    );
    return courses.map((c) =>
      toCourse(
        c,
        lessons.filter((l) => l.course_id === c.id).map(toLesson),
      ),
    );
  },

  async findWithLessons(db: Queryable, courseId: string): Promise<StoredCourse | null> {
    const rows = await many(db, courseRow, `select ${COURSE_COLUMNS} from courses where id = $1`, [courseId]);
    if (rows.length === 0) return null;
    const lessons = await many(
      db,
      lessonRow,
      `select ${LESSON_COLUMNS} from course_lessons where course_id = $1 order by sequence`,
      [courseId],
    );
    return toCourse(rows[0], lessons.map(toLesson));
  },

  async findCourseIdForLesson(db: Queryable, lessonId: string): Promise<string | null> {
    const rows = await many(db, z.object({ course_id: z.string() }), `select course_id from course_lessons where id = $1`, [lessonId]);
    return rows[0]?.course_id ?? null;
  },

  /**
   * Upsert authoritative course content from the validated catalogue.
   * Content version increments only when the stored content actually changes.
   */
  async upsert(db: Queryable, course: Course): Promise<void> {
    await exec(
      db,
      `insert into courses (id, sort_order, title, summary, description, audience, outcomes, recommendation_terms,
         languages, primary_language, level, status, content_review_status, content_review_note, estimated_minutes)
       values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::text[], $10, $11, $12, $13, $14::jsonb, $15)
       on conflict (id) do update set
         sort_order = excluded.sort_order, title = excluded.title, summary = excluded.summary,
         description = excluded.description, audience = excluded.audience, outcomes = excluded.outcomes,
         recommendation_terms = excluded.recommendation_terms, languages = excluded.languages,
         primary_language = excluded.primary_language, level = excluded.level, status = excluded.status,
         content_review_status = excluded.content_review_status, content_review_note = excluded.content_review_note,
         estimated_minutes = excluded.estimated_minutes,
         content_version = courses.content_version + case when
           (courses.title, courses.summary, courses.description, courses.outcomes, courses.status, courses.content_review_status)
           is distinct from
           (excluded.title, excluded.summary, excluded.description, excluded.outcomes, excluded.status, excluded.content_review_status)
           then 1 else 0 end`,
      [
        course.id,
        course.sortOrder,
        jsonParam(course.title),
        jsonParam(course.summary),
        jsonParam(course.description),
        jsonParam(course.audience),
        jsonParam(course.outcomes),
        jsonParam(course.recommendationTerms),
        course.languages,
        course.primaryLanguage,
        course.level,
        course.status,
        course.contentReview.status,
        jsonParam(course.contentReview.note),
        course.estimatedMinutes,
      ],
    );
    for (const lesson of course.lessons) {
      await exec(
        db,
        `insert into course_lessons (id, course_id, sequence, title, objective, concepts, practice, real_world_action,
           mentor_review_status, review_flags, estimated_minutes)
         values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11)
         on conflict (id) do update set
           course_id = excluded.course_id, sequence = excluded.sequence, title = excluded.title,
           objective = excluded.objective, concepts = excluded.concepts, practice = excluded.practice,
           real_world_action = excluded.real_world_action, mentor_review_status = excluded.mentor_review_status,
           review_flags = excluded.review_flags, estimated_minutes = excluded.estimated_minutes,
           content_version = course_lessons.content_version + case when
             (course_lessons.concepts, course_lessons.practice) is distinct from (excluded.concepts, excluded.practice)
             then 1 else 0 end`,
        [
          lesson.id,
          course.id,
          lesson.sequence,
          jsonParam(lesson.title),
          jsonParam(lesson.objective),
          jsonParam(lesson.concepts),
          jsonParam(lesson.practice),
          jsonParam(lesson.realWorldAction),
          lesson.reviewStatus,
          jsonParam(lesson.reviewFlags),
          lesson.estimatedMinutes,
        ],
      );
    }
  },
};
