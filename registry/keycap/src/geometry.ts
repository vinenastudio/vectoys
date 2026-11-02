import { IDENTITY, camera, draw, footprint, plate, slab, type Box, type Part, type ScreenRect } from "@vinena/vectoys";

// A mechanical key on a short run of keyboard deck: a sculpted cap 18 mm
// square at its foot and 12.8 mm across its dished top, 9 mm tall, on a
// switch whose top housing is 15.6 mm square and stands 5.5 mm over the deck.
// As on a real key the cap is hollow and rides over the housing, its foot
// 4.6 mm over the deck, so its 4 mm of travel stops just short of the deck.
// Sizes are millimetres at SCALE scene units each.
const SCALE = 2.6;
const mm = (value: number) => value * SCALE;

const DECK = mm(24);
const DECK_ROUND = mm(3);
const DECK_THICKNESS = mm(2);
const HOUSING = mm(15.6);
const HOUSING_HEIGHT = mm(5.5);
const CAP = mm(18);
const CAP_ROUND = mm(2.4);
const CAP_HEIGHT = mm(9);
const CAP_TAPER = mm(2.6);
const CAP_EDGE = mm(0.8);
const CAP_FOOT = mm(4.6);
// The dish is read as two steps in from the top's edge, each a shade deeper.
const DISH = [mm(0.7), mm(2.2)] as const;
const LIFT = 0.02;

/** How far the cap travels down when pressed, in millimetres. */
export const TRAVEL = 4;
/** How far it lifts under the pointer, in millimetres. */
export const HOVER = 1;

// Points round a corner every half unit, coarse enough to redraw every frame.
const STEP = 0.5;

const TOP = CAP - 2 * CAP_TAPER;
/** The cap's top in its own plane, for laying the live label on it with `Screen`. */
export const LABEL: ScreenRect = { x: -TOP / 2, y: -TOP / 2, width: TOP, height: TOP, z: LIFT * 3 };
/** The top's corner radius, as the taper scales it. */
export const LABEL_ROUND = (CAP_ROUND * TOP) / CAP;

const square = (size: number): Box => [-size / 2, -size / 2, size / 2, size / 2];
const at = (z: number) => ({ position: [0, 0, z] as const, rotation: IDENTITY });

/** Where the cap's top sits with the cap `travel` millimetres down. */
const capPose = (travel: number) => at(DECK_THICKNESS + CAP_FOOT + CAP_HEIGHT - mm(travel));

/** The cap, `travel` millimetres down from rest (up when negative), with its dish on top. */
function cap(travel: number): Part {
  const dish = DISH.map((inset, index) =>
    plate({
      name: `dish-${index}`,
      box: square(TOP - 2 * inset),
      radii: [Math.max(LABEL_ROUND - inset / 2, mm(0.5)), Math.max(LABEL_ROUND - inset / 2, mm(0.5))],
      lift: LIFT * (index + 1),
      role: "dish",
      step: STEP,
      order: 4 + index,
    }),
  );
  return slab({
    name: "cap",
    box: square(CAP),
    radii: [CAP_ROUND, CAP_ROUND],
    thickness: CAP_HEIGHT,
    taper: CAP_TAPER,
    edge: CAP_EDGE,
    step: STEP,
    order: 3,
    pose: capPose(travel),
    children: dish,
  });
}

/**
 * The deck, the switch and the cap, drawn far to near by `order` as the eye
 * always looks down on them, so the cap covers the housing it rides over.
 */
function parts(travel: number): Part[] {
  return [
    slab({ name: "deck", box: square(DECK), radii: [DECK_ROUND, DECK_ROUND], thickness: DECK_THICKNESS, edge: mm(0.5), step: STEP, pose: at(DECK_THICKNESS) }),
    slab({
      name: "housing",
      box: square(HOUSING),
      radii: [mm(1), mm(1)],
      thickness: HOUSING_HEIGHT,
      taper: mm(0.8),
      step: STEP,
      order: 1,
      pose: at(DECK_THICKNESS + HOUSING_HEIGHT),
    }),
    cap(travel),
  ];
}

/** Seen from in front and well above, turned a little so two sides of the cap show. */
export const EYE = { yaw: -18, pitch: -42 } as const;

/** The key as the eye sees it with the cap `travel` millimetres down and the eye moved `turn` degrees round it: the parts drawn, the cap's pose and the shadow. */
export function seen(travel = 0, turn = { yaw: 0, pitch: 0 }) {
  const eye = camera({ width: 100, height: 90, perspective: 320, anchorY: 58, yaw: EYE.yaw + turn.yaw, pitch: EYE.pitch + turn.pitch });
  const scene = parts(travel);
  const ground = (spread: number, ahead: number) => footprint(scene, eye, { spread, ahead }).d;
  return {
    camera: eye,
    scene,
    drawn: draw(scene, eye),
    top: capPose(travel),
    shadow: { contact: ground(mm(0.6), 0), ground: ground(mm(4), mm(2)) },
  };
}

export type View = ReturnType<typeof seen>;
