import { afterAll, expect, mock, test } from "bun:test";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Card } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

test("a click flips the card over and back, and only the face toward the eye shows", async () => {
  const onFlipChange = mock((flipped: boolean) => flipped);
  const { host, unmount } = await mount(<Card front={<p>front</p>} back={<p>back</p>} onFlipChange={onFlipChange} />);
  const button = host.querySelector("button");
  if (!button) throw new Error("no button");
  // The screen a face lies on shows it only while it faces the eye.
  const shows = (text: string) => {
    let node = [...host.querySelectorAll("p")].find((p) => p.textContent === text)?.parentElement;
    while (node && !node.style.visibility) node = node.parentElement;
    return node?.style.visibility === "visible";
  };
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect([shows("front"), shows("back")]).toEqual([true, false]);

  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(onFlipChange).toHaveBeenLastCalledWith(true);
  await frames.advance(1500);
  expect([shows("front"), shows("back")]).toEqual([false, true]);

  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(button.getAttribute("aria-pressed")).toBe("false");
  await frames.advance(1500);
  expect([shows("front"), shows("back")]).toEqual([true, false]);
  await unmount();
});

const pointer = (type: string, x: number, y = 0, buttons = 1) =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, buttons, bubbles: true });

test("a drag on a face turns the card, and the click that ends it does not flip it", async () => {
  const { host, unmount } = await mount(<Card front={<p>front</p>} back={<p>back</p>} />);
  const button = host.querySelector("button[aria-pressed]");
  const face = host.querySelector("p");
  if (!button || !face) throw new Error("no card");
  const drawing = () => htmlOf(host.querySelector("svg"));
  const before = drawing();
  await fire(face, pointer("pointerdown", 0));
  await fire(face, pointer("pointermove", 60, 10));
  await fire(face, pointer("pointerup", 60, 10, 0));
  await fire(face, new MouseEvent("click", { bubbles: true, clientX: 60, clientY: 10 }));
  expect(drawing()).not.toBe(before);
  expect(button.getAttribute("aria-pressed")).toBe("false");

  // A click with no drag still flips it.
  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(button.getAttribute("aria-pressed")).toBe("true");
  await unmount();
});

test("a drag from the flip button turns the card, and a plain click on it still flips it", async () => {
  const { host, unmount } = await mount(<Card front={<p>front</p>} back={<p>back</p>} />);
  const button = host.querySelector("button[aria-pressed]");
  if (!button) throw new Error("no card");
  const drawing = () => htmlOf(host.querySelector("svg"));
  const before = drawing();
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointermove", 60, 10));
  await fire(button, pointer("pointerup", 60, 10, 0));
  await fire(button, new MouseEvent("click", { bubbles: true, clientX: 60, clientY: 10 }));
  expect(drawing()).not.toBe(before);
  expect(button.getAttribute("aria-pressed")).toBe("false");

  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(button.getAttribute("aria-pressed")).toBe("true");
  await unmount();
});
