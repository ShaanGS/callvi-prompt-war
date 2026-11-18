import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { readJsonBody } from "@/server/http/body";
import { handle, json } from "@/server/http/respond";
import { createBrowserVoiceSession } from "@/server/providers/browser-voice";

const bodySchema = z.object({ course_id: z.string().trim().min(1).max(80).nullable().optional() });

/** Start a browser voice session: creates the learning session and a signed voice token. */
export async function POST(request: Request) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    // The voice agent explains and records consent conversationally. Until
    // then all learning state remains session-only.
    const parsed = bodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new DomainError("VALIDATION", "Invalid request.");
    const config = await createBrowserVoiceSession(await getDb(), learner, parsed.data.course_id ?? null);
    return json({ ok: true, session: config }, 201);
  });
}
