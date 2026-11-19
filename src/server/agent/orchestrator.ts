import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/types";
import { DomainError, toDomainError, type ErrorCode } from "../errors";
import { isSessionOpen, type Channel, type Learner, type LearningSession } from "../domain/types";
import { log } from "../observability/log";
import { toolInvocationsRepo } from "../repositories/ops";
import { canonicalJson, sha256Hex } from "../security/crypto";
import { summariseArgs } from "../security/redact";
import { getTool } from "./tool-registry";
import type { RegisteredTool, ToolContext, ToolName } from "./tool-types";

/**
 * AgentOrchestrator — coordinates every learning tool call, whichever channel
 * it comes from (Sarvam browser agent, Sarvam phone agent, the learner's text
 * study room, or the evaluation harness):
 *
 *   1. look up the tool in the registry and validate its input;
 *   2. check the session is open (closing is the only exception);
 *   3. for write tools, claim an idempotency key — a retry with the same key
 *      replays the original response and never writes twice;
 *   4. run the handler with a timeout;
 *   5. record a privacy-minimised trace (argument names/sizes, never values);
 *   6. return a small, structured response. A failed or timed-out write is
 *      always reported as `saved: false` with guidance not to claim success.
 */

export const DEFAULT_TOOL_TIMEOUT_MS = 8_000;
/** An in-flight write older than this is considered abandoned and may be retried. */
const STALE_CLAIM_MS = 30_000;

export interface ToolCall {
  db: Db;
  channel: Channel;
  learner: Learner;
  session: LearningSession;
  toolName: string;
  rawInput: unknown;
  interactionId: string | null;
  /** Caller-supplied idempotency key (e.g. the text study room sends one per submit). */
  idempotencyKey?: string | null;
  timeoutMs?: number;
}

export type ToolResponse =
  | {
      ok: true;
      tool: ToolName;
      data: Record<string, unknown>;
      saved?: boolean;
      replayed?: boolean;
      guidance?: string;
    }
  | {
      ok: false;
      tool: string;
      error: { code: ErrorCode; message: string; detail?: Record<string, unknown> };
      saved: false;
      guidance: string;
    };

export interface ToolCallResult {
  response: ToolResponse;
  session: LearningSession | null;
  learner: Learner | null;
}

const storedSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.record(z.string(), z.unknown()),
  saved: z.boolean().optional(),
  guidance: z.string().optional(),
});

const FAILURE_GUIDANCE =
  "This action did not complete. Do not tell the learner it was saved or done. Apologise briefly and continue the lesson safely.";

function failure(tool: string, error: DomainError): ToolResponse {
  return {
    ok: false,
    tool,
    error: { code: error.code, message: error.message, ...(error.detail ? { detail: error.detail } : {}) },
    saved: false,
    guidance:
      error.code === "VALIDATION" || error.code === "POLICY_VIOLATION" || error.code === "CONSENT_REQUIRED"
        ? `${error.message} Nothing was changed.`
        : FAILURE_GUIDANCE,
  };
}

