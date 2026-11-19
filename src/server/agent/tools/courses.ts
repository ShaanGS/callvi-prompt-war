import { z } from "zod";
import { DomainError } from "../../errors";
import { courseService } from "../../services/course-service";
import { learningService, snapshotFromSession } from "../../services/learning-service";
import { recommendCourses } from "../../services/recommendation-service";
import { sessionService } from "../../services/session-service";
import { NOT_SAVED_SESSION_ONLY } from "../tool-guidance";
import { firstOpenConcept, frontierLesson } from "../learning-policy";
import { contextLanguage, defineTool, learnerConfirmed, slugSchema } from "../tool-types";
import { title } from "./shared";

/** Choosing what to learn: recommending courses and starting or resuming one. */

export const listCourses = defineTool({
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

export const startOrResumeCourse = defineTool({
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
