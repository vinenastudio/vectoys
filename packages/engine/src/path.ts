import type { Flat } from "./vector.ts";

/**
 * A computed number cut to 4 decimals, and -0 to 0, so markup reads the same
 * from the server's HTML as from the client.
 */
export const fixed = (value: number) => Math.round(value * 1e4) / 1e4 || 0;

// Path data is cut finer than a device pixel needs, to keep the markup short.
const cut = (value: number) => Math.round(value * 100) / 100 || 0;

/** An open run of points as SVG path data. */
export const line = (points: readonly Flat[]) => `M${points.map(([x, y]) => `${cut(x)} ${cut(y)}`).join("L")}`;

/** A closed outline as SVG path data. */
export const shape = (points: readonly Flat[]) => `${line(points)}Z`;

/** A rectangle (left, top, right, bottom) as closed path data, its top corners round by `high` and its bottom ones by `low`. */
export function panel([left, top, right, bottom]: readonly [number, number, number, number], high: number, low = 0): string {
  const corner = (radius: number, x: number, y: number) => (radius > 0 ? `A${fixed(radius)} ${fixed(radius)} 0 0 1 ${fixed(x)} ${fixed(y)}` : "");
  return [
    `M${fixed(left + high)} ${fixed(top)}H${fixed(right - high)}`,
    corner(high, right, top + high),
    `V${fixed(bottom - low)}`,
    corner(low, right - low, bottom),
    `H${fixed(left + low)}`,
    corner(low, left, bottom - low),
    `V${fixed(top + high)}`,
    corner(high, left + high, top),
    "Z",
  ].join("");
}
