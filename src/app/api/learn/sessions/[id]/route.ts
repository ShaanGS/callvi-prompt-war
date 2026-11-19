import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { handle, json } from "@/server/http/respond";
import { rateLimit } from "@/server/security/rate-limit";
import { studyRoom } from "@/server/services/study-room";

/** The learner's own session view (polled by the live room). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    // The live room polls every 4 seconds (15 a minute); this allows a few tabs.
    rateLimit(`session-view:${learner.id}`, 60, 60_000);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("NOT_FOUND", "Session not found.");
    return json({ ok: true, session: await studyRoom.view(await getDb(), learner, id) });
  });
}
