import { randomUUID } from "node:crypto";
import type { AppConfig } from "@/server/config/env";
import type { Db, Queryable } from "@/server/db/types";
import { learnerService } from "@/server/services/learner-service";
import { sessionService } from "@/server/services/session-service";
import { sessionsRepo } from "@/server/repositories/sessions";
import { runTool } from "@/server/agent/orchestrator";
import type { ConversationCase, Harness, AgentScenario, ScenarioResult } from "./types";
import { LEARNER_TABLES, obj } from "./checks";
import { setEvaluationConfig } from "./config";
import { TEACHING_SCENARIOS } from "./scenarios-teaching";
import { MEMORY_AND_FAILURE_SCENARIOS } from "./scenarios-memory";

/** Runs scenarios against the real orchestrator and database. */

export const AGENT_SCENARIOS: AgentScenario[] = [...TEACHING_SCENARIOS, ...MEMORY_AND_FAILURE_SCENARIOS];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulate a slow database (e.g. a congested network) to exercise timeouts. */
function withLatency(db: Db, ms: number): Db {
  const slow = (q: Queryable): Queryable => ({
    async query(sql, params) {
      await sleep(ms);
      return q.query(sql, params);
    },
  });
  return {
    kind: db.kind,
    query: slow(db).query,
    transaction: (fn) => db.transaction((tx) => fn(slow(tx))),
    execScript: (sql) => db.execScript(sql),
    close: () => db.close(),
  };
}

export async function runScenario(db: Db, scenario: AgentScenario): Promise<ScenarioResult> {
  const failures: string[] = [];
  const { learner: created } = await learnerService.resolveOrCreate(
    db,
    { provider: "dev", subject: `eval-${randomUUID()}` },
    { preferredLanguage: scenario.learner.language },
  );
  let learner =
    scenario.learner.consent === "pending"
      ? created
      : await learnerService.recordConsent(db, created.id, scenario.learner.consent, "browser");
  let session = await sessionService.start(db, { learner, channel: "simulated", provider: "simulation" });

  const harness: Harness = {
    db,
    get learner() {
      return learner;
    },
    get session() {
      return session;
    },
    async call(tool, args = {}, opts = {}) {
      // Like the real adapters, each call starts from the persisted session.
      session = (await sessionsRepo.findById(db, session.id)) ?? session;
      const result = await runTool({
        db: opts.dbLatencyMs ? withLatency(db, opts.dbLatencyMs) : db,
        channel: session.channel,
        learner,
        session,
        toolName: tool,
        rawInput: args,
        interactionId: null,
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
        ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      });
      if (result.session) session = result.session;
      if (result.learner) learner = result.learner;
      return result.response;
    },
    async newSession(channel = "simulated") {
      session = await sessionService.start(db, {
        learner,
        channel,
        provider: channel === "simulated" ? "simulation" : "sarvam",
      });
      return session;
    },
    check(condition, message) {
      if (!condition) failures.push(message);
    },
    async count(table) {
      if (!LEARNER_TABLES.has(table)) throw new Error(`count() is limited to learner tables, got ${table}`);
      const rows = await db.query(`select count(*)::int as n from ${table} where learner_id = $1`, [learner.id]);
      const n = obj(rows[0]).n;
      return typeof n === "number" ? n : Number(n);
    },
  };

  try {
    await scenario.run(harness);
  } catch (e) {
    failures.push(`threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { id: scenario.id, title: scenario.title, passed: failures.length === 0, failures };
}

export async function runAllScenarios(db: Db, config: AppConfig): Promise<ScenarioResult[]> {
  setEvaluationConfig(config);
  const results: ScenarioResult[] = [];
  for (const scenario of AGENT_SCENARIOS) results.push(await runScenario(db, scenario));
  return results;
}

/** Conversation test cases for the provider's agent-testing tools. */
export function conversationCases(): Array<{ id: number; title: string } & ConversationCase> {
  return AGENT_SCENARIOS.map((s) => ({ id: s.id, title: s.title, ...s.conversation }));
}
