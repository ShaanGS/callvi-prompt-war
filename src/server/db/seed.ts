import type { Queryable } from "./types";
import { COURSE_CATALOGUE } from "@/content/courses";
import { coursesRepo } from "../repositories/courses";

/** Upsert the validated course catalogue into courses / course_lessons. */
export async function seedCourses(db: Queryable): Promise<number> {
  for (const course of COURSE_CATALOGUE) {
    await coursesRepo.upsert(db, course);
  }
  return COURSE_CATALOGUE.length;
}
