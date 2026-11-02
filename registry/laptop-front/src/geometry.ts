import { camera, fixed, rotateX, type Box, type Pose, type ScreenRect } from "@vinena/vectoys";

// A 14 inch laptop, 312.6 mm wide, seen straight on. The scene's sizes follow
// a scene 100 wide in which the lid is 66 across.
const WIDTH = 66;

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


/**
 * Straight on, as a product shot: the open lid upright with its display a
 * plain rectangle, over the base's front face with the thumb's scoop and two
 * feet, drawn flat to sizes measured on product renders. The scene is the
 * laptop's own bounds, the base's width across and the lid's top to the feet
 * down, and the lid is 82.4% of its width.
 */
export const FRONT = straight();
