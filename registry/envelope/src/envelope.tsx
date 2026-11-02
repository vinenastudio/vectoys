import { Faces, Screen, Stage, Turntable, useSpring, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { CARD, FRONT, seen, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the
// envelope shows as meant before they are set. The outside is the surface,
// the lining inside the finish and the card the page's own background.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const BG = "var(--vectoys-bg, #ffffff)";
const LINING = `var(--vectoys-finish, color-mix(in srgb, ${SURFACE} 80%, ${HAIRLINE}))`;

const EDGE = `color-mix(in srgb, ${HAIRLINE} 55%, transparent)`;
// Paper shows its folds by a fine line along every sheet's edge.
const sheet = (fill: string): Look => ({
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 0.75,
  strokeLinejoin: "round",
  style: { fill, stroke: EDGE },
});
const STYLES: Record<string, Look> = {
  side: sheet(`color-mix(in srgb, ${SURFACE} 80%, ${HAIRLINE})`),
  "back.top": sheet(LINING),
  "back.bottom": sheet(SURFACE),
  "flap.top": sheet(SURFACE),
  "flap.bottom": sheet(LINING),
  "card.top": sheet(BG),
  "card.bottom": sheet(BG),
  "pocket-left.pocket": sheet(`color-mix(in srgb, ${SURFACE} 94%, ${HAIRLINE})`),
  "pocket-right.pocket": sheet(`color-mix(in srgb, ${SURFACE} 94%, ${HAIRLINE})`),
  "pocket-bottom.pocket": sheet(SURFACE),
};

/** CSS pixels the letter's content lays out across. */
export const LETTER_WIDTH = 360;

// How far the flap lifts under the pointer, as a share of the opening.
const PEEK = 0.07;
// Critically damped, so the flap settles without swinging back.
const SPRING = { stiffness: 90, damping: 19 } as const;

const OPENER: CSSProperties = {
  appearance: "none",
  display: "block",
  width: "100%",
  height: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};
const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** The soft shadow under the envelope, under names of its own so any number of envelopes share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="220">
        <feGaussianBlur stdDeviation="0.8 0.5" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="220">
        <feGaussianBlur stdDeviation="3 1.6" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

export type EnvelopeProps = {
  /**
   * How far open, from 0 (shut) to 1 (the letter out), drawn as given, for a
   * page that drives it itself, such as from scrolling. Leave it out and the
   * envelope opens itself when clicked or reached with the keyboard.
   */
  open?: number;
  /** Whether it starts open, when `open` is left out. */
  defaultOpen?: boolean;
  /** Called with the state a click or keyboard focus asks for. */
  onOpenChange?: (open: boolean) => void;
  /** The opener's accessible name. */
  label?: string;
  /** The lining's color; by default the page's `--vectoys-finish`. */
  finish?: string;
  /** Live content on the letter, such as a sign up form, laid out `LETTER_WIDTH` pixels across. */
  children?: ReactNode;
} & TurnOptions;

/** Whether it is open and how far, either as the page says or as its own spring has it. */
function useOpening(open: number | undefined, defaultOpen: boolean, onOpenChange?: (open: boolean) => void) {
  const [own, setOwn] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const sprung = useSpring(own ? 1 : hover ? PEEK : 0, SPRING);
  const controlled = open !== undefined;
  const isOpen = controlled ? open >= 0.5 : own;
  const ask = (next: boolean) => {
    if (!controlled) setOwn(next);
    onOpenChange?.(next);
  };
  return { amount: controlled ? open : sprung, isOpen, ask, setHover };
}

/**
 * A newsletter envelope: one SVG of paper sheets and live content on the
 * card inside. A real button over the envelope opens it on a click, or as
 * soon as the keyboard reaches it; the flap swings up behind the card and
 * the card rises out, its content clipped to what shows over the pocket.
 * Under reduced motion it opens without the motion. A drag tilts it, and a
 * button shows it full screen.
 */
export const Envelope = memo(function Envelope({ open, defaultOpen = false, onOpenChange, label = "Open the letter", finish, children, ...turning }: EnvelopeProps) {
  const id = `envelope-${useId().replace(/[^\w-]/g, "")}`;
  const { amount, isOpen, ask, setHover } = useOpening(open, defaultOpen, onOpenChange);
  const view = useMemo(() => seen(amount), [amount]);
  // The letter's content is live only once the flap has swung past upright and left it uncovered.
  // Until then its box is clipped to nothing, so it takes no clicks meant for the opener under it.
  const out = view.flap > 90;

  const focus = (event: FocusEvent<HTMLButtonElement>) => {
    if (!isOpen && event.currentTarget.matches(":focus-visible")) ask(true);
  };

  const overlay = (
    <>
      <Screen camera={view.camera} pose={view.back} rect={FRONT} width={LETTER_WIDTH}>
        <button
          type="button"
          aria-label={label}
          aria-expanded={isOpen}
          onClick={() => ask(!isOpen)}
          onFocus={focus}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          data-vectoys-grab=""
          style={OPENER}
        />
      </Screen>
      <Screen camera={view.camera} pose={view.card} rect={CARD} width={LETTER_WIDTH} style={{ clipPath: out ? view.clip : "inset(50%)" }}>
        <div inert={!out} style={{ ...FILL, visibility: out ? "visible" : "hidden" }}>
          {children}
        </div>
      </Screen>
    </>
  );

  // Tilted, not turned: the card's clip is worked out for this one eye.
  return (
    <Turntable mode="tilt" label="envelope" {...turning}>
      <Stage camera={view.camera} overlay={overlay} style={finish ? { "--vectoys-finish": finish } : {}}>
        {view.shadow && <Shadow id={id} shadow={view.shadow} />}
        <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      </Stage>
    </Turntable>
  );
});
