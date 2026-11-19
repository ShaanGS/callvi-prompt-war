import { defineConfig, devices } from "@playwright/test";

/**
 * Tests for the public preview: the static build judges and learners open,
 * served with the headers from vercel.json. The main config tests the Next
 * app; this one tests what is actually deployed.
 */
const port = Number(process.env.PREVIEW_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e/preview",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build:rehearsal && node scripts/serve-preview.mjs ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
