import type { LanguageCode } from "@/lib/languages";
import type { Db } from "@/server/db/types";
import type { Channel, Learner, LearningSession } from "@/server/domain/types";
import type { ToolResponse } from "@/server/agent/orchestrator";

/** The shapes the agent evaluation works with. */

export interface ConversationCase {
  learnerSays: string[];
  expectedBehaviour: string[];
}

export interface Harness {
  db: Db;
  learner: Learner;
  session: LearningSession;
  /** Run a tool through the orchestrator as the agent would. */
  call(
    tool: string,
    args?: Record<string, unknown>,
    opts?: { timeoutMs?: number; idempotencyKey?: string; dbLatencyMs?: number },
  ): Promise<ToolResponse>;
  /** Start a fresh session for the same learner (a later, separate session). */
  newSession(channel?: Channel): Promise<LearningSession>;
  check(condition: boolean, message: string): void;
  count(table: string): Promise<number>;
}

export interface AgentScenario {
  id: number;
  title: string;
  learner: { consent: "granted" | "declined" | "pending"; language: LanguageCode };
  conversation: ConversationCase;
  run(h: Harness): Promise<void>;
}

export interface ScenarioResult {
  id: number;
  title: string;
  passed: boolean;
  failures: string[];
}
