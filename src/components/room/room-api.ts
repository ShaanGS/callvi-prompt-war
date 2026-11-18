import { z } from "zod";
import type { SessionView } from "@/server/services/views";

/**
 * Client for the learner's own session endpoints. Responses are validated
 * at this boundary; the server remains the source of truth for all state.
 */

const toolResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    tool: z.string(),
    data: z.record(z.string(), z.unknown()),
    saved: z.boolean().optional(),
    replayed: z.boolean().optional(),
    guidance: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    tool: z.string(),
    error: z.object({ code: z.string(), message: z.string() }),
    saved: z.literal(false),
    guidance: z.string().optional(),
  }),
]);
export type RoomToolResponse = z.infer<typeof toolResponseSchema>;

const envelopeSchema = z.object({
  response: toolResponseSchema.optional(),
  // The session view is produced by our own server; it is checked for shape here
  // only loosely and typed by the shared SessionView interface.
  session: z.custom<SessionView>((v) => typeof v === "object" && v !== null && "id" in v && "status" in v).nullable().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

export const practiceDataSchema = z.object({
  result: z.enum(["correct", "partial", "needs_practice", "ungraded"]),
  feedback: z.string(),
  met: z.array(z.string()),
  missing: z.array(z.string()),
  hint: z.string().nullable(),
  model_answer: z.string().nullable(),
  next_step: z.enum(["retry", "offer_move_on", "self_check", "next_concept", "lesson_complete", "course_complete"]),
  lesson_complete: z.boolean(),
  course_complete: z.boolean(),
  real_world_action: z.string().nullable(),
});
export type PracticeData = z.infer<typeof practiceDataSchema>;

export const lessonDataSchema = z.object({
  explanation_status: z.object({ approach: z.string(), alternatives_remaining: z.number(), all_used: z.boolean() }),
  practice: z.object({ exercise_id: z.string(), prompt: z.string(), kind: z.string() }).nullable(),
});

export const checkpointDataSchema = z.object({ summary: z.string().nullable().optional() });
export const closeDataSchema = z.object({ summary: z.string().nullable().optional() });

export class RoomApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function callRoomTool(
  sessionId: string,
  tool: string,
  args: Record<string, unknown> = {},
  idempotencyKey?: string,
): Promise<{ response: RoomToolResponse; session: SessionView | null }> {
  const res = await fetch(`/api/learn/sessions/${sessionId}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args, ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) }),
  });
  const parsed = envelopeSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new RoomApiError("INTERNAL", "Unexpected response");
  if (!parsed.data.response) throw new RoomApiError(parsed.data.error?.code ?? "INTERNAL", parsed.data.error?.message ?? "Request failed");
  return { response: parsed.data.response, session: parsed.data.session ?? null };
}

export async function fetchSessionView(sessionId: string): Promise<SessionView | null> {
  const res = await fetch(`/api/learn/sessions/${sessionId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const parsed = envelopeSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? (parsed.data.session ?? null) : null;
}
