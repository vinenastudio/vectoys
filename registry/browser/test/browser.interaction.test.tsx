import { afterAll, expect, test } from "bun:test";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Browser } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

const pointer = (type: string, x: number, y = 0) => new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the page turns the browser", async () => {
  const { host, unmount } = await mount(
    <Browser>
      <p>page</p>
    </Browser>,
  );
  const drawing = () => htmlOf(host.querySelector("svg"));
  const before = drawing();
  const content = host.querySelector("p");
  if (!content) throw new Error("no page");
  await fire(content, pointer("pointerdown", 0));
  await fire(content, pointer("pointermove", 60, 20));
  await fire(content, pointer("pointerup", 60, 20));
  expect(drawing()).not.toBe(before);
  await unmount();
});
