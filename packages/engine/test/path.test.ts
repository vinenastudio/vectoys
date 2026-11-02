import { expect, test } from "bun:test";
import { fixed, line, shape } from "../src";

test("fixed turns -0 into 0 and cuts to 4 decimals", () => {
  expect(Object.is(fixed(-0), 0)).toBe(true);
  expect(Object.is(fixed(-0.00001), 0)).toBe(true);
  expect(fixed(1.234567)).toBe(1.2346);
});

test("paths are compact and cut to 2 decimals", () => {
  expect(line([
    [1.234, -0.001],
    [5, 6.789],
  ])).toBe("M1.23 0L5 6.79");
  expect(shape([
    [0, 0],
    [1, 0],
    [1, 1],
  ])).toBe("M0 0L1 0L1 1Z");
});

test("panel draws a rectangle with round top corners and its own bottom ones", async () => {
  const { panel } = await import("../src");
  expect(panel([0, 0, 10, 4], 1)).toBe("M1 0H9A1 1 0 0 1 10 1V4H0V1A1 1 0 0 1 1 0Z");
  expect(panel([0, 0, 10, 4], 0, 2)).toBe("M0 0H10V2A2 2 0 0 1 8 4H2A2 2 0 0 1 0 2V0Z");
});
