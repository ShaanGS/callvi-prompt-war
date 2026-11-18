import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { handle, json } from "@/server/http/respond";
import { elevenLabsConnection } from "@/server/providers/elevenlabs/connection";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new DomainError("NOT_FOUND", "Session not found.");
    return json({ ok: true, connection: await elevenLabsConnection(await getDb(), learner, id) });
  });
}
