import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/types";
import {
  handleSarvamToolCallback,
  toSarvamResponseBody,
  withCallContext,
} from "@/server/providers/sarvam/tool-callback";
import { browserSessionConfig, sarvamProvider } from "@/server/providers/sarvam/sarvam-provider";
import { sarvamToolSetup } from "@/server/providers/sarvam/agent-setup";
import { issueVoiceToken } from "@/server/security/voice-token";
import { hashPhone } from "@/server/security/phone";
import { resetRateLimitsForTests } from "@/server/security/rate-limit";
import type { AppConfig } from "@/server/config/env";
import { createLearner, createTestDb, startSession } from "../support/test-db";
import { TEST_TOOL_SECRET_BROWSER, TEST_TOOL_SECRET_PHONE, testConfig } from "../support/config";

let db: Db;
let config: AppConfig;
let n = 0;
const key = () => `client-${n++}`;

beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => {
  config = testConfig();
  resetRateLimitsForTests();
});

function call(authorization: string | null, toolName: string, body: unknown) {
  return handleSarvamToolCallback(db, config, { authorization, toolName, body, clientKey: key() });
}

describe("tool callback authentication", () => {
  it("rejects a missing or invalid secret", async () => {
    expect((await call(null, "get_learning_context", { interaction_id: "a" })).status).toBe(401);
    expect((await call("Bearer wrong-secret", "get_learning_context", { interaction_id: "a" })).status).toBe(401);
    expect((await call(TEST_TOOL_SECRET_BROWSER, "get_learning_context", { interaction_id: "a" })).status).toBe(401);
  });

  // A wrong guess used to cost nothing: the per-IP limit only ran after a valid
  // secret. Failures are now counted, and the lockout is checked before compare.
  it("locks out an address after repeated wrong secrets, even if the next guess is right", async () => {
    const guesser = (authorization: string) =>
      handleSarvamToolCallback(db, config, {
        authorization,
        toolName: "get_learning_context",
        body: { interaction_id: "g" },
        clientKey: "guesser",
      });
    for (let i = 0; i < 10; i++) expect((await guesser("Bearer wrong")).status).toBe(401);
    expect((await guesser("Bearer wrong")).status).toBe(429);
    expect((await guesser(`Bearer ${TEST_TOOL_SECRET_BROWSER}`)).status).toBe(429);
  });

  it("does not charge a correct secret against another address's lockout", async () => {
    for (let i = 0; i < 10; i++) {
      await handleSarvamToolCallback(db, config, {
        authorization: "Bearer wrong",
        toolName: "get_learning_context",
        body: { interaction_id: "g" },
        clientKey: "guesser",
      });
    }
    const honest = await handleSarvamToolCallback(db, config, {
      authorization: `Bearer ${TEST_TOOL_SECRET_BROWSER}`,
      toolName: "get_learning_context",
      body: { nothing: true },
      clientKey: "agent",
    });
    expect(honest.status).toBe(422);
  });

  it("rejects malformed payloads and unknown tools", async () => {
    expect((await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "get_learning_context", { nothing: true })).status).toBe(
      422,
    );
    expect((await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "drop_tables", { interaction_id: "a" })).status).toBe(404);
  });

  it("serves a browser session identified by a valid signed voice token, and binds it to one call", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const session = await startSession(db, learner, "browser");
    const token = issueVoiceToken(config.signingSecret, session.id, 600);
    const ok = await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "get_learning_context", {
      interaction_id: "call-1",
      user_identifier: token,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    const otherCall = await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "get_learning_context", {
      interaction_id: "call-2",
      user_identifier: token,
    });
    expect(otherCall.status).toBe(409);
  });

  it("adds the whole response as one `result` string for the dashboard's response template", async () => {
    const body = toSarvamResponseBody({ ok: false, error: { code: "NOT_FOUND", message: "Session not found." } });
    expect(JSON.parse(body.result)).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Session not found." } });
    expect(body.ok).toBe(false);
  });

  it("accepts call-context values from query parameters or headers when the body lacks them", () => {
    const url = new URL("https://app.example/api/voice/tools/get_learning_context?user_identifier=lcv1.a.b");
    const merged = withCallContext({ goal_text: "x" }, url, new Headers({ "x-interaction-id": "call-9" }));
    expect(merged).toEqual({ goal_text: "x", user_identifier: "lcv1.a.b", interaction_id: "call-9" });
    const bodyWins = withCallContext(
      { interaction_id: "from-body" },
      url,
      new Headers({ "x-interaction-id": "call-9" }),
    );
    expect(bodyWins).toMatchObject({ interaction_id: "from-body" });
  });

  it("does not accept a phone number as a browser identity", async () => {
    const res = await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "get_learning_context", {
      interaction_id: "call-3",
      user_identifier: "+919876543210",
    });
    expect(res.status).toBe(401);
  });
});

