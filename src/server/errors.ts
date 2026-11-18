/**
 * Stable domain error codes. Route handlers translate these into HTTP status
 * codes; messages are safe to show to learners and never contain personal data.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONSENT_REQUIRED",
  "POLICY_VIOLATION",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "NOT_CONFIGURED",
  "PROVIDER_UNAVAILABLE",
  "TIMEOUT",
  "SESSION_CLOSED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    /** Non-sensitive, structured detail (e.g. which field failed). */
    public readonly detail?: Record<string, string | number | boolean | string[]>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONSENT_REQUIRED: 409,
  POLICY_VIOLATION: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  NOT_CONFIGURED: 503,
  PROVIDER_UNAVAILABLE: 502,
  TIMEOUT: 504,
  SESSION_CLOSED: 409,
  INTERNAL: 500,
};

export function toDomainError(e: unknown): DomainError {
  if (isDomainError(e)) return e;
  return new DomainError("INTERNAL", "Something went wrong on our side.");
}
