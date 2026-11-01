import { DESK, Laptop, type LaptopHandle } from "@vectoys/laptop";
import { clamp, scrub } from "@vinena/vectoys";
import { useScrub } from "@vinena/vectoys-react";
import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "../motion";

// How many screens tall the track is, so how long the scene stays pinned.
const SCREENS = 4;

/*
 * The scene along the scroll, from 0 to 1: the laptop shut and seen from
 * high, the lid opening as the eye comes down, a glide to the left turning to
 * face the words on the right, across to the right turning to face the words
 * on the left, and back to the middle, front on. `x` is the glide, -1 to 1.
 */
const KEYS = [
  { at: 0, lid: 0, yaw: 0, pitch: 24, x: 0 },
  { at: 0.16, lid: 1, pitch: 15 },
  { at: 0.22 },
  { at: 0.36, yaw: 20, x: -1 },
  { at: 0.5 },
  { at: 0.66, yaw: -20, x: 1 },
  { at: 0.78 },
  { at: 0.92, yaw: 0, x: 0, pitch: 12 },
];
const START = scrub(0, KEYS);

/** Each chapter's words, the side they stand on and the stretch of the scroll they show for. */
const CHAPTERS = [
  {
    side: "right",
    from: 0.3,
    to: 0.52,
    title: "The scroll drives it",
    text: "One number from the scroll sets the lid, the turn and the eye's height on every frame, with no React render.",
  },
  {
    side: "left",
    from: 0.6,
    to: 0.8,
    title: "The screen stays live",
    text: "The display is plain HTML laid onto the glass. The counter and the list on it fill as you scroll.",
  },
] as const;

// How long a chapter takes to fade in and out, as a share of the scroll.
const FADE = 0.04;

/** The steps the list on the display ticks off, and where along the scroll each is done. */
const STEPS = [
  ["Open the lid", 0.16],
  ["Glide to the left", 0.36],
  ["Glide to the right", 0.66],
  ["Face the front", 0.92],
] as const;

/**
 * What the display shows: how far the scroll is and the steps done so far.
 * Pinned, the scroll fills them in through the refs; as a still frame it is
 * all done.
 */
function Display({ percent, steps }: { percent?: RefObject<HTMLSpanElement | null>; steps?: RefObject<HTMLOListElement | null> }) {
  const done = !percent;
  return (
    <div className="scrub-screen">
      <p className="scrub-screen-label">Scrolled</p>
      <p className="scrub-screen-count">
        <span ref={percent}>{done ? 100 : 0}</span>%
      </p>
      <ol ref={steps} className="scrub-screen-steps">
        {STEPS.map(([step]) => (
          <li key={step} data-done={done ? "" : undefined}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The scene pinned while the page scrolls past it, every frame written from the scroll. */
function Pinned() {
  const track = useRef<HTMLDivElement>(null);
  const glide = useRef<HTMLDivElement>(null);
  const laptop = useRef<LaptopHandle>(null);
  const percent = useRef<HTMLSpanElement>(null);
  const steps = useRef<HTMLOListElement>(null);
  const chapters = useRef<(HTMLDivElement | null)[]>([]);
  const { progress } = useScrub(track, { screens: SCREENS });

  useEffect(() => {
    // How far the glide goes, a share of the stage's width: none on a narrow
    // page, where the words sit under the laptop.
    let reach = 0;
    const measure = () => {
      const box = glide.current;
      reach = box && matchMedia("(min-width: 900px)").matches ? box.offsetWidth * 0.34 : 0;
    };
    const draw = (t: number) => {
      const { lid, yaw, pitch, x } = scrub(t, KEYS);
      laptop.current?.set({ lid, yaw, pitch });
      if (glide.current) glide.current.style.transform = `translateX(${(x * reach).toFixed(1)}px)`;
      if (percent.current) percent.current.textContent = String(Math.round(t * 100));
      steps.current?.querySelectorAll("li").forEach((step, index) => step.toggleAttribute("data-done", t >= (STEPS[index]?.[1] ?? 1)));
      CHAPTERS.forEach(({ from, to }, index) => {
        const words = chapters.current[index];
        if (words) words.style.opacity = String(clamp((t - from) / FADE, 0, 1) * clamp((to - t) / FADE, 0, 1));
      });
    };
    const resized = () => {
      measure();
      draw(progress.get());
    };
    resized();
    addEventListener("resize", resized, { passive: true });
    const stop = progress.subscribe(draw);
    return () => {
      stop();
      removeEventListener("resize", resized);
    };
  }, [progress]);

  return (
    <div className="scrub-track" ref={track} style={{ height: `${SCREENS * 100}vh` }}>
      <div className="scrub-pin" data-replay-block="">
        <div className="scrub-glide" ref={glide}>
          <Laptop eye={DESK} look="realistic" turning lid={START.lid} yaw={START.yaw} pitch={START.pitch} ref={laptop} label="A laptop that opens and turns as the page scrolls">
            <Display percent={percent} steps={steps} />
          </Laptop>
        </div>
        {CHAPTERS.map((chapter, index) => (
          <div
            key={chapter.title}
            className={`scrub-chapter scrub-chapter-${chapter.side}`}
            ref={(words) => {
              chapters.current[index] = words;
            }}
          >
            <h3>{chapter.title}</h3>
            <p>{chapter.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** With reduced motion: the scene's poses as still frames, in the page's flow. */
function Frames() {
  return (
    <div className="scrub-frames">
      {CHAPTERS.map((chapter) => (
        <div key={chapter.title} className="scrub-frame">
          <Laptop eye={DESK} look="realistic" turning lid={1} yaw={chapter.side === "right" ? 20 : -20} label="A laptop turned toward the words beside it">
            <Display />
          </Laptop>
          <div className="scrub-chapter">
            <h3>{chapter.title}</h3>
            <p>{chapter.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Scrub() {
  const reduced = useReducedMotion();
  return (
    <section className="section" id="scrub" aria-labelledby="scrub-title">
      <div className="section-copy section-copy-wide">
        <h2 id="scrub-title">Scrub it with the scroll</h2>
        <p>
          The laptop takes a lid, a turn and a pitch, and a handle that sets all three without a render. With <code>useScrub</code> and{" "}
          <code>scrub</code>, a pinned scene follows the scroll.
        </p>
      </div>
      {reduced ? <Frames /> : <Pinned />}
    </section>
  );
}
