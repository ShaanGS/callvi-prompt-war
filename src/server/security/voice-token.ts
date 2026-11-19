import { z } from "zod";
import { base64url, hmacSha256, safeEqual } from "./crypto";

/**
 * Voice session tokens.
 *
 * The Sarvam Web SDK appends `user_identifier` to the signed WebSocket URL in
 * the browser, so the value that reaches our tool callbacks is browser
 * controlled. We therefore never pass a learner id or phone number there.
 * Instead the server issues an opaque, expiring, HMAC-signed token bound to a
 * single learning session. Tool callbacks verify the signature before
 * resolving any learner data, so a tampered or forged identifier is rejected.
 *
 * Format: lcv1.<base64url(payload)>.<base64url(hmac[0..16])>
 */

const PREFIX = "lcv1";
const payloadSchema = z.object({
  s: z.string().uuid(), // learning session id
  e: z.number().int().positive(), // expiry, unix seconds
});

export interface VoiceTokenClaims {
  sessionId: string;
  expiresAt: Date;
}

export function issueVoiceToken(secret: string, sessionId: string, ttlSeconds: number, now = new Date()): string {
  const payload = { s: sessionId, e: Math.floor(now.getTime() / 1000) + ttlSeconds };
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64url(hmacSha256(secret, `${PREFIX}.${body}`).subarray(0, 16));
  return `${PREFIX}.${body}.${sig}`;
}

export type VoiceTokenResult =
  { ok: true; claims: VoiceTokenClaims } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyVoiceToken(secret: string, token: string, now = new Date()): VoiceTokenResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: "malformed" };
  const [, body, sig] = parts;
  const expected = base64url(hmacSha256(secret, `${PREFIX}.${body}`).subarray(0, 16));
  if (!safeEqual(expected, sig)) return { ok: false, reason: "bad_signature" };
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "malformed" };
  if (parsed.data.e * 1000 < now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, claims: { sessionId: parsed.data.s, expiresAt: new Date(parsed.data.e * 1000) } };
}

export function looksLikeVoiceToken(value: string): boolean {
  return value.startsWith(`${PREFIX}.`);
}
