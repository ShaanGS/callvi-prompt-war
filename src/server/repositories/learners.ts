import { z } from "zod";
import { col, exec, many, maybeOne, one, type Queryable } from "../db/types";
import { CONSENT_STATUSES, languageSchema, type Learner, type StaffRole } from "../domain/types";

const learnerRow = z
  .object({
    id: col.uuid,
    display_name: col.nullableText,
    preferred_language: languageSchema,
    caller_id_known: z.boolean(),
    consent_status: z.enum(CONSENT_STATUSES),
    consent_version: col.nullableText,
    consent_updated_at: col.nullableDate,
    onboarding_completed_at: col.nullableDate,
    created_at: col.date,
    updated_at: col.date,
  })
  .transform((r): Learner => ({
    id: r.id,
    displayName: r.display_name,
    preferredLanguage: r.preferred_language,
    callerIdKnown: r.caller_id_known,
    consentStatus: r.consent_status,
    consentVersion: r.consent_version,
    consentUpdatedAt: r.consent_updated_at,
    onboardingCompletedAt: r.onboarding_completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

const LEARNER_COLUMNS = `id, display_name, preferred_language, caller_id_known, consent_status, consent_version,
  consent_updated_at, onboarding_completed_at, created_at, updated_at`;

export type IdentityProvider = "supabase" | "dev" | "phone" | "browser";

export const learnersRepo = {
  async findById(db: Queryable, id: string): Promise<Learner | null> {
    return maybeOne(db, learnerRow, `select ${LEARNER_COLUMNS} from learners where id = $1`, [id]);
  },

  async findByIdentity(db: Queryable, provider: IdentityProvider, subject: string): Promise<Learner | null> {
    return maybeOne(
      db,
      learnerRow,
      `select ${LEARNER_COLUMNS.split(",")
        .map((c) => `l.${c.trim()}`)
        .join(", ")}
       from learner_identities i join learners l on l.id = i.learner_id
       where i.provider = $1 and i.subject = $2`,
      [provider, subject],
    );
  },

  async create(
    db: Queryable,
    input: { preferredLanguage: Learner["preferredLanguage"]; callerIdKnown?: boolean; displayName?: string | null },
  ): Promise<Learner> {
    return one(
      db,
      learnerRow,
      `insert into learners (preferred_language, caller_id_known, display_name) values ($1, $2, $3)
       returning ${LEARNER_COLUMNS}`,
      [input.preferredLanguage, input.callerIdKnown ?? false, input.displayName ?? null],
    );
  },

  async addIdentity(db: Queryable, learnerId: string, provider: IdentityProvider, subject: string): Promise<void> {
    await exec(
      db,
      `insert into learner_identities (learner_id, provider, subject) values ($1, $2, $3)
       on conflict (provider, subject) do nothing`,
      [learnerId, provider, subject],
    );
  },

  async updateProfile(
    db: Queryable,
    id: string,
    patch: { displayName?: string | null; preferredLanguage?: Learner["preferredLanguage"] },
  ): Promise<Learner> {
    return one(
      db,
      learnerRow,
      `update learners set
         display_name = case when $2::boolean then $3 else display_name end,
         preferred_language = coalesce($4, preferred_language)
       where id = $1 returning ${LEARNER_COLUMNS}`,
      [id, patch.displayName !== undefined, patch.displayName ?? null, patch.preferredLanguage ?? null],
    );
  },

  async setConsent(db: Queryable, id: string, status: Learner["consentStatus"], version: string): Promise<Learner> {
    return one(
      db,
      learnerRow,
      `update learners set consent_status = $2, consent_version = $3, consent_updated_at = now()
       where id = $1 returning ${LEARNER_COLUMNS}`,
      [id, status, version],
    );
  },

  async markOnboarded(db: Queryable, id: string): Promise<void> {
    await exec(
      db,
      `update learners set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = $1`,
      [id],
    );
  },

  async insertConsentRecord(
    db: Queryable,
    input: {
      learnerId: string;
      decision: "granted" | "declined" | "revoked";
      version: string;
      channel: string;
      sessionId?: string | null;
    },
  ): Promise<void> {
    await exec(
      db,
      `insert into consent_records (learner_id, decision, consent_version, channel, source_session_id)
       values ($1, $2, $3, $4, $5)`,
      [input.learnerId, input.decision, input.version, input.channel, input.sessionId ?? null],
    );
  },

  async listConsentRecords(db: Queryable, learnerId: string) {
    return many(
      db,
      z.object({ decision: z.string(), consent_version: z.string(), channel: z.string(), created_at: col.date }),
      `select decision, consent_version, channel, created_at from consent_records
       where learner_id = $1 order by created_at desc limit 20`,
      [learnerId],
    );
  },

  async delete(db: Queryable, id: string): Promise<number> {
    const rows = await db.query(`delete from learners where id = $1 returning id`, [id]);
    return rows.length;
  },
};

const staffRow = z.object({ id: col.uuid, role: z.enum(["admin", "staff"]), email_hint: col.nullableText });

export const staffRepo = {
  async findRole(db: Queryable, provider: "supabase" | "dev", subject: string): Promise<StaffRole | null> {
    const row = await maybeOne(
      db,
      staffRow,
      `select id, role, email_hint from staff_members where provider = $1 and subject = $2`,
      [provider, subject],
    );
    return row?.role ?? null;
  },

  async grant(
    db: Queryable,
    input: { provider: "supabase" | "dev"; subject: string; role: StaffRole; emailHint?: string | null },
  ): Promise<void> {
    await exec(
      db,
      `insert into staff_members (provider, subject, role, email_hint) values ($1, $2, $3, $4)
       on conflict (provider, subject) do update set role = excluded.role, email_hint = excluded.email_hint`,
      [input.provider, input.subject, input.role, input.emailHint ?? null],
    );
  },

  async revoke(db: Queryable, provider: "supabase" | "dev", subject: string): Promise<void> {
    await exec(db, `delete from staff_members where provider = $1 and subject = $2`, [provider, subject]);
  },
};
