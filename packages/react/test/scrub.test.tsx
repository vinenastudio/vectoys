import { afterEach, expect, spyOn, test } from "bun:test";
import { act, useRef } from "react";
import { renderToString } from "react-dom/server";
import { useScrub, type Progress } from "../src";
import { fakeFrames, mount, reducedMotion } from "./dom";

let cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.forEach((undo) => undo());
  cleanup = [];
  document.body.replaceChildren();
});

// The track's place on screen, as the page scrolls: 3 screens tall in a viewport 768 tall.
const VIEWPORT = window.innerHeight;
let top = 0;
const place = () => {
  const spy = spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top, bottom: top + 3 * VIEWPORT, height: 3 * VIEWPORT, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) satisfies DOMRect,
  );
  cleanup.push(() => spy.mockRestore());
};

function Track({ seen }: { seen: (scrub: { progress: Progress; reduced: boolean }, renders: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const renders = useRef(0);
  renders.current += 1;
  const scrub = useScrub(track, { screens: 3 });
  seen(scrub, renders.current);
  return (
    <div ref={track}>
      <output>{scrub.progress.get()}</output>
    </div>
  );
}

const scroll = () => act(async () => void window.dispatchEvent(new Event("scroll")));

async function scrolled(to: number, frames: ReturnType<typeof fakeFrames>) {
  top = to;
  await scroll();
  await frames.advance(16);
}

test("progress runs from 0 at the track's top to 1 at its bottom, once a frame, with no render", async () => {
  place();
  const frames = fakeFrames();
  cleanup.push(frames.restore);
  const seen: Progress[] = [];
  let rendered = 0;
  top = 100;
  await mount(<Track seen={(scrub, renders) => ((rendered = renders), seen.push(scrub.progress))} />);
  const scrub = { progress: seen[0] ?? { get: () => -1, subscribe: () => () => {} } };
  expect(scrub.progress.get()).toBe(0);
  const heard: number[] = [];
  const stop = scrub.progress.subscribe((value) => heard.push(value));

  await scrolled(-VIEWPORT, frames);
  expect(scrub.progress.get()).toBeCloseTo(0.5, 10);
  await scrolled(-2 * VIEWPORT, frames);
  expect(scrub.progress.get()).toBe(1);
  await scrolled(-5 * VIEWPORT, frames);
  expect(scrub.progress.get()).toBe(1);

  // Many scroll events in one frame measure once.
  for (const to of [0, -100, -200]) {
    top = to;
    await scroll();
  }
  expect(frames.pending()).toBe(1);
  await frames.advance(16);
  expect(scrub.progress.get()).toBeCloseTo(200 / (2 * VIEWPORT), 10);

  stop();
  await scrolled(0, frames);
  expect(scrub.progress.get()).toBe(0);
  expect(heard).toEqual([0.5, 1, 200 / (2 * VIEWPORT)]);
  expect(rendered).toBe(1);
  expect(new Set(seen).size).toBe(1);
});

test("the listeners are passive and go away with the component", async () => {
  place();
  const added = spyOn(window, "addEventListener");
  const removed = spyOn(window, "removeEventListener");
  cleanup.push(() => added.mockRestore(), () => removed.mockRestore());
  const { unmount } = await mount(<Track seen={() => {}} />);
  const listened = added.mock.calls.filter(([type]) => type === "scroll" || type === "resize");
  expect(listened.map(([type, , options]) => [type, options])).toEqual([
    ["scroll", { passive: true }],
    ["resize", { passive: true }],
  ]);
  await unmount();
  expect(removed.mock.calls.filter(([type]) => type === "scroll" || type === "resize")).toHaveLength(2);
});

test("on the server the progress is 0 and nothing asks for less motion", () => {
  let reduced: boolean | null = null;
  const html = renderToString(<Track seen={(scrub) => (reduced = scrub.reduced)} />);
  expect(html).toContain("<output>0</output>");
  expect(reduced === false).toBe(true);
});

test("reduced follows the page's ask for less motion", async () => {
  place();
  const asked = reducedMotion(true);
  cleanup.push(asked.restore);
  let reduced = false;
  await mount(<Track seen={(scrub) => (reduced = scrub.reduced)} />);
  expect(reduced).toBe(true);
});
