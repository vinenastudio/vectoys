/** `value` held between `lo` and `hi`. */
export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** The number a share `t` of the way from `a` to `b`; `t` is not held to 0..1. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A share from 0 to 1 eased in and out, slow at both ends and fastest in the middle; held to 0..1 first. */
export function ease(t: number): number {
  const share = clamp(t, 0, 1);
  return share * share * (3 - 2 * share);
}

// How far the back eases pull past their ends, as Robert Penner's set them.
const BACK = 1.70158;

/** A share that first draws back below 0, then speeds to 1, as a wind up before a throw; held to 0..1 first. */
export function backIn(t: number): number {
  const share = clamp(t, 0, 1);
  return share * share * ((BACK + 1) * share - BACK);
}

/** A share that shoots past 1 and comes back to it, as a catch that gives a little; held to 0..1 first. */
export const backOut = (t: number) => 1 - backIn(1 - t);

/** Back in over the first half and back out over the second. */
export function backInOut(t: number): number {
  const share = clamp(t, 0, 1);
  const pull = BACK * 1.525;
  const half = (s: number) => s * s * ((pull + 1) * s - pull);
  return share < 0.5 ? half(2 * share) / 2 : 1 - half(2 - 2 * share) / 2;
}

// A ball let go at 0 that falls to 1 and bounces three times, each bounce
// leaving at RESTITUTION of the speed it landed with, its height the square of
// that; the fall and the bounces together take the whole share.
const RESTITUTION = 0.35;
const BOUNCES = [1, ...[1, 2, 3].map((bounce) => 2 * RESTITUTION ** bounce)];
const FALL = 1 / BOUNCES.reduce((sum, length) => sum + length, 0);

/**
 * A share that falls to 1, bounces up a little a few times, each lower and
 * shorter, and lands on 1 for good at the end: a damped bounce that never
 * goes past 1. Held to 0..1 first.
 */
export function settle(t: number): number {
  let share = clamp(t, 0, 1) / FALL;
  if (share <= 1) return share * share;
  share -= 1;
  for (const [bounce, length] of BOUNCES.slice(1).entries()) {
    if (share <= length || bounce === BOUNCES.length - 2) {
      // A parabola over this bounce, from 1 up to its height and back to 1.
      const along = Math.min(share / length, 1);
      return 1 - RESTITUTION ** (2 * (bounce + 1)) * 4 * along * (1 - along);
    }
    share -= length;
  }
  return 1;
}

/**
 * The ease CSS writes `cubic-bezier(x1, y1, x2, y2)`: the curve from (0, 0)
 * to (1, 1) through those two handles, as a share of time to a share of the
 * change. `x1` and `x2` are held to 0..1, as CSS holds them; `y1` and `y2`
 * may leave it to overshoot.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const [ax, bx] = [clamp(x1, 0, 1), clamp(x2, 0, 1)];
  const curve = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t) => {
    const share = clamp(t, 0, 1);
    // The curve's x only grows, so halving finds the point at any time.
    let [lo, hi] = [0, 1];
    for (let step = 0; step < 30; step++) {
      const mid = (lo + hi) / 2;
      if (curve(ax, bx, mid) < share) lo = mid;
      else hi = mid;
    }
    return curve(y1, y2, (lo + hi) / 2);
  };
}

/** The eases a keyframe can name. */
export const EASES = { linear: (t: number) => clamp(t, 0, 1), ease, backIn, backOut, backInOut, settle } as const;

/** How a segment eases: one of `EASES` by name, any function from a share of time to a share of the change, or a cubic Bézier's four numbers. */
export type Easing = keyof typeof EASES | ((t: number) => number) | readonly [number, number, number, number];

/** An easing as its function. */
export function easing(shape: Easing): (t: number) => number {
  if (typeof shape === "function") return shape;
  if (typeof shape === "string") return EASES[shape];
  return cubicBezier(...shape);
}

/**
 * How far along segment `i` of `n` equal segments a progress `p` from 0 to 1
 * is, from 0 at the segment's start to 1 at its end, held there outside it:
 * `segment(0.6, 1, 2)` is 0.2.
 */
export const segment = (p: number, i: number, n: number) => clamp(p * n - i, 0, 1);

/**
 * A keyframe: where it stands on a progress from 0 to 1, the numbers it sets
 * there, and, as `ease`, how the segment that ends at it eases, in place of
 * the one `scrub` is given.
 */
export type Keyframe = { readonly at: number; readonly ease?: Easing; readonly [field: string]: number | Easing | undefined };

/** Every field a list of keyframes sets, besides `at` and `ease`, each a number. */
export type Scrubbed<K extends Keyframe> = { [field in K extends unknown ? Exclude<keyof K, "at" | "ease"> : never]: number };

export type ScrubOptions = {
  /** How each segment between two keyframes eases, from a share of it to a share of the change; `ease` by default. */
  readonly ease?: (t: number) => number;
};

/** The numbers a keyframe sets, besides `at`. */
const fields = (key: Keyframe) => Object.entries(key).filter((entry): entry is [string, number] => entry[0] !== "at" && entry[0] !== "ease" && typeof entry[1] === "number");

/**
 * Every field of `keys`, sorted by `at`, at progress `t`: within each segment
 * between two keyframes a field moves from one's value to the next's, eased
 * per segment, by the `ease` of the keyframe that ends the segment if it has
 * one. A keyframe without a field keeps the value the one before had,
 * and before the first keyframe that sets a field it holds that first value;
 * before the first keyframe and after the last, every field holds.
 *
 * `scrub(0.2, [{ at: 0, lid: 0, yaw: 0 }, { at: 0.12, lid: 1 }, { at: 0.3, yaw: -20 }])`
 * is `{ lid: 1, yaw: -8.34 }`: the lid is open, and the yaw, held at 0 until
 * 0.12, is on its way to -20 by 0.3.
 */
export function scrub<K extends Keyframe>(t: number, keys: readonly K[], options?: ScrubOptions): Scrubbed<K>;
export function scrub(t: number, keys: readonly Keyframe[], { ease: shape = ease }: ScrubOptions = {}): Record<string, number> {
  // The segment `t` falls in, from the last keyframe at or before it to the
  // one after; before the first and after the last, both ends are that one.
  const next = keys.findIndex((key) => key.at > t);
  const [from, to] = next === -1 ? [keys.length - 1, keys.length - 1] : next === 0 ? [0, 0] : [next - 1, next];
  const [start, end] = [keys[from]?.at ?? 0, keys[to]?.at ?? 0];
  const own = keys[to]?.ease;
  const share = to > from ? (own === undefined ? shape : easing(own))((t - start) / (end - start)) : 0;
  // Each field at the segment's two ends, carried over from the keyframes before.
  const first: Record<string, number> = {};
  for (const [field, value] of keys.flatMap(fields)) if (!(field in first)) first[field] = value;
  const at = (index: number) => ({ ...first, ...Object.fromEntries(keys.slice(0, index + 1).flatMap(fields)) });
  const [here, there] = [at(from), at(to)];
  return Object.fromEntries(Object.entries(here).map(([field, value]) => [field, lerp(value, there[field] ?? value, share)]));
}
