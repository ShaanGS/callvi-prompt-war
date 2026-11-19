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
const RESERVED = new Set(["level", "event", "at"]);

function write(level: Level, event: string, fields: LogFields = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    // A caller field must never relabel the line: `{ level: "info" }` on an
    // error would hide it from alerting. Reserved names are kept, but prefixed.
    safe[RESERVED.has(k) ? `field_${k}` : k] = redactValue(k, v);
  }
  const line = JSON.stringify({ ...safe, level, event, at: new Date().toISOString() });
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
