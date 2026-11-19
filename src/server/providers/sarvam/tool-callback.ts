import { z } from "zod";
import type { AppConfig } from "../../config/env";
import type { Db } from "../../db/types";
import { DomainError, HTTP_STATUS, toDomainError } from "../../errors";
import { isSessionOpen, type LearningSession } from "../../domain/types";
import { log } from "../../observability/log";
import { safeEqual, sha256Hex } from "../../security/crypto";
import { hashPhone, normalisePhone } from "../../security/phone";
import { assertNotLimited, rateLimit } from "../../security/rate-limit";
import { looksLikeVoiceToken, verifyVoiceToken } from "../../security/voice-token";
import { sessionsRepo } from "../../repositories/sessions";
import { learnersRepo } from "../../repositories/learners";
import { learnerService } from "../../services/learner-service";
import { sessionService } from "../../services/session-service";
import { deletionService } from "../../services/deletion-service";
import { runTool, type ToolResponse } from "../../agent/orchestrator";
import { getTool } from "../../agent/tool-registry";
import type { ResolvedToolCaller } from "../interfaces";

/**
 * Sarvam API-tool callback adapter.
 *
 * Sarvam's API tool sends the request body you configure for each tool, with
 * call-context values (User Identifier, Interaction ID) inserted via the
 * dashboard's variable picker, and supports bearer-token auth stored as a
 * workspace secret. Signed requests are not documented, so we authenticate
 * with a dedicated, per-agent bearer secret and compare in constant time.
 *
 * Two agents, two secrets:
 *   - browser agent: user_identifier must be our signed voice-session token;
 *   - phone agent:   user_identifier is the provider-supplied inbound caller
 *                    number, hashed with a server-side HMAC key immediately.
 * A browser can never reach the phone path because it cannot present the
 * phone agent's secret.
 */

/**
 * Wrong-secret lockout: ten failures per IP in five minutes. A genuine agent
 * never sends a wrong secret, so this only ever slows a guesser; it is far
 * below the 600/min that legitimate tool traffic is allowed.
 */
const AUTH_FAILURE_LIMIT = 10;
const AUTH_FAILURE_WINDOW_MS = 5 * 60_000;

const envelopeSchema = z
  .object({
    user_identifier: z.string().trim().max(256).optional(),
    interaction_id: z.string().trim().min(1).max(200),
  })
  .loose();

export type CallbackResult = { status: number; body: ToolResponse | { ok: false; error: { code: string; message: string } } };

/**
 * The HTTP body returned to Sarvam. Besides the structured fields, `result`
 * carries the whole response as one JSON string, so the dashboard's response
 * template can pass everything to the agent with a single `@result` field
 * (the template only inserts named fields, and nested paths are not documented).
 */
export function toSarvamResponseBody(body: CallbackResult["body"]): CallbackResult["body"] & { result: string } {
  return { ...body, result: JSON.stringify(body) };
}

/**
 * Call-context values may be configured in the tool's Body, Params or Headers
 * (the dashboard's variable picker is documented for all three). Values in the
 * body win; query parameters and then headers fill any that are missing.
 */
export function withCallContext(body: unknown, url: URL, headers: Headers): unknown {
  const base: Record<string, unknown> = typeof body === "object" && body !== null && !Array.isArray(body) ? { ...body } : {};
  for (const key of ["user_identifier", "interaction_id"] as const) {
    const present = typeof base[key] === "string" && String(base[key]).trim() !== "";
    if (present) continue;
    const fromQuery = url.searchParams.get(key);
    const fromHeader = headers.get(`x-${key.replace("_", "-")}`);
    const value = fromQuery ?? fromHeader;
    if (value !== null && value.trim() !== "") base[key] = value;
  }
  return base;
}

function errorResult(e: unknown): CallbackResult {
  const err = toDomainError(e);
  return { status: HTTP_STATUS[err.code], body: { ok: false, error: { code: err.code, message: err.message } } };
}

export function authenticateToolCaller(config: AppConfig, authorization: string | null): "browser" | "phone" | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match) return null;
  const presented = match[1].trim();
  const { toolSecretBrowser, toolSecretPhone } = config.sarvam;
  if (toolSecretBrowser && safeEqual(presented, toolSecretBrowser)) return "browser";
  if (toolSecretPhone && config.sarvam.phoneAppId && safeEqual(presented, toolSecretPhone)) return "phone";
  return null;
}

