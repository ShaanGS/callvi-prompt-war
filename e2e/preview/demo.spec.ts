import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The public preview is what a judge or learner opens first, so it is tested
 * as shipped: the static build, served with vercel.json's headers.
 */

const PAGES = [
  "/",
  "/?lang=ta",
  "/?skill=cost",
  "/?skill=cost&lang=ta",
  "/?skill=digital",
  "/?skill=communication",
  "/?skill=communication&lang=ta",
  "/call-sample.html",
];

/** Collects anything the Content-Security-Policy refused, plus uncaught errors. */
function watchForBreakage(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }

  test("the page language follows the learner's choice, so Tamil is read as Tamil", async ({ page }) => {
    await page.goto("/?skill=cost");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("button", { name: "தமிழ்" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
    await expect(page).toHaveTitle(/· Callvi$/);
    await expect(page.getByRole("group", { name: "உரையாடல் மொழி" })).toBeVisible();
  });

  test("the first keyboard stop skips straight to the lesson", async ({ page }) => {
    await page.goto("/?skill=cost");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });
});

test.describe("security", () => {
  test("every page is served with the hardening headers", async ({ request }) => {
    for (const path of ["/", "/call-sample.html"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["content-security-policy"]).toContain("script-src 'self'");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["permissions-policy"]).toContain("camera=()");
    }
  });

  test("the policy blocks nothing the lessons need", async ({ page }) => {
    const problems = watchForBreakage(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
    }
    expect(problems).toEqual([]);
  });
});

test.describe("teaching", () => {
  test("feedback names the learner's actual mistake rather than just marking it wrong", async ({ page }) => {
    await page.goto("/?skill=cost");
    const answer = page.getByLabel("Your answer");
    const check = page.getByRole("button", { name: "Check my answer" });
    const feedback = page.getByRole("status");

    await answer.fill("120");
    await check.click();
    await expect(feedback).toContainText("cost for all 10 packets together");

    await answer.fill("1200");
    await check.click();
    await expect(feedback).toContainText("multiplied");

    await answer.fill("₹12 per packet");
    await check.click();
    await expect(feedback).not.toContainText("multiplied");
    await expect(feedback).not.toContainText("together");
  });

  test("a learner who does not follow can hear the idea explained another way", async ({ page }) => {
    await page.goto("/?skill=cost");
    const explanation = page.locator(".cv-concept p");
    const first = await explanation.textContent();
    await page.getByRole("button", { name: "Explain another way" }).click();
    await expect(explanation).not.toHaveText(first ?? "");
  });

  test("the communication rubric hears which details a reply included", async ({ page }) => {
    await page.goto("/?skill=communication");
    await page.getByRole("button", { name: "Fee only" }).click();
    await page.getByRole("button", { name: "Check my reply" }).click();
    await expect(page.locator(".cv-checks").last()).toContainText("Fee · heard");
    await expect(page.locator(".cv-checks").last()).toContainText("Pickup time · still needed");

    await page.getByRole("button", { name: "Both details" }).click();
    await page.getByRole("button", { name: "Check my reply" }).click();
    await expect(page.locator(".cv-checks").last()).toContainText("Pickup time · heard");
  });

  test("the same lesson runs in Tamil", async ({ page }) => {
    await page.goto("/?skill=communication&lang=ta");
    await page.getByRole("button", { name: "இரண்டும்" }).click();
    await page.getByRole("button", { name: "பதிலைச் சரிபார்" }).click();
    await expect(page.locator(".cv-checks").last()).toContainText("சொன்னீர்கள்");
  });

  test("the recorded AI call is playable", async ({ page }) => {
    await page.goto("/call-sample.html");
    const seconds = await page.locator("audio").evaluate(async (audio: HTMLAudioElement) => {
      if (audio.readyState < 1)
        await new Promise((resolve) => audio.addEventListener("loadedmetadata", resolve, { once: true }));
      return audio.duration;
    });
    expect(seconds).toBeGreaterThan(10);
  });
});
