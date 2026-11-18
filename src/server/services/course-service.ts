import type { Concept, Exercise, Lesson } from "@/content/schema";
import { DomainError } from "../errors";
import type { Queryable } from "../db/types";
import { coursesRepo, type StoredCourse } from "../repositories/courses";

/**
 * CourseRetrievalService — fetches authoritative, structured course knowledge.
 * Course content changes only through the seed/migration process, so it is
 * cached in memory briefly to avoid a database round-trip per tool call.
 */

const CACHE_TTL_MS = 60_000;
let cache: { at: number; courses: StoredCourse[] } | null = null;

export function clearCourseCache(): void {
  cache = null;
}

async function allCourses(db: Queryable): Promise<StoredCourse[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.courses;
  const courses = await coursesRepo.listWithLessons(db, { availableOnly: false });
  cache = { at: Date.now(), courses };
  return courses;
}

export function isLearnerVisible(course: StoredCourse): boolean {
  return course.status === "published" || course.status === "reviewed";
}

export const courseService = {
  async listAvailable(db: Queryable): Promise<StoredCourse[]> {
    return (await allCourses(db)).filter(isLearnerVisible);
  },

  async listAll(db: Queryable): Promise<StoredCourse[]> {
    return allCourses(db);
  },

  async getAvailable(db: Queryable, courseId: string): Promise<StoredCourse> {
    const course = (await allCourses(db)).find((c) => c.id === courseId);
    if (!course || !isLearnerVisible(course)) throw new DomainError("NOT_FOUND", "That course is not available.");
    return course;
  },

  async findCourseForLesson(db: Queryable, lessonId: string): Promise<{ course: StoredCourse; lesson: Lesson } | null> {
    for (const course of await allCourses(db)) {
      const lesson = course.lessons.find((l) => l.id === lessonId);
      if (lesson) return { course, lesson };
    }
    return null;
  },
};

export function findLesson(course: StoredCourse, lessonId: string): Lesson {
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new DomainError("NOT_FOUND", "That lesson is not part of this course.");
  return lesson;
}

export function findConcept(lesson: Lesson, conceptId: string): Concept {
  const concept = lesson.concepts.find((c) => c.id === conceptId);
  if (!concept) throw new DomainError("NOT_FOUND", "That concept is not part of this lesson.");
  return concept;
}

export function findExercise(course: StoredCourse, exerciseId: string): { lesson: Lesson; exercise: Exercise } {
  for (const lesson of course.lessons) {
    const exercise = lesson.practice.find((p) => p.id === exerciseId);
    if (exercise) return { lesson, exercise };
  }
  throw new DomainError("NOT_FOUND", "That practice question is not part of this course.");
}

export function exerciseForConcept(lesson: Lesson, conceptId: string, skip: readonly string[] = []): Exercise | null {
  const options = lesson.practice.filter((p) => p.conceptId === conceptId && p.purpose === "practice");
  return options.find((p) => !skip.includes(p.id)) ?? options[0] ?? null;
}

export function totalConcepts(course: StoredCourse): number {
  return course.lessons.reduce((n, l) => n + l.concepts.length, 0);
}
