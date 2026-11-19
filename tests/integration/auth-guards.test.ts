import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/types";
import { issueBrowserIdentity, BROWSER_IDENTITY_COOKIE } from "@/server/auth/browser-identity";
import { DEV_COOKIE, signDevIdentity } from "@/server/auth/dev-identity";
import { staffRepo } from "@/server/repositories/learners";
import { testConfig } from "../support/config";
import { createTestDb } from "../support/test-db";

/**
 * The guards in actor.ts decide who reaches the educator dashboard and whose
 * data a request acts on. Next's request APIs are replaced with a cookie jar
 * the test controls; everything below them (signature checks, the database,
 * staff lookups) is real.
 */
const jar = new Map<string, string>();
let db: Db;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  }),
}));

class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

vi.mock("@/server/db/client", () => ({ getDb: async () => db }));

const config = testConfig();
const { getCurrentLearner, getIdentity, getStaffRole, requireLearnerApi, requireStaffPage } =
  await import("@/server/auth/actor");

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Redirected) return e.to;
    throw e;
  }
  throw new Error("expected a redirect");
}

function signInAsDev(sub: string) {
  jar.set(DEV_COOKIE, signDevIdentity(config, sub, "Teacher").value);
}

describe("request identity and guards", () => {
  beforeEach(async () => {
    jar.clear();
    db = await createTestDb();
  });

  it("treats a request with no cookies as nobody", async () => {
    expect(await getIdentity()).toBeNull();
    await expect(requireLearnerApi()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("ignores a browser identity whose signature does not verify", async () => {
    const forged = issueBrowserIdentity("a-different-secret-0123456789abcdef-0123456789");
    jar.set(BROWSER_IDENTITY_COOKIE, forged);
    expect(await getIdentity()).toBeNull();
  });

  it("creates a learner for a valid browser identity, and returns the same one next time", async () => {
    jar.set(BROWSER_IDENTITY_COOKIE, issueBrowserIdentity(config.signingSecret));
    const first = await getCurrentLearner();
    const second = await getCurrentLearner();
    expect(first?.id).toBeDefined();
    expect(second?.id).toBe(first?.id);
  });

  it("never gives a browser identity a staff role, and the database cannot hold one", async () => {
    jar.set(BROWSER_IDENTITY_COOKIE, issueBrowserIdentity(config.signingSecret));
    const identity = await getIdentity();
    expect(identity?.provider).toBe("browser");
    expect(await getStaffRole()).toBeNull();
    // Second layer: the schema refuses a staff row for a browser identity at all.
    await expect(
      db.query(`insert into staff_members (provider, subject, role) values ('browser', $1, 'admin')`, [
        identity!.subject,
      ]),
    ).rejects.toThrow();
    // A browser visitor is sent to sign in, not shown the dashboard.
    expect(await redirectOf(requireStaffPage())).toBe("/sign-in?next=/staff");
  });

  it("sends a signed-in person who is not staff home, with no hint the dashboard exists", async () => {
    signInAsDev("11111111-1111-4111-8111-111111111111");
    expect(await redirectOf(requireStaffPage())).toBe("/home");
  });

  it("lets staff through with their role", async () => {
    const sub = "22222222-2222-4222-8222-222222222222";
    await staffRepo.grant(db, { provider: "dev", subject: sub, role: "admin" });
    signInAsDev(sub);
    expect(await requireStaffPage()).toMatchObject({ role: "admin", identity: { provider: "dev", subject: sub } });
  });

  it("stops honouring a staff role the moment it is revoked", async () => {
    const sub = "33333333-3333-4333-8333-333333333333";
    await staffRepo.grant(db, { provider: "dev", subject: sub, role: "admin" });
    await staffRepo.revoke(db, "dev", sub);
    signInAsDev(sub);
    expect(await redirectOf(requireStaffPage())).toBe("/home");
  });
});
