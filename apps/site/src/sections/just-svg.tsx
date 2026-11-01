import { Phone, TURN } from "@vectoys/phone";
import type { StyleWithVariables } from "@vinena/vectoys-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Segmented } from "../components/segmented";
import { clamp, useInFocus, useReducedMotion } from "../motion";

const YAW_PER_PIXEL = 0.5;
const PITCH_PER_PIXEL = 0.3;
const PITCH = [-45, 25] as const;
const ZOOMS = [1, 4, 16] as const;
const ZOOM_OPTIONS = ZOOMS.map((value): readonly [(typeof ZOOMS)[number], string] => [value, `${value}×`]);
// How long the paths take to trace, and how far apart they start.
const TRACE_MS = 1400;
const TRACE_STAGGER = 30;

/** Where the zoom closes in, as shares of the scene. */
type Focus = { x: number; y: number };
type Measure = { paths: string[]; bytes: number; gzipped: number | null; focus: Focus };

/** The top corner of the phone's outline nearest the eye's right, wherever it has turned. */
function focusOn(outline: SVGGraphicsElement | null | undefined, scene: number): Focus {
  if (!outline) return { x: 0.5, y: 0.5 };
  const box = outline.getBBox();
  return { x: (box.x + box.width * 0.85) / scene, y: (box.y + box.height * 0.12) / scene };
}

const kilobytes = (bytes: number) => (bytes / 1024).toFixed(1);

async function gzipSize(text: string) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

/** A lock screen with the time, so the glass reads as a phone's. */
const LockScreen = () => (
  <div className="lock">
    <p className="lock-time">9:41</p>
  </div>
);

export function JustSvg() {
  const reduced = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const inFocus = useInFocus(frame);
  const [turn, setTurn] = useState<{ yaw: number; pitch: number }>({ yaw: TURN.yaw, pitch: TURN.pitch });
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [showPaths, setShowPaths] = useState(false);
  const [traced, setTraced] = useState(false);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // The paths show, tracing themselves once, when the phone comes into focus.
  useEffect(() => {
    if (!inFocus) return;
    setShowPaths(true);
    if (reduced) return setTraced(true);
    const done = setTimeout(() => setTraced(true), TRACE_MS + 60 * TRACE_STAGGER);
    return () => clearTimeout(done);
  }, [inFocus, reduced]);

  // Read the drawing back from the page after every turn: its paths, and its markup's size.
  useLayoutEffect(() => {
    const svg = drawing.current?.querySelector("svg");
    if (!svg) return;
    const all = [...svg.querySelectorAll("path")];
    const paths = all.map((path) => path.getAttribute("d") ?? "");
    const markup = svg.outerHTML;
    // The phone draws its outline last.
    const focus = focusOn(all[all.length - 1], svg.viewBox.baseVal.width);
    setMeasure((before) => ({ paths, bytes: new Blob([markup]).size, gzipped: before?.gzipped ?? null, focus }));
    let current = true;
    const later = setTimeout(async () => {
      const gzipped = await gzipSize(markup);
      if (current) setMeasure((before) => before && { ...before, gzipped });
    }, 120);
    return () => {
      current = false;
      clearTimeout(later);
    };
  }, [turn]);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from) return;
    drag.current = { x: event.clientX, y: event.clientY };
    // Zoomed in, the same drag covers less of the phone, so it turns it less.
    const yaw = ((event.clientX - from.x) * YAW_PER_PIXEL) / zoom;
    const pitch = ((event.clientY - from.y) * PITCH_PER_PIXEL) / zoom;
    setTurn((before) => ({ yaw: before.yaw + yaw, pitch: clamp(before.pitch - pitch, ...PITCH) }));
  };
  const up = () => {
    drag.current = null;
  };

  // The drawing grows inside the frame and slides so the focus stays in the middle, without leaving a gap at an edge.
  const offset = (share: number) => clamp(50 - share * zoom * 100, (1 - zoom) * 100, 0);
  const focus = measure?.focus ?? { x: 0.5, y: 0.5 };
  const zoomVariable: StyleWithVariables = { "--zoom": zoom };
  const zoomed: CSSProperties = { width: `${zoom * 100}%`, left: `${offset(focus.x)}%`, top: `${offset(focus.y)}%` };

  return (
    <section className="section split" aria-labelledby="just-svg">
      <div className="section-copy">
        <h2 id="just-svg">It's just SVG</h2>
        <p>
          Every device is projected to flat SVG paths. Drag the phone to turn it: the numbers are read back from this page as it redraws.
        </p>
        <dl className="stats">
          <div>
            <dt>Paths</dt>
            <dd>{measure ? measure.paths.length : " "}</dd>
          </div>
          <div>
            <dt>Kilobytes of markup</dt>
            <dd>{measure ? kilobytes(measure.bytes) : " "}</dd>
          </div>
          <div>
            <dt>Kilobytes gzipped</dt>
            <dd>{measure?.gzipped ? kilobytes(measure.gzipped) : " "}</dd>
          </div>
        </dl>
        <ul className="facts">
          <li>Drawn on the server: view this page's source and the phone is already there as paths.</li>
          <li>Sharp at any zoom, because there are no pixels to stretch.</li>
        </ul>
      </div>
      <div className="xray-wrap">
        <div
          className="xray-frame grab"
          data-replay-block=""
          ref={frame}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={zoomVariable}
        >
          <div className="xray-zoom" style={zoomed} ref={drawing}>
            <Phone yaw={turn.yaw} pitch={turn.pitch}>
              <LockScreen />
            </Phone>
            {showPaths && measure && (
              <svg className={`xray${traced ? " xray-traced" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
                {measure.paths.map((d, index) => (
                  <path key={index} d={d} pathLength={1} style={{ animationDelay: `${index * TRACE_STAGGER}ms` }} />
                ))}
              </svg>
            )}
          </div>
        </div>
        <div className="controls">
          <button type="button" className="toggle" aria-pressed={showPaths} onClick={() => setShowPaths((shown) => !shown)}>
            Show paths
          </button>
          <Segmented label="Zoom" options={ZOOM_OPTIONS} value={zoom} onChange={setZoom} />
        </div>
      </div>
    </section>
  );
}
