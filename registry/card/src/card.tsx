import { fixed, settled, spring, type Spring, type SpringOptions } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, useFrames, useReducedMotion, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { FACE, FACE_ROUND, seen, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the card
// shows as meant before they are set. The back is in the finish.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;
const FOCUS = "var(--vectoys-focus, currentColor)";
const FOCUS_WIDTH = "var(--vectoys-focus-width, 1px)";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  top: fill(SURFACE),
  bottom: fill(FINISH),
  side: fill(`color-mix(in srgb, ${SURFACE} 78%, ${HAIRLINE})`),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: `color-mix(in srgb, ${HAIRLINE} 60%, transparent)`, fill: "none" },
};

/** CSS pixels the content lays out across each face, as on a card on a page. */
export const VIEWPORT = 320;

// The face's corners follow the card's, as shares of the face so they hold
// at any size the content lays out at.
const FACE_RADIUS = `${fixed((FACE_ROUND / FACE.width) * 100)}% / ${fixed((FACE_ROUND / FACE.height) * 100)}%`;
const FACE_STYLE: CSSProperties = {
  overflow: "hidden",
  borderRadius: FACE_RADIUS,
  clipPath: `inset(0 round ${FACE_RADIUS})`,
  containerType: "inline-size",
};

// How far the card tilts toward a pointer at its edge, in degrees, and the
// springs it flips and tilts on: the flip a little loose so it lands with a
// small bounce, the tilt quick and soft.
const TILT = 9;
const FLIP_SPRING = { stiffness: 140, damping: 16 };
const TILT_SPRING = { stiffness: 220, damping: 22 };

type Angles = { flip: number; yaw: number; pitch: number };
type Springs = Record<keyof Angles, Spring>;
const KEYS = ["flip", "yaw", "pitch"] as const;

/** The card at rest, and the box it fills in the stage, as shares, for the button over it. */
const REST = seen();
const BOUNDS = (() => {
  const points = REST.drawn.hulls.flatMap((hull) => hull.points);
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];
  const [left, top, right, bottom] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const { width, height } = REST.camera;
  return { left: left / width, top: top / height, width: (right - left) / width, height: (bottom - top) / height };
})();

const percent = (share: number) => `${fixed(share * 100)}%`;
const BUTTON = "vectoys-card-button";
const BUTTON_STYLE: CSSProperties = {
  position: "absolute",
  left: percent(BOUNDS.left),
  top: percent(BOUNDS.top),
  width: percent(BOUNDS.width),
  height: percent(BOUNDS.height),
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: "4%",
  background: "transparent",
  cursor: "pointer",
  appearance: "none",
};
const FOCUS_RING = `.${BUTTON}{outline:none}.${BUTTON}:focus-visible{outline:${FOCUS_WIDTH} solid ${FOCUS};outline-offset:4px}`;

/** The soft shadow under the card, under names of its own so any number of cards share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="220">
        <feGaussianBlur stdDeviation="0.8 0.4" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="220">
        <feGaussianBlur stdDeviation="3 1.4" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

type CardProps = TurnOptions & {
  /** Live content on the front, laid out `VIEWPORT` pixels across. */
  front?: ReactNode;
  /** Live content on the back, laid out the same and reading the right way once flipped. */
  back?: ReactNode;
  /** What flips the card: a click or tap, or a pointer resting on it. Keys flip it either way. */
  trigger?: "click" | "hover";
  /** Shows the back; leave it out for the card to keep its own state. */
  flipped?: boolean;
  /** Whether the card starts on its back when it keeps its own state. */
  defaultFlipped?: boolean;
  /** Called with the side the card asks to show. */
  onFlipChange?: (flipped: boolean) => void;
  /** Leans toward a pointer over it; on by default. */
  tilt?: boolean;
  /** The flip button's name for assistive technology. */
  label?: string;
  /** Set on the outer box, which holds the card and its full screen button. */
  className?: string;
  style?: CSSProperties;
};

/** Whether a pointer event falls inside the card's box at rest. */
function inside(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  const [x, y] = [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height];
  return x >= BOUNDS.left && x <= BOUNDS.left + BOUNDS.width && y >= BOUNDS.top && y <= BOUNDS.top + BOUNDS.height;
}

type DrawnProps = Required<Turn> & {
  id: string;
  front: ReactNode;
  back: ReactNode;
  label: string;
  pressed: boolean;
  button: RefObject<HTMLButtonElement | null>;
};

/** The card drawn at one turn, with its flip button and both faces over it. */
const Drawn = memo(function Drawn({ id, flip, yaw, pitch, front, back, label, pressed, button }: DrawnProps) {
  const view = useMemo(() => seen({ flip, yaw, pitch }), [flip, yaw, pitch]);
  const card = view.drawn.hulls.find((hull) => hull.part === "card");

  const overlay = (
    <>
      <style>{FOCUS_RING}</style>
      {/* The button covers the card, so a drag on it still turns the card. */}
      <button ref={button} type="button" className={BUTTON} aria-label={label} aria-pressed={pressed} style={BUTTON_STYLE} data-vectoys-grab />
      <Screen camera={view.camera} pose={view.front} rect={FACE} width={VIEWPORT} style={FACE_STYLE}>
        {front}
      </Screen>
      <Screen camera={view.camera} pose={view.back} rect={FACE} width={VIEWPORT} style={FACE_STYLE}>
        {back}
      </Screen>
    </>
  );

  return (
    <Stage camera={view.camera} overlay={overlay}>
      {view.shadow && <Shadow id={id} shadow={view.shadow} />}
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      {card && <path d={card.d} {...OUTLINE} />}
    </Stage>
  );
});

