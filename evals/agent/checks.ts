import type { ToolResponse } from "@/server/agent/orchestrator";

/** Small assertions shared by the scenarios. */

export const LEARNER_TABLES = new Set([
  "learner_goals",
  "enrollments",
  "practice_attempts",
  "learning_checkpoints",
  "learner_memory",
  "concept_mastery",
]);
export const SHAMING = /\b(wrong!|stupid|lazy|careless|failed|bad answer|obviously)\b/i;
export const TAMIL = /[஀-௿]/;

export function ok(r: ToolResponse): r is Extract<ToolResponse, { ok: true }> {
  return r.ok;
}
export function errorCode(r: ToolResponse): string | null {
  return r.ok ? null : r.error.code;
}
export function field(r: ToolResponse, key: string): unknown {
  return r.ok ? r.data[key] : undefined;
}
export function obj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
