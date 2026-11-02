import { fixed } from "@vinena/vectoys";
import { Faces, Screen, Stage, Turntable, useSpring, type Look, type TurnOptions } from "@vinena/vectoys-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { HOVER, LABEL, LABEL_ROUND, TRAVEL, seen, type View } from "./geometry";
import { clicks, type Clicks } from "./sound";

// The page's colors, as CSS variables. Each falls back to a tone for light
// and one for dark, picked by the page's color scheme, so the key reads on
// a dark page with nothing set. The cap is in the finish, the label in the
// ink.
const HAIRLINE = "var(--vectoys-hairline, light-dark(#8a8a8a, #5a5a5a))";
const SURFACE = "var(--vectoys-surface, light-dark(#f5f5f5, #262626))";
const SHADOW = "var(--vectoys-shadow, light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4)))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;
const INK = "var(--vectoys-ink, light-dark(#1d1d1c, #ededed))";
const FOCUS = "var(--vectoys-focus, currentColor)";
const FOCUS_WIDTH = "var(--vectoys-focus-width, 1px)";

// The cap's sides a step under its top and the dish a touch deeper, a dark
// switch housing, on a deck a step under the surface.
const CAP_SIDE = `color-mix(in srgb, ${FINISH} 86%, ${HAIRLINE})`;
const DISH = `color-mix(in srgb, ${FINISH} 96%, ${HAIRLINE})`;
const HOUSING = `color-mix(in srgb, ${HAIRLINE} 30%, #1a1a1a)`;
const DECK = `color-mix(in srgb, ${SURFACE} 80%, ${HAIRLINE})`;

const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = {
  side: fill(DECK),
  top: fill(DECK),
  bottom: fill(DECK),
  "housing.side": fill(HOUSING),
  "housing.top": fill(HOUSING),
  "cap.side": fill(CAP_SIDE),
  "cap.top": fill(FINISH),
  dish: fill(DISH),
};

const OUTLINE: Look = {
  vectorEffect: "non-scaling-stroke",
  strokeWidth: 1,
  strokeLinejoin: "round",
  style: { stroke: HAIRLINE, fill: "none" },
};

/** CSS pixels the label lays out across the cap's top. */
export const LABEL_WIDTH = 120;

