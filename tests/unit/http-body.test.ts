import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, readJsonBody } from "@/server/http/body";
import { DomainError } from "@/server/errors";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A JSON object whose serialised form is exactly `bytes` bytes of ASCII. */
function jsonOfBytes(bytes: number): string {
  const overhead = JSON.stringify({ a: "" }).length;
  return JSON.stringify({ a: "x".repeat(bytes - overhead) });
}

async function rejection(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof DomainError) return e;
    throw e;
  }
  throw new Error("expected the body to be rejected");
}

describe("JSON body size limit", () => {
  it("caps bodies at 16 KB by default", () => {
    expect(MAX_JSON_BYTES).toBe(16 * 1024);
  });

  it("accepts a body one byte under the limit", async () => {
    const text = jsonOfBytes(MAX_JSON_BYTES - 1);
    expect(Buffer.byteLength(text)).toBe(MAX_JSON_BYTES - 1);
    await expect(readJsonBody(post(text))).resolves.toEqual(JSON.parse(text));
  });

  it("accepts a body of exactly the limit", async () => {
    const text = jsonOfBytes(MAX_JSON_BYTES);
    expect(Buffer.byteLength(text)).toBe(MAX_JSON_BYTES);
    await expect(readJsonBody(post(text))).resolves.toEqual(JSON.parse(text));
  });

  it("rejects a body one byte over the limit as PAYLOAD_TOO_LARGE", async () => {
    const err = await rejection(readJsonBody(post(jsonOfBytes(MAX_JSON_BYTES + 1))));
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.message).toBe("Request body is too large.");
  });

  it("refuses an oversized declared content-length without reading the body", async () => {
    const request = post("{}", { "content-length": String(MAX_JSON_BYTES + 1) });
    const err = await rejection(readJsonBody(request));
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(request.bodyUsed).toBe(false);
  });

  // A client can under-declare content-length; the real byte count must still be enforced.
  it("measures the actual body even when the declared content-length understates it", async () => {
    const request = post(jsonOfBytes(MAX_JSON_BYTES + 100), { "content-length": "10" });
    expect((await rejection(readJsonBody(request))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("ignores a non-numeric content-length and falls back to measuring the body", async () => {
    await expect(readJsonBody(post('{"ok":true}', { "content-length": "not-a-number" }))).resolves.toEqual({
      ok: true,
    });
  });

  // Tamil text is three bytes per character in UTF-8; counting characters would let it through at ~3x the cap.
  it("stops reading a chunked body with no declared length as soon as it passes the limit", async () => {
    // An endless stream: if the reader buffered to the end, this would never finish.
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024).fill(0x20));
      },
    });
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: endless,
      duplex: "half",
    } as RequestInit);
    expect((await rejection(readJsonBody(request))).code).toBe("PAYLOAD_TOO_LARGE");
    expect(pulled).toBeLessThanOrEqual(MAX_JSON_BYTES / 1024 + 2);
  });

  it("counts UTF-8 bytes rather than characters", async () => {
    const text = JSON.stringify({ a: "த".repeat(Math.ceil(MAX_JSON_BYTES / 3)) });
    expect(text.length).toBeLessThan(MAX_JSON_BYTES);
    expect(Buffer.byteLength(text, "utf8")).toBeGreaterThan(MAX_JSON_BYTES);
    expect((await rejection(readJsonBody(post(text)))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("honours a caller-supplied smaller limit", async () => {
    await expect(readJsonBody(post('{"a":1}'), 7)).resolves.toEqual({ a: 1 });
    expect((await rejection(readJsonBody(post('{"a":12}'), 7))).code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("JSON body parsing", () => {
  it("treats an empty body as an empty object", async () => {
    await expect(readJsonBody(post(""))).resolves.toEqual({});
  });

  it("treats a whitespace-only body as an empty object", async () => {
    await expect(readJsonBody(post("  \n\t "))).resolves.toEqual({});
  });

  it("returns arrays and primitives as parsed, leaving shape checks to the route schema", async () => {
    await expect(readJsonBody(post("[1,2]"))).resolves.toEqual([1, 2]);
    await expect(readJsonBody(post("42"))).resolves.toBe(42);
  });

  it("maps malformed JSON to a VALIDATION error without echoing the input", async () => {
    const err = await rejection(readJsonBody(post('{"phone": "+91 98765 43210",')));
    expect(err.code).toBe("VALIDATION");
    expect(err.message).toBe("Request body must be valid JSON.");
    expect(err.message).not.toContain("98765");
  });
});
