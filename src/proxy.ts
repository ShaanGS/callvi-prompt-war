import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "./server/config/env";
import {
  BROWSER_IDENTITY_COOKIE,
  BROWSER_IDENTITY_MAX_AGE,
  issueBrowserIdentity,
  verifyBrowserIdentity,
} from "./server/auth/browser-identity";

/**
 * Issues a private browser identity before the first page render and refreshes
 * existing Supabase operator sessions. Authorisation stays in pages and APIs.
 */
export async function proxy(request: NextRequest) {
  // Issue only on page visits. API requests must present an existing identity.
  // Forward the cookie into this request too, so the first render can use it.
  const appConfig = getConfig();
  let browserToken: string | null = null;
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    !verifyBrowserIdentity(appConfig.signingSecret, request.cookies.get(BROWSER_IDENTITY_COOKIE)?.value)
  ) {
    browserToken = issueBrowserIdentity(appConfig.signingSecret);
    request.cookies.set(BROWSER_IDENTITY_COOKIE, browserToken);
  }
  const withBrowserCookie = (response: NextResponse) => {
    if (browserToken)
      response.cookies.set(BROWSER_IDENTITY_COOKIE, browserToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: appConfig.isProduction,
        path: "/",
        maxAge: BROWSER_IDENTITY_MAX_AGE,
      });
    return response;
  };
  const url = appConfig.auth.supabase?.url;
  const anonKey = appConfig.auth.supabase?.anonKey;
  if (!url || !anonKey || !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    return withBrowserCookie(NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return withBrowserCookie(response);
}

export const config = {
  // Skip static assets and the provider tool callbacks (server-to-server, no cookies).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/voice/tools|.*\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
