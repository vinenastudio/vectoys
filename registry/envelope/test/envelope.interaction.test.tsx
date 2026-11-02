import { afterAll, expect, mock, test } from "bun:test";
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
