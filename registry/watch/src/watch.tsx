import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, type Look, type StyleWithVariables, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { DISPLAY, DISPLAY_ROUND, TURN, seen, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables, each with a light tone so the watch
// shows as meant before they are set. The finish is the case's, the band
// color the straps'.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;
const BAND = `var(--vectoys-band, color-mix(in srgb, ${SURFACE} 70%, ${HAIRLINE}))`;

// The case in the finish, its crown and button a step darker, a black glass
// front, a dark sensor on the back and the straps in the band color.
const CASE = `color-mix(in srgb, ${FINISH} 88%, ${HAIRLINE})`;
const CROWN = `color-mix(in srgb, ${FINISH} 70%, ${HAIRLINE})`;
const SENSOR = `color-mix(in srgb, ${HAIRLINE} 25%, black)`;
const GLASS = "#0d0d0d";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(BAND),
  top: fill(BAND),
  bottom: fill(BAND),
  "case.side": fill(CASE),
  "case.top": fill(GLASS),
  "case.bottom": fill(CASE),
  "crown.side": fill(CROWN),
  "crown.top": fill(CROWN),
  "button.side": fill(CROWN),
  "button.top": fill(CROWN),
  "sensor.side": fill(SENSOR),
  "sensor.top": fill(SENSOR),
  face: fill(CASE),
  glass: fill(GLASS),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the content lays out across, as on a real watch. */
export const VIEWPORT = 198;

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

/** The soft shadow under the watch, under names of its own so any number of watches share a page. */
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

type WatchProps = Turn &
  TurnOptions & {
    /** The case's color; by default the page's `--vectoys-finish`, else its surface. */
    finish?: string;
    /** The band's color; by default the page's `--vectoys-band`, else a shade under its surface. */
    band?: string;
    /** The device's name for assistive technology. */
    label?: string;
    /** Live content on the display, laid out as on a screen `VIEWPORT` pixels wide. */
    children?: ReactNode;
  };

/** The watch drawn at one turn, under the shadow's names `id`. */
const Drawn = memo(function Drawn({ id, yaw, pitch, roll, finish, band, children, label }: Required<Turn> & { id: string; finish: string | undefined; band: string | undefined; label: string; children: ReactNode }) {
  const view = useMemo(() => seen({ yaw, pitch, roll }), [yaw, pitch, roll]);
  const body = view.drawn.hulls.find((hull) => hull.part === "case");
  const colours: StyleWithVariables = { ...(finish && { "--vectoys-finish": finish }), ...(band && { "--vectoys-band": band }) };

  const display = (
    <Screen camera={view.camera} pose={view.glass} rect={DISPLAY} width={VIEWPORT} style={DISPLAY_STYLE}>
      <div style={FILL}>{children}</div>
    </Screen>
  );

  // Empty, the device is a picture; with live content it is a group, so its
  // links and buttons stay reachable inside it.
  return (
    <Stage role={children == null ? "img" : "group"} label={label} camera={view.camera} overlay={display} style={colours}>
      {view.shadow && <Shadow id={id} shadow={view.shadow} />}
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      {body && <path d={body.d} {...OUTLINE} />}
    </Stage>
  );
});

/**
 * A smartwatch that turns any way: one SVG drawn from its parts, and live
 * content laid onto its display, hidden while the display faces away. A
 * drag or the arrow keys turn it from the turn it is given, and a button
 * shows it full screen.
 */
export const Watch = memo(function Watch({ yaw = TURN.yaw, pitch = TURN.pitch, roll = TURN.roll, finish, band, children, label = "Smartwatch", ...turning }: WatchProps) {
  const id = `watch-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Turntable mode="camera" label={label} {...turning}>
      {(turn) => (
        <Drawn id={id} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} roll={roll} finish={finish} band={band} label={label}>
          {children}
        </Drawn>
      )}
    </Turntable>
  );
});
