import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { readJsonBody } from "@/server/http/body";
import { handle, json } from "@/server/http/respond";
import { rateLimit } from "@/server/security/rate-limit";
import { studyRoom } from "@/server/services/study-room";

const bodySchema = z.object({
  args: z.record(z.string(), z.unknown()).default({}),
  idempotency_key: z.string().trim().min(8).max(100).nullable().optional(),
});

/** Run an allowed learning tool on the learner's own session. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; tool: string }> }) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    rateLimit(`learner-tool:${learner.id}`, 60, 60_000);
    const { id, tool } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("NOT_FOUND", "Session not found.");
    const parsed = bodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new DomainError("VALIDATION", "Invalid request.");
    const result = await studyRoom.callTool(await getDb(), learner, {
      sessionId: id,
      tool,
      args: parsed.data.args,
      idempotencyKey: parsed.data.idempotency_key ?? null,
    });
    return json({ ok: result.response.ok, response: result.response, session: result.view });
  });
}
