import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { DISPLAY_ROUND, TURN, seen, type Orientation, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the tablet
// shows as meant before they are set. The finish is the back's and the bump's.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;

// Metal sides a step darker than the surface, a black glass front, the back
// in the finish, and the bump a shade under it.
const FRAME = `color-mix(in srgb, ${SURFACE} 82%, ${HAIRLINE})`;
const BACK = `color-mix(in srgb, ${FINISH} 92%, ${HAIRLINE})`;
const BUMP_GLASS = `color-mix(in srgb, ${FINISH} 84%, ${HAIRLINE})`;
const BUMP_SIDE = `color-mix(in srgb, ${FINISH} 70%, ${HAIRLINE})`;
const RING = `color-mix(in srgb, ${HAIRLINE} 45%, black)`;
const GLASS = "#0d0d0d";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(FRAME),
  top: fill(FRAME),
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
  // A dark grey dot, just apart from the black glass round it.
  camera: fill(`color-mix(in srgb, ${HAIRLINE} 32%, black)`),
  flash: fill(`color-mix(in srgb, #fff3c4 70%, ${HAIRLINE})`),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the content lays out across the display's short side, as on a real tablet. */
export const VIEWPORT = 834;

const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** The display's look, its corners following the glass's as shares of the display so they hold at any size. */
function displayStyle({ width, height }: { width: number; height: number }): CSSProperties {
  const share = (length: number) => `${fixed((DISPLAY_ROUND / length) * 100)}%`;
  const radius = `${share(width)} / ${share(height)}`;
  return { overflow: "hidden", background: GLASS, borderRadius: radius, clipPath: `inset(0 round ${radius})`, containerType: "inline-size" };
}

/** The soft shadow under the tablet, under names of its own so any number of tablets share a page. */
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

type TabletProps = Turn &
  TurnOptions & {
    /** Upright, or on its side; the content lays out level either way. */
    orientation?: Orientation;
    /** The back's color; by default the page's `--vectoys-finish`, else its surface. */
    finish?: string;
    /** The device's name for assistive technology. */
    label?: string;
    /** Live content on the display, laid out `VIEWPORT` pixels across its short side. */
    children?: ReactNode;
  };

/** The tablet drawn at one turn, under the shadow's names `id`. */
const Drawn = memo(function Drawn({
  id,
  yaw,
  pitch,
  roll,
  orientation,
  finish,
  children,
  label,
}: Required<Turn> & { id: string; orientation: Orientation; finish: string | undefined; label: string; children: ReactNode }) {
  const view = useMemo(() => seen({ yaw, pitch, roll }, orientation), [yaw, pitch, roll, orientation]);
  const body = view.drawn.hulls.find((hull) => hull.part === "body");
  const { pose, rect } = view.display;

  const display = (
    <Screen
      camera={view.camera}
      pose={pose}
      rect={rect}
      width={(VIEWPORT * rect.width) / Math.min(rect.width, rect.height)}
      style={displayStyle(rect)}
    >
      <div style={FILL}>{children}</div>
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
 * A tablet that turns any way: one SVG drawn from its parts, and live content
 * laid onto its display, hidden while the display faces away. A drag or the
 * arrow keys turn it from the turn it is given, and a button shows it full
 * screen.
 */
export const Tablet = memo(function Tablet({
  yaw = TURN.yaw,
  pitch = TURN.pitch,
  roll = TURN.roll,
  orientation = "portrait",
  finish,
  children,
  label = "Tablet",
  ...turning
}: TabletProps) {
  const id = `tablet-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Turntable mode="camera" label={label} {...turning}>
      {(turn) => (
        <Drawn id={id} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} roll={roll} orientation={orientation} finish={finish} label={label}>
          {children}
        </Drawn>
      )}
    </Turntable>
  );
});