describe("phone caller identity", () => {
  it("coaches a tailoring caller, closes on hangup and waits for intent on redial", async () => {
    const invoke = async (interaction: string, tool: string, args: Record<string, unknown> = {}) =>
      (
        await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, tool, {
          interaction_id: interaction,
          user_identifier: "+919876500010",
          ...args,
        })
      ).body;
    const first = "tailoring-call-1";
    expect(await invoke(first, "set_memory_consent", { decision: "granted", learner_confirmed: true })).toMatchObject({
      ok: true,
    });
    expect(
      await invoke(first, "set_learning_goal", { goal_text: "Rehearse a customer call", learner_confirmed: true }),
    ).toMatchObject({ ok: true });
    expect(
      await invoke(first, "start_or_resume_course", { course_id: "customer-call", learner_confirmed: true }),
    ).toMatchObject({ ok: true });
    expect(await invoke(first, "get_lesson_context", { learner_ready: true })).toMatchObject({ ok: true });
    expect(
      await invoke(first, "record_practice_attempt", {
        exercise_id: "call-counteroffer",
        answer_text: "ஐம்பது ரூபாய் ஆகும்.",
      }),
    ).toMatchObject({ ok: true, data: { result: "partial" } });
    expect(await invoke(first, "close_learning_session", { reason: "provider_ended" })).toMatchObject({
      ok: true,
      saved: true,
    });
    const second = "tailoring-call-2";
    expect(await invoke(second, "get_learning_context")).toMatchObject({
      ok: true,
      data: { active_course: { id: "customer-call" } },
    });
    expect(await invoke(second, "get_lesson_context")).toMatchObject({
      ok: false,
      error: { code: "POLICY_VIOLATION" },
    });
    expect(await invoke(second, "get_lesson_context", { learner_ready: true })).toMatchObject({ ok: true });
    expect(
      await invoke(second, "record_practice_attempt", {
        exercise_id: "call-counteroffer",
        answer_text: "ஐம்பது ரூபாய். ரெண்டு நாள்ல தருவேன்.",
      }),
    ).toMatchObject({ ok: true, data: { result: "correct" } });
  });

  it("identifies a returning caller by keyed hash and never stores the raw number", async () => {
    const phone = "+91 98765 11111";
    const first = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "set_memory_consent", {
      interaction_id: "p-1",
      user_identifier: phone,
      decision: "granted",
      learner_confirmed: true,
    });
    expect(first.status).toBe(200);
    await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "set_learning_goal", {
      interaction_id: "p-1",
      user_identifier: phone,
      goal_text: "Keep sales records",
      learner_confirmed: true,
    });
    await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "close_learning_session", {
      interaction_id: "p-1",
      user_identifier: phone,
      reason: "provider_ended",
    });

    const identity = await db.query(
      `select subject from learner_identities where provider = 'phone' and subject = $1`,
      [hashPhone(config.phoneHashSecret, "+919876511111")],
    );
    expect(identity.length).toBe(1);
    const leak = await db.query(`select count(*)::int as n from learner_identities where subject like '%9876511111%'`);
    expect(JSON.stringify(leak)).toContain('"n":0');

    const second = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "get_learning_context", {
      interaction_id: "p-2",
      user_identifier: "919876511111",
    });
    expect(second.status).toBe(200);
    expect(second.body.ok && second.body.data.active_goal).toBe("Keep sales records");
  });

  it("treats an unavailable caller ID as a session-only learner deleted at the end of the call", async () => {
    const before = await db.query(`select count(*)::int as n from learners`);
    const ctx = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "get_learning_context", {
      interaction_id: "anon-1",
      user_identifier: "",
    });
    expect(ctx.status).toBe(200);
    expect(ctx.body.ok && ctx.body.data.memory_mode).toBe("session_only");
    const consent = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "set_memory_consent", {
      interaction_id: "anon-1",
      decision: "granted",
      learner_confirmed: true,
    });
    expect(consent.body).toMatchObject({ ok: false, error: { code: "POLICY_VIOLATION" } });
    const goal = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "set_learning_goal", {
      interaction_id: "anon-1",
      goal_text: "Talk to customers",
      learner_confirmed: true,
    });
    expect(goal.body.ok && "saved" in goal.body && goal.body.saved).toBe(false);
    const end1 = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "close_learning_session", {
      interaction_id: "anon-1",
      reason: "provider_ended",
    });
    expect(end1.status).toBe(200);
    const after = await db.query(`select count(*)::int as n from learners`);
    expect(after).toEqual(before);
    // A duplicate on-end webhook after deletion fails safely and creates nothing.
    const end2 = await call(`Bearer ${TEST_TOOL_SECRET_PHONE}`, "close_learning_session", {
      interaction_id: "anon-1",
      reason: "provider_ended",
    });
    expect([200, 404]).toContain(end2.status);
    expect(await db.query(`select count(*)::int as n from learners`)).toEqual(before);
  });

  it("is unreachable with the browser agent's secret", async () => {
    const res = await call(`Bearer ${TEST_TOOL_SECRET_BROWSER}`, "get_learning_context", {
      interaction_id: "p-9",
      user_identifier: "+919876522222",
    });
    expect(res.status).toBe(401);
  });
});

