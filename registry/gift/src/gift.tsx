import { fixed, settled, spring, type Spring } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, useFrames, useReducedMotion, type Look, type StyleWithVariables, type TurnOptions } from "@vinena/vectoys-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SURPRISE, seen, type View } from "./geometry";

// The page's colors, as CSS variables, each with a tone so the gift shows as
// meant before they are set: a box in the finish tied with a ribbon in the
// accent, and a surprise card in the surface.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = "var(--vectoys-finish, #e5484d)";
const ACCENT = "var(--vectoys-accent, #f5c84c)";
const FOCUS = "var(--vectoys-focus, currentColor)";
const FOCUS_WIDTH = "var(--vectoys-focus-width, 1px)";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  top: fill(FINISH),
  bottom: fill(FINISH),
  side: fill(FINISH),
  inside: fill(`color-mix(in srgb, ${FINISH} 45%, black)`),
  ribbon: fill(ACCENT),
  "loop-left.side": fill(ACCENT),
  "loop-left.top": fill(ACCENT),
  "loop-left.bottom": fill(ACCENT),
  "loop-right.side": fill(ACCENT),
  "loop-right.top": fill(ACCENT),
  "loop-right.bottom": fill(ACCENT),
  "knot.side": fill(ACCENT),
  "knot.top": fill(ACCENT),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: `color-mix(in srgb, ${HAIRLINE} 50%, transparent)`, fill: "none" },
};

/** CSS pixels the surprise lays out across, as a coupon on a page. */
export const VIEWPORT = 280;

const SURPRISE_STYLE: CSSProperties = {
  overflow: "hidden",
  borderRadius: "6% / 9.5%",
  background: SURFACE,
  boxShadow: `0 0 0 1px color-mix(in srgb, ${HAIRLINE} 40%, transparent)`,
  containerType: "inline-size",
};

// How long the lid takes to come off, and the spring it peeks on under a pointer.
const OPEN_MS = 1100;
const PEEK_SPRING = { stiffness: 300, damping: 14 };

/** The closed gift, and the box round it in the stage, as shares, for the button over it. */
const REST = seen();
const BOUNDS = (() => {
  const points = REST.drawn.hulls.flatMap((hull) => hull.points);
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];
  const { width, height } = REST.camera;
  const [left, right, top, bottom] = [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...ys) - 2, Math.max(...ys) + 2];
  return { left: left / width, top: top / height, width: (right - left) / width, height: (bottom - top) / height };
})();

const percent = (share: number) => `${fixed(share * 100)}%`;
const BUTTON = "vectoys-gift-button";
const BUTTON_STYLE: CSSProperties = {
  position: "absolute",
  left: percent(BOUNDS.left),
  top: percent(BOUNDS.top),
  width: percent(BOUNDS.width),
  height: percent(BOUNDS.height),
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: "8%",
  background: "transparent",
  cursor: "pointer",
  appearance: "none",
};
const FOCUS_RING = `.${BUTTON}{outline:none}.${BUTTON}:focus-visible{outline:${FOCUS_WIDTH} solid ${FOCUS};outline-offset:2px}`;

// The box with its ribbon, the lid, and the ribbon and bow on the lid, each
// drawn in turn with the box's and the lid's outlines between them. The lid
// always stands over the box's top, so it is never behind it.
const onBox = (part: string) => part === "box" || part === "inside" || part.startsWith("box-ribbon");
const isLid = (part: string) => part === "lid";
const overLid = (part: string) => !onBox(part) && !isLid(part);

/** The soft shadow under the box, under names of its own so any number of gifts share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: View["shadow"] }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="210">
        <feGaussianBlur stdDeviation="0.6 0.4" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="210">
        <feGaussianBlur stdDeviation="2.6 1.4" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

type GiftProps = {
  /** The surprise that rises out once the lid is off, laid out `VIEWPORT` pixels across, such as a coupon code. */
  children?: ReactNode;
  /** Whether the lid is off; leave it out for the gift to keep its own state. */
  open?: boolean;
  /** Whether the gift starts open when it keeps its own state. */
  defaultOpen?: boolean;
  /** Called with the state the gift asks to be in. */
  onOpenChange?: (open: boolean) => void;
  /** The box's color; by default the page's `--vectoys-finish`. */
  finish?: string;
  /** The ribbon's color; by default the page's `--vectoys-accent`. */
  ribbon?: string;
  /** The button's name for assistive technology. */
  label?: string;
  /** Set on the outer box, which holds the gift and its full screen button. */
  className?: string;
  style?: CSSProperties;
} & TurnOptions;