/**
 * A card with live content on both faces that flips over on a click, a tap,
 * a key or a pointer resting on it, and leans a little toward the pointer.
 * The back's content is hidden while the front shows, and the other way round.
 * A drag or the arrow keys turn it, a click after a drag does not flip it,
 * and a button shows it full screen.
 */
export function Card({
  front,
  back,
  trigger = "click",
  flipped,
  defaultFlipped = false,
  onFlipChange,
  tilt = true,
  label = "Flip card",
  // The class, the style and the turn's options are the outer box's.
  ...outer
}: CardProps) {
  const id = `card-${useId().replace(/[^\w-]/g, "")}`;
  const reduced = useReducedMotion();
  const frames = useFrames();
  const [own, setOwn] = useState(defaultFlipped);
  const showsBack = flipped ?? own;

  const target = useRef<Angles>({ flip: showsBack ? 180 : 0, yaw: 0, pitch: 0 });
  const springs = useRef<Springs>({
    flip: { value: target.current.flip, velocity: 0 },
    yaw: { value: 0, velocity: 0 },
    pitch: { value: 0, velocity: 0 },
  });
  const [angles, setAngles] = useState<Angles>(target.current);
  const pointer = useRef("mouse");
  const button = useRef<HTMLButtonElement>(null);

  /** Moves the card toward its target: on springs, or at once for reduced motion. */
  const settle = () => {
    if (reduced) {
      springs.current = { flip: { value: target.current.flip, velocity: 0 }, yaw: { value: 0, velocity: 0 }, pitch: { value: 0, velocity: 0 } };
      setAngles({ ...target.current, yaw: 0, pitch: 0 });
      return;
    }
    frames((elapsed) => {
      const step = (key: keyof Angles, options: SpringOptions) => spring(springs.current[key], target.current[key], elapsed / 1000, options);
      const next: Springs = { flip: step("flip", FLIP_SPRING), yaw: step("yaw", TILT_SPRING), pitch: step("pitch", TILT_SPRING) };
      springs.current = next;
      setAngles({ flip: next.flip.value, yaw: next.yaw.value, pitch: next.pitch.value });
      return !KEYS.every((key) => settled(next[key], target.current[key]));
    });
  };

  useEffect(() => {
    target.current.flip = showsBack ? 180 : 0;
    settle();
  }, [showsBack, reduced]);

  const ask = (next: boolean) => {
    if (next === showsBack) return;
    if (flipped === undefined) setOwn(next);
    onFlipChange?.(next);
  };

  const lean = (yaw: number, pitch: number) => {
    target.current.yaw = yaw;
    target.current.pitch = pitch;
    settle();
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    pointer.current = event.pointerType;
    if (event.pointerType === "touch") return;
    const over = inside(event);
    if (trigger === "hover") ask(over);
    // A held button drags the card round, so the lean waits until it lets go.
    if (!tilt || reduced || event.buttons !== 0) return;
    if (!over) return lean(0, 0);
    const box = event.currentTarget.getBoundingClientRect();
    const across = ((event.clientX - box.left) / box.width - BOUNDS.left) / BOUNDS.width;
    const down = ((event.clientY - box.top) / box.height - BOUNDS.top) / BOUNDS.height;
    lean(-(across * 2 - 1) * TILT, (down * 2 - 1) * TILT);
  };

  const leave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (trigger === "hover") ask(false);
    lean(0, 0);
  };

  const click = (event: MouseEvent<HTMLDivElement>) => {
    // Links and fields in the content keep their own clicks.
    const control = event.target instanceof Element ? event.target.closest("a, button, input, select, textarea, label, summary") : null;
    if (control && control !== button.current) return;
    const keyboard = event.detail === 0;
    if (!keyboard && !inside(event)) return;
    // A mouse already flips a hover card by resting on it.
    if (trigger === "hover" && !keyboard && pointer.current === "mouse") return;
    ask(!showsBack);
  };

  // The card's yaw turns it the other way to a camera's, so a drag to the right takes its right edge away.
  return (
    <Turntable mode="camera" label={label} {...outer}>
      {(turn) => (
        <div
          style={{ position: "relative", touchAction: "manipulation" }}
          onPointerDown={(event) => (pointer.current = event.pointerType)}
          onPointerMove={move}
          onPointerLeave={leave}
          onClick={click}
        >
          <Drawn
            id={id}
            flip={angles.flip}
            yaw={angles.yaw - turn.yaw}
            pitch={angles.pitch + turn.pitch}
            front={front}
            back={back}
            label={label}
            pressed={showsBack}
            button={button}
          />
        </div>
      )}
    </Turntable>
  );
}
