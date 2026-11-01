import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act } from "react";
import { fakeFrames, fire, mount, reducedMotion } from "../../../packages/react/test/dom";
import { Keyboard } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);
afterEach(() => document.body.replaceChildren());

// A stand-in for WebAudio that counts the contexts made, the clicks played and the contexts closed.
let made = 0;
let played = 0;
let closed = 0;
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect: (next: unknown) => next, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), buffer: null, type: "" });
class FakeAudio {
  sampleRate = 8000;
  currentTime = 0;
  state = "running";
  destination = {};
  constructor() {
    made += 1;
  }
  createBuffer = (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBufferSource = () => {
    played += 1;
    return node();
  };
  createBiquadFilter = node;
  createGain = node;
  createOscillator = node;
  resume = async () => {};
  close = async () => {
    closed += 1;
  };
}
const real = globalThis.AudioContext;
beforeEach(() => {
  made = 0;
  played = 0;
  closed = 0;
  Object.assign(globalThis, { AudioContext: FakeAudio });
});
afterAll(() => Object.assign(globalThis, { AudioContext: real }));

const key = (host: Element, id: string) => host.querySelector(`[data-key="${id}"]`)!;
const isDown = (host: Element, id: string) => key(host, id).hasAttribute("data-down");
/** Sends a key from the page; `at` sets its time and `caps` whether caps lock is on, as happy-dom keeps neither. */
const press = (type: "keydown" | "keyup", code: string, { at, caps, ...init }: KeyboardEventInit & { at?: number; caps?: boolean } = {}) => {
  const event = new KeyboardEvent(type, { bubbles: true, code, ...init });
  if (at !== undefined) Object.defineProperty(event, "timeStamp", { value: at });
  if (caps !== undefined) Object.defineProperty(event, "getModifierState", { value: (name: string) => name === "CapsLock" && caps });
  return fire(document.body, event);
};
const light = (host: Element) => key(host, "CapsLock").querySelector("rect")?.hasAttribute("data-on");

test("a real key holds its cap down by its code until it comes up, and never stops the page's own keys", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyQ", key: "й" });
  await fire(document.body, event);
  expect(event.defaultPrevented).toBe(false);
  expect(isDown(host, "KeyQ")).toBe(true);
  await press("keydown", "ShiftLeft");
  expect(isDown(host, "ShiftLeft")).toBe(true);
  await frames.advance(300);
  expect(isDown(host, "KeyQ")).toBe(true);
  await press("keyup", "KeyQ");
  expect(isDown(host, "KeyQ")).toBe(false);
  expect(isDown(host, "ShiftLeft")).toBe(true);
  expect(document.activeElement).toBe(document.body);
  await unmount();
});

const SCROLL_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
/** Sends a cancelable key down for each of Space and the arrows from `target`, and returns whether each was default-prevented. */
const scrollKeys = async (target: Element = document.body, init: KeyboardEventInit = {}) => {
  const prevented: boolean[] = [];
  for (const code of SCROLL_KEYS) {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code, key: code === "Space" ? " " : code, ...init });
    await fire(target, event);
    prevented.push(event.defaultPrevented);
    await fire(target, new KeyboardEvent("keyup", { bubbles: true, code }));
  }
  return prevented;
};

test("Space and the arrows do not scroll the page while focus is on no control, and still press their keys", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  expect(await scrollKeys()).toEqual([true, true, true, true, true]);
  expect(await scrollKeys(document.body, { shiftKey: true })).toEqual([true, true, true, true, true]);
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "Space", key: " " });
  await fire(document.body, event);
  expect(isDown(host, "Space")).toBe(true);
  // Other keys, Tab and the browser's shortcuts on the arrows keep their defaults.
  for (const init of [{ code: "KeyA", key: "a" }, { code: "Tab", key: "Tab" }, { code: "Enter", key: "Enter" }, { code: "PageDown", key: "PageDown" }]) {
    const other = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    await fire(document.body, other);
    expect(other.defaultPrevented).toBe(false);
  }
  expect(await scrollKeys(document.body, { metaKey: true })).toEqual([false, false, false, false, false]);
  expect(await scrollKeys(document.body, { altKey: true })).toEqual([false, false, false, false, false]);
  await unmount();
});

