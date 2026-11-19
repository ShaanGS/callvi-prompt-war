"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLanguageCode } from "@/lib/languages";
import { getDb } from "@/server/db/client";
import { getIdentity, requireLearnerApi, UI_LANGUAGE_COOKIE } from "@/server/auth/actor";
import { deleteSupabaseAuthUser } from "@/server/auth/supabase-admin";
import { DEV_COOKIE } from "@/server/auth/dev-identity";
import { appCookieOptions, SESSION_GOAL_COOKIE } from "@/server/auth/cookies";
import { BROWSER_IDENTITY_COOKIE } from "@/server/auth/browser-identity";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { toDomainError } from "@/server/errors";
import { PREFERENCE_KEYS } from "@/server/domain/types";
import { learnerService } from "@/server/services/learner-service";
import { learningService } from "@/server/services/learning-service";
import { memoryService } from "@/server/services/memory-service";
import { deletionService } from "@/server/services/deletion-service";
import { courseService } from "@/server/services/course-service";
import { sessionService } from "@/server/services/session-service";
import { createBrowserVoiceSession } from "@/server/providers/browser-voice";
import { rateLimit } from "@/server/security/rate-limit";

/**
 * Every action here writes. A browser identity costs nothing to obtain, so
 * writes are capped per learner; 60 a minute is far above what a person
 * clicking through the app can reach.
 */
async function actingLearner() {
  const learner = await requireLearnerApi();
  rateLimit(`learner-action:${learner.id}`, 60, 60_000);
  return learner;
}

/**
 * Learner server actions. Each re-authenticates, validates its input and
 * delegates to a domain service; none contains business rules.
 */

const courseIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,64}$/);

/* ------------------------------------------------------------- onboarding */

export async function chooseLanguage(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const language = formData.get("language");
  if (typeof language !== "string" || !isLanguageCode(language)) redirect("/onboarding?step=language");
  await learnerService.updateProfile(await getDb(), learner.id, { preferredLanguage: language });
  (await cookies()).set(UI_LANGUAGE_COOKIE, language, appCookieOptions({ persistent: true }));
  redirect("/onboarding?step=consent");
}

export async function chooseConsent(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const decision = formData.get("decision");
  if (decision !== "granted" && decision !== "declined") redirect("/onboarding?step=consent");
  await learnerService.recordConsent(await getDb(), learner.id, decision, "browser");
  redirect("/onboarding?step=name");
}

export async function saveName(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const name = z
    .string()
    .trim()
    .max(80)
    .safeParse(formData.get("name") ?? "");
  // The display name is a profile field; in session-only mode it is not stored.
  if (name.success && name.data && learner.consentStatus === "granted") {
    await learnerService.updateProfile(await getDb(), learner.id, { displayName: name.data });
  }
  redirect("/onboarding?step=goal");
}

export async function submitGoal(formData: FormData): Promise<void> {
  await actingLearner();
  const goal = z.string().trim().min(3).max(500).safeParse(formData.get("goal"));
  if (!goal.success) redirect("/onboarding?step=goal&error=short");
  (await cookies()).set(SESSION_GOAL_COOKIE, goal.data, appCookieOptions());
  redirect("/onboarding?step=confirm");
}

export async function confirmGoal(): Promise<void> {
  const learner = await actingLearner();
  const store = await cookies();
  const goal = store.get(SESSION_GOAL_COOKIE)?.value;
  if (!goal) redirect("/onboarding?step=goal");
  const db = await getDb();
  const result = await learningService.confirmGoal(db, {
    learner,
    goalText: goal,
    source: "onboarding",
    sourceSessionId: null,
    idempotencyKey: null,
  });
  // Durable learners: the goal now lives in the database, not the cookie.
  if (result.saved) store.delete(SESSION_GOAL_COOKIE);
  redirect("/onboarding?step=courses");
}

export async function finishOnboarding(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const db = await getDb();
  await learnerService.completeOnboarding(db, learner.id);
  const courseId = courseIdSchema.safeParse(formData.get("course_id"));
  if (!courseId.success) redirect("/courses");
  await enrolInternal(learner.id, courseId.data);
}

/* ------------------------------------------------------------- courses */

async function enrolInternal(learnerId: string, courseId: string): Promise<never> {
  const db = await getDb();
  const learner = await learnerService.get(db, learnerId);
  const course = await courseService.getAvailable(db, courseId);
  if (learner.consentStatus === "granted") {
    await learningService.startOrResumeCourse(db, { learner, course, sessionId: null, idempotencyKey: null });
    revalidatePath("/home");
  }
  redirect(`/learn?course=${encodeURIComponent(course.id)}`);
}

export async function enrolInCourse(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const courseId = courseIdSchema.safeParse(formData.get("course_id"));
  if (!courseId.success) redirect("/courses");
  await enrolInternal(learner.id, courseId.data);
}

