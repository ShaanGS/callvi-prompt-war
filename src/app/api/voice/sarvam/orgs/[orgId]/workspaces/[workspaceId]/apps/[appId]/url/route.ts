import { z } from "zod";
import { requireLearnerApi } from "@/server/auth/actor";
import { DomainError } from "@/server/errors";
import { clientKey, handle } from "@/server/http/respond";
import { sarvamProvider } from "@/server/providers/sarvam/sarvam-provider";
import { rateLimit } from "@/server/security/rate-limit";

/** Sarvam identifiers are opaque tokens; anything else is not ours to forward. */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const paramsSchema = z.object({ orgId: id, workspaceId: id, appId: id });
/** The SDK's InteractionType has exactly two values; Callvi only opens voice calls. */
const querySchema = z.object({
  interaction_type: z.enum(["call", "chat"]).optional(),
  version: z
    .string()
    .regex(/^\d{1,6}$/)
    .optional(),
});

/**
 * Same-origin proxy for the Sarvam SDK's signed-connection request. Only a
 * signed-in learner may obtain a connection URL; the API key never leaves
 * the server.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string; workspaceId: string; appId: string }> },
) {
  return handle(async () => {
    const learner = await requireLearnerApi();
    rateLimit(`voice-url:${learner.id}`, 10, 60_000);
    rateLimit(`voice-url-ip:${clientKey(request)}`, 30, 60_000);
    const path = paramsSchema.safeParse(await params);
    const url = new URL(request.url);
    const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!path.success || !query.success) throw new DomainError("VALIDATION", "Invalid voice connection request.");
    return sarvamProvider.proxySignedUrl(request, path.data);
  });
}
