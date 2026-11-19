import "server-only";
import { z } from "zod";
import { SARVAM_LANGUAGE_NAME } from "@/lib/languages";
import { getConfig } from "../../config/env";
import { getChannelReadiness } from "../../config/channels";
import type { Db } from "../../db/types";
import { DomainError } from "../../errors";
import { isSessionOpen, type Learner, type LearningSession } from "../../domain/types";
import { log } from "../../observability/log";
import { rateLimit } from "../../security/rate-limit";
import { issueVoiceToken } from "../../security/voice-token";
import { sessionService } from "../../services/session-service";
import type { BrowserVoiceSessionConfig, VoiceSessionProvider } from "../interfaces";

/** Voice tokens outlive the provider's maximum call length (60 minutes) with margin. */
export const VOICE_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/** Same-origin path the browser SDK uses as `baseUrl`. Must end with "/". */
export const SARVAM_PROXY_BASE_PATH = "/api/voice/sarvam/";

const signedUrlResponseSchema = z.object({ url: z.string().url(), reference_id: z.string().min(1) });

/**
 * SDK configuration for an existing, open browser session owned by the
 * learner (used when the live room is opened or refreshed). Issues a fresh
 * signed voice token bound to that session.
 */
export function browserSessionConfig(learner: Learner, session: LearningSession): BrowserVoiceSessionConfig {
  const config = getConfig();
  const s = config.sarvam;
  if (!s.orgId || !s.workspaceId || !s.webAppId || !s.apiKey)
    throw new DomainError("NOT_CONFIGURED", "Voice sessions are not configured yet.");
  if (session.learnerId !== learner.id || session.channel !== "browser" || !isSessionOpen(session)) {
    throw new DomainError("FORBIDDEN", "This session cannot be joined by voice.");
  }
  return {
    sessionId: session.id,
    sdk: {
      org_id: s.orgId,
      workspace_id: s.workspaceId,
      app_id: s.webAppId,
      ...(s.webAppVersion ? { version: s.webAppVersion } : {}),
      user_identifier: issueVoiceToken(config.signingSecret, session.id, VOICE_TOKEN_TTL_SECONDS),
      user_identifier_type: "custom",
      initial_language_name: SARVAM_LANGUAGE_NAME[session.language],
      proxy_base_url: SARVAM_PROXY_BASE_PATH,
    },
  };
}

/**
 * Sarvam Voice Agents adapter.
 *
 * Verified against the official TypeScript SDK (sarvam-conv-ai-sdk 0.0.42):
 * `ConversationAgent.start()` performs
 *   GET {baseUrl}orgs/{org_id}/workspaces/{workspace_id}/apps/{app_id}/url
 *       ?interaction_type=...&version=...
 * with header `X-API-Key`, and expects JSON `{ url, reference_id }`. The
 * returned URL is a single-use signed WebSocket URL; the browser connects to
 * it directly. Our proxy injects the API key server-side, so the browser is
 * constructed with `apiKey: ""` and `baseUrl` pointing at this app.
 */
export const sarvamProvider: VoiceSessionProvider = {
  name: "sarvam",

  async createBrowserSession(
    db: Db,
    learner: Learner,
    opts: { courseId: string | null },
  ): Promise<BrowserVoiceSessionConfig> {
    const config = getConfig();
    const readiness = getChannelReadiness(config).browserVoice;
    if (!readiness.available) {
      throw new DomainError("NOT_CONFIGURED", "Voice sessions are not configured yet.", { missing: readiness.missing });
    }
    const s = config.sarvam;
    if (!s.orgId || !s.workspaceId || !s.webAppId)
      throw new DomainError("NOT_CONFIGURED", "Voice sessions are not configured yet.");
    rateLimit(`voice-session:${learner.id}`, 6, 60_000);

    const session = await sessionService.start(db, {
      learner,
      channel: "browser",
      provider: "sarvam",
      courseId: opts.courseId,
    });
    return browserSessionConfig(learner, session);
  },

  async proxySignedUrl(
    request: Request,
    params: { orgId: string; workspaceId: string; appId: string },
  ): Promise<Response> {
    const config = getConfig();
    const s = config.sarvam;
    if (!s.apiKey || !s.orgId || !s.workspaceId || !s.webAppId) {
      throw new DomainError("NOT_CONFIGURED", "Voice sessions are not configured yet.");
    }
    // Only our own browser agent may be reached through our key.
    if (params.orgId !== s.orgId || params.workspaceId !== s.workspaceId || params.appId !== s.webAppId) {
      throw new DomainError("FORBIDDEN", "This voice agent is not available.");
    }
    const incoming = new URL(request.url);
    const upstream = new URL(
      `${s.apiBaseUrl}orgs/${encodeURIComponent(s.orgId)}/workspaces/${encodeURIComponent(s.workspaceId)}/apps/${encodeURIComponent(s.webAppId)}/url`,
    );
    const interactionType = incoming.searchParams.get("interaction_type");
    if (interactionType) upstream.searchParams.set("interaction_type", interactionType);
    const version = s.webAppVersion ? String(s.webAppVersion) : incoming.searchParams.get("version");
    if (version && /^\d+$/.test(version)) upstream.searchParams.set("version", version);

    let res: Response;
    try {
      res = await fetch(upstream, {
        method: "GET",
        headers: { "X-API-Key": s.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch (e) {
      log.warn("sarvam.signed_url_unreachable", { error: e instanceof Error ? e.name : "unknown" });
      throw new DomainError("PROVIDER_UNAVAILABLE", "The voice service could not be reached.");
    }
    if (!res.ok) {
      log.warn("sarvam.signed_url_failed", { status: res.status });
      // Pass the status through so the SDK raises its typed error; never forward upstream bodies.
      const headers: Record<string, string> = { "Content-Type": "text/plain", "Cache-Control": "no-store" };
      const retry = res.headers.get("x-retry-after");
      if (retry) headers["x-retry-after"] = retry;
      return new Response(
        res.status === 401 || res.status === 403
          ? "Voice provider rejected the server credentials"
          : "Voice provider error",
        {
          status: res.status,
          headers,
        },
      );
    }
    const parsed = signedUrlResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success)
      throw new DomainError("PROVIDER_UNAVAILABLE", "The voice service returned an unexpected response.");
    return new Response(JSON.stringify({ url: parsed.data.url, reference_id: parsed.data.reference_id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  },
};
