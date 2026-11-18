import { requireLearnerApi } from "@/server/auth/actor";
import { clientKey, handle } from "@/server/http/respond";
import { sarvamProvider } from "@/server/providers/sarvam/sarvam-provider";
import { rateLimit } from "@/server/security/rate-limit";

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
    return sarvamProvider.proxySignedUrl(request, await params);
  });
}
