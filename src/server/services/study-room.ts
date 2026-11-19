import type { Db } from "../db/types";
import { DomainError } from "../errors";
import type { Channel, Learner } from "../domain/types";
import { runTool, type ToolResponse } from "../agent/orchestrator";
import { isToolName, type ToolName } from "../agent/tool-types";
import { courseService } from "./course-service";
import { sessionService } from "./session-service";
import { learnerService } from "./learner-service";
import { sessionView, type SessionView } from "./views";

/**
 * The learner's own web session surface. A signed-in learner can drive their
 * session directly from the browser through the same orchestrator and tools
 * the voice agent uses — never a separate code path.
 *
 * Text sessions are the learner's typed study room: lesson, alternate
 * explanation, practice and checkpoint are all real tool calls. In browser
 * voice sessions the voice agent drives the lesson; the page may only read
 * context and end the session.
 */
const LEARNER_TOOLS: Partial<Record<Channel, readonly ToolName[]>> = {
  text: [
    "get_learning_context",
    "start_or_resume_course",
    "get_lesson_context",
    "record_practice_attempt",
    "save_checkpoint",
    "close_learning_session",
  ],
  browser: ["get_learning_context", "close_learning_session"],
};

export function learnerMayCall(channel: Channel, tool: string, provider?: string): boolean {
  // ElevenLabs dispatches tools through the authenticated browser, allowing
  // localhost and deployed sites to use their own database without webhooks.
  if (channel === "browser" && provider === "elevenlabs") return isToolName(tool);
  return (LEARNER_TOOLS[channel] ?? []).some((t) => t === tool);
}

export const studyRoom = {
  async startTextSession(db: Db, learner: Learner, courseId: string | null): Promise<SessionView> {
    if (learner.consentStatus === "pending")
      throw new DomainError("CONSENT_REQUIRED", "Please choose a memory setting first.");
    if (courseId) await courseService.getAvailable(db, courseId);
    const session = await sessionService.start(db, { learner, channel: "text", provider: "none", courseId });
    return sessionView(db, learner, session);
  },

  async view(db: Db, learner: Learner, sessionId: string): Promise<SessionView> {
    const session = await sessionService.getOwned(db, sessionId, learner.id);
    return sessionView(db, learner, session);
  },

  async callTool(
    db: Db,
    learner: Learner,
    input: { sessionId: string; tool: string; args: unknown; idempotencyKey: string | null },
  ): Promise<{ response: ToolResponse; view: SessionView | null }> {
    const session = await sessionService.getOwned(db, input.sessionId, learner.id);
    if (!learnerMayCall(session.channel, input.tool, session.provider)) {
      throw new DomainError("FORBIDDEN", "That action is not available in this session.");
    }
    const result = await runTool({
      db,
      channel: session.channel,
      learner,
      session,
      toolName: input.tool,
      rawInput: input.args,
      interactionId: null,
      idempotencyKey: input.idempotencyKey,
    });
    if (
      session.provider === "elevenlabs" &&
      input.tool === "start_or_resume_course" &&
      result.response.ok &&
      result.learner
    ) {
      await learnerService.completeOnboarding(db, result.learner.id);
    }
    const view = result.session && result.learner ? await sessionView(db, result.learner, result.session) : null;
    return { response: result.response, view };
  },
};
