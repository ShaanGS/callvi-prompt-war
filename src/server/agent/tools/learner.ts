import { z } from "zod";
import { DomainError } from "../../errors";
import { sessionSourceFor } from "../../domain/types";
import { sessionsRepo } from "../../repositories/sessions";
import { recordEvent } from "../../services/events";
import { learnerService } from "../../services/learner-service";
import { learningService } from "../../services/learning-service";
import { sessionService } from "../../services/session-service";
import { buildLearningContext } from "../context-builder";
import { NOT_SAVED_SESSION_ONLY } from "../tool-guidance";
import { defineTool, learnerConfirmed } from "../tool-types";

/** Who the learner is: their context at the start of a call, their memory consent and their goal. */

export const getLearningContext = defineTool({
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

export const setMemoryConsent = defineTool({
  name: "set_memory_consent",
  kind: "write",
  description:
    "Record the learner's decision about saving learning progress between sessions. Only call after explaining what is saved and hearing a clear yes or no. Declining is fine; learning continues for this session only.",
  input: z.object({ decision: z.enum(["granted", "declined"]), learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    if (ctx.channel === "phone" && !ctx.learner.callerIdKnown && input.decision === "granted") {
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

export const setLearningGoal = defineTool({
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
