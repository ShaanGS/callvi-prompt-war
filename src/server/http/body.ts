import { DomainError } from "../errors";

export const MAX_JSON_BYTES = 16 * 1024;

/** Read a JSON request body with a hard size limit. */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new DomainError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new DomainError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("VALIDATION", "Request body must be valid JSON.");
  }
}
