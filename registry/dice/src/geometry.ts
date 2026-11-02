import {
  IDENTITY,
  camera,
  draw,
  footprint,
  multiply,
  plate,
  rotate,
  rotateAxis,
  rotateX,
  rotateY,
  rotateZ,
  slerp,
  slab,
  type Flat,
  type Part,
  type Pose,
  type Rotation,
  type Solid,
} from "@vinena/vectoys";

// A standard 16 mm die with its edges and corners rounded by 2.5 mm, its pips
// 2.9 mm across. Sizes are millimetres at SCALE scene units each, in a scene
// 100 square, with room above the die for it to hop as it rolls.
const SCALE = 2;
const mm = (value: number) => value * SCALE;

export const SIZE = mm(16);
const ROUND = mm(2.5);
const PIP = mm(1.45);
// Pips sit on a grid this far from the face's middle.
const GRID = mm(4.3);
const STEP = 0.6;

/** A face's value. Opposite faces add up to 7. */
export type Value = 1 | 2 | 3 | 4 | 5 | 6;
export const VALUES: readonly Value[] = [1, 2, 3, 4, 5, 6];

// Where each value's pips sit on its face, in steps of GRID.
const PIPS: Record<Value, readonly Flat[]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
};

// Each value's face in the die's own space: its outward normal, the turn
// that lays a plate on it from the die's top, and the die's turn that brings
// it on top. The die's top is z = 0 and its bottom z = -SIZE, as a slab's are.
const FACES: Record<Value, { normal: Solid; turn: Rotation; up: Rotation }> = {
  1: { normal: [0, 0, 1], turn: IDENTITY, up: IDENTITY },
  6: { normal: [0, 0, -1], turn: rotateX(180), up: rotateX(180) },
  3: { normal: [1, 0, 0], turn: rotateY(90), up: rotateY(-90) },
  4: { normal: [-1, 0, 0], turn: rotateY(-90), up: rotateY(90) },
  5: { normal: [0, 1, 0], turn: rotateX(-90), up: rotateX(90) },
  2: { normal: [0, -1, 0], turn: rotateX(90), up: rotateX(-90) },
};

/** The die's turn that rests `value` on top. */
export const resting = (value: Value): Rotation => FACES[value].up;

/** The value on top of a die turned by `rotation`. */
export function upFace(rotation: Rotation): Value {
  return VALUES.reduce((best, value) => (rotate(rotation, FACES[value].normal)[2] > rotate(rotation, FACES[best].normal)[2] ? value : best));
}

/** The middle of a value's face, in the die's own space. */
const middleOf = (value: Value): Solid => {
  const [x, y, z] = FACES[value].normal;
  return [(x * SIZE) / 2, (y * SIZE) / 2, ((z - 1) * SIZE) / 2];
};

const pips = (value: Value): Part[] =>
  PIPS[value].map(([x, y], index) =>
    plate({
      name: `pip-${value}-${index}`,
      box: [x * GRID - PIP, y * GRID - PIP, x * GRID + PIP, y * GRID + PIP],
      radii: [PIP, PIP],
      role: "pip",
      step: STEP / 2,
      // Pips only draw on faces that face the eye, where nothing of the die covers them.
      order: 1,
      pose: { position: middleOf(value), rotation: FACES[value].turn },
    }),
  );

/** The die turned by `rotation`, its middle at `middle`. */
function die(rotation: Rotation, middle: Solid): Part {
  const offset = rotate(rotation, [0, 0, SIZE / 2]);
  const pose: Pose = { position: [middle[0] + offset[0], middle[1] + offset[1], middle[2] + offset[2]], rotation };
  return slab({
    name: "die",
    box: [-SIZE / 2, -SIZE / 2, SIZE / 2, SIZE / 2],
    radii: [ROUND, ROUND],
    thickness: SIZE,
    edge: ROUND,
    step: STEP,
    pose,
    children: VALUES.flatMap(pips),
  });
}

// The corners of the die's core, which the rounding grows by ROUND all round.
const CORE = SIZE / 2 - ROUND;
const CORNERS: Solid[] = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): Solid => [x * CORE, y * CORE, z * CORE])));

/** How high the die's middle stands when it rests turned by `rotation`: on its lowest corner, edge or face. */
export const standing = (rotation: Rotation) => Math.max(...CORNERS.map((corner) => -rotate(rotation, corner)[2])) + ROUND;

/** The die as one eye sees it, turned by `rotation` and lifted `hop` off the ground, the eye moved `turn` degrees round it. */
export function seen(rotation: Rotation = resting(5), hop = 0, turn = { yaw: 0, pitch: 0 }) {
  const eye = camera({ width: 100, height: 100, perspective: 260, yaw: -32 + turn.yaw, pitch: -28 + turn.pitch, anchorY: 60 });
  const height = standing(rotation);
  const scene = [die(rotation, [0, 0, height + hop])];
  // The shadow stays on the ground, so it is cast by the die as if resting
  // there, spread and faded the higher it hops.
  const ground = (spread: number, ahead: number) => footprint([die(rotation, [0, 0, height])], eye, { spread: spread + hop * 0.25, ahead });
  const [contact, far] = [ground(mm(0.4), 0), ground(mm(2.5), mm(1.5))];
  return {
    camera: eye,
    drawn: draw(scene, eye),
    shadow: { contact: contact.d, ground: far.d, strength: SIZE / (SIZE + hop * 2) },
  };
}

export type View = ReturnType<typeof seen>;

/** A roll from one turn to the face it lands on. */
export type Roll = { from: Rotation; value: Value; axis: Solid; turns: number };

// How long a roll tumbles before it lands, how long it wobbles after, and how
// high it hops at first and on the bounce, in scene units.
export const ROLL_MS = 900;
export const WOBBLE_MS = 520;
const HOP = SIZE * 1.1;
const BOUNCE = SIZE * 0.22;
const WOBBLE = 9;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A first hop, then a small bounce, landing at 85 percent of the roll. */
function hopAt(t: number) {
  if (t < 0.6) return HOP * 4 * (t / 0.6) * (1 - t / 0.6);
  if (t < 0.85) {
    const u = (t - 0.6) / 0.25;
    return BOUNCE * 4 * u * (1 - u);
  }
  return 0;
}

/**
 * Where a roll is `ms` into it: the die tumbles a few whole turns about
 * `axis` while it blends from where it was to where it lands, so it ends on
 * `value` whatever the turns; then it rocks on its face and settles.
 */
export function rollAt({ from, value, axis, turns }: Roll, ms: number): { rotation: Rotation; hop: number; done: boolean } {
  const to = resting(value);
  if (ms < ROLL_MS) {
    const t = ms / ROLL_MS;
    const e = easeOut(t);
    return { rotation: multiply(rotateAxis(axis, (1 - e) * turns * 360), slerp(from, to, e)), hop: hopAt(t), done: false };
  }
  const since = ms - ROLL_MS;
  if (since >= WOBBLE_MS) return { rotation: to, hop: 0, done: true };
  // A rock about the axis it tumbled on, dying away.
  const angle = WOBBLE * Math.exp(-since / 140) * Math.sin((since / 170) * 2 * Math.PI);
  return { rotation: multiply(rotateAxis(axis, angle), to), hop: 0, done: false };
}

/** A roll from `from` to `value`, tumbling about a level axis `heading` degrees round. */
export const roll = (from: Rotation, value: Value, heading: number, turns = 2): Roll => ({
  from,
  value,
  axis: rotate(rotateZ(heading), [1, 0, 0]),
  turns,
});
