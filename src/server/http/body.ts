import { DomainError } from "../errors";

export const MAX_JSON_BYTES = 16 * 1024;

/** Read a JSON request body with a hard size limit. */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new DomainError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  // Count bytes as they arrive rather than buffering first: a chunked upload
  // declares no length, and must be cut off at the limit, not after it.
  const text = await readCapped(request, maxBytes);
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("VALIDATION", "Request body must be valid JSON.");
  }
}

async function readCapped(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new DomainError("PAYLOAD_TOO_LARGE", "Request body is too large.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
