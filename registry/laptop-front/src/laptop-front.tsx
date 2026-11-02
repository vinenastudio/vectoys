import { fixed } from "@vinena/vectoys";
import { Screen, Stage, type StyleWithVariables } from "@vinena/vectoys-react";
import { memo, useId, type CSSProperties, type ReactNode } from "react";
import { FRONT } from "./geometry";

// Straight on, the aluminum is the page's finish, silver by default. Every
// tone is a share of it toward black, as measured on a silver machine's
// renders, so a dark finish such as #3d3b3e reads as a space black one. The
// gasket, the glass and the hinge's band, #0c0c0c on average, darker toward
// the base, are the machine's own near blacks.
const FINISH = "var(--vectoys-finish, #f0f1f3)";
const tone = (share: number) => (share >= 100 ? FINISH : `color-mix(in srgb, ${FINISH} ${share}%, black)`);
const GASKET = "#232323";
const GASKET_LINE = "#2c2c2c";
const HINGE_LINE = "#1a1a1a";
// The base's face from its top down, in its middle: a bright top edge, light
// over its upper half, darkest where its rounded underside turns away, then a
// bright lip and a dark bottom edge.
const FACE: readonly (readonly [number, number])[] = [
  [0, 99],
  [0.012, 99],
  [0.03, 92],
  [0.29, 90],
  [0.37, 88],
  [0.42, 87],
  [0.48, 83],
  [0.5, 80],
  [0.53, 74],
  [0.56, 67],
  [0.61, 60],
  [0.66, 54],
  [0.72, 54],
  [0.77, 56],
  [0.82, 64],
  [0.88, 77],
  [0.92, 89],
  [0.935, 83],
  [0.95, 89],
  [0.96, 82],
  [0.975, 70],
  [1, 57],
];
// Toward its ends the face takes one even tone, as the light falls off, with
// a bright streak where the end turns away; as shares of the base's width.
const ENDS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.04, 1],
  [0.07, 0.75],
  [0.11, 0.5],
  [0.17, 0.3],
  [0.25, 0.15],
  [0.32, 0.05],
  [0.38, 0],
];
const STREAK: readonly (readonly [number, number])[] = [
  [0, 0.2],
  [0.0045, 0.2],
  [0.008, 0.55],
  [0.0105, 0.85],
  [0.0135, 0.7],
  [0.0195, 0.1],
  [0.025, 0],
];
// The feet: an aluminum ring under the face, a dark line, then the dark pad,
// round so each is lighter in its middle and at its very sides.
const FOOT: readonly (readonly [number, number])[] = [
  [0, 87],
  [0.45, 87],
  [0.5, 13],
  [0.56, 29],
  [0.92, 29],
  [1, 22],
];
const FOOT_ROUND: readonly (readonly [number, number])[] = [
  [0, 0.08],
  [0.05, 0.08],
  [0.14, 0.3],
  [0.3, 0.12],
  [0.5, 0],
];

/** Stops from both ends of a gradient toward its middle, mirrored. */
const mirrored = (half: readonly (readonly [number, number])[]) => [
  ...half,
  ...[...half]
    .filter(([offset]) => offset < 0.5)
    .reverse()
    .map(([offset, value]): readonly [number, number] => [fixed(1 - offset), value]),
];

const stops = (tones: readonly (readonly [number, number])[]) =>
  tones.map(([offset, share]) => <stop key={offset} offset={offset} style={{ stopColor: tone(share) }} />);

const across = (share: number) => `${fixed(share * 100)}%`;
const [ACROSS, DOWN] = [across(FRONT.round / FRONT.glass.width), across(FRONT.round / FRONT.glass.height)];
const GLASS_STYLE: CSSProperties = {
  overflow: "hidden",
  background: "#0d0d0d",
  borderRadius: `${ACROSS} ${ACROSS} 0 0 / ${DOWN} ${DOWN} 0 0`,
  clipPath: `inset(0 round ${ACROSS} ${ACROSS} 0 0 / ${DOWN} ${DOWN} 0 0)`,
  containerType: "inline-size",
};
const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** The two finishes the aluminum comes in. */
const FINISHES = { silver: "#f0f1f3", black: "#3d3b3e" } as const;

