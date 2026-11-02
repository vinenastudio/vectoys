import { describe, expect, test } from "bun:test";
import { DESK, PHONE, type Perspective } from "../src/geometry";
import { DESK as OLD_DESK, PHONE as OLD_PHONE } from "./fixtures/original-geometry";

type Original = { DESK: Pick<Perspective, "DECK" | "lidArt">; PHONE: Pick<Perspective, "DECK" | "lidArt"> };

// The Agent Caffeine laptop this item was ported from, copied unchanged but
// for the lock key's names, renamed as the item's are.
const original: Original = { DESK: OLD_DESK, PHONE: OLD_PHONE };

const CLOSED = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1];

describe.each([
  ["DESK", DESK, original.DESK],
  ["PHONE", PHONE, original.PHONE],
] as const)("%s eye", (_, after, before) => {
  test("draws every deck path as the original did", () => {
    expect(Object.keys(after.DECK)).toEqual(Object.keys(before.DECK));
    for (const [name, paths] of Object.entries(after.DECK)) {
      expect([name, paths]).toEqual([name, before.DECK[name as keyof Perspective["DECK"]]]);
    }
  });

  test.each(CLOSED)("draws the lid as the original did, closed %p", (closed) => {
    expect(after.lidArt(closed)).toEqual(before.lidArt(closed));
  });
});
