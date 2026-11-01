import { afterEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Trick } from "../src/sections/trick";

const real = globalThis.matchMedia;
let root: Root | undefined;
// Unmounted after each test, so the pinned scene's scroll listener goes with it.
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  globalThis.matchMedia = real;
  document.body.replaceChildren();
});

/** A page whose media queries match `reduce` as asked. */
function asking(reduce: boolean) {
  globalThis.matchMedia = (query: string) => {
    const list = real(query);
    return Object.defineProperty(list, "matches", { value: query.includes("reduced-motion") ? reduce : list.matches });
  };
}

async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = createRoot(host);
  root = mounted;
  await act(async () => mounted.render(<Trick />));
  return host;
}

test("with reduced motion, each still frame shows how far through the trick it is", async () => {
  asking(true);
  const host = await mount();
  expect(host.querySelector(".scrub-track")).toBeNull();
  expect([...host.querySelectorAll(".scrub-screen-count")].map((count) => count.textContent)).toEqual(["0%", "47%", "100%"]);
  expect([...host.querySelectorAll("figcaption")].map((caption) => caption.textContent)).toEqual(["Straight on", "In the air", "On the desk"]);
});

test("pinned, the display starts at 0% and names no product", async () => {
  asking(false);
  const host = await mount();
  expect(host.querySelector(".scrub-track")).not.toBeNull();
  expect(host.querySelector(".scrub-screen-count")?.textContent).toBe("0%");
  expect(host.querySelector(".scrub-screen")?.textContent).toBe("Kickflip0%");
});
