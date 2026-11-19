import { z } from "zod";
import { canonicalJson, sha256Hex } from "../../security/crypto";
import { redactText } from "../../security/redact";
import { sessionsRepo } from "../../repositories/sessions";
import { sessionService } from "../../services/session-service";
import { defineTool } from "../tool-types";

/** Ending well: checkpoints and closing a learning session. */

export const saveCheckpoint = defineTool({
  name: "save_checkpoint",
  kind: "write",
  idempotency: "internal",
  description:
    "Save where the learner is (course, lesson, idea, practice done, next step) when pausing, changing lesson, or when the learner asks to save. The summary is generated from session state. Optionally pass a short note of what the learner found difficult, in their words, without personal details.",
  input: z.object({ learner_difficulty: z.string().trim().max(200).nullish() }),
  async handler(ctx, input) {
    const difficulty = input.learner_difficulty ? redactText(input.learner_difficulty).slice(0, 200) : null;
    // Build from the latest persisted state, never from a possibly stale copy.
    ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
    if (difficulty !== null) {
      ctx.session = await sessionService.mutateState(ctx.db, ctx.session, (s) => ({
        ...s,
        learnerNotedDifficulty: difficulty,
      }));
    }
    const { data } = await sessionService.buildCheckpoint(ctx.db, ctx.session, difficulty);
    // Same checkpoint content in the same session => same key => no duplicate.
    const key = `checkpoint:${ctx.session.id}:${sha256Hex(canonicalJson(data))}`;
    const result = await sessionService.saveCheckpoint(ctx.db, {
      session: ctx.session,
      learner: ctx.learner,
      idempotencyKey: key,
      unresolvedDifficulty: difficulty,
    });
    ctx.session = (await sessionsRepo.findById(ctx.db, ctx.session.id)) ?? ctx.session;
    return {
      saved: result.saved,
      data: { summary: result.summary, next_action: result.data.nextAction, already_saved: result.replayed },
      guidance: result.saved
        ? "Checkpoint saved. You may tell the learner their place is saved."
        : "Nothing was saved, because the learner chose not to save progress. Do not say their place is saved.",
    };
  },
});

export const closeLearningSession = defineTool({
  name: "close_learning_session",
  kind: "write",
  idempotency: "session",
  lifecycle: "on_end",
  allowOnClosedSession: true,
  description:
    "Finish the session: saves a final checkpoint when the learner has granted memory and marks the session closed. Safe to call more than once.",
  input: z.object({
    reason: z.enum(["learner_ended", "provider_ended", "paused", "interrupted"]).default("provider_ended"),
  }),
  async handler(ctx, input) {
    const result = await sessionService.close(ctx.db, {
      session: ctx.session,
      learner: ctx.learner,
      reason: input.reason,
      idempotencyKey: `close:${ctx.session.id}`,
    });
    ctx.session = result.session;
    return {
      saved: result.saved,
      data: { closed: true, already_closed: result.alreadyClosed, summary: result.summary },
      guidance: `${result.saved ? "Session closed and progress saved." : "Session closed. No progress was saved."} If speaking, give one short goodbye and end_call. Do not ask another question or offer more help after the learner asked to finish.`,
    };
  },
});
