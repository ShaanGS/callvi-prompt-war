import { expect, test } from "@playwright/test";
import { appendFile, writeFile } from "node:fs/promises";
import { extractNumbers } from "../src/server/services/assessment/numbers";

test.skip(process.env.LIVE_VOICE_TEST !== "1", "Real Tamil review conversation; consumes provider credits.");
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=/private/tmp/callvi-silent-microphone.wav"] } });

test("Tamil return call checks a fresh business problem and remembers help honestly", async ({ page, context, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  await context.addCookies([{ name: "lc_lang", value: "ta-IN", url: baseURL! }]);
  await page.goto("/");
  const created = await context.request.post(`${baseURL}/api/voice/browser-session`, { data: {} });
  const sessionId = (await created.json()).session.sessionId;
  if (baseURL === "https://callvi.vercel.app") {
    await writeFile("/private/tmp/callvi-production-review-session.json", JSON.stringify({ sessionId }), { mode: 0o600 });
    await appendFile("/private/tmp/callvi-production-review-fixtures.jsonl", JSON.stringify({ sessionId }) + "\n", { mode: 0o600 });
  }
  const fixture = async (tool: string, args = {}) => {
    const response = await context.request.post(`${baseURL}/api/learn/sessions/${sessionId}/tools/${tool}`, { data: { args } });
    const body = await response.json();
    expect(body.response.ok).toBe(true);
  };
  await fixture("set_memory_consent", { decision: "granted", learner_confirmed: true });
  await fixture("set_learning_goal", { goal_text: "வீட்டுல முறுக்கு செஞ்சு பக்கத்து குடும்பங்களுக்கு விக்கணும்", learner_confirmed: true });
  await fixture("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
  for (const [exercise_id, answer_text] of [
    ["sbs-01-offer-sentence", "வீட்டுல முறுக்கு செஞ்சு பக்கத்து குடும்பங்களுக்கு விப்பேன்"],
    ["sbs-01-first-customer", "எங்க தெருவில வேலைக்குப் போற குடும்பங்கள். காலைல டைம் மிச்சமாகும்"],
    ["sbs-01-customer-need", "மாவு அரைக்கிற நேரமும் வேலையும் மிச்சமாகும்"],
  ]) {
    await fixture("get_lesson_context", { learner_ready: true });
    await fixture("record_practice_attempt", { exercise_id, answer_text });
  }
  await fixture("get_lesson_context", { concept_id: "sbs-unit-cost" });
  await fixture("get_lesson_context", { request: "different_explanation" });
  await fixture("record_practice_attempt", { exercise_id: "sbs-02-unit-cost", answer_text: "பன்னெண்டு ரூபா" });
  await fixture("close_learning_session");

  const replies: string[] = [];
  const calls: { name: string; args: Record<string, unknown>; key?: string; replyCount: number; response: Record<string, unknown> }[] = [];
  let audio = 0;
  page.on("response", async (response) => {
    const match = response.url().match(/\/tools\/([a-z_]+)$/);
    if (!match) return;
    const body = await response.json().catch(() => null);
    if (body?.response) calls.push({ name: match[1], args: response.request().postDataJSON()?.args ?? {}, key: response.request().postDataJSON()?.idempotency_key, replyCount: replies.length, response: body.response });
  });
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") audio++;
        if (data.type === "agent_response") replies.push(data.agent_response_event.agent_response);
      } catch { /* Do not log audio or credentials. */ }
    });
  });
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes("api.elevenlabs.io")) Reflect.set(window, "__callviReviewSocket", this);
      }
    };
  });
  const say = async (text: string) => {
    const before = replies.length;
    await page.evaluate((message) => Reflect.get(window, "__callviReviewSocket").send(JSON.stringify({ type: "user_message", text: message })), text);
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(before);
  };
  try {
    await page.reload();
    await page.getByRole("button", { name: /கால்வியுடன் (பேசுங்கள்|தொடருங்கள்)/ }).click();
    await expect.poll(() => audio, { timeout: 45_000 }).toBeGreaterThan(0);
    expect(calls.some((c) => c.name === "get_lesson_context")).toBe(false);
    await say("போன முறை ஒரு packet செலவு கணக்கு பாத்தோம். இப்போ அதே idea-வை புது கணக்குல review பண்ணலாம்.");
    await expect.poll(() => calls.filter((c) => c.name === "get_lesson_context" && c.args.request === "review").length, { timeout: 40_000 }).toBeGreaterThan(0);
    const lesson = calls.find((c) => c.name === "get_lesson_context" && c.args.request === "review")!;
    expect(lesson.response).toMatchObject({ ok: true, data: { practice: { exercise_id: "sbs-02-unit-cost-review" }, concept: { explanation: null } } });
    // A pre-tool "one moment" response is not the practice question. Let the
    // agent finish asking the actual new problem before answering it.
    await expect.poll(() => replies.some((reply) => extractNumbers(reply).includes(180) && extractNumbers(reply).includes(10) && /எவ்வளவு|என்ன|\?/.test(reply)), { timeout: 40_000 }).toBe(true);
    expect(replies.some((reply) => extractNumbers(reply).includes(18))).toBe(false);
    const beforeWrongReply = replies.length;
    await say("பன்னெண்டு ரூபா.");
    await expect.poll(() => calls.filter((c) => c.name === "record_practice_attempt").length, { timeout: 40_000 }).toBe(1);
    expect(calls.filter((c) => c.name === "record_practice_attempt").at(-1)!.response).toMatchObject({ ok: true, data: { result: "needs_practice" } });
    const firstAttempt = calls.find((c) => c.name === "record_practice_attempt")!;
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(firstAttempt.replyCount);
    expect(replies.slice(beforeWrongReply).some((reply) => extractNumbers(reply).includes(18))).toBe(false);
    // The same spoken answer on a later turn is a new attempt. An HTTP retry
    // of one invocation still reuses its explicit action key on the server.
    await say("பன்னெண்டு ரூபா.");
    await expect.poll(() => calls.filter((c) => c.name === "record_practice_attempt").length, { timeout: 40_000 }).toBe(2);
    const attempts = calls.filter((c) => c.name === "record_practice_attempt");
    expect(attempts[0].key).toBeTruthy();
    expect(attempts[1].key).toBeTruthy();
    expect(attempts[0].key).not.toBe(attempts[1].key);
    expect(attempts[1].response).toMatchObject({ ok: true, data: { result: "needs_practice", next_step: "offer_move_on", model_answer: expect.any(String) } });
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(attempts[1].replyCount);
    await say("சரி, நூத்தி எண்பதை பத்தால வகுத்தா பதினெட்டு ரூபா.");
    await expect.poll(() => calls.filter((c) => c.name === "record_practice_attempt").length, { timeout: 40_000 }).toBe(3);
    expect(calls.filter((c) => c.name === "record_practice_attempt").at(-1)!.response).toMatchObject({ ok: true, data: { result: "correct", next_step: "review_complete", evidence: { support: "example_provided" } } });
    const correctAttempt = calls.filter((c) => c.name === "record_practice_attempt").at(-1)!;
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(correctAttempt.replyCount);
    await say("இன்னிக்கு இவ்வளவு போதும். விட்ட இடத்தை save பண்ணிட்டு call முடிச்சிடுங்க.");
    await expect(page.getByText("உங்கள் இடம் சேமிக்கப்பட்டது. தயாரானபோது மீண்டும் வாருங்கள்.")).toBeVisible({ timeout: 45_000 });
    expect(calls.filter((c) => c.response.ok === false)).toEqual([]);
  } finally {
    await writeFile(`/private/tmp/callvi-learning-review-${baseURL === "https://callvi.vercel.app" ? "production" : "local"}.json`, JSON.stringify({ replies, calls, audio }), { mode: 0o600 });
    await testInfo.attach("synthetic-review-conversation", { body: JSON.stringify({ replies, calls, audio }), contentType: "application/json" });
  }
});
