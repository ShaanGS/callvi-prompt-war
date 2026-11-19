import "server-only";
import { z } from "zod";
import { getConfig } from "../../config/env";
import type { Db } from "../../db/types";
import type { Learner } from "../../domain/types";
import { DomainError } from "../../errors";
import { TOOL_NAMES } from "../../agent/tool-types";
import { rateLimit } from "../../security/rate-limit";
import { sessionService } from "../../services/session-service";
import { buildLearningContext } from "../../agent/context-builder";

const signedUrlSchema = z.object({ signed_url: z.url().refine((value) => new URL(value).protocol === "wss:") });

/** A fresh, short-lived provider connection for the learner's own open session. */
export async function elevenLabsConnection(db: Db, learner: Learner, sessionId: string) {
  const session = await sessionService.getOwned(db, sessionId, learner.id);
  sessionService.requireOpen(session);
  if (session.channel !== "browser" || session.provider !== "elevenlabs") {
    throw new DomainError("FORBIDDEN", "This session does not use this voice provider.");
  }
  const config = getConfig().elevenlabs;
  if (!config.apiKey || !config.agentId)
    throw new DomainError("NOT_CONFIGURED", "Voice learning is not configured yet.");
  rateLimit(`elevenlabs-connection:${learner.id}`, 8, 60_000);
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
  url.searchParams.set("agent_id", config.agentId);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "xi-api-key": config.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DomainError("PROVIDER_UNAVAILABLE", "The voice service could not be reached. Please try again.");
  }
  if (!response.ok) {
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      response.status === 401 || response.status === 403
        ? "The voice service rejected its server credentials. Please contact the team."
        : "The voice service is unavailable. Please try again.",
    );
  }
  const parsed = signedUrlSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success)
    throw new DomainError("PROVIDER_UNAVAILABLE", "The voice service returned an invalid connection.");
  const tamil = session.language === "ta-IN";
  const context = await buildLearningContext(db, learner, session);
  const greeting =
    learner.consentStatus === "pending"
      ? tamil
        ? "வணக்கம்! நான் கால்வி, உங்க AI துணை. சின்ன business, digital வேலைகள், customer-கிட்ட பேசுறது—இதை நாம சேர்ந்து பழகலாம். தமிழ்லயோ English-லயோ பேசலாம். இன்னிக்கு உங்களுக்கு என்ன உதவி வேணும்?"
        : "Hi! I'm Callvi, your AI companion for practical skills, small business and everyday confidence. We can speak Tamil or English. What would you like help with today?"
      : tamil
        ? "வணக்கம்! நான் கால்வி, உங்க AI துணை. திரும்ப பேசுறதுல சந்தோஷம். இன்னிக்கு உங்களுக்கு என்ன உதவி வேணும்?"
        : "Hi, it's Callvi, your AI companion. Good to talk again. What would you like help with today?";
  return {
    signedUrl: parsed.data.signed_url,
    language: tamil ? ("ta" as const) : ("en" as const),
    toolNames: [...TOOL_NAMES],
    dynamicVariables: {
      learner_language: tamil ? "Tamil" : "English",
      greeting,
      call_context: JSON.stringify({
        consent_status: learner.consentStatus,
        memory_mode: session.memoryMode,
        active_goal: context.active_goal,
        active_course: context.active_course,
        progress: context.progress,
        learning_evidence: context.learning_evidence,
        review_suggestion: context.review_suggestion,
        last_session_summary: context.last_session_summary,
        learning_ready: session.state.learningReady,
      }),
    },
  };
}
