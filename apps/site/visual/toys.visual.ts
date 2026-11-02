import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { RegistryIndex } from "../src/registry";

// Every item the built registry lists, so a new item gets its snapshots with no line here.
const { items }: RegistryIndex = JSON.parse(readFileSync(join(import.meta.dirname, "../dist/r/index.json"), "utf8"));

const FROZEN = new Date("2026-01-01T00:00:00Z");

for (const { name } of items) {
  test(name, async ({ page }) => {
    // Only the local site: web fonts and anything else from outside fall back the same way every run.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
    // Time stands still, so a toy that plays on its own, as the keyboard types, draws its first frame every run.
    await page.clock.install({ time: FROZEN });
    await page.clock.pauseAt(FROZEN);
    await page.goto("/toys");
    const preview = page.locator(`[id="${name}"] .toy-preview`);
    await preview.scrollIntoViewIfNeeded();
    await expect(preview.locator(":scope > *").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(preview).toHaveScreenshot(`${name}.png`);
  });
}
