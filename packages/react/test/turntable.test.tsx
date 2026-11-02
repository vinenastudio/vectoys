import { afterEach, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Turntable, type Turn } from "../src";
import { fakeFrames, fire, mount, reducedMotion } from "./dom";

let cleanup: (() => unknown)[] = [];
afterEach(async () => {
  for (const undo of cleanup) await undo();
  cleanup = [];
});

/** Mounts `node`, to be unmounted after the test. */
async function place(node: ReactNode) {
  const mounted = await mount(node);
  cleanup.unshift(mounted.unmount);
  return mounted;
}

const Toy = ({ turn }: { turn: Turn }) => (
  <div>
    <output>{`${turn.yaw.toFixed(1)} ${turn.pitch.toFixed(1)} ${turn.full}`}</output>
    <button type="button">Press</button>
    <input aria-label="Text" />
  </div>
);
const toy = (turn: Turn) => <Toy turn={turn} />;
const read = (host: HTMLElement) => {
  const [yaw, pitch, full] = (host.querySelector("output")?.textContent ?? "").split(" ");
  return { yaw: Number(yaw), pitch: Number(pitch), full: full === "true" };
};
const rootOf = (host: HTMLElement) => host.querySelector<HTMLElement>(".vectoys-turntable")!;
const pointer = (type: string, x: number, y = 0, init: PointerEventInit = {}) =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true, ...init });

/** Presses at 0, 0 on `target` and moves to `x`, `y`. */
async function dragOn(target: Element, x: number, y = 0, init?: PointerEventInit) {
  await fire(target, pointer("pointerdown", 0, 0, init));
  await fire(target, pointer("pointermove", x, y, init));
}

test("the server draws the rest pose and the full screen button, the same every time", () => {
  const node = (
    <Turntable mode="camera" label="phone">
      {toy}
    </Turntable>
  );
  const html = renderToString(node);
  expect(renderToString(node)).toBe(html);
  expect(html).toContain("<output>0.0 0.0 false</output>");
  expect(html).toContain('aria-label="Full screen phone"');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain("Drag or use the arrow keys to turn");
});

test("with dragging and full screen off there is no tab stop, no hint and no button", () => {
  const html = renderToString(
    <Turntable mode="tilt" draggable={false} fullscreen={false}>
      {toy}
    </Turntable>,
  );
  expect(html).not.toContain("tabindex=");
  expect(html).not.toContain("<button type=\"button\" class=\"vectoys-turntable-full\"");
  expect(html).not.toContain("aria-label=\"Full screen");
  expect(html).not.toContain("Drag or use");
  expect(html).toContain("rotateX(0deg) rotateY(0deg)");
});

test("a drag past 4 pixels turns the toy, and a smaller move does not", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await dragOn(root, 3, 0);
  expect(read(host).yaw).toBe(0);
  await fire(root, pointer("pointerup", 3, 0));
  await dragOn(root, 40, -10);
  expect(read(host).yaw).toBeGreaterThan(0);
  expect(read(host).pitch).toBeGreaterThan(0);
});

test("a press on a button inside the toy never starts a drag", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  await dragOn(host.querySelector("button")!, 60);
  expect(read(host).yaw).toBe(0);
});

test("a toy that is one big button marked to grab turns on a drag, and still presses on a click", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  let clicks = 0;
  const { host } = await place(
    <Turntable mode="camera">
      {(turn) => (
        <>
          <output>{`${turn.yaw.toFixed(1)} ${turn.pitch.toFixed(1)} ${turn.full}`}</output>
          <button type="button" data-vectoys-grab="" onClick={() => clicks++}>
            <span>Roll</span>
          </button>
        </>
      )}
    </Turntable>,
  );
  const span = host.querySelector("span")!;
  await dragOn(span, 50);
  expect(read(host).yaw).toBeGreaterThan(0);
  await fire(span, pointer("pointerup", 50));
  await fire(span, new MouseEvent("click", { bubbles: true }));
  expect(clicks).toBe(0);
  await fire(span, pointer("pointerdown", 0));
  await fire(span, pointer("pointerup", 0));
  await fire(span, new MouseEvent("click", { bubbles: true }));
  expect(clicks).toBe(1);
});

