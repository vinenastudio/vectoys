import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, useSpring, type Look, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { FACE, LABEL, seen, type View } from "./geometry";

// The page's colors, as CSS variables, each with a tone so the disk shows as
// meant before they are set. The plastic is the finish, dark by default as
// the disks were; the label stays paper on a dark page too, as a real one does.
const HAIRLINE = "var(--vectoys-hairline, #8a8a8a)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const PLASTIC = "var(--vectoys-finish, #2c2c2e)";
const PAPER = "var(--vectoys-paper, #f7f6f1)";
const PAPER_INK = "var(--vectoys-paper-ink, #1d1d1c)";

const RECESS = `color-mix(in srgb, ${PLASTIC} 88%, black)`;
// The shutter is bare metal, light on any page.
const METAL = `color-mix(in srgb, #dcdcd8 80%, ${HAIRLINE})`;
const MEDIA = "color-mix(in srgb, #5c4630 85%, black)";
const HOLE = `color-mix(in srgb, ${PLASTIC} 30%, black)`;
const BAND = `color-mix(in srgb, ${PAPER} 82%, ${HAIRLINE})`;

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(PLASTIC),
  top: fill(PLASTIC),
  bottom: fill(PLASTIC),
  recess: fill(RECESS),
  opening: fill(MEDIA),
  shutter: fill(METAL),
  label: fill(PAPER),
  band: fill(BAND),
  hole: fill(HOLE),
  tab: fill(PLASTIC),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the disk's face lays out across, so the label's text lays out about 230 pixels wide. */
export const FACE_WIDTH = 300;

// The label as shares of the face, for placing the text on it inside the link.
const share = (value: number, whole: number) => `${fixed((value / whole) * 100)}%`;
const LABEL_TEXT: CSSProperties = {
  position: "absolute",
  left: share(LABEL.x - FACE.x, FACE.width),
  top: share(LABEL.y - FACE.y + LABEL.height * 0.14, FACE.height),
  width: share(LABEL.width, FACE.width),
  height: share(LABEL.height * 0.86, FACE.height),
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  color: PAPER_INK,
  fontSize: 26,
  fontWeight: 500,
  lineHeight: 1.2,
  textAlign: "center",
  overflowWrap: "anywhere",
};
const FACE_STYLE: CSSProperties = {
  appearance: "none",
  position: "relative",
  display: "block",
  width: "100%",
  height: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: 2,
  background: "transparent",
  font: "inherit",
  textDecoration: "none",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

/** The soft shadow under the disk, under names of its own so any number of disks share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: NonNullable<View["shadow"]> }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="0.8 0.5" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="3 1.6" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

// A button is pressed by Enter and Space, a link by Enter alone.
const BUTTON_KEYS = new Set([" ", "Enter"]);
const LINK_KEYS = new Set(["Enter"]);

// A pointer that moves this far while held is turning the disk, not pressing it.
const DRAG_FROM = 4;

/** Whether the disk is under the pointer or the keyboard's focus, and whether it is held down by `keys`; with `drag`, a pointer that moves lets it go. */
function usePointing(keys: ReadonlySet<string>, drag: boolean) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [held, setHeld] = useState(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  const handlers = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => (setHover(false), setHeld(false)),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      from.current = { x: event.clientX, y: event.clientY };
      setHeld(true);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (drag && from.current && Math.hypot(event.clientX - from.current.x, event.clientY - from.current.y) >= DRAG_FROM) {
        from.current = null;
        setHeld(false);
      }
    },
    onPointerUp: () => setHeld(false),
    onPointerCancel: () => setHeld(false),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => keys.has(event.key) && setHeld(true),
    onKeyUp: (event: KeyboardEvent<HTMLElement>) => keys.has(event.key) && setHeld(false),
    onFocus: (event: { currentTarget: HTMLElement }) => setFocus(event.currentTarget.matches(":focus-visible")),
    onBlur: () => (setFocus(false), setHeld(false)),
  };
  return { raised: hover || focus, held, handlers };
}

export type FloppyProps = {
  /** The label's text, live HTML laid out about 230 pixels wide; it names the link or button too. */
  children?: ReactNode;
  /** A file to download: the disk is then a link to it. */
  href?: string;
  /** The name to save the file under, or true to keep the link's own; true by default with `href`. */
  download?: string | boolean;
  /** Called when the disk is pressed, by pointer, touch or keyboard. */
  onPress?: () => void;
  /** An accessible name in place of the label's text, such as "Download the press kit"; "Floppy disk" when there is no text. */
  label?: string;
  /** The plastic's color; by default the page's `--vectoys-finish`, else near black. */
  finish?: string;
} & TurnOptions;

// Turned no further than the label stays in view.
const LIMITS = { yaw: [-40, 40], pitch: [-20, 20] } as const;

/**
 * A 3.5 inch floppy disk as a download button: with `href` a real link that
 * downloads the file, without one a real button. Under the pointer or the
 * keyboard's focus its shutter slides open and it turns a little toward
 * the eye; pressed, it dips back. Under reduced motion it changes without
 * the motion. A drag turns the eye round it, and a button shows it full
 * screen.
 */
export const Floppy = memo(function Floppy({ children, href, download = true, onPress, label, finish, limits, ...turning }: FloppyProps) {
  const id = `floppy-${useId().replace(/[^\w-]/g, "")}`;
  const { raised, held, handlers } = usePointing(href ? LINK_KEYS : BUTTON_KEYS, turning.draggable !== false);
  const hover = Math.max(0, Math.min(1, useSpring(raised ? 1 : 0, { stiffness: 260, damping: 26 })));
  const press = Math.max(0, useSpring(held ? 1 : 0));
  const text = <span style={LABEL_TEXT}>{children}</span>;
  const common = { ...handlers, "aria-label": label ?? (children == null ? "Floppy disk" : undefined), onClick: onPress, "data-pressed": held || undefined, "data-vectoys-grab": "", style: FACE_STYLE };
  const face = href ? (
    <a href={href} download={download === true ? "" : download || undefined} {...common}>
      {text}
    </a>
  ) : (
    <button type="button" {...common}>
      {text}
    </button>
  );

  return (
    <Turntable mode="camera" label="floppy disk" limits={{ ...LIMITS, ...limits }} {...turning}>
      {(turn) => {
        const view = seen(hover, press, turn);
        const body = view.drawn.hulls.find((hull) => hull.part === "body");
        return (
          <Stage
            camera={view.camera}
            overlay={
              <Screen camera={view.camera} pose={view.body} rect={FACE} width={FACE_WIDTH}>
                {face}
              </Screen>
            }
            style={finish ? { "--vectoys-finish": finish } : {}}
          >
            {view.shadow && <Shadow id={id} shadow={view.shadow} />}
            <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
            {body && <path d={body.d} {...OUTLINE} />}
          </Stage>
        );
      }}
    </Turntable>
  );
});
