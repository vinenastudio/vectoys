import { expect, test } from "bun:test";
import { EASES, backIn, backInOut, backOut, clamp, cubicBezier, ease, easing, lerp, scrub, segment, settle } from "../src";

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

test("the back eases draw back, overshoot and land on their ends", () => {
  for (const shape of [backIn, backOut, backInOut]) {
    expect(shape(0)).toBeCloseTo(0, 10);
    expect(shape(1)).toBeCloseTo(1, 10);
    expect(shape(-1)).toBe(shape(0));
    expect(shape(2)).toBe(shape(1));
  }
  expect(Math.min(...steps.map(backIn))).toBeLessThan(-0.05);
  expect(Math.max(...steps.map(backOut))).toBeGreaterThan(1.05);
  expect(backInOut(0.5)).toBeCloseTo(0.5, 10);
  expect(Math.min(...steps.map(backInOut))).toBeLessThan(0);
  expect(Math.max(...steps.map(backInOut))).toBeGreaterThan(1);
});

const steps = Array.from({ length: 201 }, (_, step) => step / 200);

test("settle falls to 1, bounces lower each time without passing 1, and lands for good", () => {
  expect(settle(0)).toBe(0);
  expect(settle(1)).toBe(1);
  expect(settle(2)).toBe(1);
  const values = steps.map(settle);
  expect(Math.max(...values)).toBeLessThanOrEqual(1);
  // The lowest point of each bounce, after the fall, each nearer 1 than the last.
  const dips = values.filter((value, index) => index > 0 && value < (values[index - 1] ?? 0) && value <= (values[index + 1] ?? 1));
  expect(dips.length).toBe(3);
  for (let index = 1; index < dips.length; index++) expect(dips[index]).toBeGreaterThan(dips[index - 1] ?? 1);
  expect(dips[0]).toBeLessThan(0.95);
});

test("cubicBezier follows CSS's curves", () => {
  const linear = cubicBezier(0, 0, 1, 1);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(linear(t)).toBeCloseTo(t, 6);
  // CSS's own `ease`: at each point of the curve, the time it is at gives the share it is at.
  const css = cubicBezier(0.25, 0.1, 0.25, 1);
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  for (const s of [0.1, 0.3, 0.5, 0.8]) expect(css(at(0.25, 0.25, s))).toBeCloseTo(at(0.1, 1, s), 6);
  expect(css(0.5)).toBeCloseTo(0.8024, 3);
  const over = cubicBezier(0.3, 0, 0.2, 1.6);
  expect(Math.max(...steps.map(over))).toBeGreaterThan(1);
  expect(over(1)).toBeCloseTo(1, 6);
});

test("a keyframe's ease shapes the segment that ends at it, by name, function or curve", () => {
  const keys = [{ at: 0, y: 0 }, { at: 0.5, y: 10, ease: "backOut" }, { at: 1, y: 0, ease: [0, 0, 1, 1] }] as const;
  expect(scrub(0.25, keys).y).toBeCloseTo(10 * backOut(0.5), 10);
  expect(scrub(0.75, keys).y).toBeCloseTo(5, 6);
  expect(scrub(0.25, [{ at: 0, y: 0 }, { at: 1, y: 4, ease: (t: number) => t * t }]).y).toBeCloseTo(0.25, 10);
  // Without its own, a segment takes the one scrub is given, and `ease` is not a field.
  expect(scrub(0.75, [...keys.slice(0, 2), { at: 1, y: 0 }], { ease: EASES.linear }).y).toBeCloseTo(5, 10);
  expect(Object.keys(scrub(0.5, keys))).toEqual(["y"]);
  expect(easing("settle")).toBe(settle);
});

test("scrub types every field of its keys, so a misspelt ease does not compile", () => {
  const keys = [{ at: 0, y: 0 }, { at: 1, y: 1, ease: "settle" }] as const;
  expect(scrub(1, keys).y).toBe(1);
  // @ts-expect-error `eas` is not `ease`, and a field that is not a number is not a field.
  expect(scrub(0.5, [{ at: 0, y: 0 }, { at: 1, y: 1, eas: "settle" }]).y).toBeCloseTo(0.5, 10);
  // @ts-expect-error A field's value is a number.
  scrub(0.5, [{ at: 0, y: "high" }]);
});
