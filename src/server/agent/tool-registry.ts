import { z } from "zod";
import { TOOLS } from "./tools";
import { isToolName, type RegisteredTool, type ToolName } from "./tool-types";

/**
 * ToolRegistry — the single source of truth for the learning tool surface:
 * names, descriptions, input schemas, kinds (read / session / write),
 * idempotency strategy and provider lifecycle hooks. Provider configuration
 * (scripts/sarvam-config.ts) and dispatch both read from here.
 */
const registry = new Map<ToolName, RegisteredTool>(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): RegisteredTool | null {
  return isToolName(name) ? (registry.get(name) ?? null) : null;
}

export function listTools(): RegisteredTool[] {
  return [...registry.values()];
}

export interface ToolManifestEntry {
  name: ToolName;
  kind: RegisteredTool["kind"];
  lifecycle: "run" | "on_start" | "on_end";
  description: string;
  parameters: unknown;
}

/** JSON-schema manifest of the tools, used to configure the voice provider. */
export function toolManifest(): ToolManifestEntry[] {
  return listTools().map((t) => ({
    name: t.name,
    kind: t.kind,
    lifecycle: t.lifecycle ?? "run",
    description: t.description,
    parameters: z.toJSONSchema(t.inputSchema, { io: "input", unrepresentable: "any" }),
  }));
}
