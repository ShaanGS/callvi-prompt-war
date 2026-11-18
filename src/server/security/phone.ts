import { base64url, hmacSha256 } from "./crypto";

/**
 * Inbound caller identity.
 *
 * Phone learners are resolved only from the caller number supplied by the
 * voice provider on a call to the phone agent — never from a number typed or
 * sent by a browser. The raw number is normalised to E.164, hashed with a
 * server-side HMAC key, and discarded. Only the hash and the last four digits
 * (a display helper) are stored.
 */

export interface NormalisedPhone {
  e164: string;
  last4: string;
}

/**
 * Normalise an Indian or international number to E.164.
 * Accepts "+91 98765 43210", "09876543210", "9876543210", "919876543210".
 * Returns null when the value is not a plausible phone number.
 */
export function normalisePhone(raw: string, defaultCountryCode = "91"): NormalisedPhone | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!/^[\d\s()+.-]+$/.test(trimmed)) return null;

  let e164Digits: string;
  if (hasPlus) {
    e164Digits = digits;
  } else if (digits.startsWith("00")) {
    e164Digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    e164Digits = defaultCountryCode + digits.slice(1);
  } else if (digits.length === 10) {
    e164Digits = defaultCountryCode + digits;
  } else {
    e164Digits = digits;
  }
  if (e164Digits.length < 8 || e164Digits.length > 15 || e164Digits.startsWith("0")) return null;
  return { e164: `+${e164Digits}`, last4: e164Digits.slice(-4) };
}

export function hashPhone(secret: string, e164: string): string {
  return `ph1_${base64url(hmacSha256(secret, `phone:${e164}`))}`;
}
