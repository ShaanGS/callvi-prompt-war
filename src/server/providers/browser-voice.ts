import "server-only";
import type { BrowserVoiceConfig } from "@/lib/voice/config";
import type { Db } from "../db/types";
import type { Learner, LearningSession } from "../domain/types";
import { isSessionOpen } from "../domain/types";
import { getConfig } from "../config/env";
import { DomainError } from "../errors";
import { rateLimit } from "../security/rate-limit";
import { sessionService } from "../services/session-service";
import { courseService } from "../services/course-service";
import { browserSessionConfig, sarvamProvider } from "./sarvam/sarvam-provider";

export function browserVoiceConfig(learner: Learner, session: LearningSession): BrowserVoiceConfig {
  if (session.learnerId !== learner.id || session.channel !== "browser" || !isSessionOpen(session)) {
    throw new DomainError("FORBIDDEN", "This voice session is not available.");
  }
  if (session.provider === "elevenlabs") {
    return { provider: "elevenlabs", sessionId: session.id, language: session.language === "ta-IN" ? "ta" : "en" };
  }
  return browserSessionConfig(learner, session).sdk;
}

export async function createBrowserVoiceSession(db: Db, learner: Learner, courseId: string | null) {
  if (getConfig().browserVoiceProvider === "sarvam") return sarvamProvider.createBrowserSession(db, learner, { courseId });
  const config = getConfig().elevenlabs;
  if (!config.apiKey || !config.agentId) throw new DomainError("NOT_CONFIGURED", "Voice learning is not configured yet.");
  rateLimit(`voice-session:${learner.id}`, 6, 60_000);
  if (courseId) await courseService.getAvailable(db, courseId);
  const session = await sessionService.start(db, { learner, channel: "browser", provider: "elevenlabs", courseId });
  return { sessionId: session.id, sdk: browserVoiceConfig(learner, session) };
}
