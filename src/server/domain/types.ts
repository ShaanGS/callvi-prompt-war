import { z } from "zod";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/languages";
import { explanationApproachSchema } from "@/content/schema";

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

export const CHANNELS = ["phone", "browser", "text", "simulated"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONSENT_STATUSES = ["pending", "granted", "declined", "revoked"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/** Current consent text version. Bump when the plain-language explanation changes. */
export const CONSENT_VERSION = "2026-11-04.v1";

export type MemoryMode = "durable" | "session_only";

export const PRACTICE_RESULTS = ["correct", "partial", "needs_practice", "ungraded"] as const;
export type PracticeResult = (typeof PRACTICE_RESULTS)[number];

export const MASTERY_STATES = ["introduced", "practising", "needs_practice", "practised", "mastered", "carried_forward"] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

export interface Learner {
  id: string;
  displayName: string | null;
  preferredLanguage: LanguageCode;
  phoneLast4: string | null;
  consentStatus: ConsentStatus;
  consentVersion: string | null;
  consentUpdatedAt: Date | null;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function memoryModeFor(learner: Pick<Learner, "consentStatus">): MemoryMode {
  return learner.consentStatus === "granted" ? "durable" : "session_only";
}

export interface Goal {
  id: string;
  learnerId: string;
  goalText: string;
  status: "active" | "completed" | "paused" | "abandoned";
  userConfirmed: boolean;
  source: "onboarding" | "settings" | "voice_session" | "text_session";
  sourceSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  learnerId: string;
  courseId: string;
  goalId: string | null;
  status: "active" | "paused" | "completed" | "withdrawn";
  currentLessonId: string | null;
  enrolledAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
}

export interface LessonProgress {
  enrollmentId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ConceptMastery {
  enrollmentId: string;
  lessonId: string;
  conceptId: string;
  state: MasteryState;
  attempts: number;
  lastResult: PracticeResult | null;
  sourceSessionId: string | null;
  updatedAt: Date;
}

/** Session state (context layer 2). Short-lived; owned by SessionService. */
export const sessionAttemptSchema = z.object({
  exerciseId: z.string(),
  conceptId: z.string(),
  lessonId: z.string(),
  result: z.enum(PRACTICE_RESULTS),
  at: z.string(),
});
export type SessionAttempt = z.infer<typeof sessionAttemptSchema>;

export const SESSION_PHASES = [
  "welcome",
  "consent",
  "discover_goal",
  "recommend_course",
  "confirm_enrolment",
  "teach",
  "check_understanding",
  "practice",
  "feedback",
  "checkpoint",
  "closed",
] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

export const sessionStateSchema = z.object({
  phase: z.enum(SESSION_PHASES).default("welcome"),
  /** Permission to start learning in THIS call; never restored from a checkpoint. */
  learningReady: z.boolean().default(false),
  goal: z.object({ id: z.string().uuid().nullable(), text: z.string() }).nullable().default(null),
  courseId: z.string().nullable().default(null),
  enrollmentId: z.string().uuid().nullable().default(null),
  lessonId: z.string().nullable().default(null),
  conceptId: z.string().nullable().default(null),
  /** conceptId -> explanation approaches already used in this session. */
  explanationsUsed: z.record(z.string(), z.array(explanationApproachSchema)).default({}),
  pendingExerciseId: z.string().nullable().default(null),
  practiceSupport: z.record(z.string(), z.enum(["none_recorded", "explanation_provided", "hint_provided", "example_provided"])).default({}),
  reviewReturn: z.object({ lessonId: z.string().nullable(), conceptId: z.string().nullable() }).nullable().default(null),
  attempts: z.array(sessionAttemptSchema).default([]),
  /** Session-only mastery for learners without durable-memory consent. */
  sessionMastery: z.record(z.string(), z.enum(MASTERY_STATES)).default({}),
  sessionCompletedLessons: z.array(z.string()).default([]),
  conceptsCovered: z.array(z.string()).default([]),
  preferences: z
    .object({
      explanation_style: z.enum(["examples", "step_by_step", "short", "no_preference"]).optional(),
      pace: z.enum(["slower", "normal"]).optional(),
    })
    .default({}),
  learnerNotedDifficulty: z.string().max(300).nullable().default(null),
  checkpointsSaved: z.number().int().default(0),
});
export type SessionState = z.infer<typeof sessionStateSchema>;

export function emptySessionState(): SessionState {
  return sessionStateSchema.parse({});
}

export interface LearningSession {
  id: string;
  learnerId: string;
  enrollmentId: string | null;
  channel: Channel;
  provider: "sarvam" | "elevenlabs" | "none" | "simulation";
  providerInteractionId: string | null;
  status: "started" | "active" | "paused" | "completed" | "interrupted" | "failed";
  memoryMode: MemoryMode;
  language: LanguageCode;
  state: SessionState;
  stateVersion: number;
  summary: string | null;
  checkpoint: unknown;
  endReason: string | null;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
}

export function isSessionOpen(s: Pick<LearningSession, "status">): boolean {
  return s.status === "started" || s.status === "active" || s.status === "paused";
}

export const checkpointDataSchema = z.object({
  goalText: z.string().nullable(),
  courseId: z.string().nullable(),
  lessonId: z.string().nullable(),
  conceptId: z.string().nullable(),
  completedPractice: z.array(z.object({ exerciseId: z.string(), result: z.enum(PRACTICE_RESULTS) })),
  unresolvedDifficulty: z.string().nullable(),
  nextAction: z.string(),
});
export type CheckpointData = z.infer<typeof checkpointDataSchema>;

export interface Checkpoint extends CheckpointData {
  id: string;
  learnerId: string;
  enrollmentId: string | null;
  sessionId: string | null;
  summary: string;
  createdAt: Date;
}

export interface PracticeAttempt {
  id: string;
  learnerId: string;
  enrollmentId: string;
  sessionId: string | null;
  lessonId: string;
  conceptId: string;
  exerciseId: string;
  answerText: string;
  score: number | null;
  result: PracticeResult;
  feedback: string;
  createdAt: Date;
}

export const MEMORY_TYPES = ["profile", "preference", "goal", "episode", "mastery"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemorySource = "learner_settings" | "onboarding" | "voice_session" | "text_session" | "system";

export interface MemoryItem {
  id: string;
  learnerId: string;
  type: MemoryType;
  key: string;
  value: unknown;
  source: MemorySource;
  sourceSessionId: string | null;
  confidence: number | null;
  userConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PREFERENCE_KEYS = ["explanation_style", "pace"] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export const preferenceValueSchemas = {
  explanation_style: z.enum(["examples", "step_by_step", "short", "no_preference"]),
  pace: z.enum(["slower", "normal"]),
} as const;

export type StaffRole = "admin" | "staff";

export function sessionSourceFor(channel: Channel): "voice_session" | "text_session" {
  return channel === "text" ? "text_session" : "voice_session";
}
