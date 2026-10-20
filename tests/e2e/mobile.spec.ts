import { expect, test } from "@playwright/test";
import { readGivens, solutionFor, startClassic } from "./helpers";

test("plays by touch on an iPhone-sized screen", async ({ page }) => {
  await startClassic(page);
  const givens = await readGivens(page);
  const cell = givens.indexOf("0");
  const value = solutionFor(givens)[cell];

  await page.locator(`[data-cell="${cell}"]`).tap();
  await page.getByRole("button", { name: new RegExp(`^Number ${value}`) }).tap();
  await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute("aria-label", new RegExp(`, ${value}$`));

  // Board and number pad fit the viewport without scrolling.
  const pad = await page.getByRole("group", { name: "Enter number" }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(pad!.y + pad!.height).toBeLessThanOrEqual(viewport.height);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport.width);
});

test("exposes PWA install metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
});
