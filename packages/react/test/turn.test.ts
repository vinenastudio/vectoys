import { expect, test } from "bun:test";
import { glide, nearest, rubber, unrubber, type Glide } from "../src/turn.ts";

const RANGE = [-30, 30] as const;

test("a drag inside the limits shows as it is, and past them is held back", () => {
  expect(rubber(12, RANGE)).toBe(12);
  expect(rubber(40, RANGE)).toBeCloseTo(33);
  expect(rubber(-60, RANGE)).toBeCloseTo(-39);
  expect(unrubber(rubber(55, RANGE), RANGE)).toBeCloseTo(55);
  expect(rubber(500, [-Infinity, Infinity])).toBe(500);
});

test("a spin let go inside the limits slows and stops where it is", () => {
  let state = { axis: { value: 0, velocity: 200 }, home: null as number | null };
  let frames = 0;
  while (state.axis.velocity !== 0 && frames++ < 1000) state = glide(state, [-1000, 1000], 1 / 60);
  expect(frames).toBeLessThan(200);
  expect(state.home).toBeNull();
  expect(state.axis.value).toBeGreaterThan(10);
  expect(state.axis.value).toBeLessThan(60);
});

/** Runs `state` a frame at a time until it rests, for at most two seconds. */
function rest(state: Glide) {
  for (let frame = 0; frame < 120 && (frame === 0 || state.axis.velocity !== 0); frame++) state = glide(state, RANGE, 1 / 60);
  return state.axis;
}

test("an axis let go past a limit, or coasting past one, springs back and rests on the limit", () => {
  expect(rest({ axis: { value: 40, velocity: 0 }, home: null })).toEqual({ value: 30, velocity: 0 });
  expect(rest({ axis: { value: 25, velocity: 900 }, home: null })).toEqual({ value: 30, velocity: 0 });
});

test("a reset springs home", () => {
  expect(rest({ axis: { value: 20, velocity: 0 }, home: 0 })).toEqual({ value: 0, velocity: 0 });
});

test("a reset takes the short way round", () => {
  expect(nearest(350)).toBe(-10);
  expect(nearest(-725)).toBe(-5);
  expect(nearest(20)).toBe(20);
});
