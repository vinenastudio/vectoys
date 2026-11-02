import { expect, test } from "bun:test";
import { readSibling } from "./dom";

const keycapTest = new URL("../../../registry/keycap/test/keycap.sound.test.tsx", import.meta.url).href;

test("readSibling reads files under registry/ from a test under registry/<item>/test/", async () => {
  expect(await readSibling(keycapTest, "../src/sound.ts")).toBe(await readSibling(keycapTest, "../../keyboard/src/sound.ts"));
});

test("readSibling throws for a file outside registry/ or a caller outside an item's tests", () => {
  expect(() => readSibling(keycapTest, "/etc/passwd")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(keycapTest, "../../../../../../.npmrc")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(keycapTest, "file:///etc/passwd")).toThrow("readSibling reads only files under registry/");
  expect(() => readSibling(import.meta.url, "./dom.tsx")).toThrow("readSibling reads only from a test under registry/<item>/test/");
});
