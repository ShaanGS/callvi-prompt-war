import type { LanguageCode } from "@/lib/languages";
import type { Db, Queryable } from "../db/types";
import { DomainError } from "../errors";
import {
  memoryModeFor,
  preferenceValueSchemas,
  type Learner,
  type MasteryState,
  type MemorySource,
  type PreferenceKey,
} from "../domain/types";
import { enrollmentsRepo, goalsRepo, progressRepo } from "../repositories/learning";
import { memoryRepo } from "../repositories/memory";
import { checkpointsRepo } from "../repositories/sessions";
import { courseService } from "./course-service";
import { recordEvent } from "./events";
import { renderCheckpointSummary } from "./summaries";

/**
 * MemoryService — consent-gated, structured, durable learner memory with
 * provenance. Reads return what is stored and where it came from; writes
 * happen only when the learner has granted durable memory and has confirmed
 * the fact. Nothing is inferred from voice, accent or vocabulary.
 */

export interface Provenance {
  source: MemorySource;
  sourceSessionId: string | null;
}

export interface MemorySummary {
  consentStatus: Learner["consentStatus"];
  memoryMode: "durable" | "session_only";
  profile: { displayName: string | null; preferredLanguage: LanguageCode };
  preferences: Array<{ id: string; key: string; value: string; source: MemorySource; sourceSessionId: string | null; updatedAt: Date; confirmed: boolean }>;
  activeGoal: { id: string; text: string; source: string; sourceSessionId: string | null; updatedAt: Date } | null;
  enrollments: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    status: string;
    currentLessonTitle: string | null;
    mastery: Array<{ conceptId: string; conceptTitle: string; lessonId: string; state: MasteryState; updatedAt: Date; sourceSessionId: string | null }>;
  }>;
  lastCheckpoint: { summary: string; createdAt: Date; sessionId: string | null } | null;
}

