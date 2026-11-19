import { afterEach, describe, expect, it } from "vitest";
import { appCookieOptions } from "@/server/auth/cookies";
import { setConfigForTests } from "@/server/config/env";
import { testConfig } from "../support/config";

/** The options every cookie the app sets itself is written with. */
describe("app cookie options", () => {
  afterEach(() => {
    testConfig();
  });

  it("keeps cookies away from page scripts and cross-site subrequests", () => {
    testConfig();
    expect(appCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("marks cookies HTTPS-only in production", () => {
    setConfigForTests({ ...testConfig(), isProduction: true });
    expect(appCookieOptions().secure).toBe(true);
  });

  it("allows plain HTTP only outside production, for local development", () => {
    testConfig();
    expect(appCookieOptions().secure).toBe(false);
  });

  it("is a browser-session cookie unless asked to persist, and then lasts a year", () => {
    testConfig();
    expect(appCookieOptions()).not.toHaveProperty("maxAge");
    expect(appCookieOptions({ persistent: true }).maxAge).toBe(60 * 60 * 24 * 365);
  });
});
