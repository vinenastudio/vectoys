/** `value` held between `lo` and `hi`. */
export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** The number a share `t` of the way from `a` to `b`; `t` is not held to 0..1. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A share from 0 to 1 eased in and out, slow at both ends and fastest in the middle; held to 0..1 first. */
export function ease(t: number): number {
  const share = clamp(t, 0, 1);
  return share * share * (3 - 2 * share);
}

/**
 * How far along segment `i` of `n` equal segments a progress `p` from 0 to 1
 * is, from 0 at the segment's start to 1 at its end, held there outside it:
 * `segment(0.6, 1, 2)` is 0.2.
 */
export const segment = (p: number, i: number, n: number) => clamp(p * n - i, 0, 1);

/** A keyframe: where it stands on a progress from 0 to 1, and the numbers it sets there. */
export type Keyframe = { readonly at: number; readonly [field: string]: number | undefined };

/** Every field a list of keyframes sets, besides `at`, each a number. */
export type Scrubbed<K extends Keyframe> = { [field in K extends unknown ? Exclude<keyof K, "at"> : never]: number };

export type ScrubOptions = {
  /** How each segment between two keyframes eases, from a share of it to a share of the change; `ease` by default. */
  readonly ease?: (t: number) => number;
};

/** The numbers a keyframe sets, besides `at`. */
const fields = (key: Keyframe) => Object.entries(key).filter((entry): entry is [string, number] => entry[0] !== "at" && typeof entry[1] === "number");

/**
 * Every field of `keys`, sorted by `at`, at progress `t`: within each segment
 * between two keyframes a field moves from one's value to the next's, eased
 * per segment. A keyframe without a field keeps the value the one before had,
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
  const share = to > from ? shape((t - start) / (end - start)) : 0;
  // Each field at the segment's two ends, carried over from the keyframes before.
  const first: Record<string, number> = {};
  for (const [field, value] of keys.flatMap(fields)) if (!(field in first)) first[field] = value;
  const at = (index: number) => ({ ...first, ...Object.fromEntries(keys.slice(0, index + 1).flatMap(fields)) });
  const [here, there] = [at(from), at(to)];
  return Object.fromEntries(Object.entries(here).map(([field, value]) => [field, lerp(value, there[field] ?? value, share)]));
}
