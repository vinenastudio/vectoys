import type { Camera } from "./camera.ts";
import { grow, hull, rounded, type Box } from "./outline.ts";
import { fixed, shape } from "./path.ts";
import { REST, compose, cross, dot, place, rotate, subtract, type Flat, type Pose, type Solid } from "./vector.ts";

type Common = {
  /** Names the part in what `draw` returns, so a renderer can style it. */
  readonly name: string;
  /** Where the part sits in its parent, or in the scene for a part at the top. */
  readonly pose?: Pose;
  /**
   * Parts with a lower order draw first, whatever their depth. Leave it out
   * unless depth gets two parts wrong, as a laptop's lid and base can be.
   */
  readonly order?: number;
  readonly children?: readonly Part[];
  /**
   * How far apart the points round a rounded corner stand, in the scene's
   * units; a tenth by default. A coarser step draws far fewer side faces,
   * which a part that turns and redraws every frame wants.
   */
  readonly step?: number;
  /**
   * A convex outline in the part's x, y plane, clockwise as `rounded` runs,
   * drawn in place of the rounded `box`, which then only bounds it: a
   * triangle for an envelope's flap, or a disk with one corner cut.
   */
  readonly outline?: readonly Flat[];
};

/**
 * A rounded rectangle `box` in the part's x, y plane, its top and bottom
 * corners rounded by `radii`, stood `thickness` deep: the top face lies on
 * z = 0 and the bottom on z = -thickness, so what sits on the top needs no
 * offset. `edge` rounds or chamfers the side where it meets top and bottom,
 * as a phone's sides are; 0 keeps the side a flat band.
 */
export type Slab = Common & {
  readonly kind: "slab";
  readonly box: Box;
  readonly radii?: Flat;
  readonly thickness: number;
  readonly edge?: number;
  readonly bevel?: "round" | "chamfer";
  /**
   * How far the top's outline stands in from the bottom's on every side, so
   * the sides lean in as a keycap's do; 0 keeps them upright.
   */
  readonly taper?: number;
};

/**
 * A flat rounded rectangle `lift` over its part's z = 0 plane, facing +z: a
 * screen's glass, a camera bump's top or a trackpad on its parent's face.
 */
export type Plate = Common & {
  readonly kind: "plate";
  readonly box: Box;
  readonly radii?: Flat;
  readonly lift?: number;
  readonly role?: string;
};

export type Part = Slab | Plate;

/** The parts at the top of a scene; each carries its own children. */
export type Scene = readonly Part[];

/** One flat face of a part in the part's own space, turned out along `normal`. */
export type Face = { readonly points: readonly Solid[]; readonly normal: Solid; readonly role: string };

export const slab = (options: Omit<Slab, "kind">): Slab => ({ kind: "slab", ...options });
export const plate = (options: Omit<Plate, "kind">): Plate => ({ kind: "plate", ...options });

// Steps along each quarter of a round edge. A few are enough at the sizes a
// side band shows.
const EDGE_STEPS = 3;
// How far a plate stands over its parent's face unless it says, so the two
// do not tie on depth.
const LIFT = 0.02;

/** An outline without points that repeat the one before, so every edge has a length. */
function distinct(points: readonly Flat[]): Flat[] {
  return points.filter((point, index) => {
    const [px, py] = points[(index + points.length - 1) % points.length]!;
    return Math.abs(point[0] - px) > 1e-9 || Math.abs(point[1] - py) > 1e-9;
  });
}

/** The slab's side from top to bottom, as (how far in from the outline, z). */
function profile(thickness: number, edge: number, bevel: "round" | "chamfer"): Flat[] {
  const radius = Math.min(edge, thickness / 2);
  if (radius <= 0) {
    return [
      [0, 0],
      [0, -thickness],
    ];
  }
  if (bevel === "chamfer") {
    return distinct([
      [radius, 0],
      [0, -radius],
      [0, radius - thickness],
      [radius, -thickness],
    ]);
  }
  const steps = Array.from({ length: EDGE_STEPS + 1 }, (_, step) => (Math.PI / 2) * (step / EDGE_STEPS));
  return distinct([
    ...steps.map((turn): Flat => [radius * (1 - Math.sin(turn)), -radius * (1 - Math.cos(turn))]),
    ...steps.map((turn): Flat => [radius * (1 - Math.cos(turn)), radius - thickness - radius * Math.sin(turn)]),
  ]);
}

/** A part's outline in its own x, y plane. */
const outlineOf = ({ box, radii = [0, 0], step, outline }: Part) => distinct(outline ?? rounded(box, radii, [], [], step));

/**
 * An outline drawn in toward its middle by `inset` on every side. Scaling
 * rather than offsetting keeps a corner round however far in it goes.
 */
