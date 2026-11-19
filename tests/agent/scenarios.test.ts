import { beforeAll, describe, expect, it } from "vitest";
import { AGENT_SCENARIOS, runScenario, setEvaluationConfig } from "../../evals/agent";
import type { Db } from "@/server/db/types";
import { resetRateLimitsForTests } from "@/server/security/rate-limit";
import { createTestDb } from "../support/test-db";
import { testConfig } from "../support/config";

describe("AgentEvaluation scenarios", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    setEvaluationConfig(testConfig());
    resetRateLimitsForTests();
  });

  it("defines the 12 required scenarios", () => {
    expect(AGENT_SCENARIOS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const s of AGENT_SCENARIOS) {
      expect(s.conversation.learnerSays.length).toBeGreaterThan(0);
      expect(s.conversation.expectedBehaviour.length).toBeGreaterThan(0);
    }
  });

  for (const scenario of AGENT_SCENARIOS) {
    it(`scenario ${scenario.id}: ${scenario.title}`, async () => {
      const result = await runScenario(db, scenario);
      expect(result.failures).toEqual([]);
    });
  }
});