test("the click that ends a drag does not reach the toy, and the next one does", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  let clicks = 0;
  const { host } = await place(
    <Turntable mode="tilt">
      <div className="face" onClick={() => clicks++} />
    </Turntable>,
  );
  const face = host.querySelector(".face")!;
  await dragOn(face, 50);
  await fire(face, pointer("pointerup", 50));
  await fire(face, new MouseEvent("click", { bubbles: true }));
  expect(clicks).toBe(0);
  await fire(face, pointer("pointerdown", 0));
  await fire(face, pointer("pointerup", 0));
  await fire(face, new MouseEvent("click", { bubbles: true }));
  expect(clicks).toBe(1);
});

test("a drag past a limit is held back and springs back to it on release", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(
    <Turntable mode="camera" limits={{ yaw: [-20, 20] }}>
      {toy}
    </Turntable>,
  );
  const root = rootOf(host);
  // 200 pixels at 0.45 degrees each is 90 degrees, held back to 20 + 70 * 0.3.
  await dragOn(root, 200);
  expect(read(host).yaw).toBeCloseTo(41, 0);
  await fire(root, pointer("pointerup", 200));
  await frames.advance(2000);
  expect(read(host).yaw).toBe(20);
  expect(frames.pending()).toBe(0);
});

test("release return springs back to rest, and a double click resets a toy that stays", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host, rerender } = await place(
    <Turntable mode="tilt" release="return">
      {toy}
    </Turntable>,
  );
  const root = rootOf(host);
  await dragOn(root, 30);
  await fire(root, pointer("pointerup", 30));
  await frames.advance(2000);
  expect(read(host).yaw).toBe(0);

  await rerender(<Turntable mode="tilt">{toy}</Turntable>);
  await dragOn(root, 30);
  await fire(root, pointer("pointerup", 30));
  await frames.advance(2000);
  const left = read(host).yaw;
  expect(left).toBeGreaterThan(0);
  await fire(root, new MouseEvent("dblclick", { bubbles: true }));
  await frames.advance(2000);
  expect(read(host).yaw).toBe(0);
});

test("under reduced motion the toy stops where it is let go, and a reset jumps home", async () => {
  const frames = fakeFrames();
  const reduced = reducedMotion(true);
  cleanup.push(frames.restore, reduced.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await dragOn(root, 40);
  const turned = read(host).yaw;
  await fire(root, pointer("pointerup", 40));
  await frames.advance(500);
  expect(read(host).yaw).toBe(turned);
  await fire(root, new MouseEvent("dblclick", { bubbles: true }));
  expect(read(host).yaw).toBe(0);
});

test("a touch swipe that starts up or down is left to the page", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  await dragOn(rootOf(host), 2, 30, { pointerType: "touch" });
  await fire(rootOf(host), pointer("pointermove", 40, 30, { pointerType: "touch" }));
  expect(read(host).yaw).toBe(0);
});

test("arrow keys on the turntable turn the toy, and keys in a field inside do not", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  const arrow = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
  await fire(root, arrow);
  expect(read(host).yaw).toBe(10);
  expect(arrow.defaultPrevented).toBe(true);
  const typing = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
  const input = host.querySelector("input")!;
  // Focused first, as typing is, so React's change tracking knows the field.
  await act(async () => input.focus());
  await fire(input, typing);
  expect(read(host).yaw).toBe(10);
  expect(typing.defaultPrevented).toBe(false);
  const other = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
  await fire(root, other);
  expect(other.defaultPrevented).toBe(false);
});

test("the full screen button asks the browser to fill the screen with the turntable", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  let asked = 0;
  Object.assign(root, { requestFullscreen: () => (asked++, Promise.resolve()) });
  await fire(host.querySelector(".vectoys-turntable-full")!, new MouseEvent("click", { bubbles: true }));
  expect(asked).toBe(1);
});

test("without the Fullscreen API the toy covers the page, and esc puts it back", async () => {
  const { host } = await place(
    <Turntable mode="tilt" label="card">
      {toy}
    </Turntable>,
  );
  const root = rootOf(host);
  const button = host.querySelector(".vectoys-turntable-full")!;
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(root.dataset.full).toBe("overlay");
  expect(read(host).full).toBe(true);
  expect(button.getAttribute("aria-label")).toBe("Exit full screen");
  expect(document.body.style.overflow).toBe("hidden");
  await fire(document.body, new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(root.dataset.full).toBeUndefined();
  expect(read(host).full).toBe(false);
  expect(button.getAttribute("aria-label")).toBe("Full screen card");
  expect(document.body.style.overflow).toBe("");
});
