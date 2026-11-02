import { Faces, Screen, Stage, Turntable, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { DISPLAY, TURN, seen, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the
// monitor shows as meant before they are set. The finish is the panel's back
// and the stand's.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;

// Metal edges a step darker than the surface, a black glass front with its
// thin bezel, and the back and the stand in the finish, their sides a shade
// under it.
const FRAME = `color-mix(in srgb, ${SURFACE} 82%, ${HAIRLINE})`;
const BACK = `color-mix(in srgb, ${FINISH} 92%, ${HAIRLINE})`;
const STAND = `color-mix(in srgb, ${FINISH} 86%, ${HAIRLINE})`;
const STAND_SIDE = `color-mix(in srgb, ${FINISH} 72%, ${HAIRLINE})`;
const GLASS = "#0d0d0d";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(STAND_SIDE),
  top: fill(STAND),
  bottom: fill(STAND),
  "panel.side": fill(FRAME),
  "panel.top": fill(GLASS),
  "panel.bottom": fill(BACK),
  glass: fill(GLASS),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the content lays out across, as on a desktop display. */
export const VIEWPORT = 1920;

const DISPLAY_STYLE: CSSProperties = { overflow: "hidden", background: GLASS, containerType: "inline-size" };
const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** The soft shadow under the monitor, under names of its own so any number of monitors share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="190">
        <feGaussianBlur stdDeviation="0.6 0.4" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="190">
        <feGaussianBlur stdDeviation="2.4 1.4" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

type MonitorProps = Turn &
  TurnOptions & {
    /** The color of the back and the stand; by default the page's `--vectoys-finish`, else its surface. */
    finish?: string;
    /** The device's name for assistive technology. */
    label?: string;
    /** Live content on the display, laid out as on a screen `VIEWPORT` pixels wide. */
    children?: ReactNode;
  };

/** The monitor drawn at one turn, under the shadow's names `id`. */
const Drawn = memo(function Drawn({ id, yaw, pitch, tilt, finish, children, label }: Required<Turn> & { id: string; finish: string | undefined; label: string; children: ReactNode }) {
  const view = useMemo(() => seen({ yaw, pitch, tilt }), [yaw, pitch, tilt]);
  const panel = view.drawn.hulls.find((hull) => hull.part === "panel");

  const display = (
    <Screen camera={view.camera} pose={view.glass} rect={DISPLAY} width={VIEWPORT} style={DISPLAY_STYLE}>
      <div style={FILL}>{children}</div>
    </Screen>
  );

  // Empty, the device is a picture; with live content it is a group, so its
  // links and buttons stay reachable inside it.
  return (
    <Stage role={children == null ? "img" : "group"} label={label} camera={view.camera} overlay={display} style={finish ? { "--vectoys-finish": finish } : {}}>
      {view.shadow && <Shadow id={id} shadow={view.shadow} />}
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      {panel && <path d={panel.d} {...OUTLINE} />}
    </Stage>
  );
});

/**
 * A desktop monitor on its stand that turns any way, its panel tilting on
 * the stand: one SVG drawn from its parts, and live content laid onto its
 * display, hidden while the display faces away. A drag or the arrow keys
 * turn it from the turn it is given, and a button shows it full screen.
 */
export const Monitor = memo(function Monitor({ yaw = TURN.yaw, pitch = TURN.pitch, tilt = TURN.tilt, finish, children, label = "Monitor", ...turning }: MonitorProps) {
  const id = `monitor-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Turntable mode="camera" label={label} {...turning}>
      {(turn) => (
        <Drawn id={id} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} tilt={tilt} finish={finish} label={label}>
          {children}
        </Drawn>
      )}
    </Turntable>
  );
});
