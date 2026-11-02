import { afterAll, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Floppy } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

test("with an address the disk is a download link, and a press calls onPress", async () => {
  const onPress = mock(() => {});
  const { host, unmount } = await mount(
    <Floppy href="/kit.zip" download="kit.zip" onPress={onPress}>
      Press kit
    </Floppy>,
  );
  const link = host.querySelector("a");
  expect(link?.getAttribute("href")).toBe("/kit.zip");
  expect(link?.getAttribute("download")).toBe("kit.zip");
  expect(host.querySelector("button:not(.vectoys-turntable-full)")).toBeNull();
  link?.addEventListener("click", (event) => event.preventDefault());
  await fire(link ?? host, new MouseEvent("click", { bubbles: true, cancelable: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await unmount();
});

test("without an address the disk is a button, held while a key or pointer is down", async () => {
  const onPress = mock(() => {});
  const { host, unmount } = await mount(<Floppy onPress={onPress}>Save</Floppy>);
  const button = host.querySelector("button");
  if (!button) throw new Error("no button");
  expect(host.querySelector("a")).toBeNull();
  await fire(button, new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  expect(button.hasAttribute("data-pressed")).toBe(false);
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await frames.advance(600);
  await unmount();
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the disk turns it and lets the press go without pressing, and a click still presses", async () => {
  const onPress = mock(() => {});
  const { host, unmount } = await mount(<Floppy onPress={onPress}>Save</Floppy>);
  const button = host.querySelector("button")!;
  const drawing = () => htmlOf(host.querySelector("svg"));
  const rest = drawing();
  await fire(button, pointer("pointerdown", 0));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, pointer("pointermove", 60));
  expect(button.hasAttribute("data-pressed")).toBe(false);
  expect(drawing()).not.toBe(rest);
  await fire(button, pointer("pointerup", 60));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onPress).toHaveBeenCalledTimes(0);
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointerup", 0));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await frames.advance(600);
  await unmount();
});

test("with dragging and full screen off the disk has no tab stop of its own and no full screen button", () => {
  const html = renderToString(<Floppy draggable={false} fullscreen={false}>Save</Floppy>);
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<Floppy>Save</Floppy>)).toContain('aria-label="Full screen floppy disk"');
});
