import type { LanguageCode } from "@/lib/languages";
import { DomainError } from "../../errors";
import { memoryModeFor, type MasteryState } from "../../domain/types";
import { enrollmentsRepo } from "../../repositories/learning";
import { courseService } from "../../services/course-service";
import { learningService, snapshotFromSession, type ProgressSnapshot } from "../../services/learning-service";
import type { ToolContext } from "../tool-types";

/** Helpers every teaching tool shares: the learner's progress, the current course and enrollment, and bilingual text. */

export async function snapshotFor(ctx: ToolContext): Promise<ProgressSnapshot> {
  const durable = ctx.session.memoryMode === "durable" && memoryModeFor(ctx.learner) === "durable";
  if (durable && ctx.session.state.enrollmentId)
    return learningService.progress(ctx.db, ctx.session.state.enrollmentId);
  return snapshotFromSession(ctx.session.state);
}

export async function requireCourse(ctx: ToolContext) {
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

export async function currentEnrollment(ctx: ToolContext) {
  const durable = ctx.session.memoryMode === "durable" && memoryModeFor(ctx.learner) === "durable";
  if (!durable || !ctx.session.state.enrollmentId) return null;
  const enrollment = await enrollmentsRepo.findById(ctx.db, ctx.session.state.enrollmentId);
  return enrollment && enrollment.learnerId === ctx.learner.id ? enrollment : null;
}

export function definedMastery(map: Record<string, MasteryState | undefined>): Record<string, MasteryState> {
  const out: Record<string, MasteryState> = {};
  for (const [k, v] of Object.entries(map)) if (v !== undefined) out[k] = v;
  return out;
}

export function title(text: { "ta-IN": string; "en-IN": string }, language: LanguageCode): string {
  return text[language];
}

export type Enrollment = NonNullable<Awaited<ReturnType<typeof currentEnrollment>>>;