export const memoryService = {
  isDurable(learner: Learner): boolean {
    return memoryModeFor(learner) === "durable";
  },

  async getSummary(db: Queryable, learner: Learner, language: LanguageCode): Promise<MemorySummary> {
    const base: MemorySummary = {
      consentStatus: learner.consentStatus,
      memoryMode: memoryModeFor(learner),
      profile: { displayName: learner.displayName, preferredLanguage: learner.preferredLanguage },
      preferences: [],
      activeGoal: null,
      enrollments: [],
      lastCheckpoint: null,
    };
    if (!memoryService.isDurable(learner)) return base;

    const [prefs, goal, enrollments, checkpoint, courses] = await Promise.all([
      memoryRepo.list(db, learner.id, ["preference"]),
      goalsRepo.findActive(db, learner.id),
      enrollmentsRepo.listForLearner(db, learner.id),
      checkpointsRepo.latestForLearner(db, learner.id),
      courseService.listAll(db),
    ]);
    base.preferences = prefs.map((p) => ({
      id: p.id,
      key: p.key,
      value: typeof p.value === "string" ? p.value : JSON.stringify(p.value),
      source: p.source,
      sourceSessionId: p.sourceSessionId,
      updatedAt: p.updatedAt,
      confirmed: p.userConfirmed,
    }));
    base.activeGoal = goal
      ? { id: goal.id, text: goal.goalText, source: goal.source, sourceSessionId: goal.sourceSessionId, updatedAt: goal.updatedAt }
      : null;

    // One mastery read per enrollment, issued together rather than in turn.
    const masteries = await Promise.all(enrollments.map((e) => progressRepo.listMastery(db, e.id)));
    for (const [i, e] of enrollments.entries()) {
      const course = courses.find((c) => c.id === e.courseId);
      if (!course) continue;
      const mastery = masteries[i];
      base.enrollments.push({
        id: e.id,
        courseId: e.courseId,
        courseTitle: course.title[language],
        status: e.status,
        currentLessonTitle: course.lessons.find((l) => l.id === e.currentLessonId)?.title[language] ?? null,
        mastery: mastery.map((m) => {
          const lesson = course.lessons.find((l) => l.id === m.lessonId);
          const concept = lesson?.concepts.find((c) => c.id === m.conceptId);
          return {
            conceptId: m.conceptId,
            conceptTitle: concept?.title[language] ?? m.conceptId,
            lessonId: m.lessonId,
            state: m.state,
            updatedAt: m.updatedAt,
            sourceSessionId: m.sourceSessionId,
          };
        }),
      });
    }
    if (checkpoint) {
      const course = courses.find((c) => c.id === checkpoint.courseId) ?? null;
      base.lastCheckpoint = {
        summary: renderCheckpointSummary(checkpoint, course, language),
        createdAt: checkpoint.createdAt,
        sessionId: checkpoint.sessionId,
      };
    }
    return base;
  },

  async getPreferences(db: Queryable, learner: Learner): Promise<Partial<Record<PreferenceKey, string>>> {
    if (!memoryService.isDurable(learner)) return {};
    const items = await memoryRepo.list(db, learner.id, ["preference"]);
    const out: Partial<Record<PreferenceKey, string>> = {};
    for (const item of items) {
      if ((item.key === "explanation_style" || item.key === "pace") && typeof item.value === "string") out[item.key] = item.value;
    }
    return out;
  },

  /** Save a learner-confirmed preference. Returns saved: false in session-only mode. */
  async setPreference(
    db: Queryable,
    learner: Learner,
    key: PreferenceKey,
    value: string,
    provenance: Provenance,
  ): Promise<{ saved: boolean }> {
    const parsed = preferenceValueSchemas[key].safeParse(value);
    if (!parsed.success) throw new DomainError("VALIDATION", "That preference value is not supported.", { key });
    if (!memoryService.isDurable(learner)) return { saved: false };
    await memoryRepo.upsert(db, {
      learnerId: learner.id,
      type: "preference",
      key,
      value: parsed.data,
      source: provenance.source,
      sourceSessionId: provenance.sourceSessionId,
      userConfirmed: true,
      confidence: 1,
    });
    await recordEvent(db, "memory.updated", { learnerId: learner.id, sessionId: provenance.sourceSessionId, metadata: { key } });
    return { saved: true };
  },

  /** Learner correction of their goal. Requires durable memory. */
  async correctGoal(db: Db, learner: Learner, goalText: string, provenance: Provenance): Promise<{ saved: boolean; goalId: string | null }> {
    const text = goalText.trim().replace(/\s+/g, " ");
    if (text.length < 3 || text.length > 500) throw new DomainError("VALIDATION", "A goal should be between 3 and 500 characters.");
    if (!memoryService.isDurable(learner)) return { saved: false, goalId: null };
    const source = provenance.source === "learner_settings" ? "settings" : provenance.source === "text_session" ? "text_session" : "voice_session";
    const active = await goalsRepo.findActive(db, learner.id);
    const goal = active
      ? await goalsRepo.updateText(db, active.id, text, source, provenance.sourceSessionId)
      : await db.transaction((tx) =>
          goalsRepo.replaceActive(tx, {
            learnerId: learner.id,
            goalText: text,
            source,
            sourceSessionId: provenance.sourceSessionId,
            idempotencyKey: null,
          }),
        );
    await recordEvent(db, "memory.updated", { learnerId: learner.id, sessionId: provenance.sourceSessionId, metadata: { key: "goal" } });
    return { saved: true, goalId: goal.id };
  },

  async deletePreference(db: Queryable, learner: Learner, memoryId: string): Promise<boolean> {
    const n = await memoryRepo.deleteById(db, learner.id, memoryId);
    if (n > 0) await recordEvent(db, "memory.updated", { learnerId: learner.id, metadata: { deleted: true } });
    return n > 0;
  },

  /** "I'd like to review this again": reset a concept's mastery to introduced. */
  async resetConcept(db: Queryable, learner: Learner, enrollmentId: string, conceptId: string): Promise<boolean> {
    const enrollment = await enrollmentsRepo.findById(db, enrollmentId);
    if (!enrollment || enrollment.learnerId !== learner.id) throw new DomainError("NOT_FOUND", "Enrolment not found.");
    return (await progressRepo.resetMastery(db, learner.id, enrollmentId, conceptId)) > 0;
  },
};
