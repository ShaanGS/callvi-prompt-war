import { expect, test } from "@playwright/test";

test.skip(process.env.LIVE_VOICE_TEST !== "1", "Opt-in Tamil voice test; consumes provider credits.");
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=/private/tmp/callvi-tamil-microphone.wav"] } });

test("Tamil voice recognises speech without assuming consent to start a lesson", async ({ page }) => {
  test.setTimeout(120_000);
  const replies: string[] = [], learnerSpeech: string[] = [], tools: string[] = [];
  let chunks = 0;
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") chunks++;
        if (data.type === "agent_response") replies.push(data.agent_response_event.agent_response);
        if (data.type === "user_transcript") learnerSpeech.push(data.user_transcription_event.user_transcript);
        if (data.type === "client_tool_call") tools.push(data.client_tool_call.tool_name);
      } catch { /* binary frames are not inspected */ }
    });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "கால்வியுடன் பேசுங்கள்", exact: true })).toBeVisible();
  const created = page.waitForResponse((response) => response.url().endsWith("/api/voice/browser-session") && response.request().method() === "POST");
  await page.getByRole("button", { name: "கால்வியுடன் பேசுங்கள்", exact: true }).click();
  expect((await (await created).json()).session.sessionId).toBeTruthy();
  await expect.poll(() => chunks, { timeout: 45_000 }).toBeGreaterThan(0);
  await expect.poll(() => replies.join(" "), { timeout: 30_000 }).toMatch(/[\u0B80-\u0BFF]/);
  await expect.poll(() => learnerSpeech.join(" "), { timeout: 50_000 }).toMatch(/[\u0B80-\u0BFF]/);
  expect(tools).not.toContain("get_lesson_context");
  expect(tools).not.toContain("record_practice_attempt");
  await page.getByRole("button", { name: "முடி", exact: true }).click();
  await expect(page.getByRole("heading", { name: "இன்று ஒரு புதிய படி." })).toBeVisible({ timeout: 30_000 });
  console.log("Tamil microphone transcript:", learnerSpeech.join(" | "));
});
