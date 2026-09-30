import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./pages-preview/tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "pages-preview-report" }]],
  timeout: 40_000,
  use: {
    baseURL: "http://127.0.0.1:4174/phuquoclux-app/next/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    { name: "iPhone-13-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev:pages",
    url: "http://127.0.0.1:4174/phuquoclux-app/next/",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
