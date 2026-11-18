import { expect, test } from "@playwright/test";
import { onboard, useEnglish } from "./helpers";

test("mobile layout uses bottom navigation and the study room fits the screen", async ({ page, context, baseURL }) => {
  await useEnglish(context, baseURL!);
  await page.goto("/");
  await onboard(page, { consent: "grant", goal: "Talk to customers with more confidence", courseTitle: "Customer Communication" });
  await page.goto("/home");
  const bottomNav = page.getByRole("navigation", { name: "Main" }).last();
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole("link", { name: "Progress" })).toBeVisible();
  // No horizontal overflow on a phone-width screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
