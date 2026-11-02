import { Faces, Stage, Turntable, useFrames, useReducedMotion, useSpring, type Look, type StyleWithVariables, type TurnOptions } from "@vinena/vectoys-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { BOARD, EYE, KEYS, ORDER, TRAVEL, keyFor, seen, type Key as KeySpec } from "./geometry";
import { clicks, type Clicks } from "./sound";

// The page's colors, as CSS variables. Each falls back to a tone for light
// and one for dark, picked by the page's color scheme. The caps are in the
// finish and their legends in the ink, on a case a step under the surface.
const HAIRLINE = "var(--vectoys-hairline, light-dark(#8a8a8a, #5a5a5a))";
const SURFACE = "var(--vectoys-surface, light-dark(#f5f5f5, #262626))";
const SHADOW = "var(--vectoys-shadow, light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4)))";
const FINISH = `var(--vectoys-finish, ${SURFACE})`;
const INK = "var(--vectoys-ink, light-dark(#1d1d1c, #ededed))";
const BG = `var(--vectoys-bg, ${SURFACE})`;
const FOCUS = "var(--vectoys-focus, currentColor)";
const FOCUS_WIDTH = "var(--vectoys-focus-width, 1px)";

const CASE = `color-mix(in srgb, ${SURFACE} 80%, ${HAIRLINE})`;
const CAP_SIDE = `color-mix(in srgb, ${FINISH} 72%, ${HAIRLINE})`;
const CAP_DOWN = `color-mix(in srgb, ${FINISH} 88%, ${HAIRLINE})`;
const CAP_DOWN_SIDE = `color-mix(in srgb, ${FINISH} 64%, ${HAIRLINE})`;
const LIGHT_ON = "#3fcf5e";
const LIGHT_OFF = `color-mix(in srgb, ${FINISH} 70%, ${HAIRLINE})`;

const fill = (color: string): Look => ({ style: { fill: color } });
const CASE_STYLES: Record<string, Look> = { top: fill(CASE), side: fill(CASE), bottom: fill(CASE) };
// The caps' looks are classes, set once in the sheet below, so ~80 keys
// do not each repeat the colors in their markup.
const CAP = "vectoys-kb";
const CAP_STYLES: Record<string, Look> = { top: { className: `${CAP}-top` }, side: { className: `${CAP}-side` }, bottom: { className: `${CAP}-side` } };
const OUTLINE: Look = { vectorEffect: "non-scaling-stroke", strokeWidth: 1, strokeLinejoin: "round", style: { stroke: HAIRLINE, fill: "none" } };

