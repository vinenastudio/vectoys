import { afterEach, expect, test } from "bun:test";
import { KICKFLIP } from "@vectoys/laptop";
import { scrub } from "@vinena/vectoys";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { KICK, TIMELINE, Trick } from "../src/sections/trick";

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

test("pinned, one laptop plays the kickflip and the chapters, its display starting at 0% and naming no product", async () => {
  asking(false);
  const host = await mount();
  expect(host.querySelector(".scrub-track")).not.toBeNull();
  expect(host.querySelectorAll("[aria-label^='A laptop']")).toHaveLength(1);
  expect(host.querySelector(".scrub-screen-count")?.textContent).toBe("0%");
  expect(host.querySelector(".scrub-screen")?.textContent).toBe("Scrolled0%Land the kickflipGlide to the leftGlide to the rightFace the front");
  expect([...host.querySelectorAll(".scrub-chapter h3")].map((title) => title.textContent)).toEqual(["The scroll drives it", "The screen stays live"]);
});

test("with reduced motion, still frames from the one timeline show how far through it they are, with no pinning", async () => {
  asking(true);
  const host = await mount();
  expect(host.querySelector(".scrub-track")).toBeNull();
  const counts = [...host.querySelectorAll(".scrub-screen-count")].map((count) => Number.parseInt(count.textContent ?? "", 10));
  expect(counts).toHaveLength(4);
  expect(counts[0]).toBe(0);
  for (let index = 1; index < counts.length; index++) expect(counts[index] ?? 0).toBeGreaterThan(counts[index - 1] ?? 100);
  expect(host.querySelectorAll(".trick-still .scrub-chapter h3")).toHaveLength(2);
});

test("the kickflip lands where the chapters start, so the laptop's size and place never jump", () => {
  const landed = scrub(1, KICKFLIP);
  const seam = scrub(KICK, TIMELINE);
  for (const field of ["lid", "flat", "y", "scale", "roll", "x", "yaw"] as const) expect(seam[field]).toBeCloseTo(landed[field], 9);
  // Every field moves only a little for a little scroll, across the seam and through the chapters.
  const fields = ["lid", "flat", "x", "y", "scale", "roll", "yaw", "pitch"] as const;
  for (let t = KICK - 0.05; t < 1; t += 0.002) {
    const [a, b] = [scrub(t, TIMELINE), scrub(t + 0.002, TIMELINE)];
    expect(Math.abs(b.flat - a.flat) + Math.abs(b.scale - a.scale) + Math.abs(b.y - a.y)).toBeLessThan(0.05);
    for (const field of fields) expect(Math.abs(b[field] - a[field])).toBeLessThan(field === "yaw" || field === "roll" || field === "pitch" ? 2 : 0.1);
  }
  expect(scrub(1, TIMELINE)).toMatchObject({ x: 0, yaw: 360, lid: 1, flat: 0, y: 0, scale: 1 });
});
