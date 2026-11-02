import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { ADDRESS, ADDRESS_VIEWPORT, PAGE, PAGE_ROUND, TURN, seen, type Place, type Turn, type View } from "./geometry";

// The page's colors, as CSS variables. Each falls back to a tone for light
// and one for dark, picked by the color scheme the window is in, so it
// follows a page that sets `color-scheme: light dark` with nothing else set.
const BG = "var(--vectoys-bg, light-dark(#ffffff, #161616))";
const SURFACE = "var(--vectoys-surface, light-dark(#f5f5f5, #262626))";
const HAIRLINE = "var(--vectoys-hairline, light-dark(#8a8a8a, #5a5a5a))";
const INK = "var(--vectoys-ink, light-dark(#1d1d1c, #ededed))";
const SHADOW = "var(--vectoys-shadow, light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4)))";

// The bar in the surface, the edges and the back a step toward the
// hairline, the pill a step darker than the bar and the dots a quiet grey.
const FRAME = `color-mix(in srgb, ${SURFACE} 78%, ${HAIRLINE})`;
const BACK = `color-mix(in srgb, ${SURFACE} 90%, ${HAIRLINE})`;
const PILL = `color-mix(in srgb, ${SURFACE} 86%, ${HAIRLINE})`;
const DOT = `color-mix(in srgb, ${HAIRLINE} 55%, ${SURFACE})`;

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(FRAME),
  top: fill(BG),
  bottom: fill(BACK),
  bar: fill(SURFACE),
  dot: fill(DOT),
  pill: fill(PILL),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the page lays out across, as in a laptop's browser. */
export const VIEWPORT = 1280;

const share = (length: number) => `${fixed((PAGE_ROUND / length) * 100)}%`;
const [ACROSS, DOWN] = [share(PAGE.width), share(PAGE.height)];
const PAGE_STYLE: CSSProperties = {
  overflow: "hidden",
  background: BG,
  color: INK,
  // Only the bottom corners are the window's; the top runs under the bar.
  borderRadius: `0 0 ${ACROSS} ${ACROSS} / 0 0 ${DOWN} ${DOWN}`,
  clipPath: `inset(0 round 0 0 ${ACROSS} ${ACROSS} / 0 0 ${DOWN} ${DOWN})`,
  containerType: "inline-size",
};
const FILL: CSSProperties = { position: "absolute", inset: 0 };
// The address, laid out as in a real bar: 13 pixels in a pill 28 tall.
const ADDRESS_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  font: "13px/1 system-ui, sans-serif",
  color: `color-mix(in srgb, ${INK} 62%, ${SURFACE})`,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** The soft shadow under the window, under names of its own so any number of windows share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="180">
        <feGaussianBlur stdDeviation="0.8 0.5" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="180">
        <feGaussianBlur stdDeviation="3 1.6" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

type BrowserProps = Turn &
  Place &
  TurnOptions & {
    /** The address shown in the bar. */
    url?: string;
    /** Light or dark tones for what the page's variables leave unset; by default the page's color scheme. */
    theme?: "light" | "dark";
    /** The shadow on the ground under the window; a stack wants it under the back window only. */
    shadow?: boolean;
    /** Live content on the page, laid out as in a window `VIEWPORT` pixels wide. */
    children?: ReactNode;
    /** The window's name for assistive technology. */
    label?: string;
  };

/** The window drawn at one turn, under the shadow's names `id`. */
const Drawn = memo(function Drawn({
  id,
  yaw,
  pitch,
  roll,
  depth,
  x,
  y,
  url,
  theme,
  shadow,
  children,
  label,
}: Required<Turn> & { id: string; depth: number; x: number; y: number; url: string; theme: BrowserProps["theme"]; shadow: boolean; children: ReactNode; label: string }) {
  const view = useMemo(() => seen({ yaw, pitch, roll }, { depth, offset: [x, y] }), [yaw, pitch, roll, depth, x, y]);
  const hull = view.drawn.hulls.find((part) => part.part === "window");

  const overlay = (
    <>
      <Screen camera={view.camera} pose={view.window} rect={PAGE} width={VIEWPORT} style={PAGE_STYLE}>
        <div style={FILL}>{children}</div>
      </Screen>
      <Screen camera={view.camera} pose={view.window} rect={ADDRESS} width={ADDRESS_VIEWPORT} style={ADDRESS_STYLE}>
        {url}
      </Screen>
    </>
  );

  // Empty, the window is a picture; with live content it is a group, so its
  // links and buttons stay reachable inside it.
  return (
    <Stage role={children == null ? "img" : "group"} label={label} camera={view.camera} overlay={overlay} style={theme ? { colorScheme: theme } : {}}>
      {shadow && view.shadow && <Shadow id={id} shadow={view.shadow} />}
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      {hull && <path d={hull.d} {...OUTLINE} />}
    </Stage>
  );
});

/**
 * A browser window that floats and turns any way: one SVG drawn from its
 * parts, with the address and live content laid onto it, hidden while its
 * face turns away. A drag or the arrow keys turn it from the turn it is
 * given, and a button shows it full screen.
 *
 * To stack windows, lay several over each other in one box, each
 * `position: absolute; inset: 0`, with the same turn, the back one first and
 * deepest: say `depth={160} offset={[-120, -80]}`, then `depth={80}
 * offset={[-60, -40]}`, then the front one, with `shadow={false}` on all but
 * the back one. They then stand in one space and turn together. Only the
 * front one hears a drag, so give each `draggable={false}` and
 * `fullscreen={false}` and turn the stack by its `yaw` and `pitch`.
 */
export const Browser = memo(function Browser({
  yaw = TURN.yaw,
  pitch = TURN.pitch,
  roll = TURN.roll,
  depth = 0,
  offset,
  url = "example.com",
  theme,
  shadow = true,
  children,
  label = "Browser window",
  ...turning
}: BrowserProps) {
  const id = `browser-${useId().replace(/[^\w-]/g, "")}`;
  const [x = 0, y = 0] = offset ?? [];
  return (
    <Turntable mode="camera" label={label} {...turning}>
      {(turn) => (
        <Drawn id={id} yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} roll={roll} depth={depth} x={x} y={y} url={url} theme={theme} shadow={shadow} label={label}>
          {children}
        </Drawn>
      )}
    </Turntable>
  );
});