const BUTTON: CSSProperties = {
  appearance: "none",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  margin: 0,
  padding: "12%",
  border: 0,
  borderRadius: `${fixed((LABEL_ROUND / LABEL.width) * 100)}%`,
  background: "transparent",
  color: INK,
  font: "inherit",
  fontSize: 28,
  fontWeight: 500,
  lineHeight: 1.1,
  textAlign: "center",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

/** The soft shadow under the key, under names of its own so any number of keys share a page. */
const Shadow = ({ id, shadow }: { id: string; shadow: View["shadow"] }) => (
  <>
    <defs>
      <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="0.8 0.5" />
      </filter>
      <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
        <feGaussianBlur stdDeviation="3 1.8" />
      </filter>
    </defs>
    <path d={shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
    <path d={shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
  </>
);

const SOUND = "vectoys-keycap-sound";
const SHEET = `.${SOUND}{outline:none}.${SOUND}:focus-visible{outline:${FOCUS_WIDTH} solid ${FOCUS};outline-offset:2px}`;
const TOGGLE: CSSProperties = {
  appearance: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  margin: "8px 0 0 auto",
  padding: "6px 10px",
  border: 0,
  borderRadius: 999,
  background: `color-mix(in srgb, ${HAIRLINE} 14%, transparent)`,
  color: INK,
  font: "inherit",
  fontSize: 13,
  lineHeight: 1,
  cursor: "pointer",
  touchAction: "manipulation",
};
const COLUMN: CSSProperties = { display: "flex", flexDirection: "column" };

/** A speaker, with waves when the sound is on and a cross when it is off. */
const Speaker = ({ on }: { on: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
    <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
    <path d={on ? "M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" : "M11 6l4 4M15 6l-4 4"} />
  </svg>
);

/** The switch that turns the clicks on and off, under the keys. */
const SoundSwitch = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
  <>
    <style>{SHEET}</style>
    <button type="button" role="switch" aria-checked={on} className={SOUND} onClick={toggle} style={TOGGLE}>
      <Speaker on={on} />
      {on ? "Sound on" : "Sound off"}
    </button>
  </>
);

type SoundProps = {
  /** Whether presses click, when the page keeps the state. */
  sound?: boolean;
  /** Whether presses click at first, when the key keeps its own state; false by default. */
  defaultSound?: boolean;
  /** Called with the new state when the sound switch is pressed. */
  onSoundChange?: (sound: boolean) => void;
  /** Shows a switch under the key that turns the sound on and off. */
  soundToggle?: boolean;
};

/** Whether the clicks are on, kept by the page or by the key itself, and how to flip them. */
function useSound(sound: boolean | undefined, defaultSound = false, onSoundChange?: (sound: boolean) => void) {
  const [own, setOwn] = useState(defaultSound);
  const audible = sound ?? own;
  const toggle = () => {
    if (sound === undefined) setOwn(!audible);
    onSoundChange?.(!audible);
  };
  return { audible, toggle };
}

/** Starts the audio on the first press that asks for it, then keeps it until unmount. */
function useClicks() {
  const audio = useRef<Clicks | null>(null);
  useEffect(
    () => () => {
      audio.current?.close();
      audio.current = null;
    },
    [],
  );
  return useCallback(() => (audio.current ??= clicks()), []);
}

/** A row's sound, shared by its keys so they play through one audio context, and whether a drag on a key turns the row. */
const Shared = createContext<{ audible: boolean; start: () => Clicks | null; grab: boolean } | null>(null);

const PRESS_KEYS = new Set([" ", "Enter"]);
// A pointer that moves this far while held is turning the key, not pressing it.
const DRAG_FROM = 4;
// Seen from above, never from under the deck.
const LIMITS = { yaw: [-40, 40], pitch: [-25, 25] } as const;

/** The button's own events the cap follows; a caller's handlers for them still run, first. */
type PressHandlers = Pick<
  ComponentProps<"button">,
  "onPointerEnter" | "onPointerLeave" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onKeyDown" | "onKeyUp" | "onBlur"
>;

/**
 * Whether the cap is under the pointer and whether it is held down, from the
 * button's own events; `changed` hears each press and release. With `drag`,
 * a pointer that moves while held is turning the key, so the key comes up.
 */
function usePress(disabled: boolean, caller: PressHandlers, changed: (down: boolean) => void, drag: boolean) {
  const [hover, setHover] = useState(false);
  const [held, setHeldState] = useState(false);
  const down = useRef(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  // A key disabled while held is up from then on, so it sends no release later and its next press clicks.
  useEffect(() => {
    if (disabled) down.current = false;
  }, [disabled]);
  const setHeld = (next: boolean) => {
    setHeldState(next);
    if (disabled || down.current === next) return;
    down.current = next;
    changed(next);
  };
  const handlers: PressHandlers = {
    onPointerEnter: (event) => {
      caller.onPointerEnter?.(event);
      setHover(true);
    },
    onPointerLeave: (event) => {
      caller.onPointerLeave?.(event);
      setHover(false);
      setHeld(false);
    },
    onPointerDown: (event) => {
      caller.onPointerDown?.(event);
      if (event.button !== 0) return;
      from.current = { x: event.clientX, y: event.clientY };
      setHeld(true);
    },
    onPointerMove: (event) => {
      caller.onPointerMove?.(event);
      if (drag && from.current && Math.hypot(event.clientX - from.current.x, event.clientY - from.current.y) >= DRAG_FROM) {
        from.current = null;
        setHeld(false);
      }
    },
    onPointerUp: (event) => {
      caller.onPointerUp?.(event);
      setHeld(false);
    },
    onPointerCancel: (event) => {
      caller.onPointerCancel?.(event);
      setHeld(false);
    },
    onKeyDown: (event) => {
      caller.onKeyDown?.(event);
      if (PRESS_KEYS.has(event.key) && !event.repeat) setHeld(true);
    },
    onKeyUp: (event) => {
      caller.onKeyUp?.(event);
      if (PRESS_KEYS.has(event.key)) setHeld(false);
    },
    onBlur: (event) => {
      caller.onBlur?.(event);
      setHeld(false);
    },
  };
  return { hover: hover && !disabled, held: held && !disabled, handlers };
}

export type KeycapProps = Omit<ComponentProps<"button">, "children" | "draggable"> & {
  /** The label on the cap's top, live HTML laid out about `LABEL_WIDTH` pixels across; it names the button too, "Key" without one. */
  children?: ReactNode;
  /** Called when the key is pressed, by pointer, touch or keyboard. */
  onPress?: () => void;
  /** The cap's color; by default the page's `--vectoys-finish`, else its surface. */
  finish?: string;
} & SoundProps &
  TurnOptions;

/**
 * A big mechanical key that is a real button, for a call to action. The
 * label is live HTML on the cap's top, and the button is that top, so it
 * takes focus, Enter and Space as any button does. The cap lifts under the
 * pointer and travels down while held, then springs back; under reduced
 * motion it moves straight between those places. It can click as it goes
 * down and up, made with WebAudio after the first press; that is off by
 * default. A drag on it, the cap included, turns the eye round it, and a
 * button shows it full screen; in a row, the row turns instead.
 */
export const Keycap = memo(function Keycap({
  children,
  onPress,
  finish,
  onClick,
  style,
  disabled = false,
  sound,
  defaultSound,
  onSoundChange,
  soundToggle = false,
  draggable = true,
  fullscreen,
  limits,
  release,
  ...button
}: KeycapProps) {
  const id = `keycap-${useId().replace(/[^\w-]/g, "")}`;
  const shared = useContext(Shared);
  const own = useSound(sound, defaultSound, onSoundChange);
  const start = useClicks();
  const audible = sound ?? shared?.audible ?? own.audible;
  const name = typeof children === "string" || typeof children === "number" ? String(children) : id;
  const click = (down: boolean) => {
    if (audible) (shared ? shared.start() : start())?.play(name, 1, down);
  };
  const grab = shared ? shared.grab : draggable;
  const { hover, held, handlers } = usePress(disabled, button, click, grab);
  // The cap bottoms out on the switch, so the spring's overshoot never shows past it.
  const travel = Math.min(useSpring(held ? TRAVEL : hover ? -HOVER : 0), TRAVEL);

  const press = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    onPress?.();
  };

  /** The key with the eye moved `turn` degrees round it. */
  const drawn = (turn: { yaw: number; pitch: number }) => {
    const view = seen(travel, turn);
    const cap = view.drawn.hulls.find((hull) => hull.part === "cap");
    const label = (
      <Screen camera={view.camera} pose={view.top} rect={LABEL} width={LABEL_WIDTH}>
        <button
          type="button"
          aria-label={children == null ? "Key" : undefined}
          {...button}
          {...handlers}
          disabled={disabled}
          data-pressed={held || undefined}
          data-vectoys-grab={grab ? "" : undefined}
          onClick={press}
          style={{ ...BUTTON, ...(disabled && { cursor: "default", opacity: 0.6 }), ...style }}
        >
          {children}
        </button>
      </Screen>
    );
    return (
      <Stage camera={view.camera} overlay={label} style={finish ? { "--vectoys-finish": finish } : {}}>
        <Shadow id={id} shadow={view.shadow} />
        <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
        {cap && <path d={cap.d} {...OUTLINE} />}
      </Stage>
    );
  };

  // In a row the row turns, so the key draws from where it rests.
  if (shared) return drawn({ yaw: 0, pitch: 0 });
  const title = typeof children === "string" || typeof children === "number" ? `${children} key` : "key";
  return (
    <Turntable mode="camera" label={title} draggable={draggable} limits={{ ...LIMITS, ...limits }} {...(fullscreen !== undefined && { fullscreen })} {...(release && { release })}>
      {(turn) =>
        soundToggle ? (
          <div style={COLUMN}>
            {drawn(turn)}
            <SoundSwitch on={audible} toggle={own.toggle} />
          </div>
        ) : (
          drawn(turn)
        )
      }
    </Turntable>
  );
});

export type KeycapRowProps = {
  /** One key for each label, left to right, such as the letters of a word. */
  keys: readonly string[];
  /** Called with the key's label and place when one is pressed. */
  onPress?: (key: string, index: number) => void;
  /** Names the row for assistive technology, such as the word the keys spell. */
  label?: string;
  finish?: string;
  className?: string;
  style?: CSSProperties;
} & SoundProps &
  TurnOptions;

/**
 * A row of keys side by side, such as a word spelled out, each its own
 * button. Its keys share one audio context and one sound switch. A drag on
 * the row, its keys included, tilts it as one, and a button shows it full
 * screen.
 */
export function KeycapRow({ keys, onPress, label, finish, className, style, sound, defaultSound, onSoundChange, soundToggle = false, ...turning }: KeycapRowProps) {
  const { audible, toggle } = useSound(sound, defaultSound, onSoundChange);
  const start = useClicks();
  const grab = turning.draggable !== false;
  const shared = useMemo(() => ({ audible, start, grab }), [audible, start, grab]);
  const row = (
    <div role="group" aria-label={label} className={className} style={{ display: "flex", ...style }}>
      {keys.map((key, index) => (
        <div key={index} style={{ flex: "1 1 0", minWidth: 0, marginInline: "-4%" }}>
          <Keycap {...(finish && { finish })} {...(onPress && { onPress: () => onPress(key, index) })} style={{ fontSize: 48 }}>
            {key}
          </Keycap>
        </div>
      ))}
    </div>
  );
  // Tilted as one, since each key draws with an eye of its own.
  return (
    <Shared.Provider value={shared}>
      <Turntable mode="tilt" label={label ?? "keys"} {...turning}>
        {soundToggle ? (
          <div style={COLUMN}>
            {row}
            <SoundSwitch on={audible} toggle={toggle} />
          </div>
        ) : (
          row
        )}
      </Turntable>
    </Shared.Provider>
  );
}
