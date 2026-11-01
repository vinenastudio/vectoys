import { Phone, TURN } from "@vectoys/phone";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { CopyPrompt } from "../components/copy-command";
import { clamp, useInFocus, useReducedMotion } from "../motion";
import { START, TodoApp, todosReducer } from "./todo";

const PROMPT = "Read https://vectoys.com/prompt.txt and follow it on my landing page.";

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** How far along `from` to `to` the time `t` is, eased, from 0 to 1. */
const span = (t: number, from: number, to: number) => ease(clamp((t - from) / (to - from), 0, 1));
const mix = (a: number, b: number, share: number) => a + (b - a) * share;

/*
 * The loop, in milliseconds: the phone shows its back, turns to the front, a
 * cursor taps the box of the first to-do on its glass and really checks it,
 * then the phone eases to a three-quarter view and sways, and keeps turning
 * the same way round to its back, where the to-do is unchecked again out of
 * sight. The page draws it at STILL, the three-quarter view with the list as
 * it starts, and the loop starts from there, so the first frame is in the HTML
 * and reduced motion keeps it. Once the visitor touches the app, the cursor is
 * gone for good, so the loop never changes a list someone is using.
 */
const LOOP = 12000;
const STILL = 8000;
const BACK = TURN.yaw + 180;
const FRONT = 0;
const QUARTER = TURN.yaw;
// How long the clock may skip in one frame, as after a hidden tab comes back.
const LONGEST_FRAME = 200;
// The loop redraws about 30 times a second.
const FRAME_MS = 33;

/** The to-do the cursor checks, when the cursor taps it, and when it is unchecked again with the glass facing away. */
const DEMO = 1;
const TAP = 3800;
const UNTAP = 250;

function poseAt(t: number) {
  if (t < 500) return { yaw: BACK, pitch: -10 };
  if (t < 2100) {
    const share = span(t, 500, 2100);
    return { yaw: mix(BACK, FRONT, share), pitch: mix(-10, -4, share) };
  }
  if (t < 6600) return { yaw: FRONT, pitch: -4 };
  if (t < STILL) {
    const share = span(t, 6600, STILL);
    return { yaw: mix(FRONT, QUARTER, share), pitch: mix(-4, -10, share) };
  }
  if (t < 10600) {
    const angle = ((t - STILL) / 2600) * Math.PI * 2;
    return { yaw: QUARTER + 6 * Math.sin(angle), pitch: -10 + 1.5 * Math.sin(angle * 2) };
  }
  return { yaw: mix(QUARTER, QUARTER - 180, span(t, 10600, LOOP)), pitch: -10 };
}

/** Whether the glass faces the eye enough to hold still under a pointer. */
const facing = (t: number) => t >= 2100 && t < 10600;

/** Whether the clock went past `mark` on its way from `from` to `to`, round the end of the loop too. */
export const passed = (from: number, to: number, mark: number) => (from <= to ? from < mark && mark <= to : from < mark || mark <= to);

/** Where the box to tap sits on the glass, in the glass's own pixels. */
type Point = { x: number; y: number };

