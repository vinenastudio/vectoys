import { afterEach, expect, spyOn, test } from "bun:test";
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
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, bubbles: true, ...init });

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
  await fire(span, new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(clicks).toBe(0);
  await fire(span, pointer("pointerdown", 0));
  await fire(span, pointer("pointerup", 0));
  await fire(span, new MouseEvent("click", { bubbles: true, detail: 1 }));
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
  await fire(face, new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(clicks).toBe(0);
  await fire(face, pointer("pointerdown", 0));
  await fire(face, pointer("pointerup", 0));
  await fire(face, new MouseEvent("click", { bubbles: true, detail: 1 }));
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
  await act(async () => root.focus());
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
  await act(async () => root.focus());
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

test("keys with a modifier stay the browser's, such as zoom and back", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await act(async () => root.focus());
  for (const init of [{ key: "0", ctrlKey: true }, { key: "0", metaKey: true }, { key: "ArrowLeft", metaKey: true }, { key: "ArrowLeft", altKey: true }]) {
    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    await fire(root, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(read(host).yaw).toBe(0);
});

test("a key the page moved focus away for, on its way down, is left to where focus went", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  const input = host.querySelector("input")!;
  // As the keyboard item does: its listener on the window puts focus in its text box before a typed key lands.
  const aim = () => input.focus();
  addEventListener("keydown", aim, true);
  cleanup.push(() => removeEventListener("keydown", aim, true));
  await act(async () => root.focus());
  for (const key of ["0", "ArrowRight"]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    await fire(root, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(read(host).yaw).toBe(0);
});

test("a mouse let go outside the toy before the drag began never turns it on a later hover", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await fire(root, pointer("pointerdown", 0));
  await fire(root, pointer("pointermove", 3));
  await fire(document.body, pointer("pointerup", 3, 0, { buttons: 0 }));
  await fire(root, pointer("pointermove", 60, 0, { buttons: 0 }));
  expect(read(host).yaw).toBe(0);
  expect(root.dataset.dragging).toBeUndefined();
  await fire(root, pointer("pointermove", 120));
  expect(read(host).yaw).toBe(0);
});

test("a mouse drag whose release was lost ends on the next move with no button down", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await dragOn(root, 40);
  const turned = read(host).yaw;
  expect(root.dataset.dragging).toBe("true");
  await fire(root, pointer("pointermove", 100, 0, { buttons: 0 }));
  expect(root.dataset.dragging).toBeUndefined();
  await frames.advance(2000);
  const left = read(host).yaw;
  expect(left).toBeGreaterThanOrEqual(turned);
  await fire(root, pointer("pointermove", 200, 0, { buttons: 0 }));
  await frames.advance(2000);
  expect(read(host).yaw).toBe(left);
});

test("a second finger while the first turns the toy is left alone, and the first ends the turn", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(
    <Turntable mode="camera" release="return">
      {toy}
    </Turntable>,
  );
  const root = rootOf(host);
  const finger = (type: string, x: number, pointerId: number) => pointer(type, x, 0, { pointerType: "touch", pointerId, buttons: 0 });
  await fire(root, finger("pointerdown", 0, 1));
  await fire(root, finger("pointermove", 40, 1));
  const first = read(host).yaw;
  await fire(root, finger("pointerdown", 100, 2));
  await fire(root, finger("pointerup", 100, 2));
  await fire(root, finger("pointermove", 80, 1));
  expect(read(host).yaw).toBeGreaterThan(first);
  await fire(root, finger("pointerup", 80, 1));
  expect(root.dataset.dragging).toBeUndefined();
  await frames.advance(2000);
  expect(read(host).yaw).toBe(0);
});

test("a click from the keyboard is never swallowed, after a touch drag or a mouse drag", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  let clicks = 0;
  const { host } = await place(
    <Turntable mode="tilt">
      <button type="button" onClick={() => clicks++}>
        Press
      </button>
      <div className="face" />
    </Turntable>,
  );
  const face = host.querySelector(".face")!;
  const button = host.querySelector("button")!;
  const touch = { pointerType: "touch", buttons: 0 };
  await dragOn(face, 50, 0, touch);
  await fire(face, pointer("pointerup", 50, 0, touch));
  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(clicks).toBe(1);
  await dragOn(face, 50);
  await fire(face, pointer("pointerup", 50));
  await fire(button, new MouseEvent("click", { bubbles: true, detail: 0 }));
  expect(clicks).toBe(2);
});

const Grab = ({ turn }: { turn: Turn }) => (
  <>
    <output>{`${turn.yaw.toFixed(1)} ${turn.pitch.toFixed(1)} ${turn.full}`}</output>
    <button type="button" data-vectoys-grab="">
      <span>Roll</span>
    </button>
  </>
);

test("a double click on a toy that is one big button resets it, and a double click on another control does not", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{(turn) => <Grab turn={turn} />}</Turntable>);
  const span = host.querySelector("span")!;
  await dragOn(span, 50);
  await fire(span, pointer("pointerup", 50));
  await frames.advance(2000);
  expect(read(host).yaw).toBeGreaterThan(0);
  await fire(span, new MouseEvent("dblclick", { bubbles: true }));
  await frames.advance(2000);
  expect(read(host).yaw).toBe(0);

  const { host: other } = await place(<Turntable mode="camera">{toy}</Turntable>);
  await dragOn(rootOf(other), 50);
  await fire(rootOf(other), pointer("pointerup", 50));
  await frames.advance(2000);
  const turned = read(other).yaw;
  await fire(other.querySelector("button")!, new MouseEvent("dblclick", { bubbles: true }));
  await frames.advance(2000);
  expect(read(other).yaw).toBe(turned);
});

