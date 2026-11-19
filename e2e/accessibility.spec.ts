import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { devSignIn, uniqueName, useEnglish } from "./helpers";

/**
 * The full app, not just the public preview: every learner-facing screen in
 * both languages, and the educator dashboard. Learners are often on low-end
 * phones and may rely on a screen reader to hear Tamil, so these run against
 * WCAG 2.2 AA plus axe's best-practice rules.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const LEARNER_PAGES = [
  "/",
  "/practice?skill=cost",
  "/practice?skill=digital",
  "/practice?skill=communication",
  "/courses",
  "/privacy",
  "/onboarding?step=language",
];

const STAFF_PAGES = ["/staff", "/staff/learners", "/staff/sessions", "/staff/courses", "/staff/traces", "/staff/setup"];

async function violations(page: Page) {
  const { violations: found } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return found.map(v => `${v.id} [${v.impact}]: ${v.nodes.map(n => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

for (const language of ["en-IN", "ta-IN"] as const) {
  test.describe(`learner screens in ${language === "ta-IN" ? "Tamil" : "English"}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "lc_lang", value: language, url: baseURL! }]);
    });

    for (const path of LEARNER_PAGES) {
      test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

// The phone layout has its own breakpoint rules (smaller type, tighter controls),
// which a desktop-only scan would never see.
test.describe("learner screens on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  for (const path of LEARNER_PAGES) {
    test(`${path} has no WCAG 2.2 AA violations`, async ({ page, context, baseURL }) => {
      await useEnglish(context, baseURL!);
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
});

test("feedback states are accessible too, not just the empty lesson", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "lc_lang", value: "en-IN", url: baseURL! }]);
  await page.goto("/practice?skill=cost");
  await page.getByLabel("Your answer").fill("1200");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByRole("status")).toContainText("multiplied");
  expect(await violations(page)).toEqual([]);

  await page.goto("/practice?skill=communication");
  await page.getByRole("button", { name: "Fee only" }).click();
  await page.getByRole("button", { name: "Check my reply" }).click();
  await expect(page.getByText("Fee · heard")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("the educator dashboard has no WCAG 2.2 AA violations", async ({ page, context, baseURL }) => {
  // The sign-in screen follows the learner language; the helper's labels are English.
  await useEnglish(context, baseURL!);
  await devSignIn(page, uniqueName("Teacher"), { staff: true });
  for (const path of STAFF_PAGES) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await violations(page), path).toEqual([]);
  }
});
