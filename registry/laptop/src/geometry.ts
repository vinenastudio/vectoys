import {
  camera,
  fixed,
  grow,
  hull,
  keep,
  line,
  rotateX,
  rounded,
  shape,
  slot,
  toward,
  winding,
  type Box,
  type CameraOptions,
  type Flat,
  type Pose,
  type ScreenRect,
  type Solid,
} from "@vinena/vectoys";

// A 14 inch laptop: 312.6 mm wide, 221.2 mm deep and 15.5 mm thick, of
// which the lid is about 4.5 mm. Sizes are hundredths of the scene's width,
// at 66 for the width, in a scene 100 wide. The display is 302.5 by
// 196.5 mm inside a 5 mm bezel.
export const WIDTH = 66;
export const DEPTH = 46.7;
const BASE = 2.3;
const LID = 0.95;
export const BEZEL = 1.07;
export const CHIN = 4.15;
// The lid stands LIFT above the deck.
export const LIFT = 0.15;
// The corners of both slabs, and the aluminum rim round the display glass.
export const ROUND = 2.1;
const RIM = 0.25;
// The lid turns about an axis 2.9 mm in from the base's back edge and 4.6 mm
// under the shut lid's face, so open its chin drops behind the base toward
// the table. The hinge fills a cut 237.6 mm wide and 4.5 mm deep in the
// base's back edge, between shoulders of 37.5 mm: an aluminum barrel 15 mm
// long at each end and the dark cover between them.
const PIVOT: Flat = [0.62, -0.98];
const CUT = 50.16;
const CUT_DEPTH = 0.94;
const CUT_ROUND = 0.12;
const BARREL = 3.16;

/** One dot of the speaker grilles. */
export const HOLE = 0.085;

/**
 * The display's glass in the lid's plane, x across and y down from the lid's
 * top edge to the hinge, for laying live content on it with `Screen`.
 */
export const GLASS: ScreenRect = { x: -WIDTH / 2 + BEZEL, y: -DEPTH + BEZEL, width: WIDTH - 2 * BEZEL, height: DEPTH - BEZEL - CHIN };

const HALF_WIDTH = WIDTH / 2;
const HALF_DEPTH = DEPTH / 2;
const RADIAN = Math.PI / 180;

// The thumb slot cut into the front edge of the base: 56 mm wide, 2.8 mm
// into the deck and 3.6 mm down the front, with a flat floor, rounded ends
// and a small fillet where it leaves the edge.
const NOTCH = 11.8;
const SCOOP = 0.59;
const DIP = 0.76;
const FILLET = 0.15;
const END = 0.6;

// The keyboard well and its keys, in key units across; every row adds up to
// 14.5 with the arrow keys. The well is 279.6 by 114.9 mm, 16.6 mm in from the
// deck's back edge, and the keys stand 0.44 apart.
const WELL: Box = [-29.516, -19.845, 29.516, 4.435];
const ROWS: readonly (readonly number[])[] = [
  [1.5, ...Array<number>(12).fill(1), 1],
  [...Array<number>(13).fill(1), 1.5],
  [1.5, ...Array<number>(13).fill(1)],
  [1.75, ...Array<number>(11).fill(1), 1.75],
  [2.25, ...Array<number>(10).fill(1), 2.25],
  [1, 1, 1, 1.25, 5, 1.25, 1],
];
const PAD = 0.3;
const GAP = 0.22;
const UNIT = (WELL[2] - WELL[0] - 2 * PAD) / 14.5;
const ROW = (WELL[3] - WELL[1] - 2 * PAD) / ROWS.length;

const KEYS: Box[] = ROWS.flatMap((row, index) => {
  const top = WELL[1] + PAD + index * ROW;
  let left = WELL[0] + PAD;
  return row.map((units): Box => {
    const box: Box = [left + GAP, top + GAP, left + units * UNIT - GAP, top + ROW - GAP];
    left += units * UNIT;
    return box;
  });
});
// Left, up over down, and right, the half-height arrows in the last row.
const ARROW_LEFT = WELL[0] + PAD + 11.5 * UNIT;
const ARROW_TOP = WELL[1] + PAD + 5 * ROW + GAP;
const ARROW_HALF = (ROW - 2 * GAP - 0.2) / 2;
const ARROWS: Box[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 1],
].map(([column, half]): Box => {
  const left = ARROW_LEFT + column! * UNIT + GAP;
  const top = ARROW_TOP + half! * (ARROW_HALF + 0.2);
  return [left, top, left + UNIT - 2 * GAP, top + ARROW_HALF];
});
const TOUCH_ID = KEYS[ROWS[0]!.length - 1]!;

