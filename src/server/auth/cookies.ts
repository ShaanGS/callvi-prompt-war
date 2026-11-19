import { getConfig } from "../config/env";

/** Cookie names shared by server actions and pages. */
export { UI_LANGUAGE_COOKIE } from "./actor";

/** Session-only goal (memory declined): a browser-session cookie, never stored in the database. */
export const SESSION_GOAL_COOKIE = "lc_session_goal";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Options for every cookie the app sets itself: unreadable from page scripts,
 * not sent on cross-site subrequests, and HTTPS-only in production. Omitting
 * maxAge makes it a browser-session cookie.
 */
export function appCookieOptions(opts: { persistent?: boolean } = {}) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: getConfig().isProduction,
    ...(opts.persistent ? { maxAge: ONE_YEAR_SECONDS } : {}),
  };
}
