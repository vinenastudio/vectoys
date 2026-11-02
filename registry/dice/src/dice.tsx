import { fixed, type Rotation } from "@vinena/vectoys";
import { Faces, Stage, Turntable, useFrames, useReducedMotion, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { VALUES, resting, roll, rollAt, seen, type Value, type View } from "./geometry";

// The page's colors, as CSS variables. Each falls back to a tone for light
// and one for dark, picked by the page's color scheme, so the die reads on
// a dark page with nothing set: a die in the finish, else the surface, with
// pips in the ink.
const HAIRLINE = "var(--vectoys-hairline, light-dark(#8a8a8a, #5a5a5a))";
const SURFACE = "var(--vectoys-surface, light-dark(#f5f5f5, #262626))";
const SHADOW = "var(--vectoys-shadow, light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4)))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;
const INK = "var(--vectoys-ink, light-dark(#1d1d1c, #ededed))";
const FOCUS = "var(--vectoys-focus, currentColor)";
const FOCUS_WIDTH = "var(--vectoys-focus-width, 1px)";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  top: fill(FINISH),
  bottom: fill(FINISH),
  side: fill(FINISH),
  pip: fill(INK),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: `color-mix(in srgb, ${HAIRLINE} 60%, transparent)`, fill: "none" },
};

// The die at rest, and the box round it in the stage, as shares, for the
// button over it: a little wider than the die and up to where it hops.
const REST = seen();
const BOUNDS = (() => {
  const points = REST.drawn.hulls.flatMap((hull) => hull.points);
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];
  const { width, height } = REST.camera;
  const [left, right] = [Math.min(...xs) - 4, Math.max(...xs) + 4];
  const [top, bottom] = [Math.min(...ys) - 12, Math.max(...ys) + 6];
  return { left: left / width, top: top / height, width: (right - left) / width, height: (bottom - top) / height };
})();

const percent = (share: number) => `${fixed(share * 100)}%`;
const BUTTON = "vectoys-dice-button";
const BUTTON_STYLE: CSSProperties = {
  position: "absolute",
  left: percent(BOUNDS.left),
  top: percent(BOUNDS.top),
  width: percent(BOUNDS.width),
  height: percent(BOUNDS.height),
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: "16%",
  background: "transparent",
  cursor: "pointer",
  appearance: "none",
};
const FOCUS_RING = `.${BUTTON}{outline:none}.${BUTTON}:focus-visible{outline:${FOCUS_WIDTH} solid ${FOCUS};outline-offset:2px}`;
// Read out, never seen.
const HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

/** The soft shadow under the die, fainter the higher it hops, under names of its own so any number of dice share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: View["shadow"] }) => (
  <g opacity={fixed(shadow.strength)}>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="0.5 0.35" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="2 1.2" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </g>
);

type DiceProps = {
  /** The face every roll lands on, and a new value rolls to it; random when left out. */
  value?: Value;
  /** Called with the face on top once a roll has landed. */
  onRoll?: (value: Value) => void;
  /** The die's color; by default the page's `--vectoys-finish`, else its surface. */
  finish?: string;
  /** The button's name for assistive technology. */
  label?: string;
  /** Set on the outer box, which holds the die and its full screen button. */
  className?: string;
  style?: CSSProperties;
} & TurnOptions;

// The eye can go all the way round the die, but never under the ground it stands on.
const LIMITS = { yaw: [-Infinity, Infinity], pitch: [-30, 18] } as const;

const random = (): Value => VALUES[Math.floor(Math.random() * VALUES.length)] ?? 1;

/**
 * A die that rolls when clicked, tapped or pressed: it hops, tumbles a few
 * turns, lands on a random or given face, rocks and settles, its shadow
 * following on the ground. The face on top is read out as it lands. A drag
 * turns the eye round it, and a button shows it full screen.
 */
export function Dice({ value, onRoll, finish, label = "Roll the die", limits, ...turning }: DiceProps) {
  const id = `dice-${useId().replace(/[^\w-]/g, "")}`;
  const reduced = useReducedMotion();
  const frames = useFrames();
  const [state, setState] = useState<{ rotation: Rotation; hop: number }>(() => ({ rotation: resting(value ?? 5), hop: 0 }));
  const current = useRef(state);
  // What the live region says: empty while a roll is in the air, so every
  // landing is read out, even on the face it was already on.
  const [said, setSaid] = useState(`Showing ${value ?? 5}`);
  // The face the die is on or rolling to, and whether it is in the air.
  const target = useRef<Value>(value ?? 5);
  const rolling = useRef(false);

  const set = (next: { rotation: Rotation; hop: number }) => {
    current.current = next;
    setState(next);
  };

  const start = (next: Value) => {
    target.current = next;
    const land = () => {
      rolling.current = false;
      setSaid(`Showing ${next}`);
      onRoll?.(next);
    };
    rolling.current = true;
    setSaid("");
    if (reduced) {
      set({ rotation: resting(next), hop: 0 });
      // A frame later, so the live region is empty in between and reads the face out.
      return frames(() => {
        land();
        return false;
      });
    }
    const path = roll(current.current.rotation, next, Math.random() * 360);
    let ms = 0;
    frames((elapsed) => {
      ms += elapsed;
      const at = rollAt(path, ms);
      set({ rotation: at.rotation, hop: at.hop });
      if (at.done) land();
      return !at.done;
    });
  };

  useEffect(() => {
    if (value !== undefined && value !== target.current) start(value);
  }, [value]);

  const click = () => {
    if (!rolling.current) start(value ?? random());
  };

  const overlay = (
    <>
      <style>{FOCUS_RING}</style>
      <button type="button" className={BUTTON} aria-label={label} style={BUTTON_STYLE} onClick={click} data-vectoys-grab="" />
      <span aria-live="polite" style={HIDDEN}>{said}</span>
    </>
  );

  return (
    <Turntable mode="camera" label="die" limits={{ ...LIMITS, ...limits }} {...turning}>
      {(turn) => {
        const view = seen(state.rotation, state.hop, turn);
        const die = view.drawn.hulls.find((hull) => hull.part === "die");
        return (
          <div style={{ position: "relative", touchAction: "manipulation" }}>
            <Stage camera={view.camera} overlay={overlay} style={finish ? { "--vectoys-finish": finish } : {}}>
              <Shadow id={id} shadow={view.shadow} />
              <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
              {die && <path d={die.d} {...OUTLINE} />}
            </Stage>
          </div>
        );
      }}
    </Turntable>
  );
}
