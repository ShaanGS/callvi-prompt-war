import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { log } from "@/server/observability/log";

let logSpy: MockInstance;
let warnSpy: MockInstance;
let errorSpy: MockInstance;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function lastLine(spy: MockInstance): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  expect(call, "expected a log line").toBeDefined();
  return JSON.parse(String(call?.[0]));
}

describe("log levels and sinks", () => {
  it("keeps test output quiet by dropping debug, info and warn under NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test");
    log.debug("d");
    log.info("i");
    log.warn("w");
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("still writes errors under NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test");
    log.error("boom");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("routes each level to its console method outside tests", () => {
    vi.stubEnv("NODE_ENV", "production");
    log.debug("e.debug");
    log.info("e.info");
    log.warn("e.warn");
    log.error("e.error");
    expect(logSpy.mock.calls.map((c) => JSON.parse(String(c[0])).level)).toEqual(["debug", "info"]);
    expect(lastLine(warnSpy)).toMatchObject({ level: "warn", event: "e.warn" });
    expect(lastLine(errorSpy)).toMatchObject({ level: "error", event: "e.error" });
  });

  it("writes one JSON line with level, event and an ISO timestamp", () => {
    vi.stubEnv("NODE_ENV", "production");
    log.info("session.started", { channel: "browser", ms: 12 });
    const line = lastLine(logSpy);
    expect(line).toMatchObject({ level: "info", event: "session.started", channel: "browser", ms: 12 });
    expect(new Date(String(line.at)).toISOString()).toBe(line.at);
  });
});

describe("log redaction", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("masks phone numbers inside free-text field values", () => {
    log.info("call.received", { note: "caller +91 98765 43210 asked for a lesson" });
    const raw = String(logSpy.mock.calls[0]?.[0]);
    expect(raw).not.toContain("98765");
    expect(lastLine(logSpy).note).toBe("caller [number] asked for a lesson");
  });

  it("masks email addresses, bearer tokens, voice tokens and long digit runs", () => {
    log.warn("auth.odd", {
      contact: "write to asha@example.com",
      header: "Bearer abc.def-123",
      voice: "token lcv1.payload_1.sig-2 seen",
      otp: "code 482913 sent",
    });
    const line = lastLine(warnSpy);
    expect(line.contact).toBe("write to [email]");
    expect(line.header).toBe("Bearer [redacted]");
    expect(line.voice).toBe("token [voice-token] seen");
    expect(line.otp).toBe("code [digits] sent");
  });

  it("keeps short prices so operational logs stay useful", () => {
    log.info("practice.checked", { detail: "answer was 120 rupees" });
    expect(lastLine(logSpy).detail).toBe("answer was 120 rupees");
  });

  it("replaces values under sensitive keys entirely, case-insensitively, keeping only the length", () => {
    log.info("tool.called", { phone: "+919876543210", Authorization: "Bearer xyz", transcript: "hello there", answer_text: "twelve" });
    const line = lastLine(logSpy);
    expect(line.phone).toBe("[redacted:13]");
    expect(line.Authorization).toBe("[redacted:10]");
    expect(line.transcript).toBe("[redacted:11]");
    expect(line.answer_text).toBe("[redacted:6]");
  });

  it("redacts non-string values under sensitive keys without revealing them", () => {
    log.info("tool.called", { token: 123456, value: ["a", "b"] });
    const line = lastLine(logSpy);
    expect(line.token).toBe("[redacted]");
    expect(line.value).toBe("[redacted]");
  });

  it("redacts each string in an array field and truncates entries to 80 characters", () => {
    log.info("batch", { recipients: ["+91 98765 43210", "x".repeat(120)] });
    const recipients = lastLine(logSpy).recipients as string[];
    expect(recipients[0]).toBe("[number]");
    expect(recipients[1]).toHaveLength(80);
  });

  it("truncates long free text to 200 characters", () => {
    log.info("long", { note: "y".repeat(500) });
    expect(lastLine(logSpy).note).toHaveLength(200);
  });

  it("passes numbers, booleans and null through and drops undefined fields", () => {
    log.info("shape", { count: 3, ok: false, missing: null, skipped: undefined });
    const line = lastLine(logSpy);
    expect(line).toMatchObject({ count: 3, ok: false, missing: null });
    expect(line).not.toHaveProperty("skipped");
  });

  it("redacts error-level lines the same way", () => {
    log.error("route.failed", { error: "Error: lookup failed for asha@example.com" });
    expect(lastLine(errorSpy).error).toBe("Error: lookup failed for [email]");
  });

  // A field named "level" or "event" used to overwrite the line's own, so an
  // attacker-influenced field could disguise an error as info and hide it from alerting.
  it("does not let caller fields overwrite the level or event of a line", () => {
    log.error("route.failed", { level: "info", event: "harmless" });
    expect(lastLine(errorSpy)).toMatchObject({ level: "error", event: "route.failed" });
  });

  it("keeps a reserved-name field's value rather than dropping it", () => {
    log.error("route.failed", { level: "info" });
    expect(lastLine(errorSpy)).toMatchObject({ field_level: "info" });
  });
});
