import { afterAll, expect, test } from "bun:test";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Phone } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

const pointer = (type: string, x: number, y = 0) => new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, bubbles: true });

test("a drag on the wallpaper turns the phone", async () => {
  const { host, unmount } = await mount(
    <Phone>
      <p>wallpaper</p>
    </Phone>,
  );
  const drawing = () => htmlOf(host.querySelector("svg"));
  const before = drawing();
  const wallpaper = host.querySelector("p");
  if (!wallpaper) throw new Error("no wallpaper");
  await fire(wallpaper, pointer("pointerdown", 0));
  await fire(wallpaper, pointer("pointermove", 60, 20));
  await fire(wallpaper, pointer("pointerup", 60, 20));
  expect(drawing()).not.toBe(before);
  await unmount();
});
