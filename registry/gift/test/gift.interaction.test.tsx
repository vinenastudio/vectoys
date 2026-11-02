import { afterAll, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, htmlOf, mount } from "../../../packages/react/test/dom";
import { Gift } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

test("a click opens the gift and makes its surprise live, and another shuts it", async () => {
  const onOpenChange = mock((open: boolean) => open);
  const { host, unmount } = await mount(
    <Gift onOpenChange={onOpenChange}>
      <a href="#code">SAVE20</a>
    </Gift>,
  );
  const button = host.querySelector("button");
  const surprise = host.querySelector("a")?.parentElement;
  if (!button || !surprise) throw new Error("no button or surprise");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(surprise.hasAttribute("inert")).toBe(true);

  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(surprise.hasAttribute("inert")).toBe(false);
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  await frames.advance(1400);

  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(surprise.hasAttribute("inert")).toBe(true);
  await frames.advance(1400);
  await unmount();
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the gift turns it without opening it, and a click still opens it", async () => {
  const { host, unmount } = await mount(<Gift>SAVE20</Gift>);
  const button = host.querySelector("button[aria-label='Open the gift']")!;
  const drawing = () => htmlOf(host.querySelector("svg"));
  const rest = drawing();
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointermove", 60));
  expect(drawing()).not.toBe(rest);
  await fire(button, pointer("pointerup", 60));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointerup", 0));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("true");
  await frames.advance(1400);
  await unmount();
});

test("with dragging and full screen off the gift has no tab stop of its own and no full screen button", () => {
  const html = renderToString(<Gift draggable={false} fullscreen={false} />);
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<Gift />)).toContain('aria-label="Full screen gift"');
});
