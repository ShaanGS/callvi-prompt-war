import { afterEach, describe, expect, it } from "vitest";
import { hashPhone, normalisePhone } from "@/server/security/phone";
import { issueVoiceToken, looksLikeVoiceToken, verifyVoiceToken } from "@/server/security/voice-token";
import { redactText, summariseArgs } from "@/server/security/redact";
import { rateLimit, resetRateLimitsForTests } from "@/server/security/rate-limit";
import { canonicalJson, safeEqual } from "@/server/security/crypto";
import { DomainError } from "@/server/errors";

const SECRET = "unit-test-secret-0123456789abcdef-0123456789";

describe("caller identifier normalisation and HMAC", () => {
  it("normalises Indian numbers in common formats to the same E.164 value", () => {
    const forms = ["+91 98765 43210", "919876543210", "09876543210", "98765-43210", "0091 9876543210"];
    const values = forms.map((f) => normalisePhone(f)?.e164);
    expect(new Set(values)).toEqual(new Set(["+919876543210"]));
    expect(normalisePhone("+91 98765 43210")?.last4).toBe("3210");
  });

  it("rejects values that are not phone numbers", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("anonymous")).toBeNull();
    expect(normalisePhone("12")).toBeNull();
  });

  it("hashes with a keyed HMAC: stable per key, different across keys, never the raw number", () => {
    const a = hashPhone(SECRET, "+919876543210");
    expect(a).toBe(hashPhone(SECRET, "+919876543210"));
    expect(a).not.toBe(hashPhone(`${SECRET}-other`, "+919876543210"));
    expect(a).not.toContain("9876543210");
  });
});

describe("voice-session tokens", () => {
  const sessionId = "6f1d1c9e-1111-4222-8333-444455556666";

  it("round-trips a valid token", () => {
    const token = issueVoiceToken(SECRET, sessionId, 60);
    expect(looksLikeVoiceToken(token)).toBe(true);
    const result = verifyVoiceToken(SECRET, token);
    expect(result.ok && result.claims.sessionId).toBe(sessionId);
  });

  it("rejects tampered, foreign-key and expired tokens", () => {
    const token = issueVoiceToken(SECRET, sessionId, 60);
    const [prefix, payload, sig] = token.split(".");
    const tampered = `${prefix}.${payload.slice(0, -2)}xx.${sig}`;
    expect(verifyVoiceToken(SECRET, tampered).ok).toBe(false);
    expect(verifyVoiceToken(`${SECRET}-other`, token).ok).toBe(false);
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expired = issueVoiceToken(SECRET, sessionId, 60, past);
    expect(verifyVoiceToken(SECRET, expired).ok).toBe(false);
    expect(verifyVoiceToken(SECRET, "+919876543210").ok).toBe(false);
  });
});

describe("redaction", () => {
  it("removes phone numbers, emails and long digit runs from free text", () => {
    const out = redactText("call me on 9876543210 or mail meena@example.com, OTP 123456");
    expect(out).not.toContain("9876543210");
    expect(out).not.toContain("meena@example.com");
    expect(out).not.toContain("123456");
  });

  it("summarises tool arguments without their values", () => {
    const summary = summariseArgs({ answer_text: "my secret answer", exercise_id: "sbs-01-offer-sentence" });
    expect(JSON.stringify(summary)).not.toContain("secret");
    expect(Object.keys(summary)).toEqual(["answer_text", "exercise_id"]);
  });
});

describe("rate limiting and helpers", () => {
  afterEach(() => resetRateLimitsForTests());

  it("throws RATE_LIMITED after the limit within a window and resets after it", () => {
    const now = 1_000_000;
    rateLimit("k", 2, 1000, now);
    rateLimit("k", 2, 1000, now + 1);
    expect(() => rateLimit("k", 2, 1000, now + 2)).toThrow(DomainError);
    expect(() => rateLimit("k", 2, 1000, now + 1500)).not.toThrow();
  });

  it("compares secrets in constant time and canonicalises JSON key order", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});