describe("browser voice session and signed-URL proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("issues SDK config with a signed token and no secrets", async () => {
    const learner = await createLearner(db, { consent: "granted" });
    const created = await sarvamProvider.createBrowserSession(db, learner, { courseId: "small-business-starter" });
    const json = JSON.stringify(created);
    expect(created.sdk.user_identifier.startsWith("lcv1.")).toBe(true);
    expect(created.sdk.proxy_base_url).toBe("/api/voice/sarvam/");
    expect(json).not.toContain("test-api-key");
    expect(json).not.toContain(TEST_TOOL_SECRET_BROWSER);
    const session = await startSession(db, learner, "text");
    expect(() => browserSessionConfig(learner, session)).toThrow();
  });

  it("forwards to Sarvam with the server-side key and returns only url and reference_id", async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("X-API-Key")).toBe("test-api-key");
      return new Response(
        JSON.stringify({ url: "wss://example.test/ws?sig=1", reference_id: "ref-1", extra: "dropped" }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await sarvamProvider.proxySignedUrl(
      new Request("http://localhost/api/voice/sarvam/x?interaction_type=call"),
      {
        orgId: "org-test",
        workspaceId: "ws-test",
        appId: "app-web",
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "wss://example.test/ws?sig=1", reference_id: "ref-1" });
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("orgs/org-test/workspaces/ws-test/apps/app-web/url");
    expect(calledUrl).toContain("interaction_type=call");
  });

  it("refuses other agents and reports an unreachable provider", async () => {
    await expect(
      sarvamProvider.proxySignedUrl(new Request("http://localhost/x"), {
        orgId: "org-test",
        workspaceId: "ws-test",
        appId: "someone-else",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    await expect(
      sarvamProvider.proxySignedUrl(new Request("http://localhost/x"), {
        orgId: "org-test",
        workspaceId: "ws-test",
        appId: "app-web",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("passes provider auth failures through without leaking the upstream body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret upstream detail", { status: 401 })),
    );
    const res = await sarvamProvider.proxySignedUrl(new Request("http://localhost/x"), {
      orgId: "org-test",
      workspaceId: "ws-test",
      appId: "app-web",
    });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("secret upstream detail");
  });

  it("generates dashboard tool settings for every registered tool", () => {
    const tools = sarvamToolSetup("https://app.example", "phone");
    expect(tools.length).toBe(12);
    expect(tools.find((t) => t.name === "get_learning_context")?.whenToRun).toBe("During conversation");
    expect(tools.find((t) => t.name === "close_learning_session")?.whenToRun).toBe("on_end");
    expect(tools.every((t) => t.url.startsWith("https://app.example/api/voice/tools/"))).toBe(true);
    expect(JSON.stringify(tools)).not.toContain(TEST_TOOL_SECRET_PHONE);
  });
});