function shrink(outline: readonly Flat[], inset: number): Flat[] {
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // About the middle of the bounds, not the mean of the points, so an outline
  // with more points on one side still stands in evenly all round.
  const [mx, my] = [(left + right) / 2, (top + bottom) / 2];
  const [sx, sy] = [(right - left - 2 * inset) / (right - left), (bottom - top - 2 * inset) / (bottom - top)];
  return outline.map(([x, y]): Flat => [mx + (x - mx) * sx, my + (y - my) * sy]);
}

function slabFaces(part: Slab): Face[] {
  const { thickness, edge = 0, bevel = "round", taper = 0 } = part;
  const outline = outlineOf(part);
  const centre = outline.reduce<Flat>(([x, y], [px, py]) => [x + px / outline.length, y + py / outline.length], [0, 0]);
  // The taper grows from nothing at the bottom to all of it at the top.
  const rings = profile(thickness, edge, bevel).map(([inset, z]) => {
    const drawn = taper === 0 ? outline : shrink(outline, taper * (1 + z / thickness));
    return (inset === 0 ? drawn : grow(drawn, -inset)).map(([x, y]): Solid => [x, y, z]);
  });
  const middle: Solid = [centre[0], centre[1], -thickness / 2];
  const side = rings.slice(1).flatMap((lower, band) => {
    const upper = rings[band]!;
    return upper.map((a, index): Face => {
      const next = (index + 1) % upper.length;
      const points = [a, upper[next]!, lower[next]!, lower[index]!];
      const normal = cross(subtract(points[2]!, points[0]!), subtract(points[3]!, points[1]!));
      const out = dot(normal, subtract(a, middle)) > 0 ? 1 : -1;
      const length = Math.hypot(...normal) * out;
      return { points, normal: [normal[0] / length, normal[1] / length, normal[2] / length], role: "side" };
    });
  });
  return [
    { points: rings[0]!, normal: [0, 0, 1], role: "top" },
    { points: [...rings[rings.length - 1]!].reverse(), normal: [0, 0, -1], role: "bottom" },
    ...side,
  ];
}

/** A part's faces in its own space, before its pose places it. */
export function faces(part: Part): Face[] {
  if (part.kind === "slab") return slabFaces(part);
  const lift = part.lift ?? LIFT;
  return [
    {
      points: outlineOf(part).map(([x, y]): Solid => [x, y, lift]),
      normal: [0, 0, 1],
      role: part.role ?? "plate",
    },
  ];
}

/** Every part of a scene with its pose in the scene, parents before their children. */
export function placed(scene: Scene, parent: Pose = REST): { part: Part; pose: Pose }[] {
  return scene.flatMap((part) => {
    const pose = compose(parent, part.pose ?? REST);
    return [{ part, pose }, ...placed(part.children ?? [], pose)];
  });
}

/** Each part's pose in the scene by name, for laying a screen onto it with `screenQuad`. */
export const poses = (scene: Scene) => new Map(placed(scene).map(({ part, pose }) => [part.name, pose]));

/**
 * One face as drawn: SVG path data in the scene's units, its normal in the
 * model's axes and how much `light` falls on it, from its ambient share to 1.
 */
export type Drawn = { d: string; role: string; part: string; facing: boolean; normal: Solid; shade: number };

/**
 * A light held still with the eye: `direction` points toward it in the
 * scene's axes (x right, y down, z toward the eye), and `ambient` is the
 * share of light every face gets, even one turned away from it.
 *
 * It turns with the eye and not with the model, so as a device spins its
 * sides brighten and darken the way they would under a lamp over the viewer.
 */
export type Light = { readonly direction: Solid; readonly ambient: number };

/** From above, a little to the left and mostly from the eye, so faces seen straight on stay near their own color. */
export const LIGHT: Light = { direction: [-0.3, -0.5, 0.8], ambient: 0.4 };

/** How much of `light` falls on a face turned along `normal` in the scene's axes: Lambert's law over an ambient floor. */
export function lit(normal: Solid, { direction, ambient }: Light): number {
  const toward = dot(normal, direction) / Math.hypot(...direction);
  return fixed(ambient + (1 - ambient) * Math.max(0, toward));
}

/** A part's outline on screen, for its outline stroke or a shadow. */
export type Silhouette = { part: string; d: string; points: Flat[] };

