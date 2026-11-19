import { expect, test } from "@playwright/test";
import { onboard, uniqueName, useEnglish } from "./helpers";

/** Opt-in only: uses the real provider and consumes voice credits. */
test.skip(process.env.LIVE_VOICE_TEST !== "1", "Set LIVE_VOICE_TEST=1 to verify the real ElevenLabs connection.");
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=/private/tmp/callvi-${process.env.LIVE_SPOKEN_TEST === "1" ? "spoken" : "silent"}-microphone.wav`,
    ],
  },
});

test("real voice connects, retrieves a lesson, assesses practice and saves a checkpoint", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await useEnglish(context, baseURL!);
  await page.addInitScript(() => {
    const original = window.WebSocket;
    const evidence = {
      socket: null as WebSocket | null,
      audioChunks: 0,
      messages: [] as string[],
      tools: [] as string[],
      learnerSpeech: [] as string[],
    };
    Object.assign(window, { __callviVoiceTest: evidence });
    window.WebSocket = class extends original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (!String(url).includes("api.elevenlabs.io")) return;
        evidence.socket = this;
        this.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(String(event.data));
            if (data.type === "audio") evidence.audioChunks++;
            if (data.type === "agent_response") evidence.messages.push(data.agent_response_event.agent_response);
            if (data.type === "client_tool_call") evidence.tools.push(data.client_tool_call.tool_name);
            if (data.type === "user_transcript")
              evidence.learnerSpeech.push(data.user_transcription_event.user_transcript);
          } catch {
            /* binary audio is not inspected */
          }
        });
      }
    };
  });
  const evidence = async () =>
    page.evaluate(() => {
      const data = Reflect.get(window, "__callviVoiceTest");
      return {
        audioChunks: data.audioChunks as number,
        messages: data.messages as string[],
        tools: data.tools as string[],
        learnerSpeech: data.learnerSpeech as string[],
      };
    });
  const say = async (text: string) =>
    page.evaluate((message) => {
      Reflect.get(window, "__callviVoiceTest").socket.send(JSON.stringify({ type: "user_message", text: message }));
    }, text);

  await page.goto("/");
  await onboard(page, {
    consent: "grant",
    name: uniqueName("Voice demo"),
    goal: "Learn to describe my homemade snacks and their customers",
    courseTitle: "Small Business Starter",
  });
  await page.getByRole("button", { name: "Start voice session", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Call Callvi", exact: true }).click();
  await expect.poll(async () => (await evidence()).audioChunks, { timeout: 45_000 }).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeEnabled();
  if (process.env.LIVE_SPOKEN_TEST !== "1")
    await say("Yes, please begin the first lesson and ask me the practice question.");
  await expect.poll(async () => (await evidence()).tools, { timeout: 45_000 }).toContain("get_lesson_context");
  await expect
    .poll(async () => (await evidence()).messages.join(" "), { timeout: 30_000 })
    .toMatch(/what|describe|offer|product|service/i);
  const beforeAnswer = (await evidence()).messages.length;
  if (process.env.LIVE_SPOKEN_TEST !== "1") await say("I make murukku for working families on my street.");
  await expect.poll(async () => (await evidence()).tools, { timeout: 45_000 }).toContain("record_practice_attempt");
  await expect.poll(async () => (await evidence()).messages.length, { timeout: 30_000 }).toBeGreaterThan(beforeAnswer);
  if (process.env.LIVE_SPOKEN_TEST !== "1") await say("Please save my progress and finish the lesson for today.");
  await expect.poll(async () => (await evidence()).tools, { timeout: 45_000 }).toContain("save_checkpoint");
  await expect(page.getByRole("heading", { name: "Session ended" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Your progress was saved. Next time you can pick up from here.")).toBeVisible();
  console.log("Verified real ElevenLabs audio, tools:", (await evidence()).tools.join(", "));
  if (process.env.LIVE_SPOKEN_TEST === "1") {
    expect((await evidence()).learnerSpeech.length).toBeGreaterThan(0);
    console.log("Verified microphone speech recognition:", (await evidence()).learnerSpeech.join(" | "));
  }
});
