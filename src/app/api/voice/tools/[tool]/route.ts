import { getConfig } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { readJsonBody } from "@/server/http/body";
import { clientKey, handle, json } from "@/server/http/respond";
import { handleSarvamToolCallback, toSarvamResponseBody, withCallContext } from "@/server/providers/sarvam/tool-callback";

/** Sarvam API-tool callback. Authenticated by a per-agent bearer secret. */
export async function POST(request: Request, { params }: { params: Promise<{ tool: string }> }) {
  return handle(async () => {
    const { tool } = await params;
    const body = withCallContext(await readJsonBody(request), new URL(request.url), request.headers);
    const result = await handleSarvamToolCallback(await getDb(), getConfig(), {
      authorization: request.headers.get("authorization"),
      toolName: tool,
      body,
      clientKey: clientKey(request),
    });
    return json(toSarvamResponseBody(result.body), result.status);
  });
}
