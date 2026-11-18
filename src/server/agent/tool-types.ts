import { z } from "zod";
import type { LanguageCode } from "@/lib/languages";
import type { Db } from "../db/types";
import type { Channel, Learner, LearningSession } from "../domain/types";

export const TOOL_NAMES = [
  "get_learning_context",
  "set_memory_consent",
  "list_courses",
  "set_learning_goal",
  "start_or_resume_course",
  "get_lesson_context",
  "record_practice_attempt",
  "save_checkpoint",
  "close_learning_session",
  "get_memory_summary",
  "update_memory_preference",
  "request_data_deletion",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

/**
 * read:    no state change.
 * session: changes only short-lived session state (no durable write).
 * write:   may change durable learner data; authenticated, validated, idempotent.
 */
export type ToolKind = "read" | "session" | "write";

/**
 * How the orchestrator derives an idempotency key when the caller does not
 * supply one: from the (canonical) arguments, once per session, or not at the
 * orchestrator level (the tool derives its own key from the data it writes).
 */
export type IdempotencyStrategy = "args" | "session" | "internal";

export interface ToolContext {
  readonly db: Db;
  readonly channel: Channel;
  readonly interactionId: string | null;
  readonly idempotencyKey: string;
  learner: Learner;
  session: LearningSession;
  /** Set when a tool deletes the learner; the orchestrator then skips post-processing. */
  learnerDeleted?: boolean;
}

export function contextLanguage(ctx: ToolContext): LanguageCode {
  return ctx.session.language;
}

export interface ToolOutcome {
  data: Record<string, unknown>;
  /** For write tools: whether durable state was actually persisted. */
  saved?: boolean;
  /** Short instruction for the voice agent about how to use this result. */
  guidance?: string;
}

export interface RegisteredTool {
  name: ToolName;
  kind: ToolKind;
  description: string;
  idempotency: IdempotencyStrategy;
  /** Provider lifecycle hook this tool is designed for, if any. */
  lifecycle?: "on_start" | "on_end";
  /** Whether the tool may run on a session that is already closed. */
  allowOnClosedSession?: boolean;
  inputSchema: z.ZodType;
  parse(raw: unknown): { success: true; data: unknown } | { success: false; issues: string[] };
  execute(ctx: ToolContext, input: unknown): Promise<ToolOutcome>;
}

export interface ToolDefinition<S extends z.ZodType> {
  name: ToolName;
  kind: ToolKind;
  description: string;
  idempotency?: IdempotencyStrategy;
  lifecycle?: "on_start" | "on_end";
  allowOnClosedSession?: boolean;
  input: S;
  handler(ctx: ToolContext, input: z.output<S>): Promise<ToolOutcome>;
}

/** Wrap a typed definition so the registry can hold tools with different input types. */
export function defineTool<S extends z.ZodType>(def: ToolDefinition<S>): RegisteredTool {
  return {
    name: def.name,
    kind: def.kind,
    description: def.description,
    idempotency: def.idempotency ?? (def.kind === "write" ? "args" : "internal"),
    lifecycle: def.lifecycle,
    allowOnClosedSession: def.allowOnClosedSession,
    inputSchema: def.input,
    parse(raw) {
      const result = def.input.safeParse(raw);
      if (result.success) return { success: true, data: result.data };
      return { success: false, issues: result.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`) };
    },
    async execute(ctx, input) {
      // Re-validate so execute can never receive unparsed input.
      return def.handler(ctx, def.input.parse(input));
    },
  };
}

/** Accept true or "true" (voice platforms may send booleans as strings). */
export const learnerConfirmed = z.preprocess(
  (v) => (v === "true" ? true : v),
  z.literal(true, { error: "Restate it and ask the learner to confirm before calling this tool." }),
);

export const slugSchema = z.string().trim().regex(/^[a-z0-9-]{3,64}$/, "must be an id from a previous tool result");
