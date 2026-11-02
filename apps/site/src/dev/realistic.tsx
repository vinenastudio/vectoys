import { DESK, KICKFLIP, Laptop, type LaptopHandle, type LaptopLook, type TrickPose } from "@vectoys/laptop";
import { scrub } from "@vinena/vectoys";
import { useEffect, useRef, type CSSProperties } from "react";
import { Wallpaper } from "../previews/wallpaper";

// Dev only, at /realistic and never linked or built: each pose's reference
// next to the realistic laptop at that pose and the simple one, on a light
// and a dark page. The references are local files the dev server reads from
// the folder in VECTOYS_REFS, under /refs/; without it their boxes stay empty.

type Reference = { file: string; size: readonly [number, number]; crop: readonly [number, number, number, number]; note: string };
type Row = { id: string; title: string; refs: readonly Reference[]; pose: Partial<TrickPose>; free?: boolean };

const ROWS: readonly Row[] = [
  {
    id: "front",
    title: "Front",
    refs: [{ file: "front-silver.png", size: [2400, 1844], crop: [236, 332, 1930, 1180], note: "Silver, store render" }],
    pose: { flat: 1 },
    free: true,
  },
  {
    id: "three-quarter",
    title: "Three-quarter, open",
    refs: [
      { file: "open-high-silver-photo.jpg", size: [2400, 1800], crop: [300, 220, 1460, 1420], note: "Silver, photo" },
      { file: "three-quarter-open-black-photo.jpg", size: [2400, 1800], crop: [260, 0, 1560, 1320], note: "Space black, photo (shape)" },
    ],
    pose: { yaw: -30, pitch: 24 },
  },
  {
    id: "side",
    title: "Side, open",
    refs: [{ file: "side-open-silver.png", size: [2400, 1844], crop: [1180, 400, 1000, 1000], note: "Silver, store render" }],
    pose: { yaw: 90, flat: 0.7, pitch: 3 },
    free: true,
  },
  {
    id: "low",
    title: "Open, low angle",
    refs: [
      { file: "open-low-silver.jpg", size: [1960, 1103], crop: [200, 150, 1560, 800], note: "Silver, product image, opening" },
      { file: "open-low-black.jpg", size: [1960, 1102], crop: [100, 180, 1760, 760], note: "Space black, product image (shape)" },
    ],
    pose: { pitch: 1, flat: 0.75 },
    free: true,
  },
  {
    id: "underside",
    title: "Underside",
    refs: [{ file: "underside-silver-photo.png", size: [2400, 1285], crop: [400, 80, 1620, 1130], note: "Silver, photo" }],
    pose: { lid: 0, roll: 180, pitch: 80 },
    free: true,
  },
  {
    id: "shut",
    title: "Shut, from above",
    refs: [{ file: "closed-top-silver.png", size: [2400, 1844], crop: [404, 353, 1593, 1140], note: "Silver, store render" }],
    pose: { lid: 0, pitch: 80 },
    free: true,
  },
];

const KICKS = [0, 0.14, 0.3, 0.38, 0.45, 0.52, 0.6, 0.7, 1];

/** A crop of a reference, `crop` as (x, y, width, height) in its pixels. */
function Ref({ file, size: [width, height], crop: [x, y, w, h], note }: Reference) {
  const style: CSSProperties = {
    aspectRatio: `${w} / ${h}`,
    backgroundImage: `url(/refs/${file})`,
    backgroundSize: `${(width / w) * 100}% auto`,
    backgroundPosition: `${(x / (width - w || 1)) * 100}% ${(y / (height - h || 1)) * 100}%`,
  };
  return (
    <figure className="cmp-cell">
      <div className="cmp-ref" style={style} />
      <figcaption>{note}</figcaption>
    </figure>
  );
}

function Device({ row, look, theme }: { row: Row; look: LaptopLook; theme: "light" | "dark" }) {
  return (
    <figure className={`cmp-cell cmp-${theme}`}>
      <div className="cmp-stage">
        <Laptop eye={DESK} look={look} free={row.free ?? false} {...row.pose}>
          <Wallpaper />
        </Laptop>
      </div>
      <figcaption>
        {look === "realistic" ? "Realistic" : "Simple"}, {theme}
      </figcaption>
    </figure>
  );
}

