import { expect, test } from "bun:test";
import { clamp, ease, lerp, scrub, segment } from "../src";

test("clamp holds a value between two others", () => {
  expect(clamp(5, 0, 1)).toBe(1);
  expect(clamp(-5, 0, 1)).toBe(0);
  expect(clamp(0.25, 0, 1)).toBe(0.25);
  expect(clamp(-40, -35, 35)).toBe(-35);
});

test("lerp goes a share of the way, and past the ends when the share is", () => {
  expect(lerp(10, 20, 0)).toBe(10);
  expect(lerp(10, 20, 0.25)).toBe(12.5);
  expect(lerp(10, 20, 1)).toBe(20);
  expect(lerp(10, 20, 1.5)).toBe(25);
});

test("ease starts and ends slow, passes the middle, and holds outside 0..1", () => {
  expect(ease(0)).toBe(0);
  expect(ease(0.5)).toBe(0.5);
  expect(ease(1)).toBe(1);
  expect(ease(-1)).toBe(0);
  expect(ease(2)).toBe(1);
  expect(ease(0.1)).toBeLessThan(0.1);
  expect(ease(0.9)).toBeGreaterThan(0.9);
  for (let t = 0; t < 1; t += 0.05) expect(ease(t + 0.05)).toBeGreaterThanOrEqual(ease(t));
});

test("segment gives the local progress of one of n equal segments", () => {
  expect(segment(0, 0, 4)).toBe(0);
  expect(segment(0.125, 0, 4)).toBe(0.5);
  expect(segment(0.125, 1, 4)).toBe(0);
  expect(segment(0.6, 1, 2)).toBeCloseTo(0.2, 10);
  expect(segment(1, 3, 4)).toBe(1);
  expect(segment(0.9, 0, 4)).toBe(1);
});

const KEYS = [{ at: 0, lid: 0, yaw: 0 }, { at: 0.12, lid: 1 }, { at: 0.3, yaw: -20 }, { at: 0.6, yaw: 20, pitch: 10 }, { at: 1, yaw: 0, pitch: 15 }];

test("scrub sets every field at its keyframes", () => {
  expect(scrub(0, KEYS)).toEqual({ lid: 0, yaw: 0, pitch: 10 });
  expect(scrub(0.12, KEYS)).toEqual({ lid: 1, yaw: 0, pitch: 10 });
  expect(scrub(0.3, KEYS)).toEqual({ lid: 1, yaw: -20, pitch: 10 });
  expect(scrub(0.6, KEYS)).toEqual({ lid: 1, yaw: 20, pitch: 10 });
  expect(scrub(1, KEYS)).toEqual({ lid: 1, yaw: 0, pitch: 15 });
});

test("scrub carries a missing field over from the keyframe before, and holds before a field's first keyframe", () => {
  // The yaw stays at 0 while the lid opens, and only then turns.
  expect(scrub(0.06, KEYS).yaw).toBe(0);
  expect(scrub(0.06, KEYS).lid).toBe(0.5);
  // The pitch is first set at 0.6 and holds that value before it.
  expect(scrub(0.2, KEYS).pitch).toBe(10);
});

test("scrub eases each segment, linear on request, and holds outside the keyframes", () => {
  const [from, to] = [0.12, 0.3];
  const t = from + (to - from) / 4;
  expect(scrub(t, KEYS).yaw).toBeCloseTo(-20 * ease(0.25), 10);
  expect(scrub(t, KEYS, { ease: (share) => share }).yaw).toBeCloseTo(-5, 10);
  expect(scrub(-1, KEYS)).toEqual(scrub(0, KEYS));
  expect(scrub(2, KEYS)).toEqual(scrub(1, KEYS));
  expect(scrub(0.5, [])).toEqual({});
});

test("scrub types the fields it returns", () => {
  const { lid, yaw, pitch }: { lid: number; yaw: number; pitch: number } = scrub(0.5, KEYS);
  expect(Number.isFinite(lid + yaw + pitch)).toBe(true);
});
