import { z } from "zod";
import { isLanguageCode } from "@/lib/languages";
import { DomainError } from "../../errors";
import { memoryModeFor, sessionSourceFor } from "../../domain/types";
import { sessionsRepo } from "../../repositories/sessions";
import { deletionService } from "../../services/deletion-service";
import { recordEvent } from "../../services/events";
import { learnerService } from "../../services/learner-service";
import { memoryService } from "../../services/memory-service";
import { sessionService } from "../../services/session-service";
import { buildLearningContext } from "../context-builder";
import { NOT_SAVED_SESSION_ONLY } from "../tool-guidance";
import { isConceptDone } from "../learning-policy";
import { contextLanguage, defineTool, learnerConfirmed } from "../tool-types";

/** What is remembered: the learner's view of their memory, their preferences, and deletion on request. */

export const getMemorySummary = defineTool({
  name: "get_memory_summary",
  kind: "read",
  description:
    "Tell the learner exactly what is saved about them: memory setting, goal, courses and progress, preferences and last checkpoint, with where each came from. Use when the learner asks what you remember.",
  input: z.object({}),
  async handler(ctx) {
    const language = contextLanguage(ctx);
    const summary = await memoryService.getSummary(ctx.db, ctx.learner, language);
    const learning = await buildLearningContext(ctx.db, ctx.learner, ctx.session);
    await recordEvent(ctx.db, "memory.retrieved", {
      learnerId: ctx.learner.id,
      sessionId: ctx.session.id,
      channel: ctx.channel,
    });
    return {
      data: {
        memory_mode: summary.memoryMode,
        consent_status: summary.consentStatus,
        display_name: summary.profile.displayName,
        preferred_language: summary.profile.preferredLanguage,
        goal: summary.activeGoal
          ? {
              text: summary.activeGoal.text,
              saved_from: summary.activeGoal.source,
              updated_at: summary.activeGoal.updatedAt.toISOString(),
            }
          : null,
        courses: summary.enrollments.map((e) => ({
          title: e.courseTitle,
          status: e.status,
          current_lesson: e.currentLessonTitle,
          done: e.mastery.filter((m) => isConceptDone(m.state)).map((m) => m.conceptTitle),
          needs_practice: e.mastery
            .filter((m) => m.state === "needs_practice" || m.state === "practising")
            .map((m) => m.conceptTitle),
        })),
        preferences: summary.preferences.map((p) => ({
          key: p.key,
          value: p.value,
          saved_from: p.source,
          updated_at: p.updatedAt.toISOString(),
        })),
        last_checkpoint: summary.lastCheckpoint?.summary ?? null,
        learning_evidence: learning.learning_evidence,
        review_suggestion: learning.review_suggestion,
      },
      guidance:
        summary.memoryMode === "durable"
          ? "Tell the learner plainly what is saved. Offer to correct anything (update_memory_preference) or delete it (request_data_deletion)."
          : "Tell the learner nothing is saved between sessions because they chose session-only learning.",
    };
  },
});

export const updateMemoryPreference = defineTool({
  name: "update_memory_preference",
  kind: "write",
  description:
    "Correct or set something the learner explicitly asked to change: preferred_language ('ta-IN' or 'en-IN'), explanation_style ('examples', 'step_by_step', 'short', 'no_preference'), pace ('slower', 'normal'), display_name, or goal_text. Only after the learner confirmed the change.",
  input: z.object({
    key: z.enum(["preferred_language", "explanation_style", "pace", "display_name", "goal_text"]),
    value: z.string().trim().min(1).max(500),
    learner_confirmed: learnerConfirmed,
  }),
  async handler(ctx, input) {
    const durable = memoryModeFor(ctx.learner) === "durable";
    const provenance = { source: sessionSourceFor(ctx.channel), sourceSessionId: ctx.session.id };
    let saved = false;
    switch (input.key) {
      case "preferred_language": {
        const value = input.value === "Tamil" ? "ta-IN" : input.value === "English" ? "en-IN" : input.value;
        if (!isLanguageCode(value))
          throw new DomainError("VALIDATION", "Only Tamil (ta-IN) and English (en-IN) are supported.");
        await sessionsRepo.setLanguage(ctx.db, ctx.session.id, value);
        if (durable) {
          ctx.learner = await learnerService.updateProfile(ctx.db, ctx.learner.id, { preferredLanguage: value });
          saved = true;
        }
        ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
        break;
      }
      case "explanation_style":
      case "pace": {
        const key = input.key;
        const res = await memoryService.setPreference(ctx.db, ctx.learner, key, input.value, provenance);
        saved = res.saved;
        ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
          ...s,
          preferences: { ...s.preferences, [key]: input.value },
        }));
        break;
      }
      case "display_name": {
        if (durable) {
          ctx.learner = await learnerService.updateProfile(ctx.db, ctx.learner.id, {
            displayName: input.value.slice(0, 80),
          });
          saved = true;
        }
        break;
      }
      case "goal_text": {
        const res = await memoryService.correctGoal(ctx.db, ctx.learner, input.value, provenance);
        saved = res.saved;
        ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
          ...s,
          goal: { id: res.goalId ?? s.goal?.id ?? null, text: input.value.trim() },
        }));
        break;
      }
    }
    return {
      saved,
      data: { key: input.key, updated: true },
      guidance: saved
        ? "Updated and saved. Confirm the change briefly."
        : `Updated for this session. ${NOT_SAVED_SESSION_ONLY}`,
    };
  },
});

export const requestDataDeletion = defineTool({
  name: "request_data_deletion",
  kind: "write",
  description:
    "Delete the learner's saved data after they clearly confirmed. scope='learning_memory' erases goals, courses, progress and preferences and stops saving; scope='account' deletes everything about the learner. Tell the learner what will be deleted before calling.",
  input: z.object({ scope: z.enum(["learning_memory", "account"]), learner_confirmed: learnerConfirmed }),
  async handler(ctx, input) {
    const channel = ctx.channel === "text" ? "text" : ctx.channel === "phone" ? "phone" : "browser";
    if (input.scope === "learning_memory") {
      ctx.learner = await learnerService.revokeConsent(ctx.db, ctx.learner.id, channel);
      ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
      return {
        saved: true,
        data: { deleted: true, scope: input.scope, memory_mode: "session_only" },
        guidance: "Learning memory deleted and saving stopped. Learning can continue for this session only.",
      };
    }
    await deletionService.deleteAccount(ctx.db, ctx.learner.id, channel);
    ctx.learnerDeleted = true;
    return {
      saved: true,
      data: { deleted: true, scope: input.scope },
      guidance: "All of the learner's data has been deleted. Confirm this briefly and end the session.",
    };
  },
});
