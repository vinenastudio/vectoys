import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { installGlobal, readSibling } from "./dom";

const keycapTest = new URL("../../../registry/keycap/test/keycap.sound.test.tsx", import.meta.url).href;

test("readSibling reads files under registry/ from a test under registry/<item>/test/", async () => {
  const registry = (path: string) => readFileSync(new URL(`../../../registry/${path}`, import.meta.url), "utf8");
  expect(await readSibling(keycapTest, "../src/index.ts")).toBe(registry("keycap/src/index.ts"));
  expect(await readSibling(keycapTest, "../../keyboard/item.json")).toBe(registry("keyboard/item.json"));
});

test("installGlobal puts the real global back, or none if there was none", () => {
  const restore = installGlobal("vectoysTestGlobal", 1);
  expect(Reflect.get(globalThis, "vectoysTestGlobal")).toBe(1);
  restore();
  expect(Object.prototype.hasOwnProperty.call(globalThis, "vectoysTestGlobal")).toBe(false);
  const real = globalThis.requestIdleCallback;
  const back = installGlobal("requestIdleCallback", 2);
  back();
  expect(globalThis.requestIdleCallback).toBe(real);
});

test("readSibling throws for a file outside registry/ or a caller outside an item's tests", () => {
  expect(() => readSibling(keycapTest, "/etc/passwd")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(keycapTest, "../../../../../../.npmrc")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(keycapTest, "file:///etc/passwd")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(import.meta.url, "./dom.tsx")).toThrow("readSibling reads only from a test under registry/<item>/test/");
});
