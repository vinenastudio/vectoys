import { camera, draw, plate, rotateX, slab, type Part, type Pose } from "@vinena/vectoys";

// A slab 60 by 40 scene units and 4 deep, with a plate on its face. In the
// slab's own plane x runs across from its middle, y down from its middle and
// z out of its face. Change the parts to make the item yours.
export const WIDTH = 60;
export const HEIGHT = 40;
export const THICKNESS = 4;
const INSET = 6;

/** How the slab turns toward the eye at rest, in degrees. */
export const TILT = { yaw: -24, pitch: -16 } as const;

function parts(pose: Pose): Part[] {
  return [
    slab({
      name: "body",
      box: [-WIDTH / 2, -HEIGHT / 2, WIDTH / 2, HEIGHT / 2],
      radii: [4, 4],
      thickness: THICKNESS,
      edge: 1,
      pose,
      children: [plate({ name: "face", box: [-WIDTH / 2 + INSET, -HEIGHT / 2 + INSET, WIDTH / 2 - INSET, HEIGHT / 2 - INSET], radii: [2, 2], role: "face" })],
    }),
  ];
}

/** The slab as the eye sees it, turned by `yaw` and `pitch`: the camera and the parts drawn. */
export function seen(yaw: number = TILT.yaw, pitch: number = TILT.pitch) {
  const eye = camera({ width: 100, height: 80, perspective: 280, yaw, pitch });
  // Upright, the slab's face looks at the eye.
  const pose: Pose = { position: [0, THICKNESS / 2, 0], rotation: rotateX(-90) };
  return { camera: eye, drawn: draw(parts(pose), eye) };
}

export type View = ReturnType<typeof seen>;
