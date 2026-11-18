import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

test.skip(process.env.LIVE_SARVAM_TEST !== "1", "Requires a configured Sarvam browser agent and consumes voice credits.");
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

test("a live Sarvam browser session reaches the speaking state from the homepage", async ({ context, page, baseURL }) => {
  await useEnglish(context, baseURL!);
  await page.goto("/");
  await page.getByRole("button", { name: "Call Callvi", exact: true }).click();
  await page.waitForURL(/\/learn\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Call Callvi", exact: true }).click();
  const call = page.getByRole("dialog");
  try {
    await expect(call.getByRole("status")).toHaveText("Callvi is speaking", { timeout: 25_000 });
  } finally {
    const end = call.getByRole("button", { name: "End", exact: true });
    if (await end.isVisible()) await end.click();
  }
});
