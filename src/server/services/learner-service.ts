import type { LanguageCode } from "@/lib/languages";
import type { Db, Queryable } from "../db/types";
import { DomainError } from "../errors";
import { CONSENT_VERSION, type Learner } from "../domain/types";
import { learnersRepo, type IdentityProvider } from "../repositories/learners";
import { sessionsRepo } from "../repositories/sessions";
import { recordEvent } from "./events";
import { deletionService } from "./deletion-service";

/**
 * Learner identity and consent.
 *
 * A learner is only ever resolved from a verified identity: a Supabase Auth
 * user, a signed private browser identity, a development-only identity, or a
 * provider-supplied inbound caller hash. Durable memory still requires consent.
 */
export const learnerService = {
  async resolveOrCreate(
    db: Db,
    identity: { provider: IdentityProvider; subject: string },
    defaults: { preferredLanguage: LanguageCode; phoneLast4?: string | null },
  ): Promise<{ learner: Learner; created: boolean }> {
    const existing = await learnersRepo.findByIdentity(db, identity.provider, identity.subject);
    if (existing) return { learner: existing, created: false };
    try {
      const learner = await db.transaction(async (tx) => {
        const created = await learnersRepo.create(tx, {
          preferredLanguage: defaults.preferredLanguage,
          phoneLast4: defaults.phoneLast4 ?? null,
        });
        await learnersRepo.addIdentity(tx, created.id, identity.provider, identity.subject);
        return created;
      });
      // A concurrent request may have created the identity first; prefer that one.
      const winner = await learnersRepo.findByIdentity(db, identity.provider, identity.subject);
      if (winner && winner.id !== learner.id) {
        await learnersRepo.delete(db, learner.id);
        return { learner: winner, created: false };
      }
      await recordEvent(db, "learner.identified", {
        learnerId: learner.id,
        metadata: { provider: identity.provider, created: true },
      });
      return { learner, created: true };
    } catch (e) {
      const raced = await learnersRepo.findByIdentity(db, identity.provider, identity.subject);
      if (raced) return { learner: raced, created: false };
      throw e;
    }
  },

  async get(db: Queryable, learnerId: string): Promise<Learner> {
    const learner = await learnersRepo.findById(db, learnerId);
    if (!learner) throw new DomainError("NOT_FOUND", "Learner not found.");
    return learner;
  },

  async updateProfile(
    db: Queryable,
    learnerId: string,
    patch: { displayName?: string | null; preferredLanguage?: LanguageCode },
  ) {
    const displayName = patch.displayName === undefined ? undefined : patch.displayName?.trim() || null;
    if (displayName && displayName.length > 80) throw new DomainError("VALIDATION", "Name is too long.");
    return learnersRepo.updateProfile(db, learnerId, { displayName, preferredLanguage: patch.preferredLanguage });
  },

  async completeOnboarding(db: Queryable, learnerId: string): Promise<void> {
    await learnersRepo.markOnboarded(db, learnerId);
  },

  /**
   * Record a grant or decline. Declining keeps learning available but
   * session-only; nothing durable is written while consent is not granted.
   */
  async recordConsent(
    db: Db,
    learnerId: string,
    decision: "granted" | "declined",
    channel: "browser" | "phone" | "text" | "settings",
    sourceSessionId: string | null = null,
  ): Promise<Learner> {
    const learner = await db.transaction(async (tx) => {
      const updated = await learnersRepo.setConsent(tx, learnerId, decision, CONSENT_VERSION);
      await learnersRepo.insertConsentRecord(tx, {
        learnerId,
        decision,
        version: CONSENT_VERSION,
        channel,
        sessionId: sourceSessionId,
      });
      await sessionsRepo.setMemoryMode(tx, learnerId, decision === "granted" ? "durable" : "session_only");
      return updated;
    });
    await recordEvent(db, decision === "granted" ? "consent.granted" : "consent.declined", { learnerId, channel });
    return learner;
  },

  /**
   * Revoke consent: stop saving immediately and erase durable learning memory
   * (goals, enrolments, progress, checkpoints, attempts, preferences).
   */
  async revokeConsent(db: Db, learnerId: string, channel: "browser" | "phone" | "text" | "settings"): Promise<Learner> {
    await deletionService.deleteLearningMemory(db, learnerId, channel);
    const learner = await db.transaction(async (tx) => {
      const updated = await learnersRepo.setConsent(tx, learnerId, "revoked", CONSENT_VERSION);
      await learnersRepo.insertConsentRecord(tx, { learnerId, decision: "revoked", version: CONSENT_VERSION, channel });
      await sessionsRepo.setMemoryMode(tx, learnerId, "session_only");
      return updated;
    });
    await recordEvent(db, "consent.revoked", { learnerId, channel });
    return learner;
  },
};