const ROOT: CSSProperties = { display: "flex", flexDirection: "column", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" };

const BUTTON = "vectoys-keyboard-button";
const BOX = "vectoys-keyboard-box";
const CORNER = "vectoys-keyboard-corner";
const TURN = "vectoys-keyboard-turn";
const SHEET = [
  `.${BUTTON},.${BOX}{outline:none}.${BUTTON}:focus-visible{outline:${FOCUS_WIDTH} solid ${FOCUS};outline-offset:2px}`,
  `.${BOX}:not([data-full]):focus{background:color-mix(in srgb, ${HAIRLINE} 18%, transparent)}`,
  `.${BOX}::placeholder{color:color-mix(in srgb, ${INK} 45%, transparent);opacity:1}.${BOX}[data-full]::placeholder{color:color-mix(in srgb, ${INK} 32%, transparent)}`,
  // Full screen is a writing page on the page's own background.
  `.${TURN}[data-full]{background:var(--vectoys-backdrop, ${BG})}`,
  `.${CORNER}>.${BUTTON}{opacity:.55;transition:opacity .2s}.${CORNER}>.${BUTTON}:hover,.${CORNER}>.${BUTTON}:focus-visible{opacity:1}`,
  `.${CAP}-top{fill:${FINISH}}.${CAP}-side{fill:${CAP_SIDE}}`,
  `.${CAP}-key[data-down] .${CAP}-top{fill:${CAP_DOWN}}.${CAP}-key[data-down] .${CAP}-side{fill:${CAP_DOWN_SIDE}}`,
  `.${CAP}-legend{fill:${INK};font-family:ui-sans-serif,system-ui,sans-serif;pointer-events:none}`,
  `.${CAP}-light{fill:${LIGHT_OFF}}.${CAP}-light[data-on]{fill:${LIGHT_ON}}`,
].join("");
const TOGGLE: CSSProperties = {
  appearance: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
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
const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const CONTROLS: CSSProperties = { ...ROW, justifyContent: "flex-end", marginTop: 8 };
// Room at the end of the text row for the turntable's full screen button, 32 pixels wide and 8 from the edge, so it never covers Clear.
const ROOM: CSSProperties = { paddingRight: 40 };
const TEXT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  margin: 0,
  padding: "8px 12px",
  border: 0,
  borderRadius: 10,
  background: `color-mix(in srgb, ${HAIRLINE} 12%, transparent)`,
  boxShadow: `inset 0 1px 2px ${SHADOW}`,
  color: INK,
  font: "inherit",
  fontSize: 16,
  lineHeight: 1.4,
  resize: "none",
  userSelect: "text",
  WebkitUserSelect: "text",
};
// Full screen is a writing page: the text large in a fixed area that scrolls, the board under it as
// wide as the rest of the height allows at its own aspect ratio, and the buttons quiet in the top corner.
const FULL: CSSProperties = {
  position: "relative",
  boxSizing: "border-box",
  height: "92dvh",
  justifyContent: "center",
  alignItems: "center",
  gap: "clamp(16px, 4cqh, 48px)",
  padding: "clamp(16px, 5vmin, 56px)",
  containerType: "size",
  overflow: "hidden",
};
const WRITE_HEIGHT = "clamp(120px, 34cqh, 360px)";
const WRITE: CSSProperties = {
  ...TEXT,
  flex: "none",
  width: "min(100%, 880px)",
  height: WRITE_HEIGHT,
  padding: 0,
  background: "transparent",
  boxShadow: "none",
  fontSize: "clamp(28px, 3.2vw, 44px)",
  lineHeight: 1.4,
  letterSpacing: "-0.01em",
  caretColor: INK,
};
const FIT_BOARD: CSSProperties = { width: `min(100%, 1100px, calc((100cqh - ${WRITE_HEIGHT} - 80px) * ${EYE.width} / ${EYE.height}))` };
// The page is 92dvh tall in the middle of the screen, so its top is 4dvh down; the buttons stay below the full screen button, whose bottom is 40 pixels down.
const CORNER_STYLE: CSSProperties = { ...ROW, position: "absolute", top: "max(clamp(12px, 3vmin, 28px), calc(48px - 4dvh))", right: "clamp(12px, 3vmin, 28px)", margin: 0 };

// Where a hold comes from: the real keyboard, a pointer by its id, or the demo.
const BY_KEY = "key";
const BY_DEMO = "demo";
// Keys that scroll the page when focus is on no control, which would carry the board off screen as someone types on it.
const SCROLLERS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const MODIFIERS = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "Fn", "CapsLock"]);
const WIDTHS = new Map(KEYS.map((key) => [key.id, key.width]));
// A key that sends no key up, such as caps lock on some systems, springs back after this long.
const TAP = 120;
const SPRING = { stiffness: 1100, damping: 46 };
// A pointer that moves this far while holding a key is turning the keyboard, so the key comes up.
const DRAG_FROM = 4;
const NONE: ReadonlySet<string> = new Set();

