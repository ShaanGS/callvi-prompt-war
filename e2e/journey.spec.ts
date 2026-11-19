import { expect, test } from "@playwright/test";
import { devSignIn, onboard, openStudyRoom, uniqueName, useEnglish } from "./helpers";

/**
 * The core learner journey through the real backend, then a SECOND session
 * (same private browser identity, new context) that resumes without sign-in.
 */
test("learner journey with consent, practice, checkpoint and second-session resume", async ({ browser, baseURL }) => {
  const name = uniqueName("Meena");

  // ---- Session 1 --------------------------------------------------------
  const first = await browser.newContext();
  await useEnglish(first, baseURL!);
  const page = await first.newPage();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Call Callvi", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await onboard(page, {
    consent: "grant",
    name,
    goal: "I want to price my homemade snacks and sell to neighbours",
    courseTitle: "Small Business Starter",
  });

  await expect(page.getByText("Your progress will be saved at checkpoints.")).toBeVisible();
  await openStudyRoom(page);

  // Lesson 1, first idea, taught from the course content.
  await expect(page.getByRole("heading", { level: 1, name: "What you offer" })).toBeVisible();
  await expect(page.getByText("Lesson 1 of 3")).toBeVisible();
  await expect(page.getByText("Saving progress").first()).toBeVisible();
  const firstExplanation = await page.locator("section[aria-label='Explanation'] p.text-lg").innerText();

  // A different explanation is genuinely different content.
  await page.getByRole("button", { name: "Explain it differently" }).click();
  await expect(page.getByText(/Explanation 2 of \d/)).toBeVisible();
  await expect(page.locator("section[aria-label='Explanation'] p.text-lg")).not.toHaveText(firstExplanation);

  // Practice assessed against the rubric.
  await page.getByRole("button", { name: "Practise this idea" }).click();
  await page.getByLabel("Your answer").fill("I make murukku for working families on my street");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved to your progress.")).toBeVisible();

  await page.getByRole("button", { name: "Next idea" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Who the customer is" })).toBeVisible();

  // A weak answer is not called correct.
  await page.getByRole("button", { name: "Practise this idea" }).click();
  await page.getByLabel("Your answer").fill("everyone");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText(/Partly there|Needs more practice/).first()).toBeVisible();
  await expect(page.getByText("Correct", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Save my place" }).click();
  await expect(page.getByText("Checkpoint saved.")).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { name: "Session ended" })).toBeVisible();
  await expect(page.getByText("Your progress was saved. Next time you can pick up from here.")).toBeVisible();
  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  const browserState = await first.storageState();
  await first.close();

  // A fresh browser gets its own learner and cannot read this session.
  const separate = await browser.newContext();
  await useEnglish(separate, baseURL!);
  const separatePage = await separate.newPage();
  await separatePage.goto("/");
  await expect(separatePage.getByRole("button", { name: "Call Callvi", exact: true })).toBeVisible();
  const otherSession = await separate.request.get(`${baseURL}/api/learn/sessions/${sessionId}`);
  expect(otherSession.status()).toBe(404);
  await separatePage.goto("/staff");
  await expect(separatePage).toHaveURL(/\/sign-in\?next=/);
  await separate.close();

  // ---- Session 2: reopen the same browser profile, without sign-in -----
  const second = await browser.newContext({ storageState: browserState });
  await useEnglish(second, baseURL!);
  const page2 = await second.newPage();
  await page2.goto("/home");
  await expect(page2.getByRole("heading", { name: `Welcome back, ${name}` })).toBeVisible();
  await expect(page2.getByText("I want to price my homemade snacks and sell to neighbours")).toBeVisible();
  await expect(page2.getByRole("heading", { name: "Small Business Starter" })).toBeVisible();
  await expect(page2.getByText("1 of 9 ideas done")).toBeVisible();

  await page2.getByRole("link", { name: "Continue learning" }).click();
  await openStudyRoom(page2);
  // Resumes at the idea that still needs work, not at the beginning.
  await expect(page2.getByRole("heading", { level: 1, name: "Who the customer is" })).toBeVisible();

  // Progress history reflects the real attempts.
  await page2.goto("/progress");
  await expect(page2.getByText("I make murukku for working families on my street")).toBeVisible();

  // Inspect and delete saved learning.
  await page2.goto("/privacy");
  await expect(page2.getByText("On — your goal and progress are saved so you can continue later.")).toBeVisible();
  page2.once("dialog", (d) => void d.accept());
  await page2.getByRole("button", { name: "Delete saved learning" }).click();
  await expect(page2.getByText("Deleted.")).toBeVisible();
  await expect(page2.getByText("No course progress saved.")).toBeVisible();
  await second.close();
});

test("declining memory keeps learning session-only", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await useEnglish(context, baseURL!);
  const page = await context.newPage();
  await page.goto("/");
  await onboard(page, {
    consent: "decline",
    goal: "Keep a simple record of daily sales",
    courseTitle: "Digital Basics for a Small Business",
  });
  await expect(page.getByText("Memory is off: this session will not be saved.")).toBeVisible();
  await openStudyRoom(page);
  await expect(page.getByText("Session only — not saved").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Save my place" }).click();
  await expect(page.getByText("Memory is off, so your place was not saved.")).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByText("Nothing from this session was kept.")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByText("Memory is off. Each session starts fresh and progress is not kept.")).toBeVisible();
  await expect(page.getByText("You haven't started a course yet.")).toBeVisible();
  await context.close();
});

test("staff workspace is role-protected and shows live counts", async ({ browser, baseURL }) => {
  const learnerCtx = await browser.newContext();
  await useEnglish(learnerCtx, baseURL!);
  const learnerPage = await learnerCtx.newPage();
  await devSignIn(learnerPage, uniqueName("Learner"), { next: "/onboarding" });
  await learnerPage.goto("/staff");
  await expect(learnerPage).toHaveURL(/\/home|\/onboarding|\/$/);
  await learnerCtx.close();

  const staffCtx = await browser.newContext();
  await useEnglish(staffCtx, baseURL!);
  const staffPage = await staffCtx.newPage();
  await devSignIn(staffPage, uniqueName("Staff"), { staff: true, next: "/staff" });
  await expect(staffPage.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(staffPage.getByText("Live counts from the application database.")).toBeVisible();
  await staffPage.goto("/staff/setup");
  await expect(staffPage.getByRole("heading", { name: "Setup" })).toBeVisible();
  await expect(staffPage.getByRole("cell", { name: "get_learning_context", exact: true })).toBeVisible();
  await staffPage.goto("/staff/traces");
  await expect(staffPage.getByRole("heading", { name: "Tool traces" })).toBeVisible();
  await staffCtx.close();
});

test("course catalogue is public and truthful about review status", async ({ page, context, baseURL }) => {
  await useEnglish(context, baseURL!);
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "Courses", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Small Business Starter" })).toBeVisible();
  await expect(page.getByText("Team-authored · not yet expert-reviewed").first()).toBeVisible();
  await page.getByRole("link", { name: /Small Business Starter/ }).click();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page.getByText("Practical learning, not a certificate.", { exact: false })).toBeVisible();
});