// The trackpad, 129.6 by 80.9 mm, 3 mm under the well.
const TRACKPAD: Box = [-13.68, 5.07, 13.68, 22.17];

// The speaker grilles' holes, a square grid centered in the deck beside the
// keyboard, 1.6 mm from its side edge and from the well and 4.5 mm short of
// the well's ends. The machine has 15 holes across at 0.93 mm; down the deck,
// which the eye sees foreshortened, they stand 2.3 mm apart so they are as far
// apart on screen. Each is one dot HOLE wide.
const GRILLE_GAP = 0.34;
const GRILLE_END = 0.95;

// The lid's outline in its own plane, x across and d up from the hinge.
const LID_RING = rounded([-HALF_WIDTH, -DEPTH, HALF_WIDTH, 0], [ROUND, ROUND]);
const BEZEL_RING = rounded([-HALF_WIDTH + RIM, -DEPTH + RIM, HALF_WIDTH - RIM, -RIM], [ROUND - RIM, ROUND - RIM]);

const cut = (value: number) => Math.round(value * 100) / 100 || 0;

/** The laptop as one eye sees it: what never moves, and the lid for each frame. */
function seen({ id, ...options }: CameraOptions & { id: string }) {
  const eye = camera(options);
  const { project } = eye;
  // The open lid faces the eye, so its glass is a plain rectangle on screen.
  const OPEN = -90 - eye.pitch;

  const onDeck = ([x, y]: Flat, z = 0) => project([x, y, z]);

  // The body of the base: its outline on screen, the deck's top with the slot
  // cut into its front edge and the hinge's cut into its back edge, and the
  // slot's dip down the front face.
  const SLAB: Box = [-HALF_WIDTH, -HALF_DEPTH, HALF_WIDTH, HALF_DEPTH];
  const PLAIN = rounded(SLAB, [ROUND, ROUND]);
  const SCOOP_EDGE = slot(NOTCH, SCOOP, SCOOP - FILLET, FILLET).map(([x, y]): Flat => [x, HALF_DEPTH - y]);
  const DIP_EDGE = slot(NOTCH, DIP, END, FILLET).map(([x, w]) => project([x, HALF_DEPTH, -w]));
  const CUT_EDGE = slot(CUT, CUT_DEPTH, CUT_ROUND, FILLET).map(([x, y]): Flat => [x, y - HALF_DEPTH]);
  const DECK_RING = rounded(SLAB, [ROUND, ROUND], [...SCOOP_EDGE].reverse(), CUT_EDGE).map((point) => onDeck(point));
  const BASE_HULL = hull([...PLAIN.map((point) => onDeck(point)), ...PLAIN.map((point) => onDeck(point, -BASE))]);
  // The base's outline without its back edge, which the deck's top draws with the cut.
  const BACK_EDGE = BASE_HULL.reduce(
    (back, [, y], index) =>
      y + BASE_HULL[(index + 1) % BASE_HULL.length]![1] < BASE_HULL[back]![1] + BASE_HULL[(back + 1) % BASE_HULL.length]![1] ? index : back,
    0,
  );
  const BASE_LINE = [...BASE_HULL.slice(BACK_EDGE + 1), ...BASE_HULL.slice(0, BACK_EDGE + 1)];

  /** A rounded rectangle on the deck. */
  const patch = (box: Box, radius: number) => shape(rounded(box, [radius, radius]).map((point) => onDeck(point)));

  function holes(columns: number, rows: number): string {
    return [-1, 1]
      .flatMap((side) =>
        Array.from({ length: rows * columns }, (_, index) => {
          const across = WELL[2] + GRILLE_GAP + ((HALF_WIDTH - WELL[2] - 2 * GRILLE_GAP) * (index % columns)) / (columns - 1);
          const along = WELL[1] + GRILLE_END + ((WELL[3] - WELL[1] - 2 * GRILLE_END) * Math.floor(index / columns)) / (rows - 1);
          const [x, y] = onDeck([side * across, along]);
          return `M${cut(x)} ${cut(y)}h0`;
        }),
      )
      .join("");
  }

  // The shadow on the ground: the base's footprint, a little in from its edge.
  const FOOTPRINT = (spread: number, ahead: number) =>
    shape(
      rounded(
        [-HALF_WIDTH + 1.32 - spread, -HALF_DEPTH + 0.93 - spread + ahead, HALF_WIDTH - 1.32 + spread, HALF_DEPTH - 0.93 + spread + ahead],
        [ROUND, ROUND],
      ).map((point) => onDeck(point, -BASE - 0.1)),
    );

  /** Everything that never moves, as SVG path data in the scene's units. */
  const DECK = {
    hull: shape(BASE_HULL),
    top: shape(DECK_RING),
    lines: `${line(BASE_LINE)}${shape(DECK_RING)}${line(DIP_EDGE)}`,
    scoop: shape([...SCOOP_EDGE.map((point) => onDeck(point)), ...[...DIP_EDGE].reverse()]),
    well: patch(WELL, 0.8),
    keys: [...KEYS.filter((key) => key !== TOUCH_ID), ...ARROWS].map((key) => patch(key, key[3] - key[1] < 2 ? 0.25 : 0.38)).join(""),
    touchId: patch(TOUCH_ID, 0.38),
    touchIdRing: patch([TOUCH_ID[0] + 0.45, TOUCH_ID[1] + 0.45, TOUCH_ID[2] - 0.45, TOUCH_ID[3] - 0.45], 0.3),
    // The same field of holes at full, half and quarter density, for scenes
    // too small to keep the finer ones apart.
    holes: [holes(15, 47), holes(8, 24), holes(4, 12)],
    trackpad: patch(TRACKPAD, 1),
    // The hinge in its cut, a little past the cut's edges so the deck's top and
    // the lid overlap it.
    hinge: patch([-CUT / 2, -HALF_DEPTH - 0.15, CUT / 2, -HALF_DEPTH + CUT_DEPTH + 0.3], 0),
    barrels: [-CUT / 2, CUT / 2 - BARREL]
      .map((left) => patch([left, -HALF_DEPTH - 0.15, left + BARREL, -HALF_DEPTH + CUT_DEPTH + 0.3], 0))
      .join(""),
    contact: FOOTPRINT(0, 0.3),
    ground: FOOTPRINT(0.8, 1.2),
  };

  // Which way round `hull` runs, as the sign of its outlines' area.
  const TURN = winding(BASE_HULL);

  // The base's outline on screen grown by half a hairline, so the lid stops at
  // the deck's line instead of covering half of it.
  const GROWN_HULL = grow(BASE_HULL, 0.06);

  /** What of a hull on screen, grown past its hairline, the base covers. */
  function behindBase(points: readonly Flat[]): Flat[] {
    return GROWN_HULL.reduce<Flat[]>((kept, [ax, ay], index) => {
      const [bx, by] = GROWN_HULL[(index + 1) % GROWN_HULL.length]!;
      return keep(kept, ([x, y]) => -TURN * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)), toward);
    }, grow(points, 0.2));
  }

  /**
   * The lid's place for one frame, `closed` from 0 (open) to 1 (shut on the
   * base): its angle in degrees, from OPEN to -180 when shut, about the back
   * edge of the shut lid's face, then how far it moves along the deck and up
   * for the hinge's real axis.
   */
  function lidPose(closed: number) {
    const angle = OPEN - (180 + OPEN) * closed;
    const turn = (angle + 180) * RADIAN;
    const [y, z] = PIVOT;
    return {
      angle,
      along: y * (1 - Math.cos(turn)) + z * Math.sin(turn),
      up: z * (1 - Math.cos(turn)) - y * Math.sin(turn),
    };
  }

  /**
   * The lid as a pose in the laptop's space, for `Screen`: x across, y from
   * the lid's top edge down to the hinge and z out of the display's face, as
   * `GLASS` is given.
   */
  function lidWorld(closed: number): Pose {
    const { angle, along, up } = lidPose(closed);
    return { position: [0, -HALF_DEPTH + along, LIFT + up], rotation: rotateX(angle) };
  }

  /** The lid's paths for one frame, `closed` from 0 (open) to 1 (shut on the base). */
  function lidArt(closed: number) {
    const pose = lidPose(closed);
    const angle = pose.angle * RADIAN;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    // A point `behind` the display's face, at (x, -d) in the lid's plane.
    const at =
      (behind: number) =>
      ([x, up]: Flat): Solid => [x, -HALF_DEPTH + pose.along + up * cos + behind * sin, LIFT + pose.up + up * sin - behind * cos];
    const flat = (behind: number, ring: readonly Flat[]) => ring.map((point) => project(at(behind)(point)));
    // Shut, the lid's sides reach down to the deck, so the seam is one line.
    const skirt = LIFT * Math.min(1, Math.max(0, (closed - 0.9) / 0.1));
    const front = flat(0, LID_RING);
    const back = flat(LID, LID_RING);
    const outline = hull([...front, ...back, ...(skirt > 0 ? flat(-skirt, LID_RING) : [])]);
    const facing = eye.facesEye(at(0)([0, -DEPTH / 2]), [0, -sin, cos]);
    const face = facing ? front : back;
    // The chin below the deck drops behind the base, which hides it where the
    // rest of the lid does not stand in front.
    const part = (side: number) => [0, LID].flatMap((behind) => keep(LID_RING.map(at(behind)), ([, , z]) => side * z, toward).map(project));
    const sunk = part(1);
    const hidden = sunk.length > 2 ? behindBase(hull(sunk)) : [];
    // How far over the deck the lid reaches, as a share of its depth, for its shadow.
    const reach = Math.max(0, -cos);
    return {
      facing,
      hull: shape(outline),
      face: shape(face),
      bezel: facing ? shape(flat(0, BEZEL_RING)) : null,
      cut: hidden.length > 2 ? { hidden: shape(hidden), clear: shape(grow(hull(part(-1)), 0.08)) } : null,
      lines: `${shape(outline)}${shape(face)}`,
      shadow:
        closed > 0
          ? {
              from: cut(onDeck([0, -HALF_DEPTH + DEPTH * (reach - 0.1)])[1]),
              to: cut(onDeck([0, -HALF_DEPTH + DEPTH * (reach + 0.15)])[1]),
            }
          : null,
    };
  }

  return { id, camera: eye, DECK, lidPose, lidWorld, lidArt };
}

