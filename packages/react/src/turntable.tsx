import { clamp, type Spring } from "@vinena/vectoys";
import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useFrames, useReducedMotion } from "./motion.ts";
import { glide, nearest, rubber, unrubber, type Glide, type Range } from "./turn.ts";

/** How far a toy may turn from its rest pose, in degrees each way. */
export type TurnLimits = { yaw?: readonly [number, number]; pitch?: readonly [number, number] };

export type TurnOptions = {
  /** Whether a mouse, a finger or the arrow keys turn the toy. Default true. */
  draggable?: boolean;
  /** Whether a button shows the toy full screen. Default true. */
  fullscreen?: boolean;
  /** Camera mode turns yaw -180 to 180 and pitch -35 to 35 by default, tilt mode yaw -28 to 28 and pitch -20 to 20. Use `[-Infinity, Infinity]` for free spin. */
  limits?: TurnLimits;
  /** Whether the toy stays where it is let go, or springs back to rest. Default "stay"; a double click resets it. */
  release?: "stay" | "return";
};

/** What a toy is given to draw itself: the turn from its rest pose, in degrees, and whether it fills the screen. */
export type Turn = { yaw: number; pitch: number; full: boolean };

export type TurntableProps = TurnOptions & {
  /**
   * `camera` passes the turn to the children, which add it to their own
   * camera; `tilt` turns the children with a CSS transform and passes the
   * same turn, for a flat toy or one with a fixed camera.
   */
  mode: "camera" | "tilt";
  /** The toy's name, for the full screen button. */
  label?: string;
  children: ReactNode | ((turn: Turn) => ReactNode);
  className?: string;
  style?: CSSProperties;
};

// A drag starts once the pointer has moved this far, so a click or a tap stays a click.
const DRAG_FROM = 4;
const KEY_YAW = 10;
const KEY_PITCH = 6;
// Shift turns this many steps at once.
const KEY_BIG = 3;
const KEY_REST_MS = 1500;
const DOUBLE_TAP_MS = 300;
// Degrees per pixel when the toy has no size yet to measure.
const PER_PIXEL = 0.45;
// Degrees per second, so a flick never spins wildly.
const FASTEST = 1500;
const DEFAULT_LIMITS: Record<TurntableProps["mode"], Required<TurnLimits>> = {
  camera: { yaw: [-180, 180], pitch: [-35, 35] },
  tilt: { yaw: [-28, 28], pitch: [-20, 20] },
};
// A pointer down on these presses, types or picks in the toy, and never turns it.
const NODRAG = "a, button, input, textarea, select, label, [contenteditable], [role=button], [data-vectoys-nodrag]";
// Unless the control is the toy itself, such as a die that is one big button: it turns on a drag and is pressed on a click.
const GRAB = "[data-vectoys-grab]";

