import { expect, type BrowserContext, type Page } from "@playwright/test";

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Use the English interface so assertions read naturally. */
export async function useEnglish(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([{ name: "lc_lang", value: "en-IN", url: baseURL }]);
}

/** Development-only sign-in (signing in again with the same name returns to the same learner). */
export async function devSignIn(page: Page, name: string, opts: { staff?: boolean; next?: string } = {}): Promise<void> {
  await page.goto("/sign-in?next=/staff");
  await page.locator("#dev-name").fill(name);
  if (opts.staff) await page.getByLabel("Also give this test identity staff access").check();
  await page.getByRole("button", { name: "Continue as test learner" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

export async function onboard(page: Page, opts: { consent: "grant" | "decline"; goal: string; courseTitle: string; name?: string }): Promise<void> {
  await page.goto("/onboarding?step=language");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Before we begin" })).toBeVisible();
  await page.getByRole("button", { name: opts.consent === "grant" ? "Yes, remember my progress" : "No, only for this session" }).click();
  await expect(page.getByRole("heading", { name: "What should the companion call you?" })).toBeVisible();
  if (opts.name && opts.consent === "grant") await page.getByLabel("Name", { exact: true }).fill(opts.name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to be able to do?" })).toBeVisible();
  await page.getByLabel("Your goal").fill(opts.goal);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, that's my goal" }).click();
  await expect(page.getByRole("heading", { name: "Courses that fit your goal" })).toBeVisible();
  const course = page.locator("li").filter({ has: page.getByRole("heading", { name: opts.courseTitle }) });
  await course.getByRole("button", { name: "Choose this course" }).click();
  await page.waitForURL(/\/learn\?course=/);
}

export async function openStudyRoom(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open study room" }).click();
  await page.waitForURL(/\/learn\/[0-9a-f-]{36}$/);
}
