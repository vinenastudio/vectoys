import { afterAll, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, mount } from "../../../packages/react/test/dom";
import { Envelope } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);

test("a click opens the envelope, and its letter comes alive once out", async () => {
  const onOpenChange = mock((open: boolean) => open);
  const { host, unmount } = await mount(
    <Envelope onOpenChange={onOpenChange}>
      <a href="#join">Join</a>
    </Envelope>,
  );
  const button = host.querySelector("button");
  const letter = host.querySelector("a")?.parentElement;
  if (!button || !letter) throw new Error("no button or letter");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(letter.hasAttribute("inert")).toBe(true);

  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(onOpenChange).toHaveBeenCalledWith(true);
  await frames.advance(1500);
  expect(letter.hasAttribute("inert")).toBe(false);

  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await frames.advance(1500);
  expect(letter.hasAttribute("inert")).toBe(true);
  await unmount();
});

test("a page that drives the envelope decides how far open it is", async () => {
  const { host, rerender, unmount } = await mount(<Envelope open={0}>Hi</Envelope>);
  const button = host.querySelector("button");
  await fire(button ?? host, new MouseEvent("click", { bubbles: true }));
  expect(button?.getAttribute("aria-expanded")).toBe("false");
  await rerender(<Envelope open={1}>Hi</Envelope>);
  expect(button?.getAttribute("aria-expanded")).toBe("true");
  await unmount();
});

test("a closed envelope clips its letter away, so clicks pass through to the page", async () => {
  const { host, unmount } = await mount(
    <Envelope>
      <a href="#join">Join</a>
    </Envelope>,
  );
  const button = host.querySelector("button");
  const screen = host.querySelector("a")?.parentElement?.parentElement;
  if (!button || !screen) throw new Error("no button or screen");
  expect(screen.style.clipPath).toBe("inset(50%)");

  await fire(button, new MouseEvent("click", { bubbles: true }));
  await frames.advance(1500);
  expect(screen.style.clipPath).not.toBe("inset(50%)");
  await unmount();
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the envelope tilts it without opening it, and a click still opens it", async () => {
  const { host, unmount } = await mount(<Envelope>Hi</Envelope>);
  const button = host.querySelector("button[aria-label='Open the letter']")!;
  const body = host.querySelector<HTMLElement>(".vectoys-turntable-body")!;
  expect(body.style.transform).toBe("perspective(1000px) rotateX(0deg) rotateY(0deg)");
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointermove", 60));
  expect(body.style.transform).not.toContain("rotateY(0deg)");
  await fire(button, pointer("pointerup", 60));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await fire(button, pointer("pointerdown", 0));
  await fire(button, pointer("pointerup", 0));
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-expanded")).toBe("true");
  await frames.advance(1500);
  await unmount();
});

test("with dragging and full screen off the envelope has no tab stop of its own and no full screen button", () => {
  const html = renderToString(<Envelope draggable={false} fullscreen={false} />);
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<Envelope />)).toContain('aria-label="Full screen envelope"');
});