/** An eye that sees the laptop in perspective, with a lid that opens and closes. */
export type Perspective = ReturnType<typeof seen>;

/**
 * Beside the words, on a wide page: the eye is near, so the deck comes
 * forward and spreads. The lid opens to 105 degrees. An eye sits
 * `perspective` away, level with `originY`; the laptop stands `back` behind
 * its focus at `anchorY` and turns toward it by `pitch` degrees, in a scene
 * 100 by `height`.
 */
export const DESK = seen({ id: "desk", height: 70, perspective: 200, pitch: -15, back: 14, originY: 0.22 * 70, anchorY: 0.78 * 70 });

/**
 * Over the words, on a phone: the eye is three times as far and a little
 * lower, so the deck is hardly wider than the lid and half as deep, and the
 * whole laptop fits a narrow page. `back` and `anchorY` put the open lid where
 * DESK has it, so one glass serves both. The lid opens to 102 degrees.
 */
export const PHONE = seen({ id: "phone", height: 59, perspective: 600, pitch: -12, back: 88.07, originY: 0.22 * 70, anchorY: 53.43 });


// Straight on, as product shots draw the machine. Every size here is in
// hundredths of the lid's width, measured on such shots: the base shows 1.214
// times as wide as the lid, since its front edge stands much nearer the camera
// than the hinge, and the lid shows 1.465 times as wide as it is tall above
// the base, since it leans back and the base hides its foot.
const share = (hundredths: number) => (hundredths * WIDTH) / 100;
const OVERHANG = 10.7;
const SHOWN = 100 / 1.465;
// From the lid's edge in: an aluminum rim, a dark gasket with a lighter
// inner line, then black glass. The display stands BORDER in from the edge at
// the top and the sides, with top corners round about the lid's.
const LID_ROUND = 3.05;
const RIM_LINE = 0.07;
const GASKET = 0.2;
const GASKET_LINE = 0.44;
const BLACK = 0.54;
const BORDER = 1.75;
const DISPLAY: Box = [BORDER, BORDER, 100 - BORDER, BORDER + 62.67];
const DISPLAY_ROUND = 1.27;
// Under the display, black glass to the hinge's hairline and band, which stop
// at the base with corners a little round.
const HINGE_LINE = 65.54;
const HINGE = 65.64;
const HINGE_ROUND = 0.6;
// The base's front face, with round bottom corners, the thumb's scoop cut
// down into its top edge, and two feet under the lid's sides.
const FACE = 4.37;
const FACE_ROUND = 2.4;
const SCOOP_HALF = 10.6;
const SCOOP_DEPTH = 1.53;
const SCOOP_END = 1.9;
const SCOOP_WALL = 0.75;
const FOOT_HALF = 4;
const FOOT_TAPER = 0.3;
const FOOT_HIGH = 0.6;
// The notch is NOTCH_ACROSS wide and NOTCH_HIGH tall from the display's top edge, with
// a flat floor, round bottom corners and small curved shoulders that flare
// FLARE out along that edge; the camera is centered in its top part.
const NOTCH_ACROSS = 11.79;
const NOTCH_HIGH = 2.03;
const NOTCH_ROUND = 0.7;
const SHOULDER = 0.29;
const FLARE = 0.19;
const LENS_AT = 0.54;

