import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function capture(page: import("@playwright/test").Page, filename: string) {
  await mkdir("test-results/qa-screenshots", { recursive: true });
  await page.screenshot({
    path: `test-results/qa-screenshots/${filename}`,
    fullPage: true,
    animations: "disabled",
  });
}

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "Page has horizontal overflow").toBeLessThanOrEqual(2);
}

async function expectVisibleMapReady(page: import("@playwright/test").Page) {
  const map = page.locator(".island-map:visible").first();
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 25_000,
  });
  await expect(map.locator("canvas")).toBeVisible();
  await page.waitForTimeout(400);
}

test("Worker: React Router request context and health are functional", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  expect(payload.commerce.mode).toBe("prototype");
});

test("Home: map-first layout, discovery and mobile-safe width", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Phú Quốc", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tìm kiếm" })).toBeVisible();
  await expect(page.getByText("Bạn đang cần gì?")).toBeVisible();
  await expect(page.getByText("Tour 3 đảo bằng cano").first()).toBeVisible();
  await expectVisibleMapReady(page);
  await assertNoHorizontalOverflow(page);
  await capture(page, `01-home-${testInfo.project.name}.png`);

  await page.getByRole("button", { name: "Địa điểm" }).click();
  await expect(
    page.locator(".home-place-card").filter({
      has: page.getByText("Dương Đông", { exact: true }),
    }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await capture(page, `02-home-places-${testInfo.project.name}.png`);
});

test("Map: category, textual search and party intent survive navigation", async ({ page }, testInfo) => {
  await page.goto("/map?q=cano&pax=4");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang này" })).toHaveCount(0);
  const tour = page.locator(".map-result-card").filter({ hasText: "Tour 3 đảo bằng cano" });
  await expect(tour).toBeVisible();
  await expect(tour).toHaveAttribute("href", /pax=4/);
  await expectVisibleMapReady(page);
  await assertNoHorizontalOverflow(page);
  await capture(page, `03-map-cano-${testInfo.project.name}.png`);

  await page.getByRole("button", { name: "Địa điểm" }).click();
  await expect(page.locator(".map-entity-result").filter({ hasText: "Dương Đông" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("Product: transfer does not silently shrink a large party", async ({ page }, testInfo) => {
  await page.goto("/product/xe-san-bay-rieng?pax=18");
  await expect(page.getByRole("heading", { name: "Sân bay → khách sạn" })).toBeVisible();
  await expect(page.getByText("18 khách cần nhiều hơn một xe.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cần điều chỉnh số khách" })).toBeDisabled();
  await assertNoHorizontalOverflow(page);
  await capture(page, `04-transfer-capacity-${testInfo.project.name}.png`);
});

test("Checkout: guest request discloses estimate and never claims confirmation", async ({ page }, testInfo) => {
  await page.goto("/product/tour-3-dao-cano?pax=3");
  await page.getByRole("link", { name: "Tiếp tục đặt" }).click();
  await expect(page.getByRole("heading", { name: "Thông tin liên hệ" })).toBeVisible();
  await expect(page.getByText("Chưa thu tiền")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cần xác nhận tình trạng" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await capture(page, `05-checkout-${testInfo.project.name}.png`);
});