test("Space and the arrows keep their defaults in another control, on the toy's own button, with listen={false}, and in the text box", async () => {
  const { host, unmount } = await mount(<Keyboard typing />);
  const other = document.createElement("input");
  document.body.append(other);
  other.focus();
  expect(await scrollKeys(other)).toEqual([false, false, false, false, false]);
  other.remove();
  const sound = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  sound.focus();
  expect(await scrollKeys(sound)).toEqual([false, false, false, false, false]);
  sound.blur();
  // A space typed while nothing has focus goes to the text box, so it must still type there.
  expect(await scrollKeys()).toEqual([false, false, false, false, false]);
  expect(document.activeElement).toBe(host.querySelector("textarea"));
  await unmount();
  const quiet = await mount(<Keyboard listen={false} />);
  expect(await scrollKeys()).toEqual([false, false, false, false, false]);
  await quiet.unmount();
});

test("leaving the window lets every held key go", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "KeyA");
  await press("keydown", "MetaLeft");
  await fire(key(host, "KeyL"), new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 3 }));
  expect(host.querySelectorAll("[data-down]")).toHaveLength(3);
  await act(async () => void window.dispatchEvent(new Event("blur")));
  expect(host.querySelectorAll("[data-down]")).toHaveLength(0);
  await unmount();
});

test("a pointer presses a key until it lifts or leaves", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await fire(key(host, "Space"), new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
  expect(isDown(host, "Space")).toBe(true);
  await fire(key(host, "Space"), new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  expect(isDown(host, "Space")).toBe(false);
  await fire(key(host, "KeyF"), new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
  // React makes pointer leave from pointer out, as browsers send both.
  await fire(key(host, "KeyF").querySelector("path")!, new PointerEvent("pointerout", { bubbles: true, pointerId: 1, relatedTarget: host }));
  expect(isDown(host, "KeyF")).toBe(false);
  await unmount();
});

test("no audio starts before a press, and each press and release clicks once", async () => {
  const { unmount } = await mount(<Keyboard />);
  await frames.advance(200);
  expect(made).toBe(0);
  await press("keydown", "KeyS");
  expect(made).toBe(1);
  expect(played).toBe(1);
  await press("keydown", "KeyS", { repeat: true });
  expect(played).toBe(1);
  await press("keyup", "KeyS");
  expect(played).toBe(2);
  await press("keydown", "KeyD");
  expect(made).toBe(1);
  await unmount();
});

test("the sound button turns the clicks off and on, and tells the page", async () => {
  const onSoundChange = mock((_: boolean) => {});
  const { host, unmount } = await mount(<Keyboard onSoundChange={onSoundChange} />);
  const button = host.querySelector('[role="switch"]')!;
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(button.getAttribute("aria-checked")).toBe("false");
  expect(button.textContent).toBe("Sound off");
  expect(onSoundChange).toHaveBeenLastCalledWith(false);
  await press("keydown", "KeyK");
  await press("keyup", "KeyK");
  expect(made).toBe(0);
  expect(played).toBe(0);
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onSoundChange).toHaveBeenLastCalledWith(true);
  await press("keydown", "KeyK");
  expect(played).toBe(1);
  await unmount();
});

test("a controlled sound follows its prop, not its button", async () => {
  const onSoundChange = mock((_: boolean) => {});
  const { host, unmount } = await mount(<Keyboard sound={false} onSoundChange={onSoundChange} />);
  const button = host.querySelector('[role="switch"]')!;
  await fire(button, new MouseEvent("click", { bubbles: true }));
  expect(onSoundChange).toHaveBeenCalledWith(true);
  expect(button.getAttribute("aria-checked")).toBe("false");
  await unmount();
});

test("the demo types silently and stops for good at the first real press", async () => {
  const { host, unmount } = await mount(<Keyboard demo="hi" />);
  const seen = new Set<string>();
  for (let step = 0; step < 100; step++) {
    await frames.advance(16);
    for (const down of host.querySelectorAll("[data-down]")) seen.add(down.getAttribute("data-key")!);
  }
  expect([...seen].sort()).toEqual(["KeyH", "KeyI"]);
  expect(made).toBe(0);
  await press("keydown", "KeyZ");
  await press("keyup", "KeyZ");
  await frames.advance(6000);
  expect(host.querySelectorAll("[data-down]")).toHaveLength(0);
  await unmount();
});

test("under reduced motion there is no demo, and keys still go down", async () => {
  const motion = reducedMotion(true);
  const { host, unmount } = await mount(<Keyboard demo />);
  await frames.advance(2000);
  expect(host.querySelectorAll("[data-down]")).toHaveLength(0);
  await press("keydown", "KeyE");
  expect(isDown(host, "KeyE")).toBe(true);
  await unmount();
  motion.restore();
});

test("listen={false} leaves the real keyboard alone", async () => {
  const { host, unmount } = await mount(<Keyboard listen={false} />);
  await press("keydown", "KeyQ");
  expect(isDown(host, "KeyQ")).toBe(false);
  expect(made).toBe(0);
  await unmount();
});

test("keys pressed while command is down spring back by themselves", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "MetaLeft", { metaKey: true });
  await press("keydown", "KeyK", { metaKey: true });
  expect(isDown(host, "KeyK")).toBe(true);
  await wait(200);
  expect(isDown(host, "KeyK")).toBe(false);
  expect(isDown(host, "MetaLeft")).toBe(true);
  await unmount();
});

