import { randomUUID } from "node:crypto";
import { z } from "zod";
import { base64url, hmacSha256, safeEqual } from "../security/crypto";

export const BROWSER_IDENTITY_COOKIE = "lc_browser_identity";
export const BROWSER_IDENTITY_MAX_AGE = 365 * 24 * 60 * 60;

const claimsSchema = z.object({ sub: z.string().uuid(), exp: z.number().int() });

/** A separate, signed identity for each browser; it never grants staff access. */
export function issueBrowserIdentity(secret: string, now = Date.now()): string {
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        sub: randomUUID(),
        exp: Math.floor(now / 1000) + BROWSER_IDENTITY_MAX_AGE,
      }),
    ),
  );
  return `${payload}.${base64url(hmacSha256(secret, `browser:${payload}`))}`;
}

export function verifyBrowserIdentity(secret: string, value: string | undefined, now = Date.now()): string | null {
  if (!value || value.length > 512) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!safeEqual(signature, base64url(hmacSha256(secret, `browser:${payload}`)))) return null;
  try {
    const parsed = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.success && parsed.data.exp > Math.floor(now / 1000) ? parsed.data.sub : null;
  } catch {
    return null;
  }
}
