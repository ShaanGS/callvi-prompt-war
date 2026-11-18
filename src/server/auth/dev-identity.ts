import "server-only";
import { z } from "zod";
import { base64url, hmacSha256, safeEqual } from "../security/crypto";
import type { AppConfig } from "../config/env";

/**
 * DEVELOPMENT-ONLY identity, for working on the product without a Supabase
 * project. The cookie is HMAC-signed so it cannot be forged, and every entry
 * point refuses to read or issue it when the app runs in production
 * (config.auth.devAuthEnabled is always false in production).
 */
export const DEV_COOKIE = "lc_dev_identity";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const payloadSchema = z.object({ sub: z.string().uuid(), name: z.string().max(80), exp: z.number().int() });
export type DevIdentity = z.infer<typeof payloadSchema>;

export function assertDevAuthAllowed(config: AppConfig): void {
  if (!config.auth.devAuthEnabled || config.isProduction) {
    throw new Error("Development sign-in is disabled in this environment.");
  }
}

export function signDevIdentity(config: AppConfig, sub: string, name: string): { value: string; maxAge: number } {
  assertDevAuthAllowed(config);
  const payload = { sub, name, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64url(hmacSha256(config.signingSecret, `dev.${body}`));
  return { value: `${body}.${sig}`, maxAge: MAX_AGE_SECONDS };
}

export function verifyDevIdentity(config: AppConfig, value: string | undefined): DevIdentity | null {
  if (!value || !config.auth.devAuthEnabled || config.isProduction) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(base64url(hmacSha256(config.signingSecret, `dev.${body}`)), sig)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.exp * 1000 < Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
