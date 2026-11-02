import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";

const FROZEN = new Date("2026-01-01T00:00:00Z");
// Long enough for any spring or coast to come to rest on the stopped clock.
const SETTLE_MS = 3000;

/** The /toys page on a stopped clock with only local requests, and the well of the toy `name` drawn. */
async function open(page: Page, name: string) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
  await page.clock.install({ time: FROZEN.getTime() - 60_000 });
  await page.clock.pauseAt(FROZEN);
  await page.goto("/toys");
  const preview = page.locator(`[id="${name}"] .toy-preview`);
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator(":scope > *").first()).toBeVisible();
  const placeholder = preview.locator(".preview-placeholder");
  await expect(async () => {
    if ((await placeholder.count()) > 0) await page.clock.runFor(100);
    expect(await placeholder.count()).toBe(0);
  }).toPass();
  await page.evaluate(() => document.fonts.ready);
  const table = preview.locator(".vectoys-turntable").first();
  await expect(table).toBeVisible();
  return { preview, table, button: table.locator("> .vectoys-turntable-full") };
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Input events with their own timestamps: steps 16 milliseconds apart and a
 * release 200 milliseconds after the last one, so the toy sees a pointer
 * that stopped before it let go and gives no spin. The pose is then the
 * same every run, however fast the machine is.
 */
async function timed(page: Page) {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  let at = Date.now() / 1000 - 30;
  const tick = (ms: number) => (at += ms / 1000);
  return {
    async drag(from: { x: number; y: number }, dx: number, dy: number, steps = 10) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...from, timestamp: tick(16) });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1, timestamp: tick(16) });
      for (let i = 1; i <= steps; i++) {
        const point = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "left", buttons: 1, timestamp: tick(16) });
      }
      const end = { x: from.x + dx, y: from.y + dy };
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...end, button: "left", buttons: 0, clickCount: 1, timestamp: tick(200) });
    },
    async swipe(from: { x: number; y: number }, dx: number, dy: number, steps = 10) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from], timestamp: tick(16) });
      for (let i = 1; i <= steps; i++) {
        const point = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point], timestamp: tick(16) });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: tick(200) });
    },
  };
}

/** Moves the mouse off the toy and takes focus away, so the well looks as it does at rest once a toy that follows the pointer settles. */
async function leave(page: Page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    getSelection()?.removeAllRanges();
  });
  await page.clock.runFor(SETTLE_MS);
}

const bodyTransform = (table: Locator) => table.locator("> .vectoys-turntable-body").evaluate((body) => (body as HTMLElement).style.transform);

