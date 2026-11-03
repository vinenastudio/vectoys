import { Faces, Stage, Turntable, type Look, type StyleWithVariables, type TurnOptions } from "@vinena/vectoys-react";
import { useMemo, type CSSProperties } from "react";
import { TILT, seen } from "./geometry";

// The page's colors, as CSS variables, each with a tone so the item shows as
// meant before they are set.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const FINISH = "var(--vectoys-finish, #5b7cfa)";

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  top: fill(FINISH),
  bottom: fill(FINISH),
  side: fill(FINISH),
  face: fill(SURFACE),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

// A drag, a finger or the arrow keys turn the item, and a button shows it
// full screen: props draggable, fullscreen, limits and release tune them.
export type SpinTopProps = TurnOptions & {
  /** What the item shows, for assistive technology. */
  label?: string;
  /** The slab's color; by default the page's `--vectoys-finish`. */
  finish?: string;
  /** How far it turns about its up axis, in degrees. */
  yaw?: number;
  /** How far it tips toward or away from the eye, in degrees. */
  pitch?: number;
  className?: string;
  style?: CSSProperties;
};

/** The slab drawn at one turn. */
function Drawn({ label, finish, yaw, pitch }: { label: string; finish: string | undefined; yaw: number; pitch: number }) {
  const view = useMemo(() => seen(yaw, pitch), [yaw, pitch]);
  const body = view.drawn.hulls.find((hull) => hull.part === "body");
  const vars: StyleWithVariables = finish ? { "--vectoys-finish": finish } : {};
  return (
    <div role="img" aria-label={label}>
      <Stage camera={view.camera} style={vars}>
        <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
        {body && <path d={body.d} {...OUTLINE} />}
      </Stage>
    </div>
  );
}

/** Spin top: a slab tilted toward the eye, drawn the same on the server and the client. */
export function SpinTop({ label = "Spin top", finish, yaw = TILT.yaw, pitch = TILT.pitch, ...rest }: SpinTopProps) {
  // Camera mode adds the turn to the slab's own, so it turns in 3D; a flat item uses mode="tilt".
  // The rest, className, style and the turn options, go to the Turntable.
  return (
    <Turntable mode="camera" label={label} {...rest}>
      {(turn) => <Drawn label={label} finish={finish} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} />}
    </Turntable>
  );
}

/** How the vectoys.com gallery shows the item on its card, with no props. Change it to show the item at its best. */
export const Demo = () => <SpinTop />;
