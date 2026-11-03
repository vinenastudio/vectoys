import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { missingBaselines, newItems, parseItems } from "../visual/baselines";

test("new items are the registry folders the head has and the base does not", () => {
  const base = ["registry/dice", "registry/phone", ""];
  expect(newItems(base, ["registry/dice", "registry/phone", "registry/top", "registry/a-ball", ""])).toEqual(["a-ball", "top"]);
  expect(newItems(base, ["registry/dice"])).toEqual([]);
  expect(() => newItems(base, ["registry/Top"])).toThrow("Not an item name");
  expect(() => newItems(base, ["registry/$(id)"])).toThrow("Not an item name");
});

test("the comma list takes item names only", () => {
  expect(parseItems(undefined)).toEqual([]);
  expect(parseItems("")).toEqual([]);
  expect(parseItems("top, a-ball")).toEqual(["top", "a-ball"]);
  for (const bad of ["-top", "../dice", "top,Top", "a b"]) expect(() => parseItems(bad)).toThrow("Not an item name");
});

test("an item misses its baselines when any project has no snapshot of it", () => {
  const dir = mkdtempSync(join(tmpdir(), "vectoys-baselines-"));
  try {
    for (const project of ["light", "dark", "reduced-motion"]) {
      mkdirSync(join(dir, project));
      writeFileSync(join(dir, project, "full.png"), "");
    }
    writeFileSync(join(dir, "light", "half.png"), "");
    expect(missingBaselines(["full", "half", "none"], dir)).toEqual(["half", "none"]);
  } finally {
    rmSync(dir, { recursive: true });
  }
  expect(missingBaselines(["dice", "no-such-toy"])).toEqual(["no-such-toy"]);
});