/** Waits real time, for the timers a tap uses, and lets React finish what they start. */
const wait = (ms: number) => act(() => new Promise<void>((done) => setTimeout(done, ms)));

test("caps lock taps on a key down with no key up, and on a lone key up", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "CapsLock", { at: 1000 });
  expect(isDown(host, "CapsLock")).toBe(true);
  await wait(200);
  expect(isDown(host, "CapsLock")).toBe(false);
  await press("keyup", "CapsLock", { at: 5000 });
  expect(isDown(host, "CapsLock")).toBe(true);
  await wait(200);
  expect(isDown(host, "CapsLock")).toBe(false);
  await unmount();
});

test("caps lock comes up at once on a quick key up, and taps again only after 600 ms", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "CapsLock", { at: 1000 });
  await press("keyup", "CapsLock", { at: 1050 });
  expect(isDown(host, "CapsLock")).toBe(false);
  await press("keydown", "CapsLock", { at: 2000 });
  await wait(200);
  await press("keyup", "CapsLock", { at: 2500 });
  expect(isDown(host, "CapsLock")).toBe(false);
  await press("keydown", "CapsLock", { at: 3000 });
  await wait(200);
  await press("keyup", "CapsLock", { at: 3700 });
  expect(isDown(host, "CapsLock")).toBe(true);
  await wait(200);
  expect(isDown(host, "CapsLock")).toBe(false);
  await unmount();
});

test("the caps lock light follows the system's caps lock", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  expect(light(host)).toBe(false);
  await press("keydown", "KeyA", { caps: true });
  expect(light(host)).toBe(true);
  await press("keyup", "KeyA", { caps: true });
  expect(light(host)).toBe(true);
  await press("keydown", "CapsLock", { at: 1000, caps: false });
  expect(light(host)).toBe(false);
  await unmount();
});

test("command coming up lets every held key go", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "KeyA");
  await press("keydown", "MetaLeft", { metaKey: true });
  expect(isDown(host, "KeyA")).toBe(true);
  await press("keyup", "MetaLeft");
  expect(isDown(host, "KeyA")).toBe(false);
  expect(isDown(host, "MetaLeft")).toBe(false);
  await unmount();
});

test("a hidden page lets every held key go", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "KeyA");
  expect(isDown(host, "KeyA")).toBe(true);
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  await act(async () => void document.dispatchEvent(new Event("visibilitychange")));
  Reflect.deleteProperty(document, "visibilityState");
  expect(isDown(host, "KeyA")).toBe(false);
  await unmount();
});

test("a page that stops a key still lets its cap come up", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  const stop = (event: Event) => event.stopPropagation();
  document.body.addEventListener("keyup", stop);
  await press("keydown", "KeyA");
  await press("keyup", "KeyA");
  document.body.removeEventListener("keyup", stop);
  expect(isDown(host, "KeyA")).toBe(false);
  await unmount();
});

test("unmounting closes the audio once a press started it", async () => {
  const { unmount } = await mount(<Keyboard />);
  await press("keydown", "KeyS");
  expect(made).toBe(1);
  await unmount();
  expect(closed).toBe(1);
});