test("a reset whose first frame comes with no time passed still springs home", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  await dragOn(root, 50);
  await fire(root, pointer("pointerup", 50));
  await frames.advance(2000);
  expect(read(host).yaw).toBeGreaterThan(0);
  await fire(root, new MouseEvent("dblclick", { bubbles: true }));
  await frames.still();
  await frames.advance(2000);
  expect(read(host).yaw).toBe(0);
});

test("a third quick tap does not reset the toy again", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  const tap = async (type: string, at: number, x = 0) => {
    const event = pointer(type, x, 0, { pointerType: "touch", buttons: 0 });
    Object.defineProperty(event, "timeStamp", { value: at });
    await fire(root, event);
  };
  await tap("pointerdown", 1000);
  await tap("pointerup", 1050);
  await tap("pointerdown", 1100);
  await tap("pointerup", 1150);
  await frames.advance(2000);
  // Turned between the second tap and a third soon after.
  await tap("pointerdown", 1200);
  await tap("pointermove", 1210, 40);
  await tap("pointerup", 1220, 40);
  await frames.advance(2000);
  const turned = read(host).yaw;
  expect(turned).toBeGreaterThan(0);
  await tap("pointerdown", 1300);
  await tap("pointerup", 1350);
  await frames.advance(2000);
  expect(read(host).yaw).toBe(turned);
});

test("the full screen size and the degrees per pixel come from the toy's own size, not its tilted box", async () => {
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  const body = host.querySelector<HTMLElement>(".vectoys-turntable-body")!;
  Object.defineProperties(body, { offsetWidth: { value: 360 }, offsetHeight: { value: 180 } });
  body.getBoundingClientRect = () => DOMRect.fromRect({ width: 300, height: 300 });
  // Half a turn across 360 pixels is half a degree each.
  await dragOn(root, 40);
  expect(read(host).yaw).toBeCloseTo(20, 5);
  await fire(root, pointer("pointerup", 40));
  // The test page drops a width with min(), so the width is read as it is set.
  const set = spyOn(Object.getPrototypeOf(body.style), "setProperty");
  cleanup.push(() => set.mockRestore());
  await fire(host.querySelector(".vectoys-turntable-full")!, new MouseEvent("click", { bubbles: true }));
  expect(set.mock.calls).toContainEqual(["width", "min(92vw, calc(92dvh * 2))"]);
});

test("the overlay fills the page whatever size or display the toy's own class and style give it", async () => {
  const { host } = await place(
    <Turntable mode="tilt" className="sized" style={{ width: 240, height: 120, maxWidth: 300, margin: 20, display: "block", position: "relative" }}>
      {toy}
    </Turntable>,
  );
  const root = rootOf(host);
  await fire(host.querySelector(".vectoys-turntable-full")!, new MouseEvent("click", { bubbles: true }));
  expect(root.dataset.full).toBe("overlay");
  const look = getComputedStyle(root);
  expect([look.width, look.height, look.maxWidth, look.marginTop, look.display, look.position]).toEqual(["auto", "auto", "none", "0px", "grid", "fixed"]);
});

test("two overlays open and closed give the page its scroll back", async () => {
  document.body.style.overflow = "clip";
  cleanup.push(() => (document.body.style.overflow = ""));
  const { host } = await place(
    <>
      <Turntable mode="tilt">{toy}</Turntable>
      <Turntable mode="tilt">{toy}</Turntable>
    </>,
  );
  const [first, second] = host.querySelectorAll(".vectoys-turntable-full");
  await fire(first!, new MouseEvent("click", { bubbles: true }));
  await fire(second!, new MouseEvent("click", { bubbles: true }));
  expect(document.body.style.overflow).toBe("hidden");
  await fire(document.body, new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(document.body.style.overflow).toBe("clip");
});

test("when the browser refuses full screen the toy covers the page instead", async () => {
  const { host } = await place(<Turntable mode="camera">{toy}</Turntable>);
  const root = rootOf(host);
  Object.assign(root, { requestFullscreen: () => Promise.reject(new TypeError("Permissions check failed")) });
  await fire(host.querySelector(".vectoys-turntable-full")!, new MouseEvent("click", { bubbles: true }));
  await act(async () => new Promise((done) => setTimeout(done, 0)));
  expect(root.dataset.full).toBe("overlay");
  await fire(document.body, new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
});

test("a native drag of a link or an image that is the toy is stopped, and a text box keeps its own", async () => {
  const { host } = await place(
    <Turntable mode="tilt">
      <a href="#file" data-vectoys-grab="">
        <img alt="" src="data:," />
      </a>
      <textarea aria-label="Text" />
    </Turntable>,
  );
  const drag = (target: Element) => {
    const event = new Event("dragstart", { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(drag(host.querySelector("img")!)).toBe(true);
  expect(drag(host.querySelector("textarea")!)).toBe(false);
});

test("the hidden full screen button takes no clicks until it shows, and pinch zoom stays the page's", () => {
  const html = renderToString(<Turntable mode="camera">{toy}</Turntable>);
  expect(html).toContain("opacity:0;pointer-events:none");
  expect(html).toContain("{opacity:1;pointer-events:auto}");
  expect(html).toContain("@media (hover:none){.vectoys-turntable-full{opacity:1;pointer-events:auto}}");
  expect(html).toContain("touch-action:pan-y pinch-zoom");
});

test("a press on the toy never selects its text, while a text box inside still does", async () => {
  const { host } = await place(<Turntable mode="tilt">{toy}</Turntable>);
  expect(getComputedStyle(rootOf(host)).userSelect).toBe("none");
  expect(getComputedStyle(host.querySelector("input")!).userSelect).toBe("text");
  const { host: still } = await place(<Turntable mode="tilt" draggable={false}>{toy}</Turntable>);
  expect(getComputedStyle(rootOf(still)).userSelect).not.toBe("none");
});
