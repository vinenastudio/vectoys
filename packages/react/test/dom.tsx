import "../../../test/dom";
import { spyOn } from "bun:test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

// Helpers for the interaction tests, on the DOM from the root's test/dom.ts.
// Items import them from here, so they share one way to mount.

/** Mounts `node` into a fresh element on the page. */
export async function mount(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return {
    host,
    rerender: (next: ReactNode) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

/** Sends `event` to the window, such as a blur, and lets React finish what it starts. */
export const fireOnWindow = (event: Event) => act(async () => void window.dispatchEvent(event));

/** Sends `event` to `target` and lets React finish what it starts. */
export const fire = (target: Element, event: Event) => act(async () => void target.dispatchEvent(event));

/**
 * Animation frames on a clock the test moves, in place of the real ones.
 * `advance` runs a frame every `step` milliseconds for `ms` milliseconds.
 */
export function fakeFrames() {
  let clock = 0;
  let last = 0;
  const queue = new Map<number, FrameRequestCallback>();
  const spies = [
    spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      queue.set(++last, callback);
      return last;
    }),
    spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => void queue.delete(id)),
    spyOn(performance, "now").mockImplementation(() => clock),
  ];
  return {
    advance: async (ms: number, step = 16) => {
      for (let passed = 0; passed < ms; passed += step) {
        await act(async () => {
          clock += step;
          const due = [...queue.values()];
          queue.clear();
          for (const callback of due) callback(clock);
        });
      }
    },
    pending: () => queue.size,
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}

/** Makes the page ask for reduced motion, or not, until `restore`. */
export function reducedMotion(reduce: boolean) {
  const real = globalThis.matchMedia;
  const spy = spyOn(globalThis, "matchMedia").mockImplementation((query) => {
    const list = real(query);
    if (query.includes("prefers-reduced-motion")) Object.defineProperty(list, "matches", { value: reduce });
    return list;
  });
  return { restore: () => spy.mockRestore() };
}

// Items' tests may not reach globalThis, Bun or HTML strings themselves, as
// `vectoys check` refuses them, so they do it through these.

/** Puts `value` on the page as the global `name`, such as a stand-in AudioContext; the returned function puts the real one back. */
export function installGlobal(name: string, value: unknown): () => void {
  const real: unknown = Reflect.get(globalThis, name);
  Object.assign(globalThis, { [name]: value });
  return () => void Object.assign(globalThis, { [name]: real });
}

/** The text of the file at `path` from the test file at `from`, its `import.meta.url`. */
export const readSibling = (from: string, path: string) => Bun.file(new URL(path, from)).text();

/** The markup inside `element`, or of `element` itself with `outer`. */
export const htmlOf = (element: Element | null | undefined, outer = false) => (outer ? element?.outerHTML : element?.innerHTML) ?? "";
