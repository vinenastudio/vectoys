import { expect, mock, test } from "bun:test";
import type { ComponentType } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// import.meta.glob is Vite's; here the sources are a stand-in with one item
// that has no hand-made preview.
mock.module("../src/sources", () => ({ SOURCES: { "../../../registry/ball/src/index.ts": async () => ({}) } }));
const { PREVIEWS, previewFor } = await import("../src/items");
const { Placeholder } = await import("../src/previews/placeholder");

test("a hand-made preview wins, a registry item gets one from its exports, anything else the placeholder", () => {
  expect<ComponentType | undefined>(previewFor("phone")).toBe(PREVIEWS.phone);
  expect(PREVIEWS.phone).toBeDefined();
  const ball = previewFor("ball");
  expect(ball).not.toBe(Placeholder);
  expect(previewFor("ball")).toBe(ball);
  expect(previewFor("nothing-here")).toBe(Placeholder);
  for (const inherited of ["constructor", "toString", "__proto__"]) expect(previewFor(inherited)).toBe(Placeholder);
});

test("the sources leave out exactly the items with hand-made previews", () => {
  const text = readFileSync(join(import.meta.dir, "../src/sources.ts"), "utf8");
  const left = /registry\/\{([^}]*)\}\/src\/index\.ts/.exec(text)?.[1]?.split(",");
  expect(left).toEqual(Object.keys(PREVIEWS).sort());
});