/** The steps of the demo typing `word`: when each key goes down and comes up, and how long one run lasts, in milliseconds. */
function script(word: string) {
  const steps: { at: number; key: string; on: boolean }[] = [];
  let at = 900;
  for (const char of word.toLowerCase()) {
    const code = /[a-z]/.test(char) ? `Key${char.toUpperCase()}` : /\d/.test(char) ? `Digit${char}` : char === " " ? "Space" : "";
    const key = keyFor(code);
    if (!key) continue;
    steps.push({ at, key, on: true }, { at: at + 110, key, on: false });
    at += 190;
  }
  return { steps, length: at + 2200 };
}

type KeyProps = { spec: KeySpec; down: boolean; lit: boolean; press: (key: string, pointer: number, on: boolean) => void; drag: boolean };

/** One key: its cap springs down while it is held, its legends riding on its top. With `drag`, a pointer that moves lets it up. */
const Key = memo(function Key({ spec, down, lit, press, drag }: KeyProps) {
  // The cap bottoms out, so the spring's overshoot never shows past it.
  const travel = Math.min(useSpring(down ? TRAVEL : 0, SPRING), TRAVEL);
  const view = useMemo(() => seen(spec, travel), [spec, travel]);
  const from = useRef<{ x: number; y: number } | null>(null);
  const end = (event: PointerEvent) => {
    from.current = null;
    press(spec.id, event.pointerId, false);
  };
  return (
    <g
      className={`${CAP}-key`}
      data-key={spec.id}
      data-down={down || undefined}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        from.current = { x: event.clientX, y: event.clientY };
        press(spec.id, event.pointerId, true);
      }}
      onPointerMove={(event) => drag && from.current && Math.hypot(event.clientX - from.current.x, event.clientY - from.current.y) >= DRAG_FROM && end(event)}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={CAP_STYLES} />
      <g transform={view.legends} className={`${CAP}-legend`}>
        {spec.light && <rect x={spec.light.x} y={spec.light.y} width={9} height={4} rx={2} className={`${CAP}-light`} data-on={lit || undefined} />}
        {spec.legends.map((legend, index) => (
          <text key={index} x={legend.x} y={legend.y} fontSize={legend.size} textAnchor={legend.anchor}>
            {legend.text}
          </text>
        ))}
      </g>
    </g>
  );
});

