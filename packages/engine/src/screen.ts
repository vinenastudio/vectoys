import type { Camera } from "./camera.ts";
import { place, rotate, type Flat, type Pose, type Solid } from "./vector.ts";

/** A rectangle in a part's plane at height `z`, from (x, y), `width` along x and `height` along y. */
export type ScreenRect = { x: number; y: number; width: number; height: number; z?: number };

/**
 * Where a rectangle lands on screen: its corners in the scene's units, in
 * the order top left, top right, bottom right, bottom left of the element,
 * and, while it faces the eye, the CSS transform that lays the element on it.
 */
export type ScreenQuad = { corners: [Flat, Flat, Flat, Flat]; facing: boolean; matrix?: string };

// Enough digits that a corner lands within a millionth of a unit, the same
// from the server as from the client. A term under a billionth is rounding
// dust, such as a face seen straight on picks up from its turns, and is
// written as 0: left in, the browser draws the element's text through a
// blurrier path than for the plain scale and move it is.
const digits = (value: number) => String(Math.abs(value) < 1e-9 ? 0 : Number(value.toPrecision(12)) || 0);

/**
 * The plane map that takes the unit square's corners (0, 0), (1, 0), (1, 1),
 * (0, 1) to a quad's, as the eight numbers a to h of
 * x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (g u + h v + 1).
 * Null when three corners line up, as they do for a quad seen edge on.
 */
function squareTo([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: ScreenQuad["corners"]) {
  const [sx, sy] = [x0 - x1 + x2 - x3, y0 - y1 + y2 - y3];
  const [dx1, dx2, dy1, dy2] = [x1 - x2, x3 - x2, y1 - y2, y3 - y2];
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-12) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}

/**
 * A live element laid onto a part's face. The element is `element` pixels
 * wide and tall, placed at the scene box's top left with
 * `transform-origin: 0 0`, and `matrix` maps it onto the rectangle as the
 * camera projects it: its top edge along y = rect.y, its left edge along
 * x = rect.x, facing the part's +z. `unit` is how many CSS pixels a scene
 * unit is, so a scene box `camera.width` units wide drawn W pixels wide
 * passes W / camera.width. Unlike matched CSS perspective numbers, this
 * holds for any camera.
 *
 * When the rectangle faces away, stands edge on or reaches behind the eye,
 * `facing` is false and there is no matrix, so the element is hidden.
 */
export function screenQuad(
  camera: Camera,
  pose: Pose,
  { x, y, width, height, z = 0 }: ScreenRect,
  element: { width: number; height: number },
  unit = 1,
): ScreenQuad {
  const local: Solid[] = [
    [x, y, z],
    [x + width, y, z],
    [x + width, y + height, z],
    [x, y + height, z],
  ];
  const points = local.map((point) => place(pose, point));
  const corners = points.map(camera.project) as ScreenQuad["corners"];
  const middle = place(pose, [x + width / 2, y + height / 2, z]);
  const ahead = points.every((point) => camera.toView(point)[2] < camera.perspective - 1e-9);
  const facing = ahead && camera.facesEye(middle, rotate(pose.rotation, [0, 0, 1]));
  const map = facing ? squareTo(corners) : null;
  if (!map) return { corners, facing: false };
  // Scale the element's pixels to the unit square, and the scene's units to pixels.
  const [u, v] = [1 / element.width, 1 / element.height];
  const { a, b, c, d, e, f, g, h } = map;
  const columns = [a * u * unit, d * u * unit, 0, g * u, b * v * unit, e * v * unit, 0, h * v, 0, 0, 1, 0, c * unit, f * unit, 0, 1];
  return { corners, facing: true, matrix: `matrix3d(${columns.map(digits).join(",")})` };
}
