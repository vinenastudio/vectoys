import { describe, expect, test } from "bun:test";
import { camera, rotateX, rotateZ, screenQuad, type Flat, type Pose } from "../src";

const ELEMENT = { width: 1280, height: 832 };
const RECT = { x: -26.9, y: -35, width: 53.86, height: 35, z: 0.02 };
// A lid stood up from the deck and turned toward the eye.
const LID: Pose = { position: [0, -23.35, 0.15], rotation: rotateX(-75) };

/** Where CSS puts an element's point under a matrix3d: the 4 by 4 multiply, then the w divide. */
function apply(matrix: string, [x, y]: Flat): Flat {
  const m = matrix.slice("matrix3d(".length, -1).split(",").map(Number);
  const column = (row: number) => m[row]! * x + m[4 + row]! * y + m[12 + row]!;
  const w = column(3);
  return [column(0) / w, column(1) / w];
}

describe.each([
  ["front", camera({ height: 70, perspective: 200 })],
  ["yawed 30", camera({ height: 70, perspective: 200, yaw: 30 })],
  ["DESK", camera({ height: 70, perspective: 200, pitch: -15, back: 14, originY: 0.22 * 70, anchorY: 0.78 * 70 })],
] as const)("%s camera", (_, eye) => {
  test("the matrix lays the element's corners on the projected corners", () => {
    const quad = screenQuad(eye, LID, RECT, ELEMENT);
    expect(quad.facing).toBe(true);
    const corners: Flat[] = [
      [0, 0],
      [ELEMENT.width, 0],
      [ELEMENT.width, ELEMENT.height],
      [0, ELEMENT.height],
    ];
    corners.forEach((corner, index) => {
      const [x, y] = apply(quad.matrix!, corner);
      const [px, py] = quad.corners[index]!;
      expect(Math.abs(x - px)).toBeLessThan(1e-6);
      expect(Math.abs(y - py)).toBeLessThan(1e-6);
    });
  });
});

test("unit scales the matrix to pixels", () => {
  const eye = camera({ height: 70, perspective: 200, yaw: 30 });
  const quad = screenQuad(eye, LID, RECT, ELEMENT, 8);
  const [x, y] = apply(quad.matrix!, [ELEMENT.width, ELEMENT.height]);
  expect(Math.abs(x - quad.corners[2][0] * 8)).toBeLessThan(1e-5);
  expect(Math.abs(y - quad.corners[2][1] * 8)).toBeLessThan(1e-5);
});

test("a rectangle edge on, turned away or behind the eye has no matrix", () => {
  const eye = camera({ height: 70, perspective: 200 });
  const edgeOn: Pose = { position: [0, 0, 0], rotation: rotateZ(0) };
  const away: Pose = { position: [0, 0, 0], rotation: rotateX(90) };
  const behind: Pose = { position: [0, 300, 0], rotation: rotateX(-90) };
  for (const [pose, z] of [
    [edgeOn, 0],
    [away, 0.02],
    [behind, 0.02],
  ] as const) {
    const quad = screenQuad(eye, pose, { ...RECT, z }, ELEMENT);
    expect(quad.facing).toBe(false);
    expect(quad.matrix).toBeUndefined();
  }
});

test("a face seen straight on gets a plain scale and move, with the rounding dust of its turns written as 0", async () => {
  const { camera, combine, rotateX, rotateY, screenQuad } = await import("../src");
  // Turned a full round about two axes, the pose is straight on again, but its rotation carries terms of about 1e-17.
  const eye = camera({ height: 60, perspective: 1000 });
  const pose = { position: [0, 0, 0] as const, rotation: combine(rotateX(-90), rotateY(360), rotateX(360)) };
  const quad = screenQuad(eye, { position: [...pose.position], rotation: pose.rotation }, { x: -10, y: -5, width: 20, height: 10 }, { width: 200, height: 100 });
  const terms = (quad.matrix ?? "").slice("matrix3d(".length, -1).split(",");
  expect(terms).toHaveLength(16);
  for (const at of [1, 2, 3, 4, 6, 7, 8, 9, 11, 14]) expect(terms[at]).toBe("0");
});