/**
 * Two realistic laptops at a landing page's size for a headless perf run:
 * `window.vectoysPerf.kick(t)` plays KICKFLIP at `t` and `turn(t)` sweeps the
 * lid, yaw and pitch, each through the laptop's handle.
 */
function Perf() {
  const kick = useRef<LaptopHandle>(null);
  const turn = useRef<LaptopHandle>(null);
  const plain = useRef<LaptopHandle>(null);
  useEffect(() => {
    Object.assign(window, {
      vectoysPerf: {
        kick: (t: number) => kick.current?.set(scrub(t, KICKFLIP)),
        plain: (t: number) => plain.current?.set(scrub(t, KICKFLIP)),
        turn: (t: number) => turn.current?.set({ lid: Math.min(1, t * 3), yaw: -35 + 70 * t, pitch: 5 + 25 * Math.abs(Math.sin(t * Math.PI)) }),
      },
    });
  }, []);
  return (
    <section id="perf" className="cmp-row">
      <h2>Perf</h2>
      <div className="cmp-perf cmp-light">
        <div className="cmp-stage">
          <Laptop eye={DESK} look="realistic" free {...scrub(0, KICKFLIP)} ref={kick}>
            <Wallpaper />
          </Laptop>
        </div>
        <div className="cmp-stage">
          <Laptop eye={DESK} look="realistic" turning lid={0} ref={turn}>
            <Wallpaper />
          </Laptop>
        </div>
        <div className="cmp-stage">
          <Laptop eye={DESK} free {...scrub(0, KICKFLIP)} ref={plain}>
            <Wallpaper />
          </Laptop>
        </div>
      </div>
    </section>
  );
}

