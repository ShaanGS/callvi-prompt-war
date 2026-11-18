/**
 * Redaction helpers for logs and stored operational traces.
 * Nothing that could identify a learner (phone numbers, emails, free-text
 * answers, tokens) should reach logs or the tool trace table.
 */

const PHONE_LIKE = /\+?\d[\d\s-]{7,}\d/g;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const BEARER = /bearer\s+[a-z0-9._~+/=-]+/gi;
const TOKEN_LIKE = /\blcv1\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi;
/** Codes, PINs, OTPs and account fragments (4+ digits). Prices such as 120 are kept. */
const DIGIT_RUN = /\b\d{4,}\b/g;

const SENSITIVE_KEYS = new Set([
  "answer_text",
  "goal_text",
  "summary",
  "transcript",
  "user_identifier",
  "phone",
  "email",
  "authorization",
  "token",
  "value",
  "display_name",
  "learner_difficulty",
]);

export function redactText(text: string): string {
  return text
    .replace(BEARER, "Bearer [redacted]")
    .replace(TOKEN_LIKE, "[voice-token]")
    .replace(EMAIL_LIKE, "[email]")
    .replace(PHONE_LIKE, "[number]")
    .replace(DIGIT_RUN, "[digits]");
}

export function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return typeof value === "string" ? `[redacted:${value.length}]` : "[redacted]";
  }
  if (typeof value === "string") return redactText(value).slice(0, 200);
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? redactText(v).slice(0, 80) : v));
  return value;
}

/**
 * Describe a tool request without its values: argument names, types and
 * string lengths only. Safe to persist in tool_invocations.request_summary.
 */
export function summariseArgs(args: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") out[k] = `string(${v.length})`;
    else if (typeof v === "number") out[k] = SENSITIVE_KEYS.has(k) ? "number" : `number(${v})`;
    else if (typeof v === "boolean") out[k] = `boolean(${v})`;
    else if (v === null) out[k] = "null";
    else if (Array.isArray(v)) out[k] = `array(${v.length})`;
    else out[k] = typeof v;
  }
  return out;
}
