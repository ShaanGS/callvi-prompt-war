"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLanguageCode } from "@/lib/languages";
import { getConfig } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { DEV_COOKIE, signDevIdentity } from "@/server/auth/dev-identity";
import { appCookieOptions, SESSION_GOAL_COOKIE } from "@/server/auth/cookies";
import { BROWSER_IDENTITY_COOKIE } from "@/server/auth/browser-identity";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { getCurrentLearner, getUiLanguage, UI_LANGUAGE_COOKIE } from "@/server/auth/actor";
import { staffRepo } from "@/server/repositories/learners";
import { learnerService } from "@/server/services/learner-service";
import { sha256Hex } from "@/server/security/crypto";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/http/client-ip";
import { DomainError } from "@/server/errors";
import { log } from "@/server/observability/log";

export type SignInState =
  | { step: "email"; error?: "invalid_email" | "not_configured" | "rate_limited" | "failed"; email?: string }
  | { step: "code"; email: string; error?: "invalid_code" | "rate_limited" };

/** Only same-site relative paths may be used as a post-sign-in destination. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/home";
}

async function requesterKey(): Promise<string> {
  return clientIp(await headers());
}

export async function requestEmailCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get("email"));
  if (!email.success) return { step: "email", error: "invalid_email" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { step: "email", error: "not_configured" };
  try {
    rateLimit(`otp-ip:${await requesterKey()}`, 10, 10 * 60_000);
    rateLimit(`otp-email:${sha256Hex(email.data)}`, 3, 10 * 60_000);
  } catch {
    return { step: "email", error: "rate_limited", email: email.data };
  }
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: true } });
  if (error) {
    log.warn("auth.otp_send_failed", { status: error.status ?? null });
    return { step: "email", error: error.status === 429 ? "rate_limited" : "failed", email: email.data };
  }
  return { step: "code", email: email.data };
}

export async function verifyEmailCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  if (prev.step !== "code") return { step: "email" };
  const token = z
    .string()
    .trim()
    .regex(/^\d{6,10}$/)
    .safeParse(formData.get("code"));
  if (!token.success) return { step: "code", email: prev.email, error: "invalid_code" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { step: "email", error: "not_configured" };
  try {
    rateLimit(`otp-verify:${sha256Hex(prev.email)}`, 8, 10 * 60_000);
  } catch {
    return { step: "code", email: prev.email, error: "rate_limited" };
  }
  const { error } = await supabase.auth.verifyOtp({ email: prev.email, token: token.data, type: "email" });
  if (error) return { step: "code", email: prev.email, error: "invalid_code" };
  redirect(safeNext(formData.get("next")));
}

/**
 * DEVELOPMENT ONLY. Signs in as a local test identity derived from the name,
 * so signing in again with the same name returns to the same learner (used
 * to test second-session resume). Refused outright in production.
 */
export async function devSignIn(formData: FormData): Promise<void> {
  const config = getConfig();
  if (!config.auth.devAuthEnabled || config.isProduction)
    throw new DomainError("FORBIDDEN", "Development sign-in is disabled.");
  const name = z.string().trim().min(1).max(40).safeParse(formData.get("name"));
  if (!name.success) redirect("/sign-in?error=dev_name");
  const hex = sha256Hex(`dev-identity:${name.data.toLowerCase()}`);
  const sub = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const signed = signDevIdentity(config, sub, name.data);
  const store = await cookies();
  store.set(DEV_COOKIE, signed.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: signed.maxAge,
  });
  const db = await getDb();
  if (formData.get("staff") === "on") {
    await staffRepo.grant(db, { provider: "dev", subject: sub, role: "admin", emailHint: `dev:${name.data}` });
  }
  const { learner } = await learnerService.resolveOrCreate(
    db,
    { provider: "dev", subject: sub },
    { preferredLanguage: await getUiLanguage() },
  );
  if (!learner.displayName) await learnerService.updateProfile(db, learner.id, { displayName: name.data });
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  const store = await cookies();
  store.delete(DEV_COOKIE);
  store.delete(BROWSER_IDENTITY_COOKIE);
  store.delete(SESSION_GOAL_COOKIE);
  redirect("/");
}

/** Interface language. Also updates a signed-in learner's preferred language. */
export async function setUiLanguage(formData: FormData): Promise<void> {
  const language = formData.get("language");
  if (typeof language !== "string" || !isLanguageCode(language)) return;
  const store = await cookies();
  store.set(UI_LANGUAGE_COOKIE, language, appCookieOptions({ persistent: true }));
  const learner = await getCurrentLearner();
  if (learner) await learnerService.updateProfile(await getDb(), learner.id, { preferredLanguage: language });
  redirect(safeNext(formData.get("next")));
}
