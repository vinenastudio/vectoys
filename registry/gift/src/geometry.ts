import {
  IDENTITY,
  camera,
  combine,
  draw,
  footprint,
  place,
  plate,
  rotate,
  rotateX,
  rotateY,
  rotateZ,
  slab,
  type Flat,
  type Part,
  type Pose,
  type Rotation,
  type ScreenRect,
  type Solid,
} from "@vinena/vectoys";

// A gift box 100 mm square and 80 mm tall from 3 mm board, under a lid 106 mm
// square and 24 mm deep. A ribbon 16 mm wide runs down every side and crosses
// over the lid, tied in a bow of two loops 34 by 22 mm and a knot. The
// surprise inside is a card 84 by 54 mm. Sizes are millimetres at SCALE scene
// units each, in a scene 100 wide and 110 tall, with room over the box for
// the lid to come off.
const SCALE = 0.4;
const mm = (value: number) => value * SCALE;

const BOX = mm(100);
const TALL = mm(80);
const WALL = mm(3);
const LID = mm(106);
const LID_DEEP = mm(24);
const ROUND = mm(2);
const LID_EDGE = mm(1.5);
const RIBBON = mm(16);
const LOOP: Flat = [mm(34), mm(22)];
const LOOP_THICK = mm(7);
const KNOT = mm(14);
const STEP = 0.5;

/** The surprise card in its own plane, x across and y down from its top edge, for laying live content on with `Screen`. */
export const SURPRISE: ScreenRect = { x: -mm(42), y: 0, width: mm(84), height: mm(54) };

// The turn that lays a plate from a part's top onto each of its four sides,
// and the plate's box there for a band `across` wide and `tall` high.
const SIDES: { normal: Solid; turn: Rotation; box: (across: number, tall: number) => [number, number, number, number] }[] = [
  { normal: [0, 1, 0], turn: rotateX(-90), box: (a, t) => [-a / 2, -t / 2, a / 2, t / 2] },
  { normal: [0, -1, 0], turn: rotateX(90), box: (a, t) => [-a / 2, -t / 2, a / 2, t / 2] },
  { normal: [1, 0, 0], turn: rotateY(90), box: (a, t) => [-t / 2, -a / 2, t / 2, a / 2] },
  { normal: [-1, 0, 0], turn: rotateY(-90), box: (a, t) => [-t / 2, -a / 2, t / 2, a / 2] },
];

/** The ribbon down each side of a part `width` across, `tall` high about `middle` below its top, as plates in the part's own space. */
const bands = (name: string, width: number, tall: number, middle: number, order: number): Part[] =>
  SIDES.map(({ normal: [x, y], turn, box }, index) =>
    plate({
      name: `${name}-${index}`,
      box: box(RIBBON, tall),
      role: "ribbon",
      order,
      pose: { position: [(x * width) / 2, (y * width) / 2, -middle], rotation: turn },
    }),
  );

/** A loop of the bow on one side, leaning out and up from the knot. */
const loop = (side: 1 | -1): Part =>
  slab({
    name: `loop-${side > 0 ? "right" : "left"}`,
    box: [-LOOP[0] / 2, -LOOP[1] / 2, LOOP[0] / 2, LOOP[1] / 2],
    radii: [LOOP[1] / 2, LOOP[1] / 2],
    thickness: LOOP_THICK,
    edge: LOOP_THICK / 2,
    step: STEP,
    order: 4,
    // Stood up, its thickness toward the eye, leaning out 25 degrees, its
    // low inner end just on the lid.
    pose: { position: [side * LOOP[0] * 0.45, -LOOP_THICK / 2, LOOP[1] / 2 + mm(7)], rotation: combine(rotateY(-side * 25), rotateX(90)) },
  });

/** The lid with its ribbon and bow, its top at z = 0 in its own space. */
const lid = (pose: Pose): Part =>
  slab({
    name: "lid",
    box: [-LID / 2, -LID / 2, LID / 2, LID / 2],
    radii: [ROUND, ROUND],
    thickness: LID_DEEP,
    edge: LID_EDGE,
    step: STEP,
    order: 2,
    pose,
    children: [
      plate({ name: "ribbon-across", box: [-LID / 2 + LID_EDGE, -RIBBON / 2, LID / 2 - LID_EDGE, RIBBON / 2], role: "ribbon", order: 3 }),
      plate({ name: "ribbon-along", box: [-RIBBON / 2, -LID / 2 + LID_EDGE, RIBBON / 2, LID / 2 - LID_EDGE], role: "ribbon", order: 3 }),
      ...bands("lid-ribbon", LID, LID_DEEP - 2 * LID_EDGE, LID_DEEP / 2, 3),
      loop(1),
      loop(-1),
      slab({
        name: "knot",
        box: [-KNOT / 2, -KNOT / 2, KNOT / 2, KNOT / 2],
        radii: [KNOT / 3, KNOT / 3],
        thickness: KNOT * 0.7,
        edge: KNOT / 4,
        step: STEP,
        order: 5,
        pose: { position: [0, 0, KNOT * 0.7], rotation: IDENTITY },
      }),
    ],
  });

