import { writeFileSync } from "node:fs";
import { conversationCases } from "@/server/agent/evaluation";
import { arg } from "./_shared";

/**
 * Export the 12 agent scenarios as conversation test cases for running against
 * the configured provider agent (e.g. Sarvam's conversation testing). The
 * in-repo suite (npm test) checks the tools and policies, not the provider LLM.
 */
const out = arg("out") ?? "agent-eval-cases.json";
const cases = conversationCases();
writeFileSync(out, JSON.stringify(cases, null, 2));
console.log(`Wrote ${cases.length} conversation cases to ${out}.`);