const ROOT = "vectoys-turntable";
const BODY = `${ROOT}-body`;
const BUTTON = `${ROOT}-full`;
const HINT = `${ROOT}-hint`;
// What Tab stops on inside the overlay.
const TABBABLE = "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [contenteditable], [tabindex]:not([tabindex='-1'])";
const FOCUS = "outline:var(--vectoys-focus-width,1px) solid var(--vectoys-focus,currentColor);outline-offset:4px";
const CSS = `.${ROOT}{position:relative}
.${ROOT}[tabindex]{cursor:grab;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}
.${ROOT}[tabindex] :is(input,textarea,[contenteditable]){user-select:text;-webkit-user-select:text}
.${ROOT}[data-dragging]{cursor:grabbing}
.${ROOT}:focus-visible{${FOCUS}}
.${ROOT}[data-full]{display:grid!important;place-items:center!important;background:var(--vectoys-backdrop,Canvas);touch-action:none}
.${ROOT}[data-full=overlay]{position:fixed!important;inset:0!important;z-index:2147483000;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important}
.${BUTTON}{position:absolute;top:8px;right:8px;z-index:1;display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--vectoys-hairline,#8a8a8a);border-radius:8px;background:var(--vectoys-surface,Canvas);color:inherit;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .15s}
.${ROOT}:hover>.${BUTTON},.${ROOT}:focus-within>.${BUTTON},.${ROOT}[data-full]>.${BUTTON}{opacity:1;pointer-events:auto}
@media (hover:none){.${BUTTON}{opacity:1;pointer-events:auto}}
.${BUTTON}:focus-visible{${FOCUS}}
.${HINT}{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;

// The Fullscreen API, with the prefixed names older Safari uses, found by feature checks.
const FULL_CHANGES = ["fullscreenchange", "webkitfullscreenchange"];

/** Whether `element` can fill the screen here: an iPhone, or a frame that does not allow it, cannot. */
function canFill(element: HTMLElement) {
  const able = typeof element.requestFullscreen === "function" || ("webkitRequestFullscreen" in element && typeof element.webkitRequestFullscreen === "function");
  const enabled =
    typeof document.fullscreenEnabled === "boolean"
      ? document.fullscreenEnabled
      : !("webkitFullscreenEnabled" in document) || document.webkitFullscreenEnabled !== false;
  return able && enabled;
}

function fullElement(): Element | null {
  if (document.fullscreenElement) return document.fullscreenElement;
  return "webkitFullscreenElement" in document && document.webkitFullscreenElement instanceof Element ? document.webkitFullscreenElement : null;
}

/** Asks for full screen, and calls `refused` if the browser says no. */
function enterFull(element: HTMLElement, refused: () => void) {
  if (typeof element.requestFullscreen === "function") return void element.requestFullscreen().catch(refused);
  if ("webkitRequestFullscreen" in element && typeof element.webkitRequestFullscreen === "function") element.webkitRequestFullscreen();
}

function exitFull() {
  if (typeof document.exitFullscreen === "function") return void document.exitFullscreen().catch(() => {});
  if ("webkitExitFullscreen" in document && typeof document.webkitExitFullscreen === "function") document.webkitExitFullscreen();
}

/** Four corners, pointing out to fill the screen or in to leave it. */
const Corners = ({ full }: { full: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
    <path d={full ? "M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" : "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"} />
  </svg>
);

type Drag = { id: number; touch: boolean; x: number; y: number; yaw: number; pitch: number; perYaw: number; perPitch: number; active: boolean; time: number };

const span = ([lo, hi]: Range) => hi - lo;
const perPixel = (degrees: number, pixels: number) => (pixels > 0 && Number.isFinite(degrees / pixels) ? degrees / pixels : PER_PIXEL);

/** Whether a press on `target` is on a control inside the toy, which never turns it, rather than on the toy or on a control that is the toy. */
function onControl(target: EventTarget | null) {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const control = element?.closest(NODRAG);
  return control != null && !control.matches(GRAB);
}

// Overlays open on the page, so its scroll is held while any is open and given back when the last one closes.
let overlays = 0;
let pageOverflow = "";

/**
 * Lets a toy be turned with a mouse, a finger or the arrow keys, and shown
 * full screen. The server and the first render draw the rest pose, and the
 * button is there from the start, hidden by CSS until the toy is hovered or
 * focused. With reduced motion the toy stops where it is let go, with no
 * spin and no spring.
 *
 * A press on a control inside the toy (a link, a button, a text box, or
 * anything marked `data-vectoys-nodrag`) never turns it. A device's display
 * is part of the toy: a drag on it turns the toy, and only the controls on
 * it do not. A toy that is one
 * big control marks it `data-vectoys-grab`: a drag on it then turns the toy
 * and the click that ends the drag is swallowed, while a plain click still
 * presses it.
 */
export function Turntable({ mode, label, children, className, style, draggable = true, fullscreen = true, limits, release = "stay" }: TurntableProps) {
  const reduced = useReducedMotion();
  const frames = useFrames();
  const hint = useId();
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [turn, setTurn] = useState({ yaw: 0, pitch: 0 });
  const [dragging, setDragging] = useState(false);
  const [full, setFull] = useState<false | "screen" | "overlay">(false);
  const [ratio, setRatio] = useState(1);
  const pose = useRef<{ yaw: Spring; pitch: Spring }>({ yaw: { value: 0, velocity: 0 }, pitch: { value: 0, velocity: 0 } });
  const drag = useRef<Drag | null>(null);
  // Whether the click that ends a drag is still to come, so the toy's own click does not fire.
  const swallow = useRef(false);
  const lastTap = useRef(-Infinity);
  const keyRest = useRef<ReturnType<typeof setTimeout>>(undefined);
  const yawRange = limits?.yaw ?? DEFAULT_LIMITS[mode].yaw;
  const pitchRange = limits?.pitch ?? DEFAULT_LIMITS[mode].pitch;

  const show = (yaw: Spring, pitch: Spring) => {
    pose.current = { yaw, pitch };
    setTurn({ yaw: yaw.value, pitch: pitch.value });
  };

  const stop = () => {
    frames(() => false);
    clearTimeout(keyRest.current);
  };

  const still = () => {
    const { yaw, pitch } = pose.current;
    pose.current = { yaw: { ...yaw, velocity: 0 }, pitch: { ...pitch, velocity: 0 } };
  };

  /** After a release or a reset: the toy coasts and springs back inside its limits, or springs home. */
  const settle = (home: boolean) => {
    stop();
    let { yaw, pitch } = pose.current;
    if (home) {
      yaw = { ...yaw, value: nearest(yaw.value) };
      pitch = { ...pitch, value: nearest(pitch.value) };
    }
    if (reduced) {
      const rest = (axis: Spring, range: Range) => ({ value: home ? 0 : clamp(axis.value, ...range), velocity: 0 });
      return show(rest(yaw, yawRange), rest(pitch, pitchRange));
    }
    let yawGlide = { axis: yaw, home: home ? 0 : null };
    let pitchGlide = { axis: pitch, home: home ? 0 : null };
    // A first frame can come with no time passed, so an axis at rest away from its home is still on its way.
    const moving = ({ axis, home }: Glide) => axis.velocity !== 0 || (home !== null && axis.value !== home);
    frames((elapsed) => {
      yawGlide = glide(yawGlide, yawRange, elapsed / 1000);
      pitchGlide = glide(pitchGlide, pitchRange, elapsed / 1000);
      show(yawGlide.axis, pitchGlide.axis);
      return moving(yawGlide) || moving(pitchGlide);
    });
  };

  useEffect(() => () => clearTimeout(keyRest.current), []);

  // With dragging off the pointer handlers are gone, so a drag under way ends here.
  useEffect(() => {
    if (draggable) return;
    drag.current = null;
    setDragging(false);
  }, [draggable]);

  // A click that ends a drag stops here, before the toy's own listeners hear it.
  useEffect(() => {
    const element = root.current;
    if (!draggable || !element) return;
    const click = (event: globalThis.MouseEvent) => {
      // A click from the keyboard (Enter or Space) never ends a drag.
      if (!swallow.current || event.detail === 0) return;
      swallow.current = false;
      event.stopPropagation();
      event.preventDefault();
    };
    element.addEventListener("click", click, true);
    return () => element.removeEventListener("click", click, true);
  }, [draggable]);

  useEffect(() => {
    const element = root.current;
    if (!fullscreen || !element) return;
    const change = () => setFull((now) => (fullElement() === element ? "screen" : now === "screen" ? false : now));
    for (const name of FULL_CHANGES) document.addEventListener(name, change);
    return () => {
      for (const name of FULL_CHANGES) document.removeEventListener(name, change);
      // Without the button there is no way back, so the toy leaves full screen with it.
      if (fullElement() === element) exitFull();
      setFull(false);
    };
  }, [fullscreen]);

  // The stand-in for full screen covers the page: the page stays still under it, Tab stays in it, and esc closes it and gives focus back.
  useEffect(() => {
    const element = root.current;
    if (full !== "overlay" || !element) return;
    if (overlays++ === 0) {
      pageOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const before = document.activeElement;
    element.querySelector<HTMLElement>(`.${BUTTON}`)?.focus();
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") return setFull(false);
      if (event.key !== "Tab") return;
      const stops = [element, ...element.querySelectorAll<HTMLElement>(TABBABLE)].filter((item) => item.matches(TABBABLE));
      const [first, last] = [stops[0], stops.at(-1)];
      const at = document.activeElement;
      const to = !(at instanceof Node && element.contains(at)) ? first : event.shiftKey && at === first ? last : !event.shiftKey && at === last ? first : undefined;
      if (!to) return;
      event.preventDefault();
      to.focus();
    };
    document.addEventListener("keydown", key);
    return () => {
      if (--overlays === 0) document.body.style.overflow = pageOverflow;
      document.removeEventListener("keydown", key);
      if (before instanceof HTMLElement) before.focus();
    };
  }, [full]);

  const fillOrLeave = () => {
    const element = root.current;
    if (!element) return;
    if (full === "screen") return exitFull();
    if (full === "overlay") return setFull(false);
    // The unturned size, as a tilt's transform would change the box on the page.
    const box = body.current;
    setRatio(box && box.offsetHeight > 0 ? box.offsetWidth / box.offsetHeight : 1);
    if (canFill(element)) enterFull(element, () => setFull("overlay"));
    else setFull("overlay");
  };

  const down = (event: PointerEvent<HTMLDivElement>) => {
    // A second finger while the first turns the toy is left alone.
    if (drag.current?.active) return;
    swallow.current = false;
    if (event.button !== 0 || onControl(event.target)) return;
    // A grab stops a spin where it is, so the drag starts from there.
    stop();
    const { yaw, pitch } = pose.current;
    drag.current = {
      id: event.pointerId,
      touch: event.pointerType === "touch",
      x: event.clientX,
      y: event.clientY,
      yaw: unrubber(yaw.value, yawRange),
      pitch: unrubber(pitch.value, pitchRange),
      perYaw: 0,
      perPitch: 0,
      active: false,
      time: event.timeStamp,
    };
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    // A mouse let go where the toy could not hear it moves with no button down: the drag is over.
    if (event.pointerType !== "touch" && event.buttons === 0) return up(event);
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.active) {
      if (Math.hypot(dx, dy) < DRAG_FROM) return;
      // A swipe that starts up or down on a phone scrolls the page.
      if (current.touch && !full && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      current.active = true;
      // Holds the pointer so a release outside the toy still ends the drag.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      // A drag across the toy is half a turn in camera mode, and the whole range in tilt mode.
      const width = body.current?.offsetWidth ?? 0;
      const height = body.current?.offsetHeight ?? 0;
      current.perYaw = perPixel(mode === "camera" ? 180 : span(yawRange), width);
      current.perPitch = mode === "camera" ? current.perYaw : perPixel(span(pitchRange), height);
      stop();
      setDragging(true);
    }
    const yaw = rubber(current.yaw + dx * current.perYaw, yawRange);
    const pitch = rubber(current.pitch - dy * current.perPitch, pitchRange);
    const elapsed = event.timeStamp - current.time;
    const speed = (from: number, to: number) => (elapsed > 0 ? clamp(((to - from) / elapsed) * 1000, -FASTEST, FASTEST) : 0);
    current.time = event.timeStamp;
    show({ value: yaw, velocity: speed(pose.current.yaw.value, yaw) }, { value: pitch, velocity: speed(pose.current.pitch.value, pitch) });
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (!current.active) {
      // A second tap soon after the first resets the toy, as a double click does.
      const tap = current.touch && event.type === "pointerup";
      const double = tap && event.timeStamp - lastTap.current < DOUBLE_TAP_MS;
      // A third tap starts over, so it never resets again.
      if (tap) lastTap.current = double ? -Infinity : event.timeStamp;
      // A press stopped any spin, so the toy rests from where it was held, inside its limits.
      still();
      return settle(double || release === "return");
    }
    setDragging(false);
    // A finger that drags gives no click to swallow.
    swallow.current = event.type === "pointerup" && !current.touch;
    // A pointer that stopped before it let go gives no spin.
    if (event.timeStamp - current.time > 80) still();
    settle(release === "return");
  };

  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys inside the toy type and move focus there; only keys on the turntable itself turn it, while it still has focus.
    // Keys with a modifier are the browser's, such as zoom or back.
    if (event.target !== event.currentTarget || document.activeElement !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      return settle(true);
    }
    const turns: Record<string, [number, number]> = { ArrowLeft: [-KEY_YAW, 0], ArrowRight: [KEY_YAW, 0], ArrowUp: [0, KEY_PITCH], ArrowDown: [0, -KEY_PITCH] };
    const step = turns[event.key];
    if (!step) return;
    event.preventDefault();
    stop();
    const times = event.shiftKey ? KEY_BIG : 1;
    const { yaw, pitch } = pose.current;
    show({ value: clamp(yaw.value + step[0] * times, ...yawRange), velocity: 0 }, { value: clamp(pitch.value + step[1] * times, ...pitchRange), velocity: 0 });
    if (release === "return") keyRest.current = setTimeout(() => settle(true), KEY_REST_MS);
  };

  const reset = (event: MouseEvent<HTMLDivElement>) => {
    if (!onControl(event.target)) settle(true);
  };

  // A drag on the toy, an image in it or a link that is the toy turns it and never carries it off; a control inside, such as a link or a text box, keeps its own.
  const native = (event: DragEvent<HTMLDivElement>) => {
    if (!onControl(event.target)) event.preventDefault();
  };

  const state: Turn = { ...turn, full: full !== false };
  const bodyStyle: CSSProperties = {
    ...(mode === "tilt" && { transform: `perspective(1000px) rotateX(${turn.pitch}deg) rotateY(${turn.yaw}deg)` }),
    ...(full && { width: `min(92vw, calc(92dvh * ${ratio}))` }),
  };

  return (
    <div
      ref={root}
      className={className ? `${ROOT} ${className}` : ROOT}
      style={style}
      data-full={full || undefined}
      data-dragging={dragging || undefined}
      {...(full === "overlay" && { role: "dialog", "aria-modal": true, "aria-label": label ?? "Full screen" })}
      {...(draggable && {
        tabIndex: 0,
        "aria-describedby": hint,
        onPointerDown: down,
        onPointerMove: move,
        onPointerUp: up,
        onPointerCancel: up,
        onKeyDown: key,
        onDoubleClick: reset,
        onDragStart: native,
      })}
    >
      <style href={ROOT} precedence="default">
        {CSS}
      </style>
      <div ref={body} className={BODY} style={bodyStyle}>
        {typeof children === "function" ? children(state) : children}
      </div>
      {draggable && (
        <span id={hint} className={HINT}>
          Drag or use the arrow keys to turn
        </span>
      )}
      {fullscreen && (
        <button type="button" className={BUTTON} aria-label={full ? "Exit full screen" : label ? `Full screen ${label}` : "Full screen"} onClick={fillOrLeave}>
          <Corners full={state.full} />
        </button>
      )}
    </div>
  );
}
