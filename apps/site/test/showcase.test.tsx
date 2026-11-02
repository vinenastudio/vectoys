import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Showcase } from "../src/sections/showcase";

type Watcher = { callback: IntersectionObserverCallback; targets: Element[] };
let watchers: Watcher[] = [];
let reduced = false;
let dark = false;
let listeners: Record<string, (() => void)[]> = {};
let host: HTMLDivElement;
let root: Root;
const realObserver = globalThis.IntersectionObserver;
const realMatchMedia = globalThis.matchMedia;

/** Tells every observer that the clips are in view, or not. */
function scroll(inView: boolean) {
  for (const watcher of watchers) {
    const entries = watcher.targets.map((target) => ({ target, isIntersecting: inView }) as IntersectionObserverEntry);
    act(() => watcher.callback(entries, {} as IntersectionObserver));
  }
}

beforeEach(() => {
  watchers = [];
  reduced = false;
  dark = false;
  listeners = {};
  globalThis.IntersectionObserver = class {
    readonly watcher: Watcher;
    constructor(callback: IntersectionObserverCallback) {
      this.watcher = { callback, targets: [] };
      watchers.push(this.watcher);
    }
    observe(target: Element) {
      this.watcher.targets.push(target);
    }
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  globalThis.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes("reduced-motion") ? reduced : dark;
    },
    addEventListener(_type: string, listener: () => void) {
      (listeners[query] ??= []).push(listener);
    },
    removeEventListener() {},
  })) as unknown as typeof matchMedia;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  globalThis.IntersectionObserver = realObserver;
  globalThis.matchMedia = realMatchMedia;
  mock.restore();
});

describe("Showcase", () => {
  test("links each product out with UTM and an outbound_click event", () => {
    act(() => root.render(<Showcase />));
    const links = [...host.querySelectorAll<HTMLAnchorElement>("a.showcase-card")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://snug.so/?utm_source=vectoys.com&utm_medium=referral&utm_campaign=showcase",
      "https://caffeinagent.com/?utm_source=vectoys.com&utm_medium=referral&utm_campaign=showcase",
      "https://waxmac.com/?utm_source=vectoys.com&utm_medium=referral&utm_campaign=showcase",
    ]);
    for (const link of links) {
      expect(link.dataset.track).toBe("outbound_click");
      expect(link.dataset.placement).toBe("showcase");
      expect(link.target).toBe("_blank");
    }
    expect(links.map((link) => link.dataset.to)).toEqual(["snug.so", "caffeinagent.com", "waxmac.com"]);
  });

  test("ships a clip and a poster in both schemes for every product", () => {
    act(() => root.render(<Showcase />));
    const sources = [...host.querySelectorAll("source")].map((source) => source.getAttribute("src") ?? "");
    const clips = new Set(sources.map((src) => src.replace(/-(light|dark)\.(webm|mp4)$/, "")));
    expect([...clips]).toEqual(["/showcase/snug", "/showcase/caffeinagent", "/showcase/wax"]);
    const files = [...clips].flatMap((clip) =>
      ["light", "dark"].flatMap((scheme) => ["webm", "mp4", "webp"].map((type) => `${clip}-${scheme}.${type}`)),
    );
    for (const file of files) expect(existsSync(resolve(import.meta.dir, "../public", `.${file}`))).toBe(true);
  });

  test("holds every clip unloaded, sized, silent and without a poster until it comes near", () => {
    act(() => root.render(<Showcase />));
    const videos = [...host.querySelectorAll<HTMLVideoElement>("video")];
    expect(videos).toHaveLength(6);
    for (const video of videos) {
      expect(video.getAttribute("preload")).toBe("none");
      expect(video.getAttribute("width")).toBe("1280");
      expect(video.getAttribute("height")).toBe("800");
      expect(video.hasAttribute("loop")).toBe(true);
      expect(video.hasAttribute("playsinline")).toBe(true);
      expect(video.poster).toBeFalsy();
      expect(video.closest("[data-replay-block]")).not.toBeNull();
    }
    scroll(true);
    for (const video of host.querySelectorAll("video[data-scheme=light]")) {
      expect((video as HTMLVideoElement).poster).toMatch(/^\/showcase\/(snug|caffeinagent|wax)-light\.webp$/);
    }
    for (const video of host.querySelectorAll<HTMLVideoElement>("video[data-scheme=dark]")) expect(video.poster).toBeFalsy();
  });

  test("plays only the clip of the page's scheme while it is in view", () => {
    const play = spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const pause = spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    act(() => root.render(<Showcase />));
    expect(play).not.toHaveBeenCalled();

    scroll(true);
    const played = play.mock.contexts as unknown as HTMLVideoElement[];
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((video) => video.dataset.scheme === "light" && video.muted)).toBe(true);
    for (const video of host.querySelectorAll<HTMLVideoElement>("video[data-scheme=light]")) expect(video.preload).toBe("auto");
    for (const video of host.querySelectorAll<HTMLVideoElement>("video[data-scheme=dark]")) expect(video.getAttribute("preload")).toBe("none");

    pause.mockClear();
    scroll(false);
    expect(pause.mock.contexts).toContain(host.querySelector("video[data-scheme=light]"));
  });

  test("never loads or plays a clip with reduced motion, so the poster stays", () => {
    reduced = true;
    const play = spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    act(() => root.render(<Showcase />));
    scroll(true);
    expect(play).not.toHaveBeenCalled();
    for (const video of host.querySelectorAll("video")) expect(video.getAttribute("preload")).toBe("none");
    for (const video of host.querySelectorAll<HTMLVideoElement>("video[data-scheme=light]")) expect(video.poster).toMatch(/-light\.webp$/);
  });

  test("follows scheme and reduced motion changes while in view", () => {
    const play = spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const pause = spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    act(() => root.render(<Showcase />));
    scroll(true);
    const light = [...host.querySelectorAll<HTMLVideoElement>("video[data-scheme=light]")];
    const darkVideos = [...host.querySelectorAll<HTMLVideoElement>("video[data-scheme=dark]")];

    play.mockClear();
    pause.mockClear();
    dark = true;
    act(() => listeners["(prefers-color-scheme: dark)"]?.forEach((listener) => listener()));
    for (const video of light) expect(pause.mock.contexts).toContain(video);
    for (const video of darkVideos) {
      expect(video.preload).toBe("auto");
      expect(play.mock.contexts).toContain(video);
    }

    play.mockClear();
    pause.mockClear();
    reduced = true;
    act(() => listeners["(prefers-reduced-motion: reduce)"]?.forEach((listener) => listener()));
    expect(play).not.toHaveBeenCalled();
    for (const video of [...light, ...darkVideos]) expect(pause.mock.contexts).toContain(video);
  });
});
