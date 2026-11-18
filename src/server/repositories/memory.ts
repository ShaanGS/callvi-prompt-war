import { z } from "zod";
import { col, exec, jsonParam, many, one, type Queryable } from "../db/types";
import { MEMORY_TYPES, type MemoryItem, type MemorySource, type MemoryType } from "../domain/types";

const memoryRow = z
  .object({
    id: col.uuid,
    learner_id: col.uuid,
    memory_type: z.enum(MEMORY_TYPES),
    memory_key: z.string(),
    memory_value: z.unknown(),
    source: z.enum(["learner_settings", "onboarding", "voice_session", "text_session", "system"]),
    source_session_id: col.uuid.nullable(),
    confidence: col.nullableReal,
    user_confirmed: col.bool,
    created_at: col.date,
    updated_at: col.date,
  })
  .transform(
    (r): MemoryItem => ({
      id: r.id,
      learnerId: r.learner_id,
      type: r.memory_type,
      key: r.memory_key,
      value: r.memory_value,
      source: r.source,
      sourceSessionId: r.source_session_id,
      confidence: r.confidence,
      userConfirmed: r.user_confirmed,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );
const MEMORY_COLUMNS = `id, learner_id, memory_type, memory_key, memory_value, source, source_session_id, confidence,
  user_confirmed, created_at, updated_at`;

export const memoryRepo = {
  async list(db: Queryable, learnerId: string, types?: MemoryType[]): Promise<MemoryItem[]> {
    return many(
      db,
      memoryRow,
      `select ${MEMORY_COLUMNS} from learner_memory where learner_id = $1
       ${types ? "and memory_type = any($2::text[])" : ""} order by memory_type, memory_key`,
      types ? [learnerId, types] : [learnerId],
    );
  },

  async upsert(
    db: Queryable,
    input: {
      learnerId: string;
      type: MemoryType;
      key: string;
      value: unknown;
      source: MemorySource;
      sourceSessionId: string | null;
      userConfirmed: boolean;
      confidence?: number | null;
    },
  ): Promise<MemoryItem> {
    return one(
      db,
      memoryRow,
      `insert into learner_memory (learner_id, memory_type, memory_key, memory_value, source, source_session_id, user_confirmed, confidence)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       on conflict (learner_id, memory_type, memory_key) do update set
         memory_value = excluded.memory_value, source = excluded.source,
         source_session_id = excluded.source_session_id, user_confirmed = excluded.user_confirmed,
         confidence = excluded.confidence
       returning ${MEMORY_COLUMNS}`,
      [
        input.learnerId,
        input.type,
        input.key,
        jsonParam(input.value),
        input.source,
        input.sourceSessionId,
        input.userConfirmed,
        input.confidence ?? null,
      ],
    );
  },

  async deleteById(db: Queryable, learnerId: string, id: string): Promise<number> {
    const rows = await db.query(`delete from learner_memory where learner_id = $1 and id = $2 returning id`, [learnerId, id]);
    return rows.length;
  },

  async deleteAll(db: Queryable, learnerId: string): Promise<number> {
    const rows = await db.query(`delete from learner_memory where learner_id = $1 returning id`, [learnerId]);
    return rows.length;
  },

  async deleteKey(db: Queryable, learnerId: string, type: MemoryType, key: string): Promise<void> {
    await exec(db, `delete from learner_memory where learner_id = $1 and memory_type = $2 and memory_key = $3`, [learnerId, type, key]);
  },
};
