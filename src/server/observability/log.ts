import { redactValue } from "../security/redact";

type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined | string[];
}

/**
 * Structured, privacy-minimised logging. Field values pass through redaction:
 * phone-number-like and email-like strings, bearer tokens and long free text
 * are masked before anything is written.
 */
function write(level: Level, event: string, fields: LogFields = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) safe[k] = redactValue(k, v);
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