type LaptopFrontProps = {
  /** The aluminum's color; by default the page's `--vectoys-finish`, else silver. */
  finish?: keyof typeof FINISHES;
  /** The laptop's name for assistive technology. */
  label?: string;
  /** Live content on the display, laid out as on a screen about 1280 pixels wide. */
  children?: ReactNode;
};

/** A 14 inch laptop straight on, drawn flat, with live content on its display under the notch. */
export const LaptopFront = memo(function LaptopFront({ finish, children, label = "Laptop" }: LaptopFrontProps) {
  const id = `laptop-${FRONT.id}-${useId().replace(/[^\w-]/g, "")}`;
  const { art, notch, camera } = FRONT;
  const url = (name: string) => `url(#${id}-${name})`;
  const look: StyleWithVariables = finish ? { "--vectoys-finish": FINISHES[finish] } : {};

  const glass = (
    <Screen camera={camera} pose={FRONT.pose} rect={FRONT.glass} style={GLASS_STYLE}>
      <div style={FILL}>{children}</div>
      <svg
        viewBox={`0 0 ${fixed(notch.width)} ${notch.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: across(notch.left),
          top: 0,
          width: across(notch.across),
          height: across(notch.down),
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <path d={notch.path} fill="black" />
        <circle cx={notch.lens.x} cy={notch.lens.y} r={0.35} fill="#111112" />
        <circle cx={notch.lens.x} cy={notch.lens.y} r={0.11} fill="#1b3048" />
        <circle cx={notch.lens.x} cy={fixed(notch.lens.y - 0.04)} r={0.04} fill="#2d5c86" />
      </svg>
    </Screen>
  );

  return (
    <Stage role={children == null ? "img" : "group"} label={label} camera={camera} overlay={glass} style={look}>
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          {stops(FACE)}
        </linearGradient>
        <linearGradient id={`${id}-ends`} x1="0" y1="0" x2="1" y2="0">
          {mirrored(ENDS).map(([offset, opacity]) => (
            <stop key={offset} offset={offset} style={{ stopColor: tone(62), stopOpacity: opacity }} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-streak`} x1="0" y1="0" x2="1" y2="0">
          {mirrored(STREAK).map(([offset, opacity]) => (
            <stop key={offset} offset={offset} style={{ stopColor: FINISH, stopOpacity: opacity }} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-hinge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#161616" />
          <stop offset="1" stopColor="#030303" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={art.rimFade}>
          {stops([
            [0, 66],
            [1, 73],
          ])}
        </linearGradient>
        <linearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={art.rimFade}>
          {stops([
            [0, 60],
            [1, 67],
          ])}
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          {stops([
            [0, 15],
            [0.5, 30],
            [0.85, 75],
            [1, 90],
          ])}
        </linearGradient>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
          {stops([
            [0, 96],
            [0.9, 100],
          ])}
        </linearGradient>
        <linearGradient id={`${id}-feet`} gradientUnits="userSpaceOnUse" x1="0" y1={art.feetTop} x2="0" y2={art.feetBottom}>
          {stops(FOOT)}
        </linearGradient>
        <linearGradient id={`${id}-foot`} x1="0" y1="0" x2="1" y2="0">
          {mirrored(FOOT_ROUND).map(([offset, opacity]) => (
            <stop key={offset} offset={offset} style={{ stopColor: "black", stopOpacity: opacity }} />
          ))}
        </linearGradient>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="0.12" />
        </filter>
        <clipPath id={`${id}-scoop`}>
          <path d={art.scoop} />
        </clipPath>
      </defs>
      {art.feet.map((foot) => (
        <g key={foot}>
          <path d={foot} fill={url("feet")} />
          <path d={foot} fill={url("foot")} />
        </g>
      ))}
      <path d={art.edge} fill={url("edge")} />
      <path d={art.rim} fill={url("rim")} />
      <path d={art.gasket} fill={GASKET} />
      <path d={art.gasketLine} fill={GASKET_LINE} />
      <path d={art.glass} fill="black" />
      <path d={art.hingeLine} fill={HINGE_LINE} />
      <path d={art.hinge} fill={url("hinge")} />
      <path d={art.base} fill={url("face")} />
      <path d={art.base} fill={url("ends")} />
      <path d={art.base} fill={url("streak")} />
      <path d={art.scoop} fill={url("floor")} />
      <g clipPath={url("scoop")}>
        <path d={art.walls} fillRule="evenodd" fill={url("wall")} filter={url("soft")} />
      </g>
    </Stage>
  );
});