/** Puts a stand-in IntersectionObserver in place until `restore`; `view` tells every observed board whether it is on screen. */
function fakeObserver() {
  const real = globalThis.IntersectionObserver;
  const instances: FakeObserver[] = [];
  class FakeObserver implements IntersectionObserver {
    root = null;
    rootMargin = "";
    scrollMargin = "";
    thresholds = [0];
    takeRecords = () => [];
    callback: IntersectionObserverCallback;
    target?: Element;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
    observe(target: Element) {
      this.target = target;
    }
    disconnect() {}
    unobserve() {}
  }
  Object.assign(globalThis, { IntersectionObserver: FakeObserver });
  const view = (isIntersecting: boolean) =>
    act(async () => {
      for (const observer of instances) {
        const { callback, target } = observer;
        if (!target) continue;
        const rect = target.getBoundingClientRect();
        callback(
          [{ boundingClientRect: rect, intersectionRect: rect, rootBounds: null, intersectionRatio: isIntersecting ? 1 : 0, time: 0, isIntersecting, target }],
          observer,
        );
      }
    });
  return { view, restore: () => Object.assign(globalThis, { IntersectionObserver: real }) };
}

test("the real keyboard moves the keys only while the board is on screen", async () => {
  const { view, restore } = fakeObserver();
  try {
    const { host, unmount } = await mount(<Keyboard />);
    await view(false);
    await press("keydown", "KeyQ");
    expect(isDown(host, "KeyQ")).toBe(false);
    expect(made).toBe(0);
    await view(true);
    await press("keydown", "KeyQ");
    expect(isDown(host, "KeyQ")).toBe(true);
    expect(made).toBe(1);
    await view(false);
    expect(isDown(host, "KeyQ")).toBe(false);
    await unmount();
  } finally {
    restore();
  }
});

test("off screen, Space and the arrows scroll the page as usual", async () => {
  const { view, restore } = fakeObserver();
  try {
    const { unmount } = await mount(<Keyboard />);
    await view(false);
    expect(await scrollKeys()).toEqual([false, false, false, false, false]);
    await view(true);
    expect(await scrollKeys()).toEqual([true, true, true, true, true]);
    await unmount();
  } finally {
    restore();
  }
});

test("the demo rests while the board is off screen, and types again when it shows", async () => {
  const { view, restore } = fakeObserver();
  try {
    const { host, unmount } = await mount(<Keyboard demo="hi" />);
    await view(false);
    // Let the caps' springs settle; then nothing asks for frames.
    await frames.advance(1500);
    expect(frames.pending()).toBe(0);
    expect(host.querySelectorAll("[data-down]")).toHaveLength(0);
    await view(true);
    const seen = new Set<string>();
    for (let step = 0; step < 100; step++) {
      await frames.advance(16);
      for (const down of host.querySelectorAll("[data-down]")) seen.add(down.getAttribute("data-key") ?? "");
    }
    expect([...seen].sort()).toEqual(["KeyH", "KeyI"]);
    await unmount();
  } finally {
    restore();
  }
});

test("with listen={false} a key held by a pointer still comes up when the window loses focus", async () => {
  const { host, unmount } = await mount(<Keyboard listen={false} />);
  await fire(key(host, "KeyL"), new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 4 }));
  expect(isDown(host, "KeyL")).toBe(true);
  await act(async () => void window.dispatchEvent(new Event("blur")));
  expect(isDown(host, "KeyL")).toBe(false);
  await unmount();
});

const box = (host: Element) => host.querySelector("textarea")!;
const buttonNamed = (host: Element, name: string) => [...host.querySelectorAll("button")].find((button) => button.textContent === name);
/**
 * Puts `text` in a text box as typing would. Depending on what React found when it loaded,
 * it reads the change on input or on key up, so both are sent; it acts on the first only.
 */
const typeInto = (field: HTMLTextAreaElement, text: string) =>
  act(async () => {
    field.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  });

test("a key typed while nothing has focus focuses the text box before the browser types it, and still presses", async () => {
  const { host, unmount } = await mount(<Keyboard typing defaultValue="Hi" />);
  expect(document.activeElement).toBe(document.body);
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyH", key: "h" });
  await fire(document.body, event);
  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(box(host));
  expect([box(host).selectionStart, box(host).selectionEnd]).toEqual([2, 2]);
  expect(isDown(host, "KeyH")).toBe(true);
  expect(made).toBe(1);
  await unmount();
});

test("an AltGr character, sent as ctrl and alt on Windows, goes into the text box", async () => {
  const { host, unmount } = await mount(<Keyboard typing />);
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyQ", key: "@", ctrlKey: true, altKey: true });
  Object.defineProperty(event, "getModifierState", { value: (name: string) => name === "AltGraph" });
  await fire(document.body, event);
  expect(document.activeElement).toBe(box(host));
  await unmount();
});

