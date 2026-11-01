import { fixed } from "@vinena/vectoys";
import type { Ref, SVGProps } from "react";

/** One stop of a `Gradient`: its offset from 0 to 1, its color and that color's opacity, whole if left out. */
export type Stop = readonly [offset: number, color: string, opacity?: number];

/**
 * A linear gradient from stops of color and opacity, for light that runs
 * across a face: a sheen, a falloff, a specular band. Any other attribute,
 * such as its ends in `gradientUnits="userSpaceOnUse"` or a `ref` a pose
 * writes them through, passes on.
 */
export function Gradient({ id, stops, ...rest }: { id: string; stops: readonly Stop[] } & SVGProps<SVGLinearGradientElement>) {
  return (
    <linearGradient id={id} {...rest}>
      {stops.map(([offset, stopColor, stopOpacity]) => (
        <stop key={offset} offset={offset} style={{ stopColor, stopOpacity }} />
      ))}
    </linearGradient>
  );
}

/**
 * A fine grain, as of bead blasted or brushed metal, to fill over a face
 * already painted: a square tile `size` across of `count` specks `speck`
 * wide, each lighter or darker by up to `strength`, scattered by a fixed
 * seed so the server and the client draw the same. `stretch` draws each
 * speck that many times as wide as tall, toward a brushed look. It is drawn
 * once into the tile, with no filter, so it costs nothing per frame.
 */
export function Grain({ id, size = 3, count = 140, speck = 0.07, strength = 0.07, stretch = 1, seed = 7 }: { id: string; size?: number; count?: number; speck?: number; strength?: number; stretch?: number; seed?: number }) {
  let state = seed;
  const next = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const specks = Array.from({ length: count }, (_, index) => {
    const [x, y, light, share] = [next() * size, next() * size, next() < 0.5, next()];
    return <rect key={index} x={fixed(x)} y={fixed(y)} width={fixed(speck * stretch)} height={speck} fill={light ? "white" : "black"} fillOpacity={fixed(strength * (0.3 + 0.7 * share))} />;
  });
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size}>
      {specks}
    </pattern>
  );
}

/** Stops from both ends of a gradient toward its middle, as `[offset, value]` pairs: the half given, then mirrored past 0.5. */
export const mirrored = (half: readonly (readonly [number, number])[]) => [
  ...half,
  ...[...half]
    .filter(([offset]) => offset < 0.5)
    .reverse()
    .map(([offset, value]): readonly [number, number] => [fixed(1 - offset), value]),
];

/**
 * The glass of a `Screen`, laid over its content: a faint reflection of a
 * window up and to the left, and the glass's edge sunk a little in its
 * frame. It takes no pointer events, so the content stays live under it.
 */
export function Glare({ opacity = 1, ref }: { opacity?: number; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity,
        background: "linear-gradient(118deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.04) 30%, transparent 46%, transparent 74%, rgb(255 255 255 / 0.03) 88%, transparent)",
        boxShadow: "inset 0 0 0 0.1cqw rgb(0 0 0 / 0.7), inset 0 0.3cqw 0.9cqw rgb(0 0 0 / 0.35)",
      }}
    />
  );
}
