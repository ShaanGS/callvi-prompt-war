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

test("a learner can switch languages, play the Tamil customer and clear the rehearsal", async ({ page, context, baseURL }) => {
  await useEnglish(context, baseURL!);
  await page.goto("/practice");
  await page.getByRole("button", { name: "Fee only" }).click();
  await page.getByRole("button", { name: "Check my reply" }).click();
  await page.getByRole("button", { name: "தமிழ்" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "வாடிக்கையாளர் குரலைக் கேளுங்கள்" }).click();
  await expect(page.getByRole("button", { name: "ஒலியை நிறுத்து" })).toBeVisible();
  await page.getByRole("button", { name: "இரண்டும்" }).click();
  await page.getByRole("button", { name: "பதிலைச் சரிபார்" }).click();
  await expect(page.getByRole("listitem").last().getByText("தரும் நேரம் · சொன்னீர்கள்")).toBeVisible();
  await page.getByRole("button", { name: "மீண்டும் தொடங்கு" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toBeFocused();
});