/* ------------------------------------------------------------- sessions */

export async function startSession(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const mode = formData.get("mode");
  const parsedCourse = courseIdSchema.safeParse(formData.get("course_id"));
  const courseId = parsedCourse.success ? parsedCourse.data : null;
  const back = `/learn${courseId ? `?course=${encodeURIComponent(courseId)}&` : "?"}`;
  if (learner.consentStatus === "pending" && mode !== "voice") redirect("/onboarding?step=language");
  let sessionId: string;
  try {
    const db = await getDb();
    if (mode === "voice") {
      sessionId = (await createBrowserVoiceSession(db, learner, courseId)).sessionId;
    } else {
      if (courseId) await courseService.getAvailable(db, courseId);
      sessionId = (await sessionService.start(db, { learner, channel: "text", provider: "none", courseId })).id;
    }
  } catch (e) {
    const err = toDomainError(e);
    redirect(`${back}error=${err.code}`);
  }
  redirect(`/learn/${sessionId}`);
}

/* ------------------------------------------------------------- privacy */

export async function setMemoryConsent(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const db = await getDb();
  const decision = formData.get("decision");
  if (decision === "granted") await learnerService.recordConsent(db, learner.id, "granted", "settings");
  else if (decision === "revoked") await learnerService.revokeConsent(db, learner.id, "settings");
  else if (decision === "declined") await learnerService.recordConsent(db, learner.id, "declined", "settings");
  revalidatePath("/", "layout");
  redirect("/privacy?done=memory");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const name = z
    .string()
    .trim()
    .max(80)
    .safeParse(formData.get("name") ?? "");
  const language = formData.get("language");
  const db = await getDb();
  await learnerService.updateProfile(db, learner.id, {
    // Names are only stored with durable memory.
    displayName: learner.consentStatus === "granted" && name.success ? name.data || null : undefined,
    preferredLanguage: typeof language === "string" && isLanguageCode(language) ? language : undefined,
  });
  if (typeof language === "string" && isLanguageCode(language)) {
    (await cookies()).set(UI_LANGUAGE_COOKIE, language, appCookieOptions({ persistent: true }));
  }
  revalidatePath("/", "layout");
  redirect("/privacy?done=profile");
}

export async function updateGoal(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const goal = z.string().trim().min(3).max(500).safeParse(formData.get("goal"));
  if (!goal.success) redirect("/privacy?error=goal");
  await memoryService.correctGoal(await getDb(), learner, goal.data, {
    source: "learner_settings",
    sourceSessionId: null,
  });
  revalidatePath("/home");
  redirect("/privacy?done=goal");
}

export async function updatePreference(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const key = z.enum(PREFERENCE_KEYS).safeParse(formData.get("key"));
  const value = formData.get("value");
  if (!key.success || typeof value !== "string") redirect("/privacy?error=preference");
  try {
    await memoryService.setPreference(await getDb(), learner, key.data, value, {
      source: "learner_settings",
      sourceSessionId: null,
    });
  } catch {
    redirect("/privacy?error=preference");
  }
  redirect("/privacy?done=preference");
}

export async function deletePreference(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (id.success) await memoryService.deletePreference(await getDb(), learner, id.data);
  redirect("/privacy?done=deleted");
}

export async function resetConcept(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  const enrollmentId = z.string().uuid().safeParse(formData.get("enrollment_id"));
  const conceptId = z.string().max(80).safeParse(formData.get("concept_id"));
  if (enrollmentId.success && conceptId.success) {
    await memoryService.resetConcept(await getDb(), learner, enrollmentId.data, conceptId.data);
  }
  revalidatePath("/home");
  redirect("/privacy?done=deleted");
}

export async function deleteLearningMemory(): Promise<void> {
  const learner = await actingLearner();
  await deletionService.deleteLearningMemory(await getDb(), learner.id, "settings");
  revalidatePath("/", "layout");
  redirect("/privacy?done=deleted");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const learner = await actingLearner();
  if (formData.get("confirm") !== "DELETE") redirect("/privacy?error=confirm");
  const identity = await getIdentity();
  const { identities } = await deletionService.deleteAccount(await getDb(), learner.id, "settings");
  let authRemoved = true;
  for (const i of identities) {
    if (i.provider === "supabase") authRemoved = (await deleteSupabaseAuthUser(i.subject)) && authRemoved;
  }
  const supabase = await createSupabaseServerClient();
  if (supabase && identity?.provider === "supabase") await supabase.auth.signOut();
  const store = await cookies();
  store.delete(DEV_COOKIE);
  store.delete(BROWSER_IDENTITY_COOKIE);
  store.delete(SESSION_GOAL_COOKIE);
  redirect(`/?deleted=${authRemoved ? "1" : "auth_pending"}`);
}
