import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "@/lib/languages";
import { getConfig } from "../config/env";
import { getDb } from "../db/client";
import { DomainError } from "../errors";
import type { Learner, StaffRole } from "../domain/types";
import { learnersRepo, staffRepo } from "../repositories/learners";
import { learnerService } from "../services/learner-service";
import { DEV_COOKIE, verifyDevIdentity } from "./dev-identity";
import { createSupabaseServerClient } from "./supabase-server";
import { BROWSER_IDENTITY_COOKIE, verifyBrowserIdentity } from "./browser-identity";

/**
 * The verified application identity for the current request. Browser learners
 * are resolved from a signed browser identity, a verified Supabase session,
 * or a development-only identity. Browser identities never grant staff roles.
 */
export interface Identity {
  provider: "supabase" | "dev" | "browser";
  subject: string;
  /** Display hint only (never used for authorisation). */
  label: string | null;
}

export const UI_LANGUAGE_COOKIE = "lc_lang";

export const getIdentity = cache(async (): Promise<Identity | null> => {
  const config = getConfig();
  const store = await cookies();
  if (config.auth.supabase && store.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { provider: "supabase", subject: data.user.id, label: data.user.email ?? null };
    }
  }
  if (config.auth.devAuthEnabled) {
    const dev = verifyDevIdentity(config, store.get(DEV_COOKIE)?.value);
    if (dev) return { provider: "dev", subject: dev.sub, label: dev.name };
  }
  const subject = verifyBrowserIdentity(config.signingSecret, store.get(BROWSER_IDENTITY_COOKIE)?.value);
  if (subject) return { provider: "browser", subject, label: null };
  return null;
});

export const getUiLanguage = cache(async (): Promise<LanguageCode> => {
  const store = await cookies();
  const value = store.get(UI_LANGUAGE_COOKIE)?.value;
  return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
});

/** The current learner, created on first use of a verified browser identity. */
export const getCurrentLearner = cache(async (): Promise<Learner | null> => {
  const identity = await getIdentity();
  if (!identity) return null;
  const db = await getDb();
  const existing = await learnersRepo.findByIdentity(db, identity.provider, identity.subject);
  if (existing) return existing;
  const { learner } = await learnerService.resolveOrCreate(db, identity, { preferredLanguage: await getUiLanguage() });
  return learner;
});

export const getStaffRole = cache(async (): Promise<StaffRole | null> => {
  const identity = await getIdentity();
  if (!identity || identity.provider === "browser") return null;
  const db = await getDb();
  return staffRepo.findRole(db, identity.provider, identity.subject);
});

/** A normal page visit receives its browser identity from the proxy. */
export async function requireLearnerPage(nextPath = "/home"): Promise<Learner> {
  const learner = await getCurrentLearner();
  if (!learner) throw new DomainError("UNAUTHENTICATED", `Please enable cookies to continue to ${nextPath}.`);
  return learner;
}

/** Page guard: learner who has made a consent decision, else onboarding. */
export async function requireOnboardedLearnerPage(nextPath = "/home"): Promise<Learner> {
  const learner = await requireLearnerPage(nextPath);
  if (learner.consentStatus === "pending" || !learner.onboardingCompletedAt) redirect("/onboarding");
  return learner;
}

/** Page guard for the staff workspace. Non-staff get a 404-style redirect, not a hint. */
export async function requireStaffPage(): Promise<{ role: StaffRole; identity: Identity }> {
  const identity = await getIdentity();
  if (!identity || identity.provider === "browser") redirect("/sign-in?next=/staff");
  const role = await getStaffRole();
  if (!role) redirect("/home");
  return { role, identity };
}

/** API guard: throws UNAUTHENTICATED instead of redirecting. */
export async function requireLearnerApi(): Promise<Learner> {
  const learner = await getCurrentLearner();
  if (!learner) throw new DomainError("UNAUTHENTICATED", "Please open the app with cookies enabled to continue.");
  return learner;
}
