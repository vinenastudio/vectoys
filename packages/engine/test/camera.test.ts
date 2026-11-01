import { describe, expect, test } from "bun:test";
import { camera, type Flat, type Solid } from "../src";

type Eye = { height: number; perspective: number; camera: number; back: number; origin: number; anchor: number };

// The two eyes of the Agent Caffeine hero, and its `scene`, `project` and
// `facesEye` as they were, closed over one eye.
const DESK: Eye = { height: 70, perspective: 200, camera: -15, back: 14, origin: 0.22 * 70, anchor: 0.78 * 70 };
const PHONE: Eye = { height: 59, perspective: 600, camera: -12, back: 88.07, origin: 0.22 * 70, anchor: 53.43 };

function source({ perspective, camera: angle, back, origin, anchor }: Eye) {
  const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
  const scene = ([x, y, z]: Solid): Solid => [50 + x, anchor - z * cos - y * sin, -z * sin + y * cos - back];
  const project = (point: Solid): Flat => {
    const [x, y, z] = scene(point);
    const scale = perspective / (perspective - z);
    return [50 + (x - 50) * scale, origin + (y - origin) * scale];
  };
  const facesEye = (point: Solid, [nx, ny, nz]: Solid) => {
    const [x, y, z] = scene(point);
    const [, sy, sz] = scene([nx, ny, nz]);
    const [, oy, oz] = scene([0, 0, 0]);
    return nx * (50 - x) + (sy - oy) * (origin - y) + (sz - oz) * (perspective - z) > 0;
  };
  return { project, facesEye };
}

const POINTS: Solid[] = [
  [0, 0, 0],
  [33, 23.35, 0],
  [-33, -23.35, -2.3],
  [12.5, -40, 30],
  [-7.25, 9.1, 46.7],
];

const NORMALS: Solid[] = [
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [0, -0.97, 0.26],
  [1, 0, 0],
];

describe.each([
  ["DESK", DESK],
  ["PHONE", PHONE],
] as const)("%s eye", (_, eye) => {
  const before = source(eye);
  const after = camera({
    height: eye.height,
    perspective: eye.perspective,
    pitch: eye.camera,
    back: eye.back,
    originY: eye.origin,
    anchorY: eye.anchor,
  });

  test("projects every point where the source did", () => {
    for (const point of POINTS) {
      const [x, y] = after.project(point);
      const [sx, sy] = before.project(point);
      expect(Math.abs(x - sx)).toBeLessThan(1e-9);
      expect(Math.abs(y - sy)).toBeLessThan(1e-9);
    }
  });

  test("agrees with the source on which faces face the eye", () => {
    for (const point of POINTS) {
      for (const normal of NORMALS) {
        expect(after.facesEye(point, normal)).toBe(before.facesEye(point, normal));
      }
    }
  });
});

test("an unturned model at the anchor stands where the scene's middle is", () => {
  const eye = camera({ height: 60, perspective: 300 });
  expect(eye.toView([0, 0, 0])).toEqual([50, 30, 0]);
  expect(eye.project([0, 0, 0])).toEqual([50, 30]);
  const [, up] = eye.toView([0, 0, 10]);
  expect(up).toBeCloseTo(20, 12);
});

test("aimed turns an eye's camera and moves it into a box, so a pose draws the same there, only shifted", async () => {
  const { aimed } = await import("../src");
  const options = { height: 70, perspective: 200, back: 14, originY: 15.4, anchorY: 54.6 };
  const plain = aimed(options, { yaw: 20, pitch: -15 });
  const boxed = aimed(options, { yaw: 20, pitch: -15 }, { width: 140, height: 90, x: 20, y: 7 });
  expect([plain.yaw, plain.pitch, boxed.width, boxed.height]).toEqual([20, -15, 140, 90]);
  for (const point of POINTS) {
    const [[x, y], [bx, by]] = [plain.project(point), boxed.project(point)];
    expect(bx - x).toBeCloseTo(20, 9);
    expect(by - y).toBeCloseTo(7, 9);
  }
});

test("moved turns the model round a middle, then grows it about the middle on screen and shifts it", async () => {
  const { moved, rotateZ } = await import("../src");
  const eye = camera({ height: 70, perspective: 200, pitch: -15 });
  const middle: Solid = [0, 0, -1];
  const still = moved(eye, rotateZ(0), 1, [0, 0], middle);
  for (const point of POINTS) expect(still.project(point)).toEqual(eye.project(point));
  const big = moved(eye, rotateZ(0), 2, [3, -1], middle);
  const [cx, cy] = eye.project(middle);
  const [x, y] = eye.project([10, 5, 0]);
  const [mx, my] = big.project([10, 5, 0]);
  expect(mx).toBeCloseTo(cx + (x - cx) * 2 + 3, 9);
  expect(my).toBeCloseTo(cy + (y - cy) * 2 - 1, 9);
  // A half turn about the up axis through the middle swaps a point's sides.
  const turned = moved(eye, rotateZ(180), 1, [0, 0], middle);
  const [a, b] = [turned.toView([10, 0, -1]), eye.toView([-10, 0, -1])];
  a.forEach((value, axis) => expect(value).toBeCloseTo(b[axis] ?? 0, 9));
});