// The eye stays above the box, so the lid always draws over it, and in front of the surprise.
const LIMITS = { yaw: [-40, 40], pitch: [-20, 14] } as const;

/**
 * A gift box tied with a ribbon and a bow. A click, a tap or a key pops the
 * lid up and off, and the surprise rises out of the box; again, and it all
 * goes back. Under a pointer the lid peeks up a little. A drag turns the
 * eye round it, and a button shows it full screen.
 */
export function Gift({ children, open, defaultOpen = false, onOpenChange, finish, ribbon, label = "Open the gift", limits, ...turning }: GiftProps) {
  const id = `gift-${useId().replace(/[^\w-]/g, "")}`;
  const reduced = useReducedMotion();
  const frames = useFrames();
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;

  const progress = useRef(isOpen ? 1 : 0);
  const peek = useRef<Spring>({ value: 0, velocity: 0 });
  const hovered = useRef(false);
  const [state, setState] = useState({ open: progress.current, peek: 0 });

  /** Runs the lid toward open or shut at an even pace, and its peek on a spring. */
  const run = () => {
    const to = isOpen ? 1 : 0;
    const lift = hovered.current && !isOpen ? 1 : 0;
    if (reduced) {
      progress.current = to;
      peek.current = { value: 0, velocity: 0 };
      setState({ open: to, peek: 0 });
      return;
    }
    frames((elapsed) => {
      const step = elapsed / OPEN_MS;
      progress.current = to > progress.current ? Math.min(to, progress.current + step) : Math.max(to, progress.current - step);
      peek.current = spring(peek.current, lift, elapsed / 1000, PEEK_SPRING);
      setState({ open: progress.current, peek: peek.current.value });
      return progress.current !== to || !settled(peek.current, lift);
    });
  };

  useEffect(run, [isOpen, reduced]);

  const toggle = () => {
    if (open === undefined) setOwn(!isOpen);
    onOpenChange?.(!isOpen);
  };

  const hover = (over: boolean) => {
    hovered.current = over;
    run();
  };

  const surpriseId = `${id}-surprise`;
  const vars: StyleWithVariables = { ...(finish && { "--vectoys-finish": finish }), ...(ribbon && { "--vectoys-accent": ribbon }) };

  /** The gift with the eye moved `turn` degrees round it. */
  const drawn = (turn: { yaw: number; pitch: number }) => {
    const view = seen(state.open, state.peek, turn);
    const hidden = view.surprise.shown === 0;

    const overlay = (
      <>
        <style>{FOCUS_RING}</style>
        <button
          type="button"
          className={BUTTON}
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={surpriseId}
          style={BUTTON_STYLE}
          onClick={toggle}
          onPointerEnter={(event) => event.pointerType === "mouse" && hover(true)}
          onPointerLeave={() => hover(false)}
          data-vectoys-grab=""
        />
        <Screen
          camera={view.camera}
          pose={view.surprise.pose}
          rect={SURPRISE}
          width={VIEWPORT}
          style={{ ...SURPRISE_STYLE, clipPath: `inset(0 0 ${fixed((1 - view.surprise.shown) * 100)}% 0)` }}
        >
          <div id={surpriseId} aria-hidden={!isOpen} inert={!isOpen} style={{ position: "absolute", inset: 0, opacity: hidden ? 0 : 1 }}>
            {children}
          </div>
        </Screen>
      </>
    );

    const layer = (has: (part: string) => boolean) => ({
      faces: view.drawn.faces.filter((face) => has(face.part)),
      hulls: view.drawn.hulls.filter((hull) => has(hull.part)),
    });
    const outline = (part: string) => {
      const hull = view.drawn.hulls.find((hull) => hull.part === part);
      return hull && <path d={hull.d} {...OUTLINE} />;
    };

    return (
      <div style={{ position: "relative", touchAction: "manipulation" }}>
        <Stage camera={view.camera} overlay={overlay} style={vars}>
          <Shadow id={id} shadow={view.shadow} />
          <Faces {...layer(onBox)} styles={STYLES} shading />
          {outline("box")}
          <Faces {...layer(isLid)} styles={STYLES} shading />
          {outline("lid")}
          <Faces {...layer(overLid)} styles={STYLES} shading />
        </Stage>
      </div>
    );
  };

  return (
    <Turntable mode="camera" label="gift" limits={{ ...LIMITS, ...limits }} {...turning}>
      {drawn}
    </Turntable>
  );
}