test("a dead key pressed while nothing has focus focuses the text box, so the accent it starts lands there", async () => {
  const { host, unmount } = await mount(<Keyboard typing />);
  await press("keydown", "Quote", { key: "Dead", metaKey: true });
  expect(document.activeElement).toBe(document.body);
  await press("keydown", "Quote", { key: "Dead" });
  expect(document.activeElement).toBe(box(host));
  await unmount();
});

test("shortcuts, tab and a space on the toy's own button stay where they are", async () => {
  const { host, unmount } = await mount(<Keyboard typing fullscreen />);
  await press("keydown", "KeyL", { key: "l", metaKey: true });
  await press("keydown", "KeyT", { key: "t", ctrlKey: true });
  await press("keydown", "Tab", { key: "Tab" });
  expect(document.activeElement).toBe(document.body);
  const sound = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  sound.focus();
  await fire(sound, new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " }));
  expect(document.activeElement).toBe(sound);
  await fire(sound, new KeyboardEvent("keydown", { bubbles: true, code: "KeyA", key: "a" }));
  expect(document.activeElement).toBe(box(host));
  await unmount();
});

test("typing in another field on the page stays in that field and presses nothing", async () => {
  const { host, unmount } = await mount(<Keyboard typing />);
  const other = document.createElement("input");
  document.body.append(other);
  other.focus();
  await fire(other, new KeyboardEvent("keydown", { bubbles: true, code: "KeyX", key: "x" }));
  expect(document.activeElement).toBe(other);
  expect(isDown(host, "KeyX")).toBe(false);
  expect(made).toBe(0);
  other.remove();
  await unmount();
});

test("Enter or Space on another button on the page presses no key and starts no audio", async () => {
  const { host, unmount } = await mount(<Keyboard typing />);
  const other = document.createElement("button");
  document.body.append(other);
  other.focus();
  for (const { code, key } of [
    { code: "Enter", key: "Enter" },
    { code: "Space", key: " " },
  ]) {
    await fire(other, new KeyboardEvent("keydown", { bubbles: true, code, key }));
    expect(host.querySelectorAll("[data-down]")).toHaveLength(0);
    await fire(other, new KeyboardEvent("keyup", { bubbles: true, code, key }));
  }
  expect(document.activeElement).toBe(other);
  expect(made).toBe(0);
  expect(played).toBe(0);
  other.remove();
  await unmount();
});

test("a key that went down with no focus comes up after focus moves to another control", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  await press("keydown", "KeyA");
  expect(isDown(host, "KeyA")).toBe(true);
  const other = document.createElement("input");
  document.body.append(other);
  other.focus();
  await fire(other, new KeyboardEvent("keyup", { bubbles: true, code: "KeyA" }));
  expect(isDown(host, "KeyA")).toBe(false);
  other.remove();
  await unmount();
});

test("keys on the keyboard's own focused buttons still press", async () => {
  const { host, unmount } = await mount(<Keyboard />);
  const sound = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  sound.focus();
  await fire(sound, new KeyboardEvent("keydown", { bubbles: true, code: "Enter", key: "Enter" }));
  expect(isDown(host, "Enter")).toBe(true);
  await unmount();
});

test("the text box keeps what is typed, tells the page, and Clear empties it and keeps the focus there", async () => {
  const onValueChange = mock((_: string) => {});
  const { host, unmount } = await mount(<Keyboard typing onValueChange={onValueChange} />);
  await typeInto(box(host), "Hello world");
  expect(box(host).value).toBe("Hello world");
  expect(onValueChange).toHaveBeenLastCalledWith("Hello world");
  await fire(buttonNamed(host, "Clear")!, new MouseEvent("click", { bubbles: true }));
  expect(box(host).value).toBe("");
  expect(onValueChange).toHaveBeenLastCalledWith("");
  expect(document.activeElement).toBe(box(host));
  await unmount();
});

test("a controlled text follows its prop, not the box", async () => {
  const onValueChange = mock((_: string) => {});
  const { host, rerender, unmount } = await mount(<Keyboard typing value="fixed" onValueChange={onValueChange} />);
  await typeInto(box(host), "fixedx");
  expect(onValueChange).toHaveBeenLastCalledWith("fixedx");
  expect(box(host).value).toBe("fixed");
  await rerender(<Keyboard typing value="next" onValueChange={onValueChange} />);
  expect(box(host).value).toBe("next");
  await unmount();
});

