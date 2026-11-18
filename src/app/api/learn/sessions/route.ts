import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { readJsonBody } from "@/server/http/body";
import { handle, json } from "@/server/http/respond";
import { rateLimit } from "@/server/security/rate-limit";
import { studyRoom } from "@/server/services/study-room";

const bodySchema = z.object({ course_id: z.string().trim().min(1).max(80).nullable().optional() });

/** Start a typed study-room session. */
export async function POST(request: Request) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    rateLimit(`text-session:${learner.id}`, 10, 60_000);
    const parsed = bodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new DomainError("VALIDATION", "Invalid request.");
    const view = await studyRoom.startTextSession(await getDb(), learner, parsed.data.course_id ?? null);
    return json({ ok: true, session: view }, 201);
  });
}
