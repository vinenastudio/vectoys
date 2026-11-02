import { clamp, settled, spring, type Spring } from "@vinena/vectoys";

/** The lowest and highest offset an axis may turn to, in degrees. */
export type Range = readonly [number, number];

// Past a limit a drag moves the toy this share of the way, so it feels held back.
const RESIST = 0.3;
// After a release the spin slows by this share every 16 milliseconds, and stops below this many degrees per second.
const FRICTION = 0.92;
const STOP = 10;

/** Where a drag to `value` shows the toy: as far as `value` inside the range, held back past it. */
export function rubber(value: number, [lo, hi]: Range): number {
  const edge = clamp(value, lo, hi);
  return edge + (value - edge) * RESIST;
}

/** The drag value that `rubber` shows at `shown`, so a new drag starts where the toy is. */
export function unrubber(shown: number, [lo, hi]: Range): number {
  const edge = clamp(shown, lo, hi);
  return edge + (shown - edge) / RESIST;
}

/** An axis on its way to rest after a release, and where it springs to, if anywhere yet. */
export type Glide = { axis: Spring; home: number | null };

/**
 * An axis `seconds` later after a release: it springs to `home` when there
 * is one, and coasts and slows otherwise. Once it coasts past a limit, the
 * limit becomes its home, so it springs back and rests there. At rest its
 * velocity is exactly 0.
 */
export function glide({ axis, home }: Glide, range: Range, seconds: number): Glide {
  const edge = clamp(axis.value, ...range);
  const target = home ?? (edge !== axis.value ? edge : null);
  if (target !== null) {
    const next = spring(axis, target, seconds);
    return { axis: settled(next, target, 0.01) ? { value: target, velocity: 0 } : next, home: target };
  }
  const velocity = axis.velocity * FRICTION ** ((seconds * 1000) / 16);
  if (Math.abs(velocity) < STOP) return { axis: { value: axis.value, velocity: 0 }, home };
  return { axis: { value: axis.value + velocity * seconds, velocity }, home };
}

/** The same turn as `yaw` within half a turn of 0, so a reset never spins the long way round. */
export const nearest = (yaw: number) => yaw - 360 * Math.round(yaw / 360);
