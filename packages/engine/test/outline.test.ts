import { expect, test } from "bun:test";
import { grow, hull, keep, rounded, toward, type Flat, type Solid } from "../src";

test("hull keeps the outer points, anticlockwise with y up from the leftmost", () => {
  const points: Flat[] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [1, 1],
    [1, 0],
    [0.5, 1.5],
  ];
  expect(hull(points)).toEqual([
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ]);
});

test("a rounded outline's left half mirrors its right half exactly", () => {
  const outline = rounded([-10, -4, 10, 6], [2.1, 0.7]);
  const half = outline.length / 2;
  for (let index = 0; index < half; index++) {
    const [x, y] = outline[index]!;
    const [mx, my] = outline[outline.length - 1 - index]!;
    expect(mx).toBe(-x);
    expect(my).toBe(y);
  }
});

const SQUARE: Flat[] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

test.each([
  ["one way", SQUARE],
  ["the other way", [...SQUARE].reverse()],
])("grow moves a square out by the distance, run %s", (_, square) => {
  const grown = grow(square, 0.5);
  square.forEach(([x, y], index) => {
    const [gx, gy] = grown[index]!;
    expect(gx).toBeCloseTo(x === 0 ? -0.5 : 4.5, 12);
    expect(gy).toBeCloseTo(y === 0 ? -0.5 : 4.5, 12);
  });
});

test("keep cuts a square in half along a line", () => {
  expect(keep(SQUARE, ([x]) => x - 2, toward)).toEqual([
    [0, 0],
    [2, 0],
    [2, 4],
    [0, 4],
  ]);
});

test("toward works on points in space", () => {
  const [from, to]: Solid[] = [
    [0, 0, 0],
    [2, 4, 8],
  ];
  expect(toward(from!, to!, 0.25)).toEqual([0.5, 1, 2]);
});

test("nearness is the squared distance to a segment's nearest point, its ends included", async () => {
  const { nearness } = await import("../src");
  expect(nearness([5, 3], [0, 0], [10, 0])).toBe(9);
  expect(nearness([-3, 4], [0, 0], [10, 0])).toBe(25);
  expect(nearness([2, 2], [1, 1], [1, 1])).toBe(2);
});