/** A rectangle's outline as path data, its top corners round by `high` and its bottom ones by `low`. */
function box([left, top, right, bottom]: Box, high: number, low = 0): string {
  const corner = (radius: number, x: number, y: number) => (radius > 0 ? `A${fixed(radius)} ${fixed(radius)} 0 0 1 ${fixed(x)} ${fixed(y)}` : "");
  return [
    `M${fixed(left + high)} ${fixed(top)}H${fixed(right - high)}`,
    corner(high, right, top + high),
    `V${fixed(bottom - low)}`,
    corner(low, right - low, bottom),
    `H${fixed(left + low)}`,
    corner(low, left, bottom - low),
    `V${fixed(top + high)}`,
    corner(high, left + high, top),
    "Z",
  ].join("");
}

/** The laptop straight on, drawn flat: its paths, the display's place and the notch. */
function straight() {
  const x = (hundredths: number) => share(OVERHANG + hundredths);
  const at = ([left, top, right, bottom]: Box): Box => [x(left), share(top), x(right), share(bottom)];
  const plate = (outline: Box, high: number, low = 0) => box(at(outline), share(high), share(low));
  const BASE_TOP = SHOWN;
  const BASE_BOTTOM = BASE_TOP + FACE;
  const FEET = BASE_BOTTOM + FOOT_HIGH;
  const eye = camera({ width: fixed(share(100 + 2 * OVERHANG)), height: fixed(share(FEET)), perspective: 1000, anchorX: 0, anchorY: 0 });

  /** The scoop's outline, its walls quarter ellipses `end` across down to a flat floor. */
  function scoop(end: number, inset: number) {
    const [left, right, top, floor] = [x(50 - SCOOP_HALF + inset), x(50 + SCOOP_HALF - inset), share(BASE_TOP), share(BASE_TOP + SCOOP_DEPTH)];
    const [across, down] = [fixed(share(end)), fixed(share(SCOOP_DEPTH))];
    return `M${fixed(left)} ${fixed(top)}A${across} ${down} 0 0 0 ${fixed(left + share(end))} ${fixed(floor)}H${fixed(right - share(end))}A${across} ${down} 0 0 0 ${fixed(right)} ${fixed(top)}Z`;
  }

  /** A foot centered under `middle`, from under the base's face to the ground, a little narrower at the bottom. */
  function foot(middle: number) {
    const [top, face, ground, round] = [share(BASE_BOTTOM - 0.3), share(BASE_BOTTOM), share(FEET), share(0.2)];
    const [wide, narrow] = [share(FOOT_HALF), share(FOOT_HALF - FOOT_TAPER)];
    const center = x(middle);
    const [l, r, ll, rr] = [center - wide, center + wide, center - narrow, center + narrow];
    return [
      `M${fixed(l)} ${fixed(top)}H${fixed(r)}V${fixed(face)}L${fixed(rr)} ${fixed(ground - round)}`,
      `Q${fixed(rr)} ${fixed(ground)} ${fixed(rr - round)} ${fixed(ground)}H${fixed(ll + round)}`,
      `Q${fixed(ll)} ${fixed(ground)} ${fixed(ll)} ${fixed(ground - round)}L${fixed(l)} ${fixed(face)}Z`,
    ].join("");
  }

  // The notch in its own box, in hundredths of the lid's width, from the
  // display's top edge down; a little past that edge so no seam shows.
  const NOTCH_WIDE = NOTCH_ACROSS + 2 * FLARE;
  const [side, far, floor] = [FLARE, FLARE + NOTCH_ACROSS, NOTCH_HIGH];
  const notch = {
    width: NOTCH_WIDE,
    height: NOTCH_HIGH,
    path: [
      `M0 -0.1V0Q${side} 0 ${side} ${SHOULDER}V${fixed(floor - NOTCH_ROUND)}`,
      `A${NOTCH_ROUND} ${NOTCH_ROUND} 0 0 0 ${fixed(side + NOTCH_ROUND)} ${floor}H${fixed(far - NOTCH_ROUND)}`,
      `A${NOTCH_ROUND} ${NOTCH_ROUND} 0 0 0 ${fixed(far)} ${fixed(floor - NOTCH_ROUND)}V${SHOULDER}Q${fixed(far)} 0 ${fixed(NOTCH_WIDE)} 0V-0.1Z`,
    ].join(""),
    lens: { x: fixed(NOTCH_WIDE / 2), y: LENS_AT },
    // Its place on the display, as shares of the display's width and height.
    left: (50 - BORDER - NOTCH_WIDE / 2) / (DISPLAY[2] - DISPLAY[0]),
    across: NOTCH_WIDE / (DISPLAY[2] - DISPLAY[0]),
    down: NOTCH_HIGH / (DISPLAY[3] - DISPLAY[1]),
  };

  const [left, top, right, bottom] = at(DISPLAY);
  return {
    id: "front",
    camera: eye,
    /** The display in the scene, for laying live content on it with `Screen`. */
    glass: { x: left, y: top, width: right - left, height: bottom - top } satisfies ScreenRect,
    /** The display's top corners' radius in the scene. */
    round: share(DISPLAY_ROUND),
    /** The display's plane, facing the eye, where a point of `glass` lands on the scene as it is. */
    pose: { position: [0, 0, 0], rotation: rotateX(-90) } satisfies Pose,
    notch,
    art: {
      edge: plate([0, 0, 100, SHOWN + 0.2], LID_ROUND),
      rim: plate([RIM_LINE, RIM_LINE, 100 - RIM_LINE, SHOWN + 0.2], LID_ROUND - RIM_LINE),
      gasket: plate([GASKET, GASKET, 100 - GASKET, SHOWN], LID_ROUND - GASKET, HINGE_ROUND + BLACK - GASKET),
      gasketLine: plate([GASKET_LINE, GASKET_LINE, 100 - GASKET_LINE, SHOWN], LID_ROUND - GASKET_LINE, HINGE_ROUND + BLACK - GASKET_LINE),
      glass: plate([BLACK, BLACK, 100 - BLACK, SHOWN], LID_ROUND - BLACK, HINGE_ROUND),
      hingeLine: plate([BLACK, HINGE_LINE, 100 - BLACK, SHOWN], 0, HINGE_ROUND),
      hinge: plate([BLACK, HINGE, 100 - BLACK, SHOWN], 0, HINGE_ROUND),
      base: box([0, share(BASE_TOP), share(100 + 2 * OVERHANG), share(BASE_BOTTOM)], 0, share(FACE_ROUND)),
      scoop: scoop(SCOOP_END, 0),
      // The scoop's walls, from its edge to a narrower scoop inside it, to fill even-odd.
      walls: scoop(SCOOP_END, 0) + scoop(SCOOP_END - SCOOP_WALL, SCOOP_WALL),
      feet: [foot(0), foot(100)],
      /** Where the rim's top darkens, and where the feet start and end, as heights in the scene for their gradients. */
      rimFade: fixed(share(LID_ROUND)),
      feetTop: fixed(share(BASE_BOTTOM)),
      feetBottom: fixed(share(FEET)),
    },
  };
}

export type Straight = ReturnType<typeof straight>;

/** An eye on the laptop: `DESK`, `PHONE` or `FRONT`. */
export type View = Perspective | Straight;

/**
 * Straight on, as a product shot: the open lid upright with its display a
 * plain rectangle, over the base's front face with the thumb's scoop and two
 * feet, drawn flat to sizes measured on product renders. The lid is always
 * open, so `closed` does nothing. Its aluminum is the page's
 * `--vectoys-finish`, silver by default; #3d3b3e reads as space black. The
 * scene is the laptop's own bounds, the base's width across and the lid's top
 * to the feet down, and the lid is 82.4% of its width. Laptop takes no style
 * or className, so to let a frame cut it, put it in a div with `width:
 * 121.4%; margin-inline: -10.7%; margin-bottom: -3%` inside a wrapper with
 * `overflow: hidden`: the lid then fills the wrapper's width, the base's ends
 * are cut flush with the lid's sides, and the base's face just under the
 * thumb's scoop.
 */
export const FRONT = straight();
