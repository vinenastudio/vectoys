import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fakeFrames, fire, installGlobal, mount, readSibling } from "../../../packages/react/test/dom";
import { Keycap, KeycapRow } from "../src";

const frames = fakeFrames();
afterAll(frames.restore);
afterEach(() => document.body.replaceChildren());

// A stand-in for WebAudio that counts the contexts made, the clicks played (one noise burst each) and the contexts closed.
let made = 0;
let played = 0;
let closed = 0;
let resumed = 0;
let disconnected = 0;
let state = "running";
// The sources made, so a test can end them as the audio would.
const sources: { onended: (() => void) | null }[] = [];
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({
  connect: (next: unknown) => next,
  disconnect() {
    disconnected += 1;
  },
  start() {},
  stop() {},
  onended: null,
  gain: param(),
  frequency: param(),
  Q: param(),
  buffer: null,
  type: "",
});
const source = () => {
  const made = node();
  sources.push(made);
  return made;
};
class FakeAudio {
  sampleRate = 8000;
  currentTime = 0;
  get state() {
    return state;
  }
  destination = {};
  constructor() {
    made += 1;
  }
  createBuffer = (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBufferSource = () => {
    played += 1;
    return source();
  };
  createBiquadFilter = node;
  createGain = node;
  createOscillator = source;
  resume = async () => {
    resumed += 1;
  };
  close = async () => {
    closed += 1;
  };
}
const restoreAudio = installGlobal("AudioContext", FakeAudio);
beforeEach(() => {
  made = 0;
  played = 0;
  closed = 0;
  resumed = 0;
  disconnected = 0;
  state = "running";
  sources.length = 0;
});
afterAll(restoreAudio);

const buttonIn = (host: Element, name: string) => {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent === name);
  if (!button) throw new Error(`no ${name} button`);
  return button;
};
const pointer = async (button: Element) => {
  await fire(button, new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  await fire(button, new PointerEvent("pointerup", { bubbles: true }));
};
const enter = async (button: Element) => {
  await fire(button, new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  await fire(button, new KeyboardEvent("keydown", { bubbles: true, key: "Enter", repeat: true }));
  await fire(button, new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
};

test("no audio starts before a press, then a pointer press and Enter each click down and up", async () => {
  const { host, unmount } = await mount(<Keycap defaultSound>Join</Keycap>);
  expect(made).toBe(0);
  const button = buttonIn(host, "Join");
  await pointer(button);
  expect(made).toBe(1);
  expect(played).toBe(2);
  await enter(button);
  expect(made).toBe(1);
  expect(played).toBe(4);
  await unmount();
  expect(closed).toBe(1);
});

test("sound is off by default and when the page turns it off, and a disabled key never clicks", async () => {
  for (const node of [<Keycap>Join</Keycap>, <Keycap sound={false} defaultSound>Join</Keycap>, <Keycap defaultSound disabled>Join</Keycap>]) {
    const { host, unmount } = await mount(node);
    await pointer(buttonIn(host, "Join"));
    await enter(buttonIn(host, "Join"));
    await unmount();
  }
  expect(made).toBe(0);
  expect(played).toBe(0);
});

test("a key disabled while held sends no release later, and its next press clicks", async () => {
  const { host, rerender, unmount } = await mount(<Keycap defaultSound>Join</Keycap>);
  await fire(buttonIn(host, "Join"), new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  expect(played).toBe(1);
  await rerender(<Keycap defaultSound disabled>Join</Keycap>);
  await rerender(<Keycap defaultSound>Join</Keycap>);
  await fire(buttonIn(host, "Join"), new PointerEvent("pointerup", { bubbles: true }));
  expect(played).toBe(1);
  await fire(buttonIn(host, "Join"), new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  expect(played).toBe(2);
  await unmount();
});

test("each finished click lets go of its nodes, and a suspended or interrupted context resumes", async () => {
  const { host, unmount } = await mount(<Keycap defaultSound>Join</Keycap>);
  await pointer(buttonIn(host, "Join"));
  expect(resumed).toBe(0);
  // Two clicks, each a noise burst through a band and its gain, and a tone through its gain.
  expect(sources).toHaveLength(4);
  for (const ended of sources) ended.onended?.();
  expect(disconnected).toBe(10);
  for (const next of ["suspended", "interrupted", "closed"]) {
    state = next;
    await pointer(buttonIn(host, "Join"));
  }
  expect(resumed).toBe(4);
  await unmount();
});

test("a row's keys share one audio context, closed when the row goes", async () => {
  const { host, unmount } = await mount(<KeycapRow keys={["T", "O", "Y"]} defaultSound />);
  for (const key of ["T", "O", "Y"]) await pointer(buttonIn(host, key));
  expect(made).toBe(1);
  expect(played).toBe(6);
  await unmount();
  expect(closed).toBe(1);
});

test("the row's sound switch turns the clicks off and on and tells the page", async () => {
  const changes: boolean[] = [];
  const { host, unmount } = await mount(<KeycapRow keys={["T"]} defaultSound soundToggle onSoundChange={(sound) => changes.push(sound)} />);
  const toggle = host.querySelector('[role="switch"]');
  if (!toggle) throw new Error("no switch");
  expect(toggle.hasAttribute("aria-label")).toBe(false);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(toggle.textContent).toBe("Sound on");
  await fire(toggle, new MouseEvent("click", { bubbles: true }));
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(toggle.textContent).toBe("Sound off");
  await pointer(buttonIn(host, "T"));
  expect(played).toBe(0);
  await fire(toggle, new MouseEvent("click", { bubbles: true }));
  await pointer(buttonIn(host, "T"));
  expect(played).toBe(2);
  expect(changes).toEqual([false, true]);
  await unmount();
});

test("a single key's sound switch turns its clicks off and tells the page", async () => {
  const changes: boolean[] = [];
  const { host, unmount } = await mount(
    <Keycap defaultSound soundToggle onSoundChange={(sound) => changes.push(sound)}>
      Join
    </Keycap>,
  );
  const toggle = host.querySelector('[role="switch"]');
  if (!toggle) throw new Error("no switch");
  await fire(toggle, new MouseEvent("click", { bubbles: true }));
  await pointer(buttonIn(host, "Join"));
  expect(played).toBe(0);
  expect(changes).toEqual([false]);
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  await unmount();
});

test("the keycap's sound is the same file as the keyboard's", async () => {
  expect(await readSibling(import.meta.url, "../src/sound.ts")).toBe(await readSibling(import.meta.url, "../../keyboard/src/sound.ts"));
});

test("renders the same on the server with the sound switch, and no switch without it", () => {
  const row = <KeycapRow keys={["v"]} label="vec" defaultSound soundToggle />;
  expect(renderToString(row)).toBe(renderToString(row));
  expect(renderToString(row)).toContain('role="switch" aria-checked="true" class=');
  expect(renderToString(<KeycapRow keys={["v"]} />)).not.toContain('role="switch"');
  expect(renderToString(<Keycap />)).not.toContain('role="switch"');
});