/** The cursor that comes up to the box, presses it and leaves, in the glass's own pixels. */
function cursorAt(t: number, box: Point) {
  const hidden = { x: 0, y: 0, opacity: 0, press: 0 };
  if (t < 2300 || t >= 5400) return hidden;
  const opacity = clamp((t - 2300) / 300, 0, 1) * (1 - clamp((t - 5000) / 400, 0, 1));
  const press = span(t, 3600, TAP) - span(t, TAP, 4000);
  if (t < 4300) {
    const share = span(t, 2600, 3600);
    return { x: mix(310, box.x, share), y: mix(640, box.y, share), opacity, press };
  }
  const share = span(t, 4300, 5300);
  return { x: mix(box.x, 330, share), y: mix(box.y, 620, share), opacity, press: 0 };
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <path d="M5 3l14 8.5-6.2 1.3L9.6 19z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/** The loop's clock. It runs while `running`, and holds where it is otherwise. `reset` moves it to a time. */
function useLoopClock(running: boolean) {
  const [t, setT] = useState(STILL);
  const clock = useRef(STILL);
  useEffect(() => {
    if (!running) return;
    let id = 0;
    let last = performance.now();
    let drawn = 0;
    const step = (now: number) => {
      id = requestAnimationFrame(step);
      clock.current = (clock.current + Math.min(now - last, LONGEST_FRAME)) % LOOP;
      last = now;
      if (now - drawn < FRAME_MS) return;
      drawn = now;
      setT(clock.current);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [running]);
  const reset = (time: number) => {
    clock.current = time;
    setT(time);
  };
  return [t, reset] as const;
}

/** The phone as a hand or a key left it. */
type Hand = { yaw: number; pitch: number };

const REST: Hand = { yaw: QUARTER, pitch: TURN.pitch };
// Square on to the eye, where the app is easy to use.
const FACE: Hand = { yaw: FRONT, pitch: -4 };
// The same turn per pixel and pitch limits as the phone in It's just SVG, so the view never breaks.
const YAW_PER_PIXEL = 0.5;
const PITCH_PER_PIXEL = 0.3;
const PITCH = [-45, 25] as const;
const KEY_YAW = 15;
const KEY_PITCH = 5;
// A drag starts once the pointer has moved this far, so a click or a tap on the glass stays a click.
const DRAG_FROM = 6;
// After a drag the spin slows by this share every 16 milliseconds, and stops below this many degrees per millisecond.
const FRICTION = 0.92;
const SPIN_STOP = 0.01;
const SETTLE_MS = 900;
// How long the phone rests after the last arrow key before it eases back.
const KEY_REST_MS = 1500;
// A touch on these presses, swipes or types in them, and never turns the phone.
const CONTROLS = "button, input, .todo-row";

type Drag = { id: number; touch: boolean; x: number; y: number; base: Hand; active: boolean; lastYaw: number; lastTime: number; speed: number };

/** Whether the element is on screen at all, kept up to date. */
function useOnScreen(ref: React.RefObject<Element | null>) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

function HeroPhone() {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const inFocus = useInFocus(stage);
  const onScreen = useOnScreen(stage);
  const [todos, dispatch] = useReducer(todosReducer, START);
  const [pointer, setPointer] = useState(false);
  const [box, setBox] = useState<Point | null>(null);
  const [held, setHeld] = useState(false);
  const [hand, setHand] = useState<Hand | null>(null);
  const [dragging, setDragging] = useState(false);
  // Whether the loop may still tap the list: until the visitor first touches, focuses or types in the app.
  const [demo, setDemo] = useState(true);
  const [t, resetClock] = useLoopClock(inFocus && onScreen && !reduced && !held && !hand);
  const drag = useRef<Drag | null>(null);
  const settling = useRef<() => void>(() => {});
  const shown = useRef<Hand>(REST);
  // Whether focus is in the app, so the phone faces the eye while someone uses it.
  const inside = useRef(false);
  const lastT = useRef(t);

  useEffect(() => () => settling.current(), []);

  // A pointer on the phone holds the loop once the glass faces the eye, so the visitor can use the app.
  useEffect(() => {
    setHeld(pointer && facing(t));
  }, [pointer, t]);

  // The cursor checks its to-do as the clock runs past the tap, and the to-do is unchecked again with the glass turned away.
  useEffect(() => {
    const from = lastT.current;
    lastT.current = t;
    // A jump of the clock, as when a hand lets go and the loop starts again from STILL, is not the loop running past.
    if (!demo || (t - from + LOOP) % LOOP > 1000) return;
    if (passed(from, t, TAP)) dispatch({ type: "set", id: DEMO, done: true });
    if (passed(from, t, UNTAP)) dispatch({ type: "set", id: DEMO, done: false });
  }, [t, demo]);

  useLayoutEffect(() => {
    const measure = () => {
      const element = glass.current?.querySelector<HTMLElement>(`[data-todo="${DEMO}"] .todo-check`);
      if (!element || !glass.current) return;
      let x = element.offsetWidth / 2;
      let y = element.offsetHeight / 2;
      for (let node: HTMLElement | null = element; node && node !== glass.current; node = node.offsetParent as HTMLElement | null) {
        x += node.offsetLeft;
        y += node.offsetTop;
      }
      setBox({ x, y });
    };
    measure();
    void document.fonts?.ready.then(measure);
  }, []);

  const pose = poseAt(t);
  const now: Hand = hand ?? pose;
  shown.current = now;
  const cursor = box && demo && !held && !hand ? cursorAt(t, box) : null;

  /**
   * After a hand lets go: the spin runs on and slows, then the phone eases back
   * to the three-quarter view and the loop goes on from there, or, with focus
   * in the app, to face the eye and stays there. With reduced motion it stays
   * where it was left.
   */
  const settle = (from: Hand, speed: number) => {
    settling.current();
    if (reduced) return;
    let id = 0;
    let last = performance.now();
    let spin = speed;
    let current = from;
    let easeFrom: Hand | null = null;
    let easeStart = 0;
    let target = REST;
    const step = (time: number) => {
      const elapsed = Math.min(time - last, LONGEST_FRAME);
      last = time;
      if (!easeFrom && Math.abs(spin) > SPIN_STOP) {
        current = { ...current, yaw: current.yaw + spin * elapsed };
        spin *= FRICTION ** (elapsed / 16);
        setHand(current);
      } else {
        if (!easeFrom) {
          target = inside.current ? FACE : REST;
          // The nearest way round to the pose, however many turns the hand gave it.
          easeFrom = { ...current, yaw: current.yaw - 360 * Math.round((current.yaw - target.yaw) / 360) };
          easeStart = time;
        }
        const share = span(time, easeStart, easeStart + SETTLE_MS);
        setHand({ yaw: mix(easeFrom.yaw, target.yaw, share), pitch: mix(easeFrom.pitch, target.pitch, share) });
        if (share >= 1) {
          settling.current = () => {};
          if (target === REST) {
            resetClock(STILL);
            setHand(null);
          }
          return;
        }
      }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    settling.current = () => cancelAnimationFrame(id);
  };

  // Focus coming into the app turns the phone to face the eye; focus leaving lets it go back to the loop.
  const focusIn = () => {
    setDemo(false);
    if (inside.current) return;
    inside.current = true;
    if (!reduced) settle(shown.current, 0);
    else setHand(FACE);
  };

  const focusOut = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    inside.current = false;
    if (!reduced) settle(shown.current, 0);
    else setHand(null);
  };

  const down = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const onGlass = glass.current?.contains(target) ?? false;
    const touch = event.pointerType === "touch";
    // A mouse or pen on the glass uses the app; only the device's own drawing starts a drag. A touch on the glass turns the phone too, unless it is on a control or a row.
    if (onGlass ? !touch || target.closest(CONTROLS) : !(target instanceof SVGPathElement)) return;
    if (!touch) {
      event.preventDefault();
      // Holds the pointer so a release outside the stage still ends the drag.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.current = { id: event.pointerId, touch, x: event.clientX, y: event.clientY, base: shown.current, active: false, lastYaw: shown.current.yaw, lastTime: event.timeStamp, speed: 0 };
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.active) {
      if (event.buttons === 0) {
        drag.current = null;
        return;
      }
      if (Math.hypot(dx, dy) < DRAG_FROM) return;
      current.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      settling.current();
      setDragging(true);
    }
    // Touch turns the phone left and right only, so an upward swipe still scrolls the page.
    const yaw = current.base.yaw + dx * YAW_PER_PIXEL;
    const pitch = current.touch ? current.base.pitch : clamp(current.base.pitch - dy * PITCH_PER_PIXEL, ...PITCH);
    const elapsed = event.timeStamp - current.lastTime;
    if (elapsed > 0) current.speed = (yaw - current.lastYaw) / elapsed;
    current.lastYaw = yaw;
    current.lastTime = event.timeStamp;
    setHand({ yaw, pitch });
  };

  const up = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (!current.active) return;
    setDragging(false);
    // A pointer that stopped before it let go gives no spin.
    const still = event.timeStamp - current.lastTime > 80;
    settle(shown.current, still ? 0 : current.speed);
  };

  const key = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Keys in the app move its caret and its focus; only keys on the phone itself turn it.
    if (event.target !== event.currentTarget) return;
    const turns: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_YAW, 0],
      ArrowRight: [KEY_YAW, 0],
      ArrowUp: [0, KEY_PITCH],
      ArrowDown: [0, -KEY_PITCH],
    };
    const turn = turns[event.key];
    if (!turn) return;
    event.preventDefault();
    settling.current();
    const from = shown.current;
    const next = { yaw: from.yaw + turn[0], pitch: clamp(from.pitch + turn[1], ...PITCH) };
    setHand(next);
    if (reduced) return;
    const timer = setTimeout(() => settle(next, 0), KEY_REST_MS);
    settling.current = () => clearTimeout(timer);
  };

  return (
    <div ref={stage} className="hero-stage">
      <div
        className={`hero-phone${dragging ? " hero-phone-dragging" : ""}`}
        data-replay-block=""
        role="group"
        aria-label="3D phone, use arrow keys to turn it"
        tabIndex={0}
        onKeyDown={key}
        onPointerEnter={() => setPointer(true)}
        onPointerLeave={() => setPointer(false)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <Phone yaw={now.yaw} pitch={now.pitch} label="A phone with a working to-do app on its screen">
          {/* Focusable itself, so a click on the glass between controls keeps focus in the app. */}
          <div ref={glass} className="todo-glass" tabIndex={-1} onPointerDown={() => setDemo(false)} onFocus={focusIn} onBlur={focusOut}>
            <TodoApp todos={todos} dispatch={dispatch} reduced={reduced} live={!demo} />
            {cursor && cursor.opacity > 0 && (
              <div className="todo-cursor" aria-hidden="true" style={{ transform: `translate(${cursor.x - 6}px, ${cursor.y - 4}px) scale(${1 - 0.14 * cursor.press})`, opacity: cursor.opacity }}>
                <Arrow />
              </div>
            )}
          </div>
        </Phone>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <h1 id="hero-title">Draw anything on the web with SVGs</h1>
          <p className="lede">
            Phones, laptops and small toys for your React landing page. The screen is live HTML you can tap and type into. No WebGL, no images,
            MIT.
          </p>
          <div className="hero-prompt">
            <CopyPrompt prompt={PROMPT} caption="Prompt for your agent" placement="hero" />
            <a href="/prompt.txt" className="hero-link">
              Read the full prompt
            </a>
          </div>
          <p className="hero-note">That phone is live HTML. Add a to-do.</p>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}
