import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.skip(process.env.LIVE_VOICE_TEST !== "1", "Real Tamil voice coach regression; consumes provider credits.");
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=/private/tmp/callvi-silent-microphone.wav"] } });

test("Tamil coach teaches a complete business lesson, handles help and partial answers, then resumes", async ({ page, context, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  await context.addCookies([{ name: "lc_lang", value: "ta-IN", url: baseURL! }]);
  const replies: string[] = [];
  const calls: { name: string; args: Record<string, unknown>; result: Record<string, unknown>; replyCount: number }[] = [];
  const assessments: string[] = [];
  let audioChunks = 0;
  page.on("response", async (response) => {
    const match = response.url().match(/\/tools\/([a-z_]+)$/);
    if (!match) return;
    const body = await response.json().catch(() => null);
    if (!body?.response) return;
    calls.push({ name: match[1], args: response.request().postDataJSON()?.args ?? {}, result: body.response, replyCount: replies.length });
    if (match[1] === "record_practice_attempt" && body.response.ok) assessments.push(body.response.data.result);
  });
  page.on("websocket", (socket) => {
    if (!socket.url().includes("api.elevenlabs.io")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const data = JSON.parse(String(payload));
        if (data.type === "audio") audioChunks++;
        if (data.type === "agent_response") replies.push(data.agent_response_event.agent_response);
      } catch { /* No audio or signed URLs are logged. */ }
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
  const say = async (message: string) => {
    const before = replies.length;
    await page.evaluate((text) => Reflect.get(window, "__callviTestSocket").send(JSON.stringify({ type: "user_message", text })), message);
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(before);
  };
  const waitForToolReply = async (name: string) => {
    const call = calls.filter((item) => item.name === name && item.result.ok === true).at(-1);
    if (!call) throw new Error(`Expected successful ${name}`);
    await expect.poll(() => replies.length, { timeout: 40_000 }).toBeGreaterThan(call.replyCount);
  };
  const waitForPractice = async (exerciseId: string) => {
    await expect.poll(() => calls.some((item) => item.name === "get_lesson_context" && item.result.ok === true && (item.result.data as { practice?: { exercise_id?: string } })?.practice?.exercise_id === exerciseId), { timeout: 40_000 }).toBe(true);
    await waitForToolReply("get_lesson_context");
  };
  const assess = async (answer: string, expected: string) => {
    const before = assessments.length;
    await say(answer);
    await expect.poll(() => assessments.length, { timeout: 40_000 }).toBe(before + 1);
    expect(assessments.at(-1)).toBe(expected);
    await waitForToolReply("record_practice_attempt");
  };
  const names = () => calls.map((call) => call.name);
  try {
    await page.goto("/");
    const created = page.waitForResponse((r) => r.url().endsWith("/api/voice/browser-session") && r.request().method() === "POST");
    await page.getByRole("button", { name: "கால்வியுடன் பேசுங்கள்", exact: true }).click();
    const sessionId = (await (await created).json()).session.sessionId;
    if (baseURL === "https://callvi.vercel.app") await writeFile("/private/tmp/callvi-production-coach-session.json", JSON.stringify({ sessionId }));
    await expect.poll(() => audioChunks, { timeout: 45_000 }).toBeGreaterThan(0);
    await say("வீட்டுல முறுக்கு செஞ்சு எங்க தெருவில விக்க கத்துக்கணும். இப்போ இந்த business skill-ஐ கத்துக்க ஆரம்பிக்கலாம்.");
    await say("ஆமா, என் learning goal-ஐயும் கத்துக்கிட்ட இடத்தையும் நினைவில் வச்சுக்கோங்க.");
    await expect.poll(names, { timeout: 40_000 }).toContain("set_memory_consent");
    await waitForToolReply("set_memory_consent");
    await say("ஆமா, அதுதான் என் goal. அதை சேமிச்சுக்கோங்க.");
    await expect.poll(names, { timeout: 40_000 }).toContain("set_learning_goal");
    await waitForToolReply("set_learning_goal");
    await say("சிறு தொழில் தொடக்கம் course-ஐ தேர்ந்தெடுக்கிறேன். அதை ஆரம்பிக்கலாம்.");
    await expect.poll(names, { timeout: 40_000 }).toContain("get_lesson_context");

    await waitForPractice("sbs-01-offer-sentence");
    const beforeHelp = assessments.length;
    await say("புரியல. இன்னும் சிம்பிளா ஒரு example சொல்லுங்க.");
    await expect.poll(() => calls.filter((call) => call.name === "get_lesson_context" && call.args.request === "different_explanation").length, { timeout: 40_000 }).toBeGreaterThan(0);
    expect(assessments).toHaveLength(beforeHelp);
    await waitForToolReply("get_lesson_context");
    await assess("முறுக்கு செஞ்சு விப்பேன்.", "partial");
    await assess("பக்கத்து குடும்பங்களுக்கு.", "correct");

    await say("சரி, அடுத்ததுக்குப் போலாம்.");
    await expect(page.getByText("வாடிக்கையாளர் யார்", { exact: true })).toBeVisible();
    await waitForPractice("sbs-01-first-customer");
    await assess("அவங்க தெருவில வேலைக்குப் போற குடும்பங்கள். காலைல டைம் மிச்சமாகும், பக்கத்துலயே வாங்கிக்கலாம்.", "correct");
    await say("அடுத்த idea-வைப் பாக்கலாம்.");
    await waitForPractice("sbs-01-customer-need");
    await assess("மாவு அரைக்கிற நேரமும் வேலையும் மிச்சமாகும்.", "correct");
    const last = calls.filter((call) => call.name === "record_practice_attempt").at(-1)!;
    expect(last.result).toMatchObject({ ok: true, data: { lesson_complete: true } });
    await say("இன்னிக்கு போதும். விட்ட இடத்தை save பண்ணிட்டு call-ஐ முடிச்சிடுங்க.");
    await expect.poll(names, { timeout: 40_000 }).toContain("save_checkpoint");
    await expect(page.getByText("உங்கள் இடம் சேமிக்கப்பட்டது. தயாரானபோது மீண்டும் வாருங்கள்.")).toBeVisible({ timeout: 40_000 });
    await page.reload();
    const beforeResume = calls.length;
    const audioBeforeResume = audioChunks;
    await page.getByRole("button", { name: "கால்வியுடன் தொடருங்கள்", exact: true }).click();
    await expect.poll(() => audioChunks, { timeout: 45_000 }).toBeGreaterThan(audioBeforeResume);
    await say("ஆமா, போன தடவை விட்ட இடத்திலிருந்து தொடரலாம்.");
    await expect.poll(() => calls.slice(beforeResume).some((call) => call.name === "get_lesson_context"), { timeout: 40_000 }).toBe(true);
    await expect(page.getByRole("button", { name: "முடி", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "முடி", exact: true }).click();
    await expect(page.getByText("உங்கள் இடம் சேமிக்கப்பட்டது. தயாரானபோது மீண்டும் வாருங்கள்.")).toBeVisible({ timeout: 30_000 });
    expect(replies.join(" ")).toMatch(/நீங்க|உங்க|பண்ண|சொல்லுங்க|பாருங்க/);
    expect(replies.join(" ")).not.toMatch(/மேற்கொள்ளுங்கள்|விரும்புகிறீர்கள்|வெற்றிகரமாகச் சேமிக்கப்பட்டது/);
    expect(calls.filter((call) => call.result.ok === false)).toEqual([]);
    console.log("Tamil coach verified:", { audioChunks, assessments, toolCalls: calls.length, longestReplyWords: Math.max(...replies.map((text) => text.split(/\s+/).length)) });
  } finally {
    await writeFile(`/private/tmp/callvi-tamil-coach-${baseURL === "https://callvi.vercel.app" ? "production" : "local"}.json`, JSON.stringify({ replies, calls, assessments }, null, 2), { mode: 0o600 });
    await testInfo.attach("synthetic-tamil-coach-transcript", { body: JSON.stringify({ replies, calls, assessments }, null, 2), contentType: "application/json" });
  }
});
