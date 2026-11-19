import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";
import { writeFile } from "node:fs/promises";

test.skip(process.env.LIVE_VOICE_TEST !== "1", "Opt-in real ElevenLabs test; consumes provider credits.");
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

test("one-tap voice entry handles consent, goal and course entirely in conversation", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await useEnglish(context, baseURL!);
  const tools: string[] = [];
  const messages: string[] = [];
  let audioChunks = 0;
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") audioChunks++;
        if (data.type === "client_tool_call") tools.push(data.client_tool_call.tool_name);
        if (data.type === "agent_response") messages.push(data.agent_response_event.agent_response);
      } catch {
        /* no audio or credentials are logged */
      }
    });
  });
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes("api.elevenlabs.io")) Reflect.set(window, "__callviTestSocket", this);
      }
    };
  });
  const say = async (text: string) => {
    const count = messages.length;
    await page.evaluate(
      (message) =>
        Reflect.get(window, "__callviTestSocket").send(JSON.stringify({ type: "user_message", text: message })),
      text,
    );
    await expect.poll(() => messages.length, { timeout: 30_000 }).toBeGreaterThan(count);
  };
  await page.goto("/");
  await expect(page.locator("input, textarea")).toHaveCount(0);
  const created = page.waitForResponse(
    (response) => response.url().endsWith("/api/voice/browser-session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Call Callvi", exact: true }).click();
  const sessionId = (await (await created).json()).session.sessionId;
  if (baseURL === "https://callvi.vercel.app")
    await writeFile("/private/tmp/callvi-production-smoke-session.json", JSON.stringify({ sessionId }));
  await page.screenshot({ path: "/private/tmp/callvi-dialer-desktop.png" });
  await expect.poll(() => audioChunks, { timeout: 45_000 }).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeEnabled();
  await page.screenshot({ path: "/private/tmp/callvi-live-desktop.png" });
  await say("I would like to start learning now how to sell homemade snacks to families in my neighbourhood.");
  await say("Yes, you may remember my learning goal and progress.");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("set_memory_consent");
  await say("Yes, that is my learning goal. Please save it.");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("set_learning_goal");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("list_courses");
  await say("I choose the Small Business Starter course. Please enrol me and start the first lesson.");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("start_or_resume_course");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("get_lesson_context");
  await say("I make murukku for working families on my street.");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("record_practice_attempt");
  await say("Please save my place and finish our conversation for today.");
  await expect.poll(() => tools, { timeout: 30_000 }).toContain("save_checkpoint");
  await expect(page.getByText("Your place is saved. Come back whenever you're ready.")).toBeVisible({
    timeout: 45_000,
  });
  const view = await (await context.request.get(`${baseURL}/api/learn/sessions/${sessionId}`)).json();
  expect(view.session.open).toBe(false);
  expect(view.session.memoryMode).toBe("durable");
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue with Callvi", exact: true })).toBeVisible();
  const previousTools = tools.length;
  const previousAudio = audioChunks;
  await page.getByRole("button", { name: "Continue with Callvi", exact: true }).click();
  await expect.poll(() => audioChunks, { timeout: 45_000 }).toBeGreaterThan(previousAudio);
  await say("Yes, please tell me my saved goal and continue from where we stopped.");
  await expect.poll(() => tools.slice(previousTools), { timeout: 30_000 }).toContain("get_learning_context");
  await say("Yes, please continue the next idea in my course.");
  await expect.poll(() => tools.slice(previousTools), { timeout: 30_000 }).toContain("get_lesson_context");
  await expect(page.getByText("Who the customer is", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "End", exact: true }).click();
  await expect(page.getByText("Your place is saved. Come back whenever you're ready.")).toBeVisible({
    timeout: 30_000,
  });
  console.log("Verified voice-only onboarding and learning:", tools.join(", "));
});
