import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { RegistryIndex } from "../src/registry";
import { parseItems } from "./baselines";

// Every item the built registry lists, so a new item gets its snapshots with no line here.
const { items }: RegistryIndex = JSON.parse(readFileSync(join(import.meta.dirname, "../dist/r/index.json"), "utf8"));

const FROZEN = new Date("2026-01-01T00:00:00Z");

// Items a pull request adds, as CI lists them. Unset outside CI, so nothing is skipped there.
const NEW_ITEMS = new Set(parseItems(process.env.VECTOYS_NEW_ITEMS));

for (const { name } of items) {
  test(name, async ({ page }, testInfo) => {
    // A submitted toy comes with no snapshots, and only a maintainer makes them. An item already on the base branch is never skipped.
    const updating = testInfo.config.updateSnapshots === "all" || testInfo.config.updateSnapshots === "changed";
    const baseline = testInfo.snapshotPath(`${name}.png`, { kind: "screenshot" });
    test.skip(NEW_ITEMS.has(name) && !updating && !existsSync(baseline), "needs maintainer baseline");
    // Only the local site: web fonts and anything else from outside fall back the same way every run.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
    // Time stands still, so a toy that plays on its own, as the keyboard types, draws its first frame every run.
    // Installed a minute early, so pausing never asks the clock to go back, however long setup takes.
    await page.clock.install({ time: FROZEN.getTime() - 60_000 });
    await page.clock.pauseAt(FROZEN);
    await page.goto("/toys");
    // Only this toy's card, in the first cell of the grid, so a toy added before it never moves it by a fraction of a pixel.
    await page.addStyleTag({ content: `.toys > .toy:not([id="${name}"]) { display: none; }` });
    const preview = page.locator(`[id="${name}"] .toy-preview`);
    await preview.scrollIntoViewIfNeeded();
    await expect(preview.locator(":scope > *").first()).toBeVisible();
    // An item drawn from its own exports shows the placeholder while its module loads, which waits on the stopped clock.
    const placeholder = preview.locator(".preview-placeholder");
    await expect(async () => {
      if ((await placeholder.count()) > 0) await page.clock.runFor(100);
      expect(await placeholder.count()).toBe(0);
    }).toPass();
    await page.evaluate(() => document.fonts.ready);
    await expect(preview).toHaveScreenshot(`${name}.png`);
  });
}
