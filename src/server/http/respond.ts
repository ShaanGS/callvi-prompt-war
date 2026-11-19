import { NextResponse } from "next/server";
import { HTTP_STATUS, toDomainError } from "../errors";
import { log } from "../observability/log";
import { clientIp } from "./client-ip";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Route-handler wrapper: route handlers validate, authenticate and call a
 * service; this turns domain errors into stable, privacy-safe JSON errors.
 */
export async function handle(fn: () => Promise<NextResponse | Response>): Promise<NextResponse | Response> {
  try {
    return await fn();
  } catch (e) {
    const err = toDomainError(e);
    if (err.code === "INTERNAL") log.error("route.failed", { error: e instanceof Error ? `${e.name}: ${e.message}` : "unknown" });
    const headers: Record<string, string> = {};
    if (err.code === "RATE_LIMITED" && typeof err.detail?.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(err.detail.retryAfterSeconds);
    }
    return json({ ok: false, error: { code: err.code, message: err.message } }, HTTP_STATUS[err.code], headers);
  }
}

export function clientKey(request: Request): string {
  return clientIp(request.headers);
}
