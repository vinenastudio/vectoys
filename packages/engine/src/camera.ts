import { fixed } from "./path.ts";
import { add, combine, dot, multiply, rotate, rotateX, rotateY, rotateZ, subtract, type Flat, type Rotation, type Solid } from "./vector.ts";

/**
 * A scene `width` by `height`, in the units the SVG viewBox and the CSS use.
 * An eye sits `perspective` in front of it, level with the vanishing point
 * (`originX`, `originY`), as CSS `perspective` and `perspective-origin` put
 * it. The model stands `back` behind the scene at (`anchorX`, `anchorY`) and
 * turns by `yaw` about its up axis, `pitch` toward or away from the eye and
 * `roll` about the line of sight, all in degrees.
 */
export type CameraOptions = {
  width?: number;
  height: number;
  perspective: number;
  originX?: number;
  originY?: number;
  anchorX?: number;
  anchorY?: number;
  back?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
};

export type Camera = Required<CameraOptions> & {
  /** Turns a direction of the model into the scene's axes. */
  rotation: Rotation;
  toView: (point: Solid) => Solid;
  project: (point: Solid) => Flat;
  facesEye: (point: Solid, normal: Solid) => boolean;
};

// The model's axes: x across, y toward the front and z up. The scene's
// axes, as CSS has them: x right, y down and z toward the eye. Standing
// upright the model's front faces the eye, which is CSS `rotateX(90deg)`.
const UPRIGHT = rotateX(90);

/**
 * A perspective camera on a model. The model turns as CSS turns an element
 * styled `translateZ(-back) rotateZ(roll) rotateX(pitch) rotateY(yaw)
 * rotateX(90deg)` at the anchor, so a live element laid over the drawing
 * lines up with it.
 */
export function camera(options: CameraOptions): Camera {
  const { width = 100, height, perspective } = options;
  const settings = {
    width,
    height,
    perspective,
    originX: options.originX ?? width / 2,
    originY: options.originY ?? height / 2,
    anchorX: options.anchorX ?? width / 2,
    anchorY: options.anchorY ?? height / 2,
    back: options.back ?? 0,
    yaw: options.yaw ?? 0,
    pitch: options.pitch ?? 0,
    roll: options.roll ?? 0,
  };
  const { originX, originY, anchorX, anchorY, back } = settings;
  const rotation = combine(rotateZ(settings.roll), rotateX(settings.pitch), rotateY(settings.yaw), UPRIGHT);

  /** A point of the model in the scene, before perspective draws it in. */
  function toView(point: Solid): Solid {
    const [x, y, z] = rotate(rotation, point);
    return [anchorX + x, anchorY + y, z - back];
  }

  function project(point: Solid): Flat {
    const [x, y, z] = toView(point);
    const share = perspective / (perspective - z);
    return [originX + (x - originX) * share, originY + (y - originY) * share];
  }

  /** Whether a face through `point`, turned out along `normal`, faces the eye. */
  function facesEye(point: Solid, normal: Solid): boolean {
    return dot(rotate(rotation, normal), subtract([originX, originY, perspective], toView(point))) > 0;
  }

  return { ...settings, rotation, toView, project, facesEye };
}

/** A box a camera's scene moves into: its size, and how far the drawing moves in it. */
export type Boxed = { width: number; height: number; x: number; y: number };

/**
 * An eye's camera turned by `yaw` and `pitch`. Given a `box`, the scene is
 * the box's size and the drawing moves by its (x, y) in it, so a pose draws
 * the same in the box, only shifted.
 */
export function aimed(options: CameraOptions, { yaw, pitch }: { yaw: number; pitch: number }, box?: Boxed): Camera {
  const { width = 100, height } = options;
  const [originX, originY] = [options.originX ?? width / 2, options.originY ?? height / 2];
  const [anchorX, anchorY] = [options.anchorX ?? width / 2, options.anchorY ?? height / 2];
  const [x, y] = box ? [box.x, box.y] : [0, 0];
  return camera({
    ...options,
    ...(box && { width: box.width, height: box.height }),
    originX: originX + x,
    originY: originY + y,
    anchorX: anchorX + x,
    anchorY: anchorY + y,
    yaw,
    pitch,
  });
}

/** A camera that sees the model turned by `turn` round `middle`, then scaled by `scale` about the middle on screen and moved by `shift`. */
export function moved(eye: Camera, turn: Rotation, scale: number, [dx, dy]: Flat, middle: Solid): Camera {
  const [cx, cy] = eye.project(middle);
  const model = (point: Solid) => add(rotate(turn, subtract(point, middle)), middle);
  return {
    ...eye,
    rotation: multiply(eye.rotation, turn),
    toView: (point) => eye.toView(model(point)),
    project(point) {
      const [x, y] = eye.project(model(point));
      return [cx + (x - cx) * scale + dx, cy + (y - cy) * scale + dy];
    },
    facesEye: (point, normal) => eye.facesEye(model(point), rotate(turn, normal)),
  };
}

/**
 * A linear gradient laid across a face, as the `gradientTransform` of one in
 * `userSpaceOnUse` with ends (0, 0) and (0, 1): 0 at `from` and 1 at `to`,
 * and its lines along the model's x where the span's middle is, so they lie
 * square across a turned face, as ends given on screen do not.
 */
export function gradientSpace(eye: Camera, from: Solid, to: Solid) {
  const [[ox, oy], [tx, ty]] = [eye.project(from), eye.project(to)];
  const side = (x: number) => eye.project(add(from, [x + (to[0] - from[0]) / 2, (to[1] - from[1]) / 2, (to[2] - from[2]) / 2]));
  const [[lx, ly], [rx, ry]] = [side(-1), side(1)];
  return { gradientTransform: `matrix(${[rx - lx, ry - ly, tx - ox, ty - oy, ox, oy].map(fixed).join(" ")})` };
}
