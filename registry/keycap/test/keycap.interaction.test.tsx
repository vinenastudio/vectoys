import { afterAll, afterEach, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Keycap, KeycapRow } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);
afterEach(() => document.body.replaceChildren());

test("a keycap is held while pressed by pointer or key, and runs the page's own handlers first", async () => {
  const calls: string[] = [];
  const onPress = mock(() => calls.push("press"));
  const { host, unmount } = await mount(
    <Keycap
      onPress={onPress}
      onPointerDown={() => calls.push("pointerdown")}
      onPointerUp={() => calls.push("pointerup")}
      onKeyDown={() => calls.push("keydown")}
      onKeyUp={() => calls.push("keyup")}
      onBlur={() => calls.push("blur")}
    >
      Join
    </Keycap>,
  );
  const button = host.querySelector("button");
  if (!button) throw new Error("no button");

  await fire(button, new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, new PointerEvent("pointerup", { bubbles: true }));
  expect(button.hasAttribute("data-pressed")).toBe(false);

  await fire(button, new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, new KeyboardEvent("keyup", { bubbles: true, key: " " }));
  expect(button.hasAttribute("data-pressed")).toBe(false);

  await fire(button, new MouseEvent("click", { bubbles: true }));
  await fire(button, new FocusEvent("focusout", { bubbles: true }));
  expect(calls).toEqual(["pointerdown", "pointerup", "keydown", "keyup", "press", "blur"]);
  expect(onPress).toHaveBeenCalledTimes(1);
  await frames.advance(400);
  await unmount();
});

test("a disabled keycap is never held", async () => {
  const { host, unmount } = await mount(<Keycap disabled>Join</Keycap>);
  const button = host.querySelector("button");
  if (!button) throw new Error("no button");
  await fire(button, new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  expect(button.hasAttribute("data-pressed")).toBe(false);
  await unmount();
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the key turns it and lets the key up without pressing it, and a click still presses", async () => {
  const onPress = mock(() => {});
  const { host, unmount } = await mount(<Keycap onPress={onPress}>Join</Keycap>);
  const button = host.querySelector("button")!;
  const drawing = () => htmlOf(host.querySelector("svg"));
  const rest = drawing();
  await fire(button, pointer("pointerdown", 0));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, pointer("pointermove", 3));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, pointer("pointermove", 60));
  expect(button.hasAttribute("data-pressed")).toBe(false);
  await frames.advance(400);
  expect(drawing()).not.toBe(rest);
  await fire(button, pointer("pointerup", 60));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onPress).toHaveBeenCalledTimes(0);
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointerup", 0));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await frames.advance(400);
  await unmount();
});

test("a drag on a key in a row tilts the whole row", async () => {
  const { host, unmount } = await mount(<KeycapRow keys={["v", "e"]} label="ve" />);
  const body = host.querySelector<HTMLElement>(".vectoys-turntable-body")!;
  const key = host.querySelector("button")!;
  await fire(key, pointer("pointerdown", 0));
  await fire(key, pointer("pointermove", 60));
  expect(body.style.transform).not.toContain("rotateY(0deg)");
  expect(key.hasAttribute("data-pressed")).toBe(false);
  await fire(key, pointer("pointerup", 60));
  await frames.advance(400);
  await unmount();
});

test("with dragging and full screen off the key has no tab stop of its own and no full screen button, and a held key stays held as it moves", async () => {
  const html = renderToString(
    <Keycap draggable={false} fullscreen={false}>
      Join
    </Keycap>,
  );
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<Keycap>Join</Keycap>)).toContain('aria-label="Full screen Join key"');
  const { host, unmount } = await mount(<Keycap draggable={false}>Join</Keycap>);
  const button = host.querySelector("button")!;
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointermove", 60));
  expect(button.getAttribute("data-pressed")).toBe("true");
  await fire(button, pointer("pointerup", 60));
  await frames.advance(400);
  await unmount();
});