const mean = (points: readonly Solid[]): Solid => {
  const sum = points.reduce<Solid>(([x, y, z], [px, py, pz]) => [x + px, y + py, z + pz], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
};

/**
 * A scene as the camera sees it: the faces that face the eye, far to near,
 * and each part's silhouette in the same order.
 *
 * Depth is the distance from the eye in the camera's view space, which,
 * unlike view z alone, agrees with `facesEye` toward the edges of a wide
 * perspective. Parts draw by `order`, then from the farthest center to the
 * nearest; a part's faces draw by the same rule, ties in the order the part
 * gives them.
 *
 * That is right for convex parts that do not pass through each other and
 * whose centers sort as they overlap: inside one convex part the faces that
 * face the eye never cover each other, and a plate's center is nearer the eye
 * than its parent's whenever the plate faces it. Parts that interlock, or a
 * part that reaches past another's center (a lid swinging over its base),
 * need `order`. Pass `cull: false` to keep the faces turned away, marked by
 * `facing`. Each face's `shade` is how much `light` falls on it.
 */
export function draw(scene: Scene, camera: Camera, { cull = true, light = LIGHT }: { cull?: boolean; light?: Light } = {}) {
  const eye: Solid = [camera.originX, camera.originY, camera.perspective];
  const far = (point: Solid) => {
    const [x, y, z] = subtract(camera.toView(point), eye);
    return x * x + y * y + z * z;
  };
  const parts = placed(scene).map(({ part, pose }) => {
    const shown = faces(part).map((face) => {
      const points = face.points.map((point) => place(pose, point));
      const normal = rotate(pose.rotation, face.normal);
      const facing = camera.facesEye(points[0]!, normal);
      const shade = lit(rotate(camera.rotation, normal), light);
      return { points, facing, normal, shade, role: face.role, depth: far(mean(points)) };
    });
    const all = shown.flatMap((face) => face.points);
    return { part, shown, all, depth: far(mean(all)) };
  });
  parts.sort((a, b) => (a.part.order ?? 0) - (b.part.order ?? 0) || b.depth - a.depth);
  const drawn = parts.flatMap(({ part, shown }) =>
    shown
      .filter((face) => face.facing || !cull)
      .sort((a, b) => b.depth - a.depth)
      .map(
        ({ points, role, facing, normal, shade }): Drawn => ({ d: shape(points.map(camera.project)), role, part: part.name, facing, normal, shade }),
      ),
  );
  const hulls = parts.map(({ part, all }): Silhouette => {
    const points = hull(all.map(camera.project));
    return { part: part.name, d: shape(points), points };
  });
  return { faces: drawn, hulls };
}

/**
 * A scene's shadow on the ground, for a device that floats over the page:
 * every part as seen from straight above, grown by `spread`, laid `gap` under
 * the lowest point, moved `ahead` toward the front and drawn by the camera.
 * The model's z is up whatever the parts' poses, so the shadow follows a
 * turning device the way light from overhead would. `facing` is false when
 * the eye is under the ground, where the shadow cannot be seen.
 */
export function footprint(
  scene: Scene,
  camera: Camera,
  { gap = 0, spread = 0, ahead = 0 }: { gap?: number; spread?: number; ahead?: number } = {},
): Silhouette & { facing: boolean } {
  const all = placed(scene).flatMap(({ part, pose }) => faces(part).flatMap((face) => face.points.map((point) => place(pose, point))));
  const ground = Math.min(...all.map(([, , z]) => z)) - gap;
  const above = hull(all.map(([x, y]): Flat => [x, y + ahead]));
  const points = (spread > 0 ? grow(above, spread) : above).map(([x, y]) => camera.project([x, y, ground]));
  return { part: "footprint", d: shape(points), points, facing: camera.facesEye([0, 0, ground], [0, 0, 1]) };
}

/**
 * The side faces between `rings` of a convex solid, each ring an outline at
 * one height, from one end to the other, placed by `pose` and seen by `eye`:
 * its outline on screen, and the faces that face the eye as path data, one
 * string for each of `count` tones. `tone` picks a face's tone, from 0 to
 * `count - 1`, from its unit normal in the scene's model space, turned out
 * from `middle`.
 */
export function banded(rings: readonly (readonly Solid[])[], pose: Pose, eye: Camera, middle: Solid, count: number, tone: (normal: Solid) => number) {
  const placed = rings.map((ring) => ring.map((point) => place(pose, point)));
  const drawn = placed.map((ring) => ring.map(eye.project));
  const center = place(pose, middle);
  const tones = Array.from({ length: count }, () => "");
  placed.forEach((upper, band) => {
    const lower = placed[band + 1];
    const [top, bottom] = [drawn[band], drawn[band + 1]];
    if (!lower || !top || !bottom) return;
    upper.forEach((a, index) => {
      const next = (index + 1) % upper.length;
      const [b, c, d] = [upper[next], lower[next], lower[index]];
      if (!b || !c || !d) return;
      const across = cross(subtract(c, a), subtract(d, b));
      const normal: Solid = dot(across, subtract(a, center)) < 0 ? [-across[0], -across[1], -across[2]] : across;
      if (!eye.facesEye(a, normal)) return;
      const length = Math.hypot(...normal);
      tones[tone([normal[0] / length, normal[1] / length, normal[2] / length])] += shape([top[index] ?? [0, 0], top[next] ?? [0, 0], bottom[next] ?? [0, 0], bottom[index] ?? [0, 0]]);
    });
  });
  return { hull: shape(hull(drawn.flat())), tones };
}
