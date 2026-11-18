import { test, expect } from "@playwright/test";
import { useEnglish } from "./helpers";

test("a first-time visitor can rehearse and retry without a microphone", async ({ page, context, baseURL }) => {
  await useEnglish(context, baseURL!);
  await page.goto("/");
  await page.getByRole("link", { name: "Practise by text" }).click();
  const reply = page.getByLabel("What would you say to the customer?");
  await reply.fill("My fee is 50 rupees.");
  await page.getByRole("button", { name: "Check my reply" }).click();
  await expect(page.getByText(/Still to include: when the trousers will be ready/)).toBeVisible();
  await reply.fill("My fee is 50 rupees and I need two days.");
  await page.getByRole("button", { name: "Check my reply" }).click();
  await expect(page.getByText("I heard your fee and when I can collect the trousers.")).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(2);
});