async function resolveBrowserCaller(db: Db, config: AppConfig, userIdentifier: string | undefined, interactionId: string): Promise<ResolvedToolCaller> {
  if (!userIdentifier || !looksLikeVoiceToken(userIdentifier)) {
    throw new DomainError("UNAUTHENTICATED", "This voice session is not linked to a signed-in learner.");
  }
  const verified = verifyVoiceToken(config.signingSecret, userIdentifier);
  if (!verified.ok) throw new DomainError("UNAUTHENTICATED", "This voice session link is invalid or has expired.");
  const session = await sessionsRepo.findById(db, verified.claims.sessionId);
  if (!session || session.channel !== "browser") throw new DomainError("NOT_FOUND", "Session not found.");
  await sessionService.attachInteraction(db, session, interactionId);
  const learner = await learnersRepo.findById(db, session.learnerId);
  if (!learner) throw new DomainError("NOT_FOUND", "Learner not found.");
  return { channel: "browser", learner, session: { ...session, providerInteractionId: interactionId }, interactionId, anonymous: false };
}

async function resolvePhoneCaller(db: Db, config: AppConfig, userIdentifier: string | undefined, interactionId: string): Promise<ResolvedToolCaller> {
  const existingSession = await sessionsRepo.findByInteractionId(db, interactionId);
  if (existingSession) {
    if (existingSession.channel !== "phone") throw new DomainError("FORBIDDEN", "Interaction belongs to another channel.");
    const learner = await learnersRepo.findById(db, existingSession.learnerId);
    if (!learner) throw new DomainError("NOT_FOUND", "Learner not found.");
    return { channel: "phone", learner, session: existingSession, interactionId, anonymous: learner.phoneLast4 === null };
  }

  const phone = userIdentifier ? normalisePhone(userIdentifier) : null;
  let anonymous = false;
  let subject: string;
  if (phone) {
    subject = hashPhone(config.phoneHashSecret, phone.e164);
  } else {
    // Caller ID unavailable: a session-only learner scoped to this one call.
    anonymous = true;
    subject = `anon_${sha256Hex(`${config.phoneHashSecret}:${interactionId}`).slice(0, 32)}`;
  }
  const { learner } = await learnerService.resolveOrCreate(
    db,
    { provider: "phone", subject },
    { preferredLanguage: "ta-IN", phoneLast4: phone?.last4 ?? null },
  );
  let current = learner;
  if (anonymous && learner.consentStatus === "pending") {
    current = await learnerService.recordConsent(db, learner.id, "declined", "phone");
  }
  let session: LearningSession;
  try {
    session = await sessionService.start(db, { learner: current, channel: "phone", provider: "sarvam", providerInteractionId: interactionId });
  } catch (e) {
    // Two hooks raced to create the session for this interaction.
    const raced = await sessionsRepo.findByInteractionId(db, interactionId);
    if (!raced) throw e;
    session = raced;
  }
  return { channel: "phone", learner: current, session, interactionId, anonymous };
}

export async function handleSarvamToolCallback(
  db: Db,
  config: AppConfig,
  input: { authorization: string | null; toolName: string; body: unknown; clientKey: string },
): Promise<CallbackResult> {
  try {
    // Both limits run before the secret is compared. Checked after it, a wrong
    // guess cost nothing, so the bearer secret was the only thing slowing a guesser.
    const failures = `tool-auth-fail:${input.clientKey}`;
    assertNotLimited(failures, AUTH_FAILURE_LIMIT);
    rateLimit(`tool-ip:${input.clientKey}`, 600, 60_000);
    const channel = authenticateToolCaller(config, input.authorization);
    if (!channel) {
      rateLimit(failures, AUTH_FAILURE_LIMIT + 1, AUTH_FAILURE_WINDOW_MS);
      log.warn("sarvam.tool_auth_failed", { tool: input.toolName.slice(0, 64) });
      throw new DomainError("UNAUTHENTICATED", "Invalid tool credentials.");
    }
    if (!getTool(input.toolName)) throw new DomainError("NOT_FOUND", "Unknown tool.");

    const envelope = envelopeSchema.safeParse(input.body);
    if (!envelope.success) throw new DomainError("VALIDATION", "interaction_id is required.");
    const { user_identifier, interaction_id } = envelope.data;
    rateLimit(`tool-interaction:${interaction_id}`, 120, 60_000);

    const caller =
      channel === "browser"
        ? await resolveBrowserCaller(db, config, user_identifier, interaction_id)
        : await resolvePhoneCaller(db, config, user_identifier, interaction_id);

    // Only the tool's own arguments reach the orchestrator; call-context fields
    // (identifier, interaction id, transcript, call length) are dropped here and never stored.
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(envelope.data)) {
      if (!["user_identifier", "interaction_id", "call_transcript", "transcript", "call_length"].includes(k)) args[k] = v;
    }

    const result = await runTool({
      db,
      channel: caller.channel,
      learner: caller.learner,
      session: caller.session,
      toolName: input.toolName,
      rawInput: args,
      interactionId: caller.interactionId,
    });

    // An anonymous phone caller's call leaves nothing behind.
    if (caller.anonymous && input.toolName === "close_learning_session" && result.learner) {
      const s = result.session;
      if (!s || !isSessionOpen(s)) await deletionService.deleteAccount(db, caller.learner.id, "phone");
    }
    return { status: 200, body: result.response };
  } catch (e) {
    return errorResult(e);
  }
}
