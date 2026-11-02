import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { DISPLAY, DISPLAY_ROUND, TURN, seen, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the phone
// shows as meant before they are set. The finish is the back's and the bump's.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;

// Brushed metal sides a step darker than the surface and the buttons a step
// darker again, a black glass front, the back in the finish, and the bump's
// glass a shade under it.
const FRAME = `color-mix(in srgb, ${SURFACE} 82%, ${HAIRLINE})`;
const BUTTON = `color-mix(in srgb, ${SURFACE} 62%, ${HAIRLINE})`;
const BACK = `color-mix(in srgb, ${FINISH} 92%, ${HAIRLINE})`;
const BUMP_GLASS = `color-mix(in srgb, ${FINISH} 84%, ${HAIRLINE})`;
const BUMP_SIDE = `color-mix(in srgb, ${FINISH} 70%, ${HAIRLINE})`;
const RING = `color-mix(in srgb, ${HAIRLINE} 45%, black)`;
const GLASS = "#0d0d0d";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(FRAME),
  // Only the buttons' faces out are left with the plain top.
  top: fill(BUTTON),
  bottom: fill(FRAME),
  "body.top": fill(GLASS),
  "body.bottom": fill(BACK),
  "bump.top": fill(BUMP_GLASS),
  "bump.side": fill(BUMP_SIDE),
  "lens-0.side": fill(RING),
  "lens-0.top": fill(RING),
  "lens-1.side": fill(RING),
  "lens-1.top": fill(RING),
  glass: fill(GLASS),
  lens: fill(`color-mix(in srgb, ${HAIRLINE} 12%, black)`),
  flash: fill(`color-mix(in srgb, #fff3c4 70%, ${HAIRLINE})`),
  mic: fill(`color-mix(in srgb, ${HAIRLINE} 50%, black)`),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

// The display's corners follow the glass's, as shares of the display so they
// hold at any size the content lays out at.
const ACROSS = `${fixed((DISPLAY_ROUND / DISPLAY.width) * 100)}%`;
const DOWN = `${fixed((DISPLAY_ROUND / DISPLAY.height) * 100)}%`;
const DISPLAY_STYLE: CSSProperties = {
  overflow: "hidden",
  background: GLASS,
  borderRadius: `${ACROSS} / ${DOWN}`,
  clipPath: `inset(0 round ${ACROSS} / ${DOWN})`,
  containerType: "inline-size",
};
const FILL: CSSProperties = { position: "absolute", inset: 0 };
// The front camera's pill, as a share of the display's width.
const PILL: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "2.8cqw",
  width: "32cqw",
  height: "9.4cqw",
  transform: "translateX(-50%)",
  borderRadius: "4.7cqw",
  background: "black",
};

/** CSS pixels the content lays out across, as on a real phone. */
export const VIEWPORT = 393;

/** The soft shadow under the phone, under names of its own so any number of phones share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="0.6 0.4" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="2.4 1.4" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

type PhoneProps = Turn &
  TurnOptions & {
    /** The back's color; by default the page's `--vectoys-finish`, else its surface. */
    finish?: string;
    /** The device's name for assistive technology. */
    label?: string;
    /** Live content on the display, laid out as on a screen `VIEWPORT` pixels wide. */
    children?: ReactNode;
  };

/** The phone drawn at one turn, under the shadow's names `id`. */
const Drawn = memo(function Drawn({ id, yaw, pitch, roll, finish, children, label }: Required<Turn> & { id: string; label: string; finish: string | undefined; children: ReactNode }) {
  const view = useMemo(() => seen({ yaw, pitch, roll }), [yaw, pitch, roll]);
  const body = view.drawn.hulls.find((hull) => hull.part === "body");

  const display = (
    <Screen camera={view.camera} pose={view.glass} rect={DISPLAY} width={VIEWPORT} style={DISPLAY_STYLE}>
      <div style={FILL}>{children}</div>
      <div style={PILL} />
    </Screen>
  );

  // Empty, the device is a picture; with live content it is a group, so its
  // links and buttons stay reachable inside it.
  return (
    <Stage role={children == null ? "img" : "group"} label={label} camera={view.camera} overlay={display} style={finish ? { "--vectoys-finish": finish } : {}}>
      {view.shadow && <Shadow id={id} shadow={view.shadow} />}
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      {body && <path d={body.d} {...OUTLINE} />}
    </Stage>
  );
});

/**
 * A phone that turns any way: one SVG drawn from its parts, and live content
 * laid onto its display, hidden while the display faces away. A drag or the
 * arrow keys turn it from the turn it is given, and a button shows it full
 * screen.
 */
export const Phone = memo(function Phone({ yaw = TURN.yaw, pitch = TURN.pitch, roll = TURN.roll, finish, children, label = "Phone", ...turning }: PhoneProps) {
  const id = `phone-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Turntable mode="camera" label={label} {...turning}>
      {(turn) => (
        <Drawn id={id} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} roll={roll} finish={finish} label={label}>
          {children}
        </Drawn>
      )}
    </Turntable>
  );
});
