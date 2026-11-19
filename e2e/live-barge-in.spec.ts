import { expect, test } from "@playwright/test";

test.skip(
  process.env.LIVE_BARGE_IN_TEST !== "1",
  "Opt-in real speech interruption check; needs the synthetic Tamil microphone WAV.",
);
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-file-for-fake-audio-capture=/private/tmp/callvi-barge-in-microphone.wav",
    ],
  },
});

test("Tamil speech interrupts the greeting and is not assessed as a practice answer", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  await context.addCookies([{ name: "lc_lang", value: "ta-IN", url: baseURL! }]);
  const transcripts: string[] = [];
  const tools: string[] = [];
  let interruptions = 0,
    audioChunks = 0;
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") audioChunks++;
        if (data.type === "interruption") interruptions++;
        if (data.type === "user_transcript") transcripts.push(data.user_transcription_event.user_transcript);
        if (data.type === "client_tool_call") tools.push(data.client_tool_call.tool_name);
      } catch {
        /* Provider audio and connection details stay private. */
      }
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "கால்வியுடன் பேசுங்கள்", exact: true }).click();
  await expect.poll(() => audioChunks, { timeout: 45_000 }).toBeGreaterThan(0);
  await expect.poll(() => transcripts.join(" "), { timeout: 35_000 }).toMatch(/மெதுவா|மெதுவாக/);
  await expect.poll(() => interruptions, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(tools).not.toContain("record_practice_attempt");
  expect(tools).not.toContain("set_memory_consent");
  await page.getByRole("button", { name: "முடி", exact: true }).click();
  console.log("Real Tamil microphone interruption verified:", { interruptions, audioChunks, transcripts });
});
