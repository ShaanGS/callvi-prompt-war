import { describe, expect, it } from "vitest";
import { issueBrowserIdentity, verifyBrowserIdentity, BROWSER_IDENTITY_MAX_AGE } from "@/server/auth/browser-identity";
import { signDevIdentity } from "@/server/auth/dev-identity";
import { buildConfig } from "@/server/config/env";

const secret = "browser-test-signing-secret-0123456789abcdef";

describe("private browser identity", () => {
  it("keeps separate browsers isolated and preserves a browser's identity", () => {
    const first = issueBrowserIdentity(secret);
    const second = issueBrowserIdentity(secret);
    const subject = verifyBrowserIdentity(secret, first);
    expect(subject).toMatch(/^[0-9a-f-]{36}$/);
    expect(verifyBrowserIdentity(secret, first)).toBe(subject);
    expect(verifyBrowserIdentity(secret, second)).not.toBe(subject);
  });

  it("rejects tampering, another signing key, malformed and expired cookies", () => {
    const now = Date.now();
    const token = issueBrowserIdentity(secret, now);
    expect(verifyBrowserIdentity(secret, `${token}x`)).toBeNull();
    expect(verifyBrowserIdentity("different-secret", token)).toBeNull();
    expect(verifyBrowserIdentity(secret, `${token}.extra`)).toBeNull();
    expect(verifyBrowserIdentity(secret, undefined)).toBeNull();
    expect(verifyBrowserIdentity(secret, token, now + BROWSER_IDENTITY_MAX_AGE * 1000)).toBeNull();
  });

  it("does not accept a development sign-in token as a browser identity", () => {
    const config = buildConfig({ NODE_ENV: "development", APP_SIGNING_SECRET: secret });
    const dev = signDevIdentity(config, "6f1d1c9e-1111-4222-8333-444455556666", "Staff");
    expect(verifyBrowserIdentity(secret, dev.value)).toBeNull();
  });
});