export function Realistic() {
  return (
    <main className="cmp">
      <style>{STYLE}</style>
      <h1>Realistic laptop, side by side</h1>
      {ROWS.map((row) => (
        <section key={row.id} id={row.id} className="cmp-row">
          <h2>{row.title}</h2>
          <div className="cmp-grid" style={{ gridTemplateColumns: `repeat(${row.refs.length + 4}, minmax(0, 1fr))` }}>
            {row.refs.map((ref) => (
              <Ref key={ref.file} {...ref} />
            ))}
            <Device row={row} look="realistic" theme="light" />
            <Device row={row} look="realistic" theme="dark" />
            <Device row={row} look="simple" theme="light" />
            <Device row={row} look="simple" theme="dark" />
          </div>
        </section>
      ))}
      {(["light", "dark"] as const).map((theme) => (
        <section key={theme} id={`kickflip-${theme}`} className="cmp-row">
          <h2>Kickflip, realistic, {theme}</h2>
          <div className={`cmp-strip cmp-${theme}`}>
            {KICKS.map((t) => (
              <figure key={t} className="cmp-cell">
                <div className="cmp-stage">
                  <Laptop eye={DESK} look="realistic" free {...scrub(t, KICKFLIP)}>
                    <Wallpaper />
                  </Laptop>
                </div>
                <figcaption>{t}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <Perf />
    </main>
  );
}

const STYLE = `
.cmp { padding: 24px 16px 64px; max-width: 2000px; margin: 0 auto; }
.cmp h1 { font: 500 28px var(--display); margin: 0 0 24px; }
.cmp h2 { font: 500 18px var(--display); margin: 0 0 12px; }
.cmp-row { margin-bottom: 40px; }
.cmp-grid { display: grid; gap: 12px; align-items: stretch; }
.cmp-strip { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 8px; padding: 12px; border-radius: 12px; background: var(--vectoys-bg); }
.cmp-cell { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cmp-cell figcaption { font-size: 13px; color: var(--muted); text-align: center; }
.cmp-ref { border-radius: 12px; background-color: #f2f2f2; background-repeat: no-repeat; }
.cmp-shot { flex: 1; min-height: 200px; border-radius: 12px; background: var(--vectoys-bg, #f2f2f2) center / contain no-repeat; }
.cmp-stage { flex: 1; display: grid; place-items: center; padding: 18% 8%; border-radius: 12px; background: var(--vectoys-bg); overflow: hidden; }
.cmp-stage > * { width: 100%; }
.cmp-light { --vectoys-bg: #f3f4f6; --vectoys-surface: #f5f6f8; --vectoys-hairline: #8a8e96; --vectoys-border: #d2d5db; --vectoys-shadow: rgba(10, 14, 22, 0.1); }
.cmp-dark { --vectoys-bg: #0f1114; --vectoys-surface: #3a3e46; --vectoys-hairline: #6c717c; --vectoys-border: #4b505a; --vectoys-shadow: rgba(0, 0, 0, 0.55); }
.cmp-perf { display: grid; grid-template-columns: repeat(3, 720px); gap: 12px; }
.cmp-dark figcaption { color: #959baa; }
`;

// Dev only, at /realistic/polish: for each pose of a polish round, the
// references, the realistic laptop as it was before the round (captures in
// the polish folder under VECTOYS_REFS, at /refs/polish/before/) and as it
// is now, live, on a light and a dark page.
type Shot = { id: string; title: string; refs: readonly string[]; pose: Partial<TrickPose>; free?: boolean; kick?: number };

const SHOTS: readonly Shot[] = [
  { id: "front", title: "Front, flat 1", refs: ["front-silver-render"], pose: { flat: 1 }, free: true },
  { id: "tq", title: "Three-quarter, open: yaw -25, pitch 15", refs: ["tq-black-photo-mirrored"], pose: { yaw: -25, pitch: 15 } },
  { id: "high", title: "High front: pitch 30", refs: ["high-silver-photo"], pose: { pitch: 30 } },
  { id: "lowside", title: "Low side: yaw 50, pitch 5, lid 0.6", refs: ["lowside-silver-render"], pose: { yaw: 50, pitch: 5, lid: 0.6 }, free: true },
  { id: "open", title: "Open, from the side: yaw 90, pitch 3", refs: ["open-silver-render"], pose: { yaw: 90, pitch: 3 }, free: true },
  { id: "shut", title: "Shut: yaw -20, pitch 30", refs: ["shut-black-photo", "shut-silver-top-render"], pose: { lid: 0, yaw: -20, pitch: 30 } },
  { id: "under", title: "Underside, mid-flip: KICKFLIP at 0.49", refs: ["under-silver-photo"], pose: {}, free: true, kick: 0.49 },
];

function Shown({ src, note, theme }: { src: string; note: string; theme?: "light" | "dark" }) {
  return (
    <figure className={`cmp-cell${theme ? ` cmp-${theme}` : ""}`}>
      <div className="cmp-shot" style={{ backgroundImage: `url(${src})` }} />
      <figcaption>{note}</figcaption>
    </figure>
  );
}

export function Polish() {
  return (
    <main className="cmp">
      <style>{STYLE}</style>
      <h1>Realistic laptop, polish round: reference, before, after</h1>
      {SHOTS.map((shot) => (
        <section key={shot.id} id={shot.id} className="cmp-row">
          <h2>{shot.title}</h2>
          <div className="cmp-grid" style={{ gridTemplateColumns: `repeat(${shot.refs.length + 4}, minmax(0, 1fr))` }}>
            {shot.refs.map((ref) => (
              <Shown key={ref} src={`/refs/polish/refs/${ref}.png`} note={`Reference: ${ref.replace(/^[a-z]+-/, "").replaceAll("-", " ")}`} />
            ))}
            {(["light", "dark"] as const).map((theme) => (
              <Shown key={theme} src={`/refs/polish/before/${shot.id}-${theme}.png`} note={`Before, ${theme}`} theme={theme} />
            ))}
            {(["light", "dark"] as const).map((theme) => (
              <figure key={theme} className={`cmp-cell cmp-${theme}`}>
                <div className="cmp-stage">
                  <Laptop eye={DESK} look="realistic" free={shot.free ?? false} {...(shot.kick === undefined ? shot.pose : scrub(shot.kick, KICKFLIP))}>
                    <Wallpaper />
                  </Laptop>
                </div>
                <figcaption>After, {theme}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
