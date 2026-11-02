import { camera, draw, footprint, plate, rotateX, slab, type Box, type Flat, type Part, type Pose, type ScreenRect } from "@vinena/vectoys";

// A 3.5 inch floppy disk, 90 by 94 mm and 3.3 mm thick, its top right corner
// cut 3.5 mm across. Seen from its label side: a metal shutter 48 by 30 mm
// over the top edge, with a 10 by 22 mm window, slides 17 mm left to line its
// window up with the opening onto the disk inside; a label 68 by 52 mm fills
// the bottom, with the write-protect window in the bottom left corner and the
// density hole in the bottom right. In the disk's own plane x runs across
// from its middle, y down from its middle and z out of the label side.
// Sizes are millimetres at SCALE scene units each.
const SCALE = 0.78;
const mm = (value: number) => value * SCALE;

export const WIDTH = mm(90);
export const HEIGHT = mm(94);
export const THICKNESS = mm(3.3);
const CUT = mm(3.5);
/** How far the shutter slides open, in scene units. */
export const SLIDE = mm(17);

/** A box on the disk's face given in millimetres from its top left corner, as the disk is measured. */
const fromCorner = (x: number, y: number, width: number, height: number): Box => [
  mm(x) - WIDTH / 2,
  mm(y) - HEIGHT / 2,
  mm(x + width) - WIDTH / 2,
  mm(y + height) - HEIGHT / 2,
];

const RECESS = fromCorner(5, 0, 68, 31);
const SHUTTER = fromCorner(22, 0, 48, 30);
const SHUTTER_WINDOW = fromCorner(41, 4, 10, 22);
const OPENING = fromCorner(24, 4, 10, 22);
const LABEL_BOX = fromCorner(11, 38, 68, 54);
const LABEL_BAND = fromCorner(11, 38, 68, 7);
const PROTECT = fromCorner(3, 83, 4.5, 7.5);
const PROTECT_TAB = fromCorner(3, 83, 4.5, 3.75);
const DENSITY = fromCorner(82.5, 83, 4.5, 7.5);

/** The label in the disk's plane, for laying the live text on it with `Screen`. */
export const LABEL: ScreenRect = {
  x: LABEL_BOX[0],
  y: LABEL_BOX[1],
  width: LABEL_BOX[2] - LABEL_BOX[0],
  height: LABEL_BOX[3] - LABEL_BOX[1],
  z: 0.06,
};
/** The whole face, for laying the link or button over it with `Screen`. */
export const FACE: ScreenRect = { x: -WIDTH / 2, y: -HEIGHT / 2, width: WIDTH, height: HEIGHT, z: 0.06 };

// The outline runs clockwise from the cut corner, as `rounded` runs.
const OUTLINE: Flat[] = [
  [WIDTH / 2 - CUT, -HEIGHT / 2],
  [WIDTH / 2, -HEIGHT / 2 + CUT],
  [WIDTH / 2, HEIGHT / 2],
  [-WIDTH / 2, HEIGHT / 2],
  [-WIDTH / 2, -HEIGHT / 2],
];

/** A flat piece on the face, `lift` over it and drawn in `order` over what it lies on. */
const piece = (name: string, box: Box, lift: number, order: number, role = name): Part =>
  plate({ name, box, radii: [mm(0.4), mm(0.4)], lift, role, order });

/** The shutter `slide` units left of shut, as three strips round its window so the opening shows through it. */
function shutter(slide: number): Part[] {
  const slid = ([left, top, right, bottom]: Box): Box => [left - slide, top, right - slide, bottom];
  const [left, top, right, bottom] = slid(SHUTTER);
  const [windowLeft, windowTop, windowRight, windowBottom] = slid(SHUTTER_WINDOW);
  const strip = (name: string, box: Box) => plate({ name, box, lift: 0.04, role: "shutter", order: 3 });
  return [
    strip("shutter-left", [left, top, windowLeft, bottom]),
    strip("shutter-right", [windowRight, top, right, bottom]),
    strip("shutter-top", [windowLeft, top, windowRight, windowTop]),
    strip("shutter-bottom", [windowLeft, windowBottom, windowRight, bottom]),
  ];
}

/**
 * The disk's parts. Everything but the body lies on its face, so it draws by
 * `order`: the recess, the opening onto the disk, the shutter over them and
 * the label and corner windows beside it.
 */
function parts(pose: Pose, slide: number): Part[] {
  return [
    slab({
      name: "body",
      box: [-WIDTH / 2, -HEIGHT / 2, WIDTH / 2, HEIGHT / 2],
      outline: OUTLINE,
      thickness: THICKNESS,
      edge: mm(0.4),
      bevel: "chamfer",
      pose,
      children: [
        piece("recess", RECESS, 0.01, 1),
        piece("opening", OPENING, 0.02, 2),
        ...shutter(slide),
        piece("label", LABEL_BOX, 0.02, 1),
        piece("band", LABEL_BAND, 0.03, 2),
        piece("protect", PROTECT, 0.02, 1, "hole"),
        piece("protect-tab", PROTECT_TAB, 0.03, 2, "tab"),
        piece("density", DENSITY, 0.02, 1, "hole"),
      ],
    }),
  ];
}

/**
 * Upright, the disk's label side faces the eye: its z turns to the model's y
 * and its y, down the disk, to the model's -z. `back` pushes it away from
 * the eye, as a press does.
 */
function bodyPose(back: number): Pose {
  return { position: [0, THICKNESS / 2 - back, 0], rotation: rotateX(-90) };
}

/** How the disk turns at rest and how much further under the pointer, in degrees. */
export const TURN = { yaw: -16, pitch: -10 } as const;
export const HOVER_TURN = { yaw: 12, pitch: 5 } as const;
/** How far a press pushes the disk back, in scene units. */
export const PRESS = mm(5);

/**
 * The disk as the eye sees it, `hover` from 0 to 1 sliding the shutter open
 * and turning it toward the eye, `press` from 0 to 1 pushing it back, and
 * the eye moved `turn` degrees round it: the parts drawn, the body's pose
 * and the shadow under it.
 */
export function seen(hover = 0, press = 0, turn = { yaw: 0, pitch: 0 }) {
  const eye = camera({
    width: 100,
    height: 100,
    perspective: 280,
    anchorY: 47,
    yaw: TURN.yaw + HOVER_TURN.yaw * hover + turn.yaw,
    pitch: TURN.pitch + HOVER_TURN.pitch * hover + turn.pitch,
  });
  const pose = bodyPose(PRESS * press);
  const scene = parts(pose, SLIDE * hover);
  const ground = (spread: number, ahead: number) => footprint(scene, eye, { gap: mm(10), spread, ahead });
  const [contact, far] = [ground(mm(1.5), 0), ground(mm(8), mm(4))];
  return {
    camera: eye,
    scene,
    drawn: draw(scene, eye),
    body: pose,
    shadow: contact.facing ? { contact: contact.d, ground: far.d } : null,
  };
}

export type View = ReturnType<typeof seen>;
