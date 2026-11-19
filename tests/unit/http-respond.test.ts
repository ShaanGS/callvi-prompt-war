import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKey, handle, json } from "@/server/http/respond";
import { DomainError, ERROR_CODES, HTTP_STATUS } from "@/server/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

function withForwardedFor(value?: string): Request {
  return new Request("http://localhost/api/test", value === undefined ? {} : { headers: { "x-forwarded-for": value } });
}

describe("json response helper", () => {
  it("defaults to 200 and marks the response as not cacheable", async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("applies a custom status and merges extra headers alongside no-store", () => {
    const res = json({ ok: true }, 201, { "X-Request-Id": "abc" });
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBe("abc");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("route handler wrapper", () => {
  it("passes a successful handler's response through untouched", async () => {
    const original = json({ ok: true, data: { id: "s1" } }, 201);
    const res = await handle(async () => original);
    expect(res).toBe(original);
  });

  it.each(ERROR_CODES.filter((code) => code !== "INTERNAL"))("maps a %s domain error to its HTTP status and a stable error body", async (code) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handle(async () => {
      throw new DomainError(code, `Readable message for ${code}.`);
    });
    expect(res.status).toBe(HTTP_STATUS[code]);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false, error: { code, message: `Readable message for ${code}.` } });
  });

  it("does not log expected domain errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await handle(async () => {
      throw new DomainError("FORBIDDEN", "Not allowed.");
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("sets Retry-After on RATE_LIMITED when the retry delay is known", async () => {
    const res = await handle(async () => {
      throw new DomainError("RATE_LIMITED", "Too many requests.", { retryAfterSeconds: 30 });
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("omits Retry-After on RATE_LIMITED when no numeric retry delay is given", async () => {
    const missing = await handle(async () => {
      throw new DomainError("RATE_LIMITED", "Too many requests.");
    });
    const textual = await handle(async () => {
      throw new DomainError("RATE_LIMITED", "Too many requests.", { retryAfterSeconds: "soon" });
    });
    expect(missing.headers.get("retry-after")).toBeNull();
    expect(textual.headers.get("retry-after")).toBeNull();
  });

  it("never sets Retry-After for codes other than RATE_LIMITED", async () => {
    const res = await handle(async () => {
      throw new DomainError("CONFLICT", "Busy.", { retryAfterSeconds: 30 });
    });
    expect(res.headers.get("retry-after")).toBeNull();
  });

  // Internal error messages can carry SQL, hostnames or learner data; only the generic message may reach the client.
  it("returns a generic 500 for unexpected errors without leaking the internal message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handle(async () => {
      throw new Error("duplicate key in learners for +91 98765 43210 at db.internal:5432");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { code: "INTERNAL", message: "Something went wrong on our side." } });
    expect(JSON.stringify(body)).not.toContain("db.internal");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("logs unexpected errors as route.failed with the phone number redacted", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await handle(async () => {
      throw new TypeError("bad input from +91 98765 43210");
    });
    const line = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ level: "error", event: "route.failed" });
    expect(line.error).toContain("TypeError");
    expect(line.error).not.toContain("98765");
  });

  it("logs a thrown non-Error value as unknown and still answers 500", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handle(async () => {
      throw "plain string";
    });
    expect(res.status).toBe(500);
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toBe("unknown");
  });
});

describe("rate-limit client key", () => {
  it("uses the first x-forwarded-for entry, trimmed", () => {
    expect(clientKey(withForwardedFor("  203.0.113.7 , 10.0.0.1, 10.0.0.2"))).toBe("203.0.113.7");
  });

  it("uses a single x-forwarded-for value as-is", () => {
    expect(clientKey(withForwardedFor("198.51.100.4"))).toBe("198.51.100.4");
  });

  it("falls back to local when the header is missing", () => {
    expect(clientKey(withForwardedFor())).toBe("local");
  });

  it("falls back to local when the first entry is blank", () => {
    expect(clientKey(withForwardedFor(""))).toBe("local");
    expect(clientKey(withForwardedFor("   , 10.0.0.1"))).toBe("local");
  });
});
