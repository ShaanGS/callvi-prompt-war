/**
 * AgentEvaluation — repeatable scenarios for the parts of the agent the
 * application owns: tool contracts, context, policy, memory and failure
 * handling. Each scenario drives the real orchestrator and database.
 *
 * What this does NOT evaluate: the provider's language model, speech
 * recognition or speech synthesis. Each scenario therefore also carries a
 * conversation script (`conversation`) to run as a test case against the
 * configured Sarvam agent (exported by `npm run agent:eval-export`).
 */

export type { AgentScenario, ConversationCase, Harness, ScenarioResult } from "./types";
export { setEvaluationConfig } from "./config";
export { AGENT_SCENARIOS, conversationCases, runAllScenarios, runScenario } from "./runner";