/**
 * The box with its open top and the ribbon down its sides. Drawn before the
 * lid, which always stands over the box's top and so is never behind it.
 */
const body: Part = slab({
  name: "box",
  box: [-BOX / 2, -BOX / 2, BOX / 2, BOX / 2],
  radii: [ROUND, ROUND],
  thickness: TALL,
  step: STEP,
  pose: { position: [0, 0, TALL], rotation: IDENTITY },
  children: [
    plate({ name: "inside", box: [-BOX / 2 + WALL, -BOX / 2 + WALL, BOX / 2 - WALL, BOX / 2 - WALL], radii: [ROUND / 2, ROUND / 2], role: "inside", order: 1 }),
    ...bands("box-ribbon", BOX, TALL, TALL / 2, 1),
  ],
});

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Eases out past the end and back, for a pop. */
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

/**
 * The lid `open` of the way off, from 0 (on the box) to 1: it pops straight
 * up, then tips its back up so its top and bow turn toward the eye, and
 * drifts back and to the right, out of the way of what comes out. `peek`
 * lifts it a little, as a hover does. Its top faces the eye all the way,
 * so the ribbon and the bow on it always draw over the lid.
 */
function lidPose(open: number, peek: number): Pose {
  const rise = easeOutBack(clamp(open / 0.55)) * TALL * 0.95 + peek * mm(5);
  const drift = easeInOut(clamp((open - 0.2) / 0.8));
  const rotation = combine(rotateZ(-14 * drift + peek * 3), rotateX(-28 * drift), rotateY(-10 * drift));
  // The lid turns about its middle, half way down its depth.
  const middle: Solid = [mm(30) * drift, -mm(34) * drift, TALL + LID_DEEP / 2 + rise];
  const offset = rotate(rotation, [0, 0, LID_DEEP / 2]);
  return { position: [middle[0] + offset[0], middle[1] + offset[1], middle[2] + offset[2]], rotation };
}

/**
 * The surprise card `open` of the way out, and how far out it is: it waits
 * inside until the lid is clear, then rises right out of the box with a
 * small pop.
 */
const DEEP = mm(28);

function surprisePose(open: number): { pose: Pose; out: number } {
  const out = easeOutBack(clamp((open - 0.3) / 0.7));
  // Deep enough at first that the eye cannot see it over the rim.
  const top = TALL - DEEP + out * (SURPRISE.height + DEEP);
  return { pose: { position: [0, 0, top], rotation: rotateX(-90) }, out };
}

// The front edge of the box's opening, which hides the part of the surprise still inside.
const RIM: [Solid, Solid] = [
  [-BOX / 2 + WALL, BOX / 2 - WALL, TALL],
  [BOX / 2 - WALL, BOX / 2 - WALL, TALL],
];

type Eye = ReturnType<typeof camera>;

/**
 * How much of the surprise shows over the box's front rim, from 0 to 1 from
 * its top edge down. The rim is level, so the line it hides along is level on
 * the card too, and halving finds it.
 */
function shown(eye: Eye, pose: Pose): number {
  const [a, b] = RIM.map(eye.project) as [Flat, Flat];
  const side = ([x, y]: Flat) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const below = Math.sign(side(eye.project([0, BOX / 2, 0])));
  const hidden = (down: number) => side(eye.project(place(pose, [0, down, 0]))) * below > 0;
  if (hidden(0)) return 0;
  if (!hidden(SURPRISE.height)) return 1;
  let [low, high] = [0, SURPRISE.height];
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (hidden(middle)) high = middle;
    else low = middle;
  }
  return low / SURPRISE.height;
}

const EYE = { width: 100, height: 110, perspective: 280, yaw: -30, pitch: -24, anchorY: 72 };

/** The gift as the eye sees it, `open` of the way open, lifted `peek` by a hover and the eye moved `turn` degrees round it: the faces drawn, the surprise's pose and how much of it shows, and the shadow. */
export function seen(open = 0, peek = 0, turn = { yaw: 0, pitch: 0 }) {
  const eye = camera({ ...EYE, yaw: EYE.yaw + turn.yaw, pitch: EYE.pitch + turn.pitch });
  const scene = [body, lid(lidPose(open, peek))];
  const ground = (spread: number, ahead: number) => footprint([body], eye, { spread, ahead });
  const { pose, out } = surprisePose(open);
  return {
    camera: eye,
    drawn: draw(scene, eye),
    // Before it rises the lid still covers it, or has only just lifted.
    surprise: { pose, shown: out > 0 ? shown(eye, pose) : 0 },
    shadow: { contact: ground(mm(2), 0).d, ground: ground(mm(9), mm(5)).d },
  };
}

export type View = ReturnType<typeof seen>;