/** Leaves out the Fullscreen API, as an iPhone does, so the toy covers the page with its own overlay. */
function withoutFullscreen() {
  delete (Element.prototype as Partial<Element>).requestFullscreen;
  delete (Element.prototype as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
}

for (const name of ["phone", "envelope"]) {
  test(`${name} shows the full screen button on hover`, async ({ page }) => {
    const { preview, table, button } = await open(page, name);
    await expect(button).toHaveCSS("opacity", "0");
    await table.hover();
    await expect(button).toHaveCSS("opacity", "1");
    await expect(preview).toHaveScreenshot(`${name}-hover.png`);
  });
}

for (const name of ["phone", "card", "envelope", "keyboard"]) {
  test(`${name} turns on a drag and resets on a double click`, async ({ page }) => {
    const { preview, table } = await open(page, name);
    const rest = await preview.screenshot();
    const restTransform = await bodyTransform(table);
    const pressed = name === "card" ? await table.locator("[data-vectoys-grab]").getAttribute("aria-pressed") : null;
    const input = await timed(page);
    const from = await center(table);
    await input.drag(from, 90, -30);
    await page.clock.runFor(SETTLE_MS);
    await expect(table).not.toHaveAttribute("data-dragging");
    // A finding, not a check: the press that starts a drag can select text in the toy before the drag takes over.
    const selected = await page.evaluate(() => String(getSelection()));
    if (selected) console.log(`${name}: a drag selected ${JSON.stringify(selected)}`);
    await leave(page);
    // A drag that ends on the card's own button turns it and does not flip it.
    if (pressed !== null) await expect(table.locator("[data-vectoys-grab]")).toHaveAttribute("aria-pressed", pressed);
    if (name === "envelope" || name === "keyboard") expect(await bodyTransform(table)).not.toBe(restTransform);
    expect((await preview.screenshot()).equals(rest)).toBe(false);
    await expect(preview).toHaveScreenshot(`${name}-turned.png`);

    // The card is one big button, where a double click flips it twice, so Home resets it instead.
    if (name === "card") {
      await table.focus();
      await page.keyboard.press("Home");
    } else {
      await page.mouse.dblclick(from.x, from.y);
    }
    await page.clock.runFor(SETTLE_MS);
    await leave(page);
    // Back to the pixels the gallery test keeps for this toy at rest. A toy that has turned
    // smooths its edges a little differently, a few hundred pixels by a shade; a turn moves thousands.
    await expect(preview).toHaveScreenshot(`${name}.png`, { maxDiffPixels: 500 });
  });
}

test("the arrow keys turn the focused envelope, as far as its limits", async ({ page }) => {
  const { table } = await open(page, "envelope");
  await table.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  expect(await bodyTransform(table)).toBe("perspective(1000px) rotateX(6deg) rotateY(20deg)");
  // Each limit holds: the envelope turns at most 28 degrees each way.
  await page.keyboard.press("Shift+ArrowRight");
  expect(await bodyTransform(table)).toBe("perspective(1000px) rotateX(6deg) rotateY(28deg)");
});

test("the arrow keys turn the focused phone", async ({ page }) => {
  const phone = await open(page, "phone");
  const rest = await phone.preview.screenshot();
  await phone.table.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("ArrowDown");
  expect((await phone.preview.screenshot()).equals(rest)).toBe(false);
  await expect(phone.preview).toHaveScreenshot("phone-keys.png");
  await page.keyboard.press("Home");
  await page.clock.runFor(SETTLE_MS);
  await leave(page);
  await expect(phone.preview).toHaveScreenshot("phone.png");
});

test("the full screen button fills the screen and comes back", async ({ page }) => {
  const { table, button } = await open(page, "phone");
  await table.hover();
  await button.click();
  // Headless Chromium may grant the Fullscreen API or not; the toy takes the screen either way.
  await expect(table).toHaveAttribute("data-full", /^(screen|overlay)$/);
  const how = await table.getAttribute("data-full");
  test.info().annotations.push({ type: "full screen", description: how ?? "" });
  console.log(`full screen path: ${how}`);
  if (how === "screen") expect(await page.evaluate(() => document.fullscreenElement?.className)).toContain("vectoys-turntable");
  await expect(button).toHaveAttribute("aria-label", "Exit full screen");
  await button.click();
  await expect(table).not.toHaveAttribute("data-full");
  await expect(button).toHaveAttribute("aria-label", "Full screen Phone");
});

for (const name of ["phone", "keyboard"]) {
  test(`${name} covers the page where the Fullscreen API is missing`, async ({ page }) => {
    await page.addInitScript(withoutFullscreen);
    const { table, button } = await open(page, name);
    await table.hover();
    await button.click();
    await expect(table).toHaveAttribute("data-full", "overlay");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.mouse.move(0, 0);
    await page.clock.runFor(100);
    await expect(page).toHaveScreenshot(`${name}-overlay.png`);
    await page.keyboard.press("Escape");
    await expect(table).not.toHaveAttribute("data-full");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the card shows its button, scrolls on a vertical swipe and turns on a sideways one", async ({ page }) => {
    const { preview, table, button } = await open(page, "card");
    // With no hover, the button always shows.
    await expect(button).toHaveCSS("opacity", "1");
    await expect(preview).toHaveScreenshot("card-phone.png");
    const rest = await preview.screenshot();
    const pressed = await table.locator("[data-vectoys-grab]").getAttribute("aria-pressed");
    const input = await timed(page);

    const top = await page.evaluate(() => scrollY);
    await input.swipe(await center(table), 0, -120);
    await page.clock.runFor(SETTLE_MS);
    await expect(table).not.toHaveAttribute("data-dragging");
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(top);
    await preview.scrollIntoViewIfNeeded();
    expect((await preview.screenshot()).equals(rest)).toBe(true);

    await input.swipe(await center(table), 100, 0);
    await page.clock.runFor(SETTLE_MS);
    await expect(table.locator("[data-vectoys-grab]")).toHaveAttribute("aria-pressed", pressed ?? "false");
    expect((await preview.screenshot()).equals(rest)).toBe(false);
    await expect(preview).toHaveScreenshot("card-phone-turned.png");
  });

  test("the phone covers the screen with its own overlay", async ({ page }) => {
    await page.addInitScript(withoutFullscreen);
    const { table, button } = await open(page, "phone");
    await button.tap();
    await expect(table).toHaveAttribute("data-full", "overlay");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.clock.runFor(100);
    await expect(page).toHaveScreenshot("phone-overlay-phone.png");
    await page.keyboard.press("Escape");
    await expect(table).not.toHaveAttribute("data-full");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
});
