import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// A synthetic QA-only style tests MapLibre / Vite worker initialization
// independently of the public tile CDN. This is NOT geographic truth and
// is never used by the application or as evidence of real island coverage.
const fixtureStyle = {
  version: 8,
  name: "Synthetic MapLibre renderer fixture",
  sources: {
    fixture: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { qaOnly: true },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [103.955, 10.19], [103.975, 10.19],
              [103.975, 10.21], [103.955, 10.21],
              [103.955, 10.19],
            ]],
          },
        }],
      },
    },
  },
  layers: [
    { id: "qa-background", type: "background", paint: { "background-color": "#edf2e9" } },
    { id: "qa-worker-geojson", type: "fill", source: "fixture", paint: { "fill-color": "#77944C" } },
  ],
};

test("Deterministic renderer: local style and GeoJSON exercise bundled MapLibre worker", async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtureStyle),
    }),
  );
  await page.goto("/map");
  const map = page.locator(".island-map:visible").first();
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  await expect(map.locator("canvas")).toBeVisible();
});

test("Live basemap smoke: real OpenFreeMap style and tiles load for Phu Quoc", async ({ page }, testInfo) => {
  const styles: string[] = [];
  const tiles: string[] = [];
  page.on("response", (response) => {
    if (!response.ok()) return;
    const url = response.url();
    if (!url.includes("openfreemap.org")) return;
    if (url.includes("/styles/liberty")) styles.push(url);
    if (/\.pbf(?:\?|$)|\/planet\//i.test(url)) tiles.push(url);
  });

  await page.goto("/map");
  const map = page.locator(".island-map:visible").first();
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  await expect(map.locator("canvas")).toBeVisible();
  expect(styles.length, "OpenFreeMap style must load from real provider").toBeGreaterThan(0);
  expect(tiles.length, "Real Phu Quoc vector tiles must load").toBeGreaterThan(0);

  await mkdir("test-results/qa-screenshots", { recursive: true });
  await page.screenshot({
    path: `test-results/qa-screenshots/06-live-map-${testInfo.project.name}.png`,
    animations: "disabled",
  });
});
