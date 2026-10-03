import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function open(page: import("@playwright/test").Page, hash = "") {
  await page.goto(`./${hash}`);
}

async function readyMap(page: import("@playwright/test").Page) {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 980;
  const onHome = !new URL(page.url()).hash || new URL(page.url()).hash === "#/";
  const selector = onHome
    ? mobile
      ? ".mobile-map-card > .island-map"
      : ".desktop-map-stage > .island-map"
    : ".full-map-stage > .island-map";
  const host = page.locator(selector);
  await expect(host).toBeVisible();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  await expect(host.locator("canvas")).toBeVisible();
  return host;
}

test("Home: actual React layout, no horizontal overflow, renderable map", async ({ page }, testInfo) => {
  await open(page);
  await expect(page.getByText("MY PHU QUOC - XEM THỬ")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Phú Quốc", exact: true })).toBeVisible();
  await expect(page.locator(".search-panel select[name=pax]")).toHaveValue("2");
  await readyMap(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await mkdir("pages-preview-evidence", { recursive: true });
  await page.screenshot({
    path: `pages-preview-evidence/home-${testInfo.project.name}.png`,
    animations: "disabled",
  });
});

test("Home search uses the static router and preserves party intent", async ({ page }) => {
  await open(page);
  await page.locator('.search-panel input[name="q"]').fill("cano");
  await page.locator('.search-panel select[name="pax"]').selectOption("4");
  await page.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#/map?")).toBe(true);
  await expect(page.locator(".map-result-card").filter({ hasText: "Tour 3 đảo bằng cano" })).toBeVisible();
  await expect(page.locator(".map-result-card").first()).toHaveAttribute("href", /pax=4/);
});

test("Map: search results and 4-person intent survive static routing", async ({ page }, testInfo) => {
  await open(page, "#/map?q=cano&pax=4");
  const card = page.locator(".map-result-card").filter({ hasText: "Tour 3 đảo bằng cano" });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", /pax=4/);
  await readyMap(page);
  await mkdir("pages-preview-evidence", { recursive: true });
  await page.screenshot({
    path: `pages-preview-evidence/map-${testInfo.project.name}.png`,
    animations: "disabled",
  });
});

test("Product: 18 travelers cannot silently fit into one van", async ({ page }) => {
  await open(page, "#/product/xe-san-bay-rieng?pax=18");
  await expect(page.getByText("18 khách cần nhiều hơn một xe.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cần điều chỉnh số khách" })).toBeDisabled();
});

test("Checkout: demonstration has no personal-data form and cannot submit", async ({ page }) => {
  await open(page, "#/checkout/tour-3-dao-cano?pax=3");
  await expect(page.getByRole("heading", { name: "Kiểm tra lựa chọn" })).toBeVisible();
  await expect(page.getByText("Không thu thập thông tin khách", { exact: false })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
});

test("Home: there is no request to the unavailable Cloudflare weather API", async ({ page }) => {
  const bad: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/context/weather")) bad.push(r.url()); });
  await open(page);
  await page.waitForTimeout(600);
  expect(bad).toHaveLength(0);
});
