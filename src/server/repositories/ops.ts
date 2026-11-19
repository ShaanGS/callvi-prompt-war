import { z } from "zod";
import { col, exec, jsonParam, maybeOne, type Queryable } from "../db/types";
import type { Channel } from "../domain/types";

const invocationRow = z.object({
  id: col.uuid,
  tool_name: z.string(),
  status: z.enum(["started", "succeeded", "failed", "rejected"]),
  response: z.unknown(),
  created_at: col.date,
});
export type InvocationRecord = z.infer<typeof invocationRow>;

export const toolInvocationsRepo = {
  async findByKey(db: Queryable, idempotencyKey: string): Promise<InvocationRecord | null> {
    return maybeOne(
      db,
      invocationRow,
      `select id, tool_name, status, response, created_at from tool_invocations where idempotency_key = $1`,
      [idempotencyKey],
    );
  },

  /** Claim an idempotency key. Returns null if the key already exists. */
  async start(
    db: Queryable,
    input: {
      toolName: string;
      channel: Channel;
      learnerId: string | null;
      sessionId: string | null;
      providerInteractionId: string | null;
      idempotencyKey: string;
      requestSummary: Record<string, string>;
    },
  ): Promise<string | null> {
    const row = await maybeOne(
      db,
      z.object({ id: col.uuid }),
      `insert into tool_invocations (tool_name, channel, learner_id, session_id, provider_interaction_id, idempotency_key, status, request_summary)
       values ($1, $2, $3, $4, $5, $6, 'started', $7::jsonb)
       on conflict (idempotency_key) do nothing returning id`,
      [
        input.toolName,
        input.channel,
        input.learnerId,
        input.sessionId,
        input.providerInteractionId,
        input.idempotencyKey,
        jsonParam(input.requestSummary),
      ],
    );
    return row?.id ?? null;
  },

  async finish(
    db: Queryable,
    id: string,
    input: {
      status: "succeeded" | "failed" | "rejected";
      latencyMs: number;
      errorCode: string | null;
      response: unknown | null;
    },
  ): Promise<void> {
    await exec(
      db,
      `update tool_invocations set status = $2, latency_ms = $3, error_code = $4, response = $5::jsonb, completed_at = now()
       where id = $1`,
      [id, input.status, input.latencyMs, input.errorCode, input.response === null ? null : jsonParam(input.response)],
    );
  },

  async markReplayed(db: Queryable, idempotencyKey: string): Promise<void> {
    await exec(db, `update tool_invocations set replay_count = replay_count + 1 where idempotency_key = $1`, [
      idempotencyKey,
    ]);
  },

  /** Allow a failed/abandoned invocation to be retried under the same key. */
  async release(db: Queryable, idempotencyKey: string): Promise<void> {
    await exec(db, `delete from tool_invocations where idempotency_key = $1 and status in ('failed', 'rejected')`, [
      idempotencyKey,
    ]);
  },

  async deleteForLearner(db: Queryable, learnerId: string): Promise<number> {
    const rows = await db.query(`delete from tool_invocations where learner_id = $1 returning id`, [learnerId]);
    return rows.length;
  },
};

export const eventsRepo = {
  async record(
    db: Queryable,
    input: {
      name: string;
      learnerId?: string | null;
      sessionId?: string | null;
      channel?: string | null;
      metadata?: Record<string, string | number | boolean | null>;
    },
  ): Promise<void> {
    await exec(
      db,
      `insert into app_events (event_name, learner_id, session_id, channel, metadata) values ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.name,
        input.learnerId ?? null,
        input.sessionId ?? null,
        input.channel ?? null,
        jsonParam(input.metadata ?? {}),
      ],
    );
  },

  async deleteForLearner(db: Queryable, learnerId: string): Promise<number> {
    const rows = await db.query(`delete from app_events where learner_id = $1 returning id`, [learnerId]);
    return rows.length;
  },
};

export const deletionReceiptsRepo = {
  async record(
    db: Queryable,
    input: { scope: "learning_memory" | "account"; channel: string; rowsDeleted: number },
  ): Promise<void> {
    await exec(db, `insert into deletion_receipts (scope, channel, rows_deleted) values ($1, $2, $3)`, [
      input.scope,
      input.channel,
      input.rowsDeleted,
    ]);
  },
};
