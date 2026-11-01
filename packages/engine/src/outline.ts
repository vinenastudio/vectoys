import type { Flat } from "./vector.ts";

/** A rectangle as (left, top, right, bottom). */
export type Box = readonly [number, number, number, number];

/**
 * A quarter turn as (cos, sin) in steps of about `step` units along the arc,
 * a tenth by default, its second half mirrored from its first so left and
 * right sides match exactly.
 */
export function quarter(radius: number, step = 0.1): Flat[] {
  const steps = Math.max(3, Math.ceil(radius / step));
  const half = Array.from({ length: Math.floor(steps / 2) + 1 }, (_, step): Flat => {
    const turn = (Math.PI / 2) * (step / steps);
    return [Math.cos(turn), Math.sin(turn)];
  });
  return Array.from({ length: steps + 1 }, (_, step): Flat => {
    if (step < half.length) return half[step]!;
    const [c, s] = half[steps - step]!;
    return [s, c];
  });
}

/**
 * The outline of a rounded rectangle from (left, top) to (right, bottom),
 * clockwise from its top right corner, with radii for the top and the bottom
 * corners, `bottomEdge` run along the bottom from right to left and `topEdge`
 * along the top from left to right. `step` is how far apart the corners'
 * points stand, as `quarter` has it.
 */
export function rounded(
  [left, top, right, bottom]: Box,
  [high, low]: Flat,
  bottomEdge: readonly Flat[] = [],
  topEdge: readonly Flat[] = [],
  step?: number,
): Flat[] {
  const [up, down] = [quarter(high, step), quarter(low, step)];
  return [
    ...up.map(([c, s]): Flat => [right - high + high * s, top + high - high * c]),
    ...down.map(([c, s]): Flat => [right - low + low * c, bottom - low + low * s]),
    ...bottomEdge,
    ...down.map(([c, s]): Flat => [left + low - low * s, bottom - low + low * c]),
    ...up.map(([c, s]): Flat => [left + high - high * c, top + high - high * s]),
    ...topEdge,
  ];
}

/**
 * A slot cut into an edge, from left to right as (across from its middle,
 * how far in from the edge): `width` along the edge, `depth` in, a flat
 * floor with ends rounded by `end`, and a `fillet` where it leaves the edge.
 */
export function slot(width: number, depth: number, end: number, fillet: number): Flat[] {
  const side = width / 2 - fillet;
  const left: Flat[] = [
    ...quarter(fillet).map(([c, s]): Flat => [-side - fillet + fillet * s, fillet - fillet * c]),
    ...quarter(end).map(([c, s]): Flat => [-side + end - end * c, depth - end + end * s]),
  ];
  return [...left, ...[...left].reverse().map(([x, y]): Flat => [-x, y])];
}

/** The outer outline of points on screen, anticlockwise. */
export function hull(points: readonly Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: readonly Flat[]) => {
    const kept: Flat[] = [];
    for (const point of list) {
      while (kept.length >= 2 && turn(kept[kept.length - 2]!, kept[kept.length - 1]!, point) <= 0) {
        kept.pop();
      }
      kept.push(point);
    }
    kept.pop();
    return kept;
  };
  return [...chain(sorted), ...chain(sorted.reverse())];
}

/** Which way round an outline runs, as the sign of its area. */
export function winding(points: readonly Flat[]): number {
  return Math.sign(
    points.reduce((sum, [x, y], index) => {
      const [nx, ny] = points[(index + 1) % points.length]!;
      return sum + x * ny - nx * y;
    }, 0),
  );
}

/** A convex outline moved out by `distance` all round, either way it runs. */
export function grow(points: readonly Flat[], distance: number): Flat[] {
  const sense = winding(points);
  const out = ([ax, ay]: Flat, [bx, by]: Flat): Flat => {
    const length = Math.hypot(bx - ax, by - ay);
    return [(sense * (by - ay)) / length, (-sense * (bx - ax)) / length];
  };
  return points.map((point, index): Flat => {
    const first = out(points[(index + points.length - 1) % points.length]!, point);
    const second = out(point, points[(index + 1) % points.length]!);
    const [mx, my] = [first[0] + second[0], first[1] + second[1]];
    const length = Math.hypot(mx, my);
    const reach = distance / ((mx * first[0] + my * first[1]) / length);
    return [point[0] + (mx / length) * reach, point[1] + (my / length) * reach];
  });
}

/**
 * The part of a closed outline where `side` is not above 0, cut where it
 * crosses, with `between` the point a share of the way from one point to the
 * next. Works on screen points and on points in space alike.
 */
export function keep<P extends readonly number[]>(
  points: readonly P[],
  side: (point: P) => number,
  between: (from: P, to: P, share: number) => P,
): P[] {
  return points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]!;
    const [here, there] = [side(point), side(next)];
    const kept = here <= 0 ? [point] : [];
    return here * there < 0 ? [...kept, between(point, next, here / (here - there))] : kept;
  });
}

/** The point a share of the way from one point to another, in any dimension. */
export const toward = <P extends readonly number[]>(from: P, to: P, share: number): P =>
  from.map((value, axis) => value + (to[axis]! - value) * share) as unknown as P;

/** How near a point on screen lies to a segment, as its squared distance to the segment's nearest point. */
export function nearness([px, py]: Flat, [ax, ay]: Flat, [bx, by]: Flat): number {
  const [dx, dy] = [bx - ax, by - ay];
  const share = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return (ax + dx * share - px) ** 2 + (ay + dy * share - py) ** 2;
}
