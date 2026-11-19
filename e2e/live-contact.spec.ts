import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";
import { writeFile } from "node:fs/promises";

test.skip(process.env.LIVE_VOICE_TEST !== "1", "Real voice contact flow; consumes provider credits.");
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-file-for-fake-audio-capture=/private/tmp/callvi-silent-microphone.wav",
    ],
  },
});

test("the call explains the service, respects not-now and waits for today's intent on return", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await useEnglish(context, baseURL!);
  const replies: string[] = [];
  const calls: { name: string; args: Record<string, unknown>; ok: boolean }[] = [];
  let audio = 0;
  page.on("response", async (response) => {
    const match = response.url().match(/\/tools\/([a-z_]+)$/);
    if (!match) return;
    const body = await response.json().catch(() => null);
    if (body?.response)
      calls.push({ name: match[1], args: response.request().postDataJSON()?.args ?? {}, ok: body.response.ok });
  });
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") audio++;
        if (data.type === "agent_response") replies.push(data.agent_response_event.agent_response);
      } catch {
        /* Audio and signed URLs are not logged. */
      }
    });
  });
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes("api.elevenlabs.io")) Reflect.set(window, "__callviContactSocket", this);
      }
    };
  });
  const say = async (text: string) => {
    const before = replies.length;
    await page.evaluate(
      (message) =>
        Reflect.get(window, "__callviContactSocket").send(JSON.stringify({ type: "user_message", text: message })),
      text,
    );
    await expect.poll(() => replies.length, { timeout: 35_000 }).toBeGreaterThan(before);
  };
  await page.goto("/");
  await page.getByRole("button", { name: "Call Callvi", exact: true }).click();
  await expect.poll(() => audio, { timeout: 45_000 }).toBeGreaterThan(0);
  await say("What is this service? I only have a basic phone and cannot look at a screen.");
  await say("I don't want to start a lesson today. I just wanted to know what you can help with.");
  expect(calls.some((call) => call.name === "get_lesson_context" || call.name === "record_practice_attempt")).toBe(
    false,
  );
  await say("Thanks. Please finish our call now.");
  await expect(page.getByText("This conversation has ended. No learning progress was saved.")).toBeVisible({
    timeout: 35_000,
  });

  // Synthetic returning-learner fixture. No real learner data or provider mocks.
  const started = await context.request.post(`${baseURL}/api/voice/browser-session`, { data: {} });
  const id = (await started.json()).session.sessionId;
  if (baseURL === "https://callvi.vercel.app")
    await writeFile("/private/tmp/callvi-production-contact-session.json", JSON.stringify({ sessionId: id }));
  const fixture = async (tool: string, args = {}) => {
    const response = await context.request.post(`${baseURL}/api/learn/sessions/${id}/tools/${tool}`, {
      data: { args },
    });
    expect((await response.json()).response.ok).toBe(true);
  };
  await fixture("set_memory_consent", { decision: "granted", learner_confirmed: true });
  await fixture("set_learning_goal", { goal_text: "Sell homemade snacks to nearby families", learner_confirmed: true });
  await fixture("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
  await fixture("get_lesson_context", { learner_ready: true });
  await fixture("record_practice_attempt", {
    exercise_id: "sbs-01-offer-sentence",
    answer_text: "I make murukku for families on my street",
  });
  await fixture("close_learning_session");
  await page.reload();
  const beforeReturn = calls.length;
  const beforeAudio = audio;
  await page.getByRole("button", { name: "Continue with Callvi", exact: true }).click();
  await expect.poll(() => audio, { timeout: 45_000 }).toBeGreaterThan(beforeAudio);
  await say("Hi. I'm not ready to continue a lesson. I only want to know what this service does.");
  await say("Okay.");
  expect(
    calls
      .slice(beforeReturn)
      .some((call) => call.name === "get_lesson_context" || call.name === "record_practice_attempt"),
  ).toBe(false);
  const choice = calls.length;
  await say("Now I would like to continue my Small Business Starter lesson. Let's begin.");
  await expect
    .poll(
      () =>
        calls
          .slice(choice)
          .some((call) => call.name === "get_lesson_context" && call.args.learner_ready === true && call.ok),
      { timeout: 35_000 },
    )
    .toBe(true);
  await expect(page.getByText("Who the customer is", { exact: true })).toBeVisible();
  await say("Please save my place and finish our call.");
  await expect(page.getByText("Your place is saved. Come back whenever you're ready.")).toBeVisible({
    timeout: 35_000,
  });
  console.log(
    "Verified: orientation without a screen, not-now respected on both calls, explicit choice required, saved lesson resumes.",
  );
});