function deriveKey(tool: RegisteredTool, call: ToolCall, input: unknown): string {
  const scope = call.interactionId ?? call.session.id;
  if (call.idempotencyKey) return `${tool.name}:${call.session.id}:client:${sha256Hex(call.idempotencyKey)}`;
  if (tool.idempotency === "session") return `${tool.name}:${call.session.id}`;
  if (tool.idempotency === "args")
    return `${tool.name}:${call.session.id}:${sha256Hex(`${scope}|${canonicalJson(input)}`)}`;
  return `${tool.name}:${call.session.id}:${randomUUID()}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DomainError("TIMEOUT", "The action took too long.")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

export async function runTool(call: ToolCall): Promise<ToolCallResult> {
  const started = Date.now();
  const unchanged = (response: ToolResponse): ToolCallResult => ({
    response,
    session: call.session,
    learner: call.learner,
  });

  const tool = getTool(call.toolName);
  if (!tool) return unchanged(failure(call.toolName, new DomainError("NOT_FOUND", "Unknown tool.")));

  const parsed = tool.parse(call.rawInput ?? {});
  if (!parsed.success) {
    return unchanged(
      failure(
        tool.name,
        new DomainError("VALIDATION", "Some tool arguments were missing or invalid.", { issues: parsed.issues }),
      ),
    );
  }

  if (!isSessionOpen(call.session) && !tool.allowOnClosedSession) {
    return unchanged(failure(tool.name, new DomainError("SESSION_CLOSED", "This learning session has ended.")));
  }

  const key = deriveKey(tool, call, parsed.data);
  const isWrite = tool.kind === "write";

  if (isWrite) {
    const existing = await toolInvocationsRepo.findByKey(call.db, key);
    if (existing?.status === "succeeded") {
      const stored = storedSuccessSchema.safeParse(existing.response);
      if (stored.success) {
        await toolInvocationsRepo.markReplayed(call.db, key);
        log.info("tool.replayed", { tool: tool.name, channel: call.channel });
        return unchanged({
          ok: true,
          tool: tool.name,
          data: stored.data.data,
          saved: stored.data.saved,
          guidance: stored.data.guidance,
          replayed: true,
        });
      }
    }
    if (existing?.status === "started") {
      if (Date.now() - existing.created_at.getTime() < STALE_CLAIM_MS) {
        return unchanged(failure(tool.name, new DomainError("CONFLICT", "The same action is already in progress.")));
      }
      await call.db.query(`delete from tool_invocations where idempotency_key = $1 and status = 'started'`, [key]);
    }
    if (existing && (existing.status === "failed" || existing.status === "rejected")) {
      await toolInvocationsRepo.release(call.db, key);
    }
  }

  const invocationId = await toolInvocationsRepo.start(call.db, {
    toolName: tool.name,
    channel: call.channel,
    learnerId: call.learner.id,
    sessionId: call.session.id,
    providerInteractionId: call.interactionId,
    idempotencyKey: key,
    requestSummary: summariseArgs(plainObject(call.rawInput)),
  });
  if (isWrite && invocationId === null) {
    return unchanged(failure(tool.name, new DomainError("CONFLICT", "The same action is already in progress.")));
  }

  const ctx: ToolContext = {
    db: call.db,
    channel: call.channel,
    interactionId: call.interactionId,
    idempotencyKey: key,
    learner: call.learner,
    session: call.session,
  };

  const execution: Promise<ToolResponse> = tool.execute(ctx, parsed.data).then(
    async (outcome) => {
      const response: ToolResponse = {
        ok: true,
        tool: tool.name,
        data: outcome.data,
        ...(outcome.saved !== undefined ? { saved: outcome.saved } : {}),
        ...(outcome.guidance ? { guidance: outcome.guidance } : {}),
      };
      // Record completion even if the caller already timed out, so a retry replays it.
      if (invocationId && !ctx.learnerDeleted) {
        await toolInvocationsRepo
          .finish(call.db, invocationId, {
            status: "succeeded",
            latencyMs: Date.now() - started,
            errorCode: null,
            response: isWrite ? response : null,
          })
          .catch(() => undefined);
      }
      return response;
    },
    async (e: unknown) => {
      const err = toDomainError(e);
      if (err.code === "INTERNAL") {
        log.error("tool.failed", {
          tool: tool.name,
          error: e instanceof Error ? `${e.name}: ${e.message}` : "unknown",
        });
      }
      if (invocationId && !ctx.learnerDeleted) {
        await toolInvocationsRepo
          .finish(call.db, invocationId, {
            status:
              err.code === "VALIDATION" || err.code === "POLICY_VIOLATION" || err.code === "NOT_FOUND"
                ? "rejected"
                : "failed",
            latencyMs: Date.now() - started,
            errorCode: err.code,
            response: null,
          })
          .catch(() => undefined);
      }
      throw err;
    },
  );

  try {
    const response = await withTimeout(execution, call.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS);
    log.info("tool.succeeded", { tool: tool.name, channel: call.channel, ms: Date.now() - started });
    return {
      response,
      session: ctx.learnerDeleted ? null : ctx.session,
      learner: ctx.learnerDeleted ? null : ctx.learner,
    };
  } catch (e) {
    const err = toDomainError(e);
    if (err.code === "TIMEOUT") {
      // Let the handler finish in the background; its outcome is recorded for replay.
      execution.catch(() => undefined);
      log.warn("tool.timeout", { tool: tool.name, channel: call.channel });
    }
    return { response: failure(tool.name, err), session: ctx.session, learner: ctx.learner };
  }
}
