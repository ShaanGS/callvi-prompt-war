import { describe, expect, it } from "vitest";
import { buildConfig, ConfigurationError } from "@/server/config/env";
import { signDevIdentity, verifyDevIdentity } from "@/server/auth/dev-identity";
import { getChannelReadiness } from "@/server/config/channels";
import { classifyVoiceError, initialVoiceState, voiceReducer, type VoiceAction } from "@/lib/voice/voice-state";

const PROD_BASE = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  APP_SIGNING_SECRET: "prod-signing-secret-0123456789abcdef-0123456789",
  PHONE_HASH_SECRET: "prod-phone-secret-0123456789abcdef-01234567890",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("configuration safety", () => {
  it("never enables development sign-in in production", () => {
    const config = buildConfig(PROD_BASE);
    expect(config.auth.devAuthEnabled).toBe(false);
    expect(() => buildConfig({ ...PROD_BASE, DEV_AUTH_ENABLED: "true" })).toThrow(ConfigurationError);
  });

  it("refuses to start in production without required secrets", () => {
    const missing = { ...PROD_BASE, APP_SIGNING_SECRET: undefined };
    expect(() => buildConfig(missing)).toThrow(ConfigurationError);
  });

  it("enables development sign-in locally only when no identity provider is configured or it is requested", () => {
    expect(buildConfig({ NODE_ENV: "development" }).auth.devAuthEnabled).toBe(true);
    expect(buildConfig({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" }).auth.devAuthEnabled).toBe(false);
  });

  it("rejects short secrets", () => {
    expect(() => buildConfig({ NODE_ENV: "development", APP_SIGNING_SECRET: "short" })).toThrow(ConfigurationError);
  });

  it("does not offer phone until it has been verified with a real call", () => {
    const config = buildConfig({
      NODE_ENV: "development",
      SARVAM_ORG_ID: "o",
      SARVAM_WORKSPACE_ID: "w",
      SARVAM_PHONE_APP_ID: "p",
      SARVAM_TOOL_SECRET_PHONE: "phone-tool-secret-0123456789abcdef-0123",
      PHONE_DISPLAY_NUMBER: "+91 00000 00000",
    });
    const phone = getChannelReadiness(config).phone;
    expect(phone.available).toBe(false);
    expect(phone.displayNumber).toBeUndefined();
  });
});

describe("development identity", () => {
  it("is signed, verifiable locally and refused in production", () => {
    const dev = buildConfig({ NODE_ENV: "development" });
    const signed = signDevIdentity(dev, "6f1d1c9e-1111-4222-8333-444455556666", "Test");
    expect(verifyDevIdentity(dev, signed.value)?.name).toBe("Test");
    expect(verifyDevIdentity(dev, `${signed.value}x`)).toBeNull();
    const prod = buildConfig(PROD_BASE);
    expect(verifyDevIdentity(prod, signed.value)).toBeNull();
    expect(() => signDevIdentity(prod, "6f1d1c9e-1111-4222-8333-444455556666", "Test")).toThrow();
  });
});

describe("voice session state (real SDK states only)", () => {
  const run = (...actions: VoiceAction[]) => actions.reduce(voiceReducer, initialVoiceState);

  it("follows the SDK through connect, listen, speak and end", () => {
    expect(run({ type: "start_requested" }).phase).toBe("requesting_mic");
    expect(run({ type: "start_requested" }, { type: "mic_granted" }).phase).toBe("connecting");
    expect(run({ type: "start_requested" }, { type: "mic_granted" }, { type: "sdk_state", state: "listening" }).phase).toBe("listening");
    expect(run({ type: "start_requested" }, { type: "mic_granted" }, { type: "sdk_state", state: "speaking" }).phase).toBe("agent_speaking");
    expect(run({ type: "start_requested" }, { type: "mic_granted" }, { type: "sdk_state", state: "listening" }, { type: "learner_speech", speaking: true }).phase).toBe("learner_speaking");
    expect(run({ type: "start_requested" }, { type: "mic_granted" }, { type: "ended" }).phase).toBe("ended");
  });

  it("maps microphone and provider failures to specific errors", () => {
    expect(classifyVoiceError({ name: "NotAllowedError" })).toBe("mic_denied");
    expect(classifyVoiceError({ name: "NotFoundError" })).toBe("mic_missing");
    expect(classifyVoiceError({ name: "NotReadableError" })).toBe("mic_busy");
    expect(classifyVoiceError({ name: "NotFoundError", code: "NOT_FOUND", statusCode: 404 })).toBe("generic");
    expect(classifyVoiceError({ name: "AuthenticationError", code: "AUTH", statusCode: 401 })).toBe("auth");
    expect(classifyVoiceError({ name: "RateLimitError", code: "RATE", statusCode: 429 })).toBe("rate_limited");
    expect(classifyVoiceError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("keeps only learner/companion transcript lines and ignores state after an error", () => {
    const s = run({ type: "transcript", role: "user", text: "hi" }, { type: "transcript", role: "bot", text: "hello" }, { type: "transcript", role: "system", text: "x" });
    expect(s.transcript.map((l) => l.role)).toEqual(["learner", "companion"]);
    const failed = run({ type: "start_requested" }, { type: "failed", error: "network" }, { type: "sdk_state", state: "speaking" });
    expect(failed.phase).toBe("error");
  });

  it("shows only what the companion actually said after an interruption", () => {
    const before = run({ type: "transcript", role: "bot", text: "A long explanation and a question." }, { type: "transcript", role: "user", text: "Wait, I don't understand." });
    const corrected = voiceReducer(before, { type: "transcript_corrected", original: "A long explanation and a question.", corrected: "A long explanation" });
    expect(corrected.transcript.map((line) => line.text)).toEqual(["A long explanation", "Wait, I don't understand."]);
    const removed = voiceReducer(corrected, { type: "transcript_corrected", original: "A long explanation", corrected: "" });
    expect(removed.transcript.map((line) => line.role)).toEqual(["learner"]);
  });
});