/** A speaker, with waves when the sound is on and a cross when it is off. */
const Speaker = ({ on }: { on: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
    <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
    <path d={on ? "M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" : "M11 6l4 4M15 6l-4 4"} />
  </svg>
);

/** Whether a key is one character to type, or a dead key that starts an accent, with no command or control shortcut held. */
const printable = (event: KeyboardEvent) => ([...event.key].length === 1 || event.key === "Dead") && !event.metaKey && (!event.ctrlKey || event.getModifierState("AltGraph")) && !event.isComposing;

export type KeyboardProps = {
  /** Names the keyboard for assistive technology. */
  label?: string;
  /** The caps' color; by default the page's `--vectoys-finish`, else its surface. */
  finish?: string;
  /** Whether the keys follow the real keyboard while the keyboard is on screen and no other control on the page has focus; true by default. */
  listen?: boolean;
  /** Whether presses click, when the page keeps the state. */
  sound?: boolean;
  /** Whether presses click at first, when the keyboard keeps its own state; true by default. */
  defaultSound?: boolean;
  /** Called with the new state when the sound button is pressed. */
  onSoundChange?: (sound: boolean) => void;
  /** Types a word on the keys by itself, silently, until someone presses a key: `true` types "hello". */
  demo?: boolean | string;
  /** Shows a text box over the board that takes what you type, also while nothing else on the page has focus; `"fullscreen"` shows it only while the keyboard fills the screen; false by default. */
  typing?: boolean | "fullscreen";
  /** The text in the box, when the page keeps the state. */
  value?: string;
  /** The text in the box at first, when the keyboard keeps its own state; empty by default. */
  defaultValue?: string;
  /** Called with the new text when it changes in the box or is cleared. */
  onValueChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
} & TurnOptions;

/**
 * A full-size keyboard with a US layout whose keys go down as you type on
 * your own keyboard while it is on screen, by each key's place
 * (`KeyboardEvent.code`) whatever layout the system uses, and under a
 * pointer or a finger, while focus is on no control or on the keyboard
 * itself. It never stops a key from reaching the page, and keys typed in
 * another control on the page leave it alone. Each press clicks, made with WebAudio after the first press,
 * and a button turns that off. Under reduced motion the keys change at once.
 * With `typing`, a text box takes what you type (with `typing="fullscreen"`,
 * only while full screen). A drag, from anywhere on it, tilts it, and a
 * button in its corner fills the screen with it (`fullscreen`, true by
 * default).
 */
export function Keyboard({ label = "Keyboard", draggable, fullscreen, limits, release, ...props }: KeyboardProps) {
  return (
    <Turntable
      mode="tilt"
      label={label}
      className={TURN}
      {...(draggable !== undefined && { draggable })}
      {...(fullscreen !== undefined && { fullscreen })}
      {...(limits && { limits })}
      {...(release && { release })}
    >
      {({ full }) => <Board {...props} label={label} full={full} drag={draggable !== false} room={fullscreen !== false} />}
    </Turntable>
  );
}

/** The keyboard itself, laid out as a writing page while `full`. */
function Board({
  label = "Keyboard",
  finish,
  listen = true,
  sound,
  defaultSound = true,
  onSoundChange,
  demo = false,
  typing = false,
  value,
  defaultValue = "",
  onValueChange,
  className,
  style,
  full,
  drag,
  room,
}: Omit<KeyboardProps, keyof TurnOptions> & { full: boolean; drag: boolean; room: boolean }) {
  const id = `keyboard-${useId().replace(/[^\w-]/g, "")}`;
  const reduced = useReducedMotion();
  const frames = useFrames();
  const [ownSound, setOwnSound] = useState(defaultSound);
  const audible = sound ?? ownSound;
  const [down, setDown] = useState(NONE);
  const [caps, setCaps] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [ownText, setOwnText] = useState(defaultValue);
  const text = value ?? ownText;
  const writing = typing === true || (typing === "fullscreen" && full);
  // Without IntersectionObserver, as on a server, the keyboard counts as on screen.
  const [shown, setShown] = useState(true);

  const holds = useRef(new Map<string, Set<string>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const audio = useRef<Clicks | null>(null);
  const hearing = useRef(audible);
  hearing.current = audible;
  const touched = useRef(false);
  const stopDemo = useRef(() => {});

  /** Holds `key` down for `source`, or lets it go; it clicks when it goes down or comes up, unless the demo moved it. */
  const hold = useCallback((key: string, source: string, on: boolean) => {
    const sources = holds.current.get(key) ?? new Set<string>();
    const was = sources.size > 0;
    if (on) sources.add(source);
    else sources.delete(source);
    if (sources.size > 0) holds.current.set(key, sources);
    else holds.current.delete(key);
    if (was === sources.size > 0) return;
    setDown(new Set(holds.current.keys()));
    if (source !== BY_DEMO && hearing.current) audio.current?.play(key, WIDTHS.get(key) ?? 1, on);
  }, []);

  const letGo = useCallback(
    (which: (source: string) => boolean) => {
      if (which(BY_KEY)) {
        for (const timer of timers.current.values()) clearTimeout(timer);
        timers.current.clear();
      }
      for (const [key, sources] of [...holds.current]) for (const source of [...sources]) if (which(source)) hold(key, source, false);
    },
    [hold],
  );

  /** A person pressed something: the demo stops for good, and the sound may start, as browsers allow only now. */
  const person = useCallback(() => {
    if (!touched.current) {
      touched.current = true;
      stopDemo.current();
    }
    if (hearing.current && !audio.current) audio.current = clicks();
  }, []);

  /** Presses `key` and lets it go a moment later, or later still if it is pressed again. */
  const tap = useCallback(
    (key: string) => {
      clearTimeout(timers.current.get(key));
      hold(key, BY_KEY, true);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          hold(key, BY_KEY, false);
        }, TAP),
      );
    },
    [hold],
  );

  const pointer = useCallback(
    (key: string, pointerId: number, on: boolean) => {
      if (on) person();
      hold(key, `pointer ${pointerId}`, on);
    },
    [hold, person],
  );

  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => entry && setShown(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Pointer presses need letting go too, so this runs whether or not the keyboard listens.
  useEffect(() => {
    if (!shown) return;
    const clear = () => letGo((source) => source !== BY_DEMO);
    const hidden = () => document.visibilityState === "hidden" && clear();
    addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hidden);
      clear();
    };
  }, [shown, letGo]);

  useEffect(() => {
    if ((!listen && !writing) || !shown) return;
    let capsAt = -Infinity;
    /** Whether keys are the keyboard's: focus is on no control, or on the keyboard or inside it, not on another control on the page. */
    // The turntable round the keyboard takes focus on a click, and counts as no control.
    const free = () => {
      const active = document.activeElement;
      return !active || active === document.body || active === document.documentElement || active === root.current?.closest(`.${TURN}`);
    };
    // Inside the turntable counts too, as its full screen button keeps focus after a click.
    const mine = () => free() || (root.current?.closest(`.${TURN}`)?.contains(document.activeElement) ?? false);
    /** Focuses the text box before the browser types a character pressed while nothing editable has focus, so it lands there. */
    const aim = (event: KeyboardEvent) => {
      const field = box.current;
      if (!field || event.defaultPrevented || !printable(event) || document.activeElement === field) return;
      // A space on the toy's own focused button presses that button.
      if (document.activeElement instanceof HTMLButtonElement && event.key === " ") return;
      field.setSelectionRange(field.value.length, field.value.length);
      field.focus({ preventScroll: true });
    };
    const press = (event: KeyboardEvent) => {
      if (!mine()) return;
      if (writing) aim(event);
      if (!listen) return;
      setCaps(event.getModifierState("CapsLock"));
      const key = keyFor(event.code);
      if (!key) return;
      // Only while focus is on no control, so a focused button or text box keeps its own Space and arrows; shortcuts stay the browser's.
      if (free() && SCROLLERS.has(event.code) && !event.metaKey && !event.ctrlKey && !event.altKey) event.preventDefault();
      person();
      if (key === "CapsLock") capsAt = event.timeStamp;
      // Some systems send no key up for caps lock, nor for keys pressed while command is down.
      if (key === "CapsLock" || (event.metaKey && !MODIFIERS.has(key))) return tap(key);
      hold(key, BY_KEY, true);
    };
    const lift = (event: KeyboardEvent) => {
      if (!listen) return;
      const key = keyFor(event.code);
      // A key that went down here still comes up after focus moved to another control.
      if (!mine() && !(key && holds.current.get(key)?.has(BY_KEY))) return;
      setCaps(event.getModifierState("CapsLock"));
      if (!key) return;
      // Caps lock sent its key down long ago, or never: this key up is a press of its own.
      if (key === "CapsLock" && event.timeStamp - capsAt > 600) return tap(key);
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      hold(key, BY_KEY, false);
      if (key === "MetaLeft" || key === "MetaRight") letGo((source) => source === BY_KEY);
    };
    // In the capture phase, so a page that stops a key on its way cannot leave a cap stuck down.
    addEventListener("keydown", press, true);
    addEventListener("keyup", lift, true);
    return () => {
      removeEventListener("keydown", press, true);
      removeEventListener("keyup", lift, true);
      letGo((source) => source === BY_KEY);
    };
  }, [listen, writing, shown, hold, letGo, person, tap]);

  const word = demo === true ? "hello" : demo || "";
  useEffect(() => {
    const { steps, length } = script(word);
    // Off screen the demo rests, and starts over when the board shows again.
    if (steps.length === 0 || reduced || touched.current || !shown) return;
    let clock = 0;
    let next = 0;
    frames((elapsed) => {
      clock += elapsed;
      for (let step = steps[next]; step && clock >= step.at; step = steps[next]) {
        hold(step.key, BY_DEMO, step.on);
        next += 1;
      }
      if (next === steps.length && clock >= length) [clock, next] = [clock - length, 0];
      return true;
    });
    const stop = () => {
      frames(() => false);
      letGo((source) => source === BY_DEMO);
    };
    stopDemo.current = stop;
    return () => {
      stop();
      stopDemo.current = () => {};
    };
  }, [word, reduced, shown, frames, hold, letGo]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      audio.current?.close();
      audio.current = null;
    },
    [],
  );

  const toggle = () => {
    if (sound === undefined) setOwnSound(!audible);
    onSoundChange?.(!audible);
  };

  const write = (next: string) => {
    if (value === undefined) setOwnText(next);
    onValueChange?.(next);
  };
  const clear = () => {
    write("");
    box.current?.focus();
  };

  // The shadow and the case never change, so they render once.
  const board = useMemo(
    () => (
      <>
        <defs>
          <filter id={`${id}-near`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="150">
            <feGaussianBlur stdDeviation="0.5 0.35" />
          </filter>
          <filter id={`${id}-far`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="150">
            <feGaussianBlur stdDeviation="2.4 1.4" />
          </filter>
        </defs>
        <path d={BOARD.shadow.ground} filter={`url(#${id}-far)`} style={{ fill: SHADOW }} />
        <path d={BOARD.shadow.contact} filter={`url(#${id}-near)`} style={{ fill: SHADOW }} />
        <Faces faces={BOARD.drawn.faces} hulls={BOARD.drawn.hulls} styles={CASE_STYLES} shading />
        {BOARD.drawn.hulls.map((hull) => (
          <path key={hull.part} d={hull.d} {...OUTLINE} />
        ))}
      </>
    ),
    [id],
  );

  const look: StyleWithVariables = { ...ROOT, ...(finish && { "--vectoys-finish": finish }), ...style, ...(full && FULL) };
  const button = (children: ReactNode, onClick: () => void) => (
    <button type="button" className={BUTTON} onClick={onClick} style={TOGGLE}>
      {children}
    </button>
  );
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className={className}
      style={look}
    >
      <style>{SHEET}</style>
      {writing && (
        <div style={full ? { display: "contents" } : { ...ROW, marginBottom: 12, ...(room && ROOM) }}>
          <textarea
            ref={box}
            rows={2}
            aria-label="Typed text"
            placeholder={full ? "Start typing\u2026" : "Click here or just start typing"}
            spellCheck={false}
            className={BOX}
            data-full={full || undefined}
            value={text}
            onChange={(event) => write(event.target.value)}
            style={full ? WRITE : TEXT}
          />
          {!full && button("Clear", clear)}
        </div>
      )}
      <div style={full ? FIT_BOARD : undefined}>
        <Stage camera={EYE} role="img" label="A full-size keyboard with a US layout. Its keys go down as you type." style={{ touchAction: "manipulation" }}>
          {board}
          <g style={{ cursor: "pointer" }}>
            {ORDER.map((key) => (
              <Key key={key.id} spec={key} down={down.has(key.id)} lit={key.light ? caps : false} press={pointer} drag={drag} />
            ))}
          </g>
        </Stage>
      </div>
      <div className={full ? CORNER : undefined} style={full ? CORNER_STYLE : CONTROLS}>
        {full && writing && button("Clear", clear)}
        <button type="button" role="switch" aria-checked={audible} className={BUTTON} onClick={toggle} style={TOGGLE}>
          <Speaker on={audible} />
          {audible ? "Sound on" : "Sound off"}
        </button>
      </div>
    </div>
  );
}
