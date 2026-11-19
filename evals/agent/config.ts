import type { AppConfig } from "@/server/config/env";

/** The app configuration scenario 12 needs; the runner sets it. */

let evalConfig: AppConfig | null = null;
/** Configuration used by scenario 12; set by the runner. */
export function setEvaluationConfig(config: AppConfig): void {
  evalConfig = config;
}
export function evaluationConfig(): AppConfig {
  if (!evalConfig) throw new Error("Evaluation config not set");
  return evalConfig;
}