test("the text box brings no audio before a gesture, and listen={false} with typing still focuses the box but presses nothing", async () => {
  const { host, unmount } = await mount(<Keyboard typing listen={false} />);
  await frames.advance(200);
  expect(made).toBe(0);
  await press("keydown", "KeyQ", { key: "q" });
  expect(document.activeElement).toBe(box(host));
  expect(isDown(host, "KeyQ")).toBe(false);
  expect(made).toBe(0);
  await unmount();
});

test("the full screen button shows only where the Fullscreen API is, and follows full screen changes", async () => {
  const plain = await mount(<Keyboard fullscreen />);
  expect(buttonNamed(plain.host, "Full screen")).toBeUndefined();
  await plain.unmount();

  const screen: { filled: Element | null } = { filled: null };
  const change = () => document.dispatchEvent(new Event("fullscreenchange"));
  const requestFullscreen = mock(async function (this: Element) {
    screen.filled = this;
    change();
  });
  const exitFullscreen = mock(async () => {
    screen.filled = null;
    change();
  });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { value: requestFullscreen, configurable: true });
  Object.defineProperty(document, "exitFullscreen", { value: exitFullscreen, configurable: true });
  Object.defineProperty(document, "fullscreenElement", { get: () => screen.filled, configurable: true });
  try {
    const off = await mount(<Keyboard />);
    expect(off.host.querySelectorAll("button")).toHaveLength(1);
    await off.unmount();

    const { host, unmount } = await mount(<Keyboard fullscreen typing />);
    const toy = host.firstElementChild!;
    expect([...host.querySelectorAll("button, textarea")].map((element) => element.textContent || element.tagName)).toEqual([
      "TEXTAREA",
      "Clear",
      "Sound on",
      "Full screen",
    ]);
    await act(async () => buttonNamed(host, "Full screen")!.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.filled).toBe(toy);
    expect(buttonNamed(host, "Exit full screen")).toBeDefined();
    await act(async () => buttonNamed(host, "Exit full screen")!.click());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(buttonNamed(host, "Full screen")).toBeDefined();
    // Esc is the browser's: it leaves full screen and sends only the change.
    await act(async () => toy instanceof HTMLElement && toy.requestFullscreen());
    expect(buttonNamed(host, "Exit full screen")).toBeDefined();
    screen.filled = null;
    await act(async () => change());
    expect(buttonNamed(host, "Full screen")).toBeDefined();
    await unmount();

    const only = await mount(<Keyboard fullscreen typing="fullscreen" />);
    expect(only.host.querySelector("textarea")).toBeNull();
    await press("keydown", "KeyH", { key: "h" });
    expect(document.activeElement).toBe(document.body);
    await act(async () => buttonNamed(only.host, "Full screen")!.click());
    expect(box(only.host)).not.toBeNull();
    expect(box(only.host).placeholder).toBe("Start typing\u2026");
    await press("keydown", "KeyH", { key: "h" });
    expect(document.activeElement).toBe(box(only.host));
    expect([...only.host.querySelectorAll("button")].map((element) => element.textContent)).toEqual(["Clear", "Sound on", "Exit full screen"]);
    await act(async () => buttonNamed(only.host, "Exit full screen")!.click());
    expect(only.host.querySelector("textarea")).toBeNull();
    await only.unmount();

    // The page takes the button away while the toy fills the screen: it leaves full screen and lays out as before.
    const dropped = await mount(<Keyboard fullscreen typing="fullscreen" />);
    await act(async () => buttonNamed(dropped.host, "Full screen")?.click());
    expect(box(dropped.host)).not.toBeNull();
    const exits = exitFullscreen.mock.calls.length;
    await dropped.rerender(<Keyboard typing="fullscreen" />);
    expect(exitFullscreen).toHaveBeenCalledTimes(exits + 1);
    expect(screen.filled).toBeNull();
    expect(dropped.host.querySelector("textarea")).toBeNull();
    expect(dropped.host.firstElementChild?.getAttribute("style")).not.toContain("position: relative");
    await dropped.unmount();
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    Reflect.deleteProperty(document, "exitFullscreen");
    Reflect.deleteProperty(document, "fullscreenElement");
  }
});
