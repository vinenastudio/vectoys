import { afterAll, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Dice, ROLL_MS, WOBBLE_MS } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

test("a roll lands on the given face, reads it out, and reads it out again on the next roll", async () => {
  const onRoll = mock((value: number) => value);
  const { host, unmount } = await mount(<Dice value={3} onRoll={onRoll} />);
  const button = host.querySelector("button");
  const live = host.querySelector("[aria-live]");
  if (!button || !live) throw new Error("no button or live region");
  expect(live.textContent).toBe("Showing 3");

  for (const round of [1, 2]) {
    await fire(button, new MouseEvent("click", { bubbles: true }));
    await frames.advance(32);
    // Empty in the air, so the same face landing again is still read out.
    expect(live.textContent).toBe("");
    await frames.advance(ROLL_MS + WOBBLE_MS + 100);
    expect(live.textContent).toBe("Showing 3");
    expect(onRoll).toHaveBeenCalledTimes(round);
  }
  expect(onRoll).toHaveBeenLastCalledWith(3);
  await unmount();
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the die turns it without rolling, and a click still rolls", async () => {
  const onRoll = mock((value: number) => value);
  const { host, unmount } = await mount(<Dice value={2} onRoll={onRoll} />);
  const button = host.querySelector("button[aria-label='Roll the die']")!;
  const drawing = () => htmlOf(host.querySelector("svg"));
  const rest = drawing();
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointermove", 60));
  expect(drawing()).not.toBe(rest);
  await fire(button, pointer("pointerup", 60));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  await frames.advance(ROLL_MS + WOBBLE_MS + 100);
  expect(onRoll).toHaveBeenCalledTimes(0);
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointerup", 0));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  await frames.advance(ROLL_MS + WOBBLE_MS + 100);
  expect(onRoll).toHaveBeenCalledTimes(1);
  await unmount();
});

test("with dragging and full screen off the die has no tab stop of its own and no full screen button", () => {
  const html = renderToString(<Dice draggable={false} fullscreen={false} />);
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<Dice />)).toContain('aria-label="Full screen die"');
});
